import anthropic
import os
import json
import logging

from agents.base_system_prompt import AURA_SYSTEM_PROMPT

logger = logging.getLogger(__name__)
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def draft_completion_emails(project: dict) -> dict:
    """After a staging job is marked complete, generate 4 follow-up email drafts."""
    user_message = f"""Draft 4 professional follow-up emails on behalf of Tran at Aura Home Staging.
Tone: warm, professional, grateful. Return JSON only with this exact structure:

{{
  "action_type": "followup_draft",
  "requires_approval": true,
  "emails": {{
    "thank_you": {{
      "subject": "...",
      "body": "..."
    }},
    "seven_day_followup": {{
      "subject": "...",
      "body": "..."
    }},
    "feedback_request": {{
      "subject": "...",
      "body": "..."
    }},
    "review_request": {{
      "subject": "...",
      "body": "..."
    }}
  }}
}}

Email guidelines:
- thank_you: Sent immediately after job completion. Thank the client, mention the property address, express excitement about the results.
- seven_day_followup: Sent 7 days later. Check in on how showings are going, offer to help with anything, keep it brief.
- feedback_request: Ask for honest feedback on the staging experience. Mention it helps Aura improve.
- review_request: Kindly ask for a Google review. Keep it short and easy. Include placeholder [GOOGLE_REVIEW_LINK].

Project data:
{json.dumps(project, indent=2)}"""

    try:
        response = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=2500,
            system=AURA_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
        raw_text = response.content[0].text.strip()
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
            raw_text = raw_text.strip()
        return json.loads(raw_text)
    except Exception as e:
        logger.error("Follow-up draft failed: %s", e)
        return {
            "error": "Follow-up draft failed",
            "requires_approval": True,
        }


def format_followup_approval_message(emails: dict, client_name: str) -> str:
    """Format the 4 email drafts into a clean approval card for the dashboard."""
    email_data = emails.get("emails", {})

    def preview(key: str) -> tuple[str, str]:
        entry = email_data.get(key, {})
        subject = entry.get("subject", "")
        body = entry.get("body", "")
        return subject, body[:100]

    ty_subject, ty_preview = preview("thank_you")
    sd_subject, sd_preview = preview("seven_day_followup")
    fb_subject, fb_preview = preview("feedback_request")
    rv_subject, rv_preview = preview("review_request")

    return (
        f"4 Follow-Up Emails Ready for Review — Client: {client_name}\n\n"
        f"1. Thank You\n"
        f"   Subject: {ty_subject}\n"
        f"   Preview: {ty_preview}...\n\n"
        f"2. 7-Day Follow-Up\n"
        f"   Subject: {sd_subject}\n"
        f"   Preview: {sd_preview}...\n\n"
        f"3. Feedback Request\n"
        f"   Subject: {fb_subject}\n"
        f"   Preview: {fb_preview}...\n\n"
        f"4. Review Request\n"
        f"   Subject: {rv_subject}\n"
        f"   Preview: {rv_preview}...\n\n"
        f"Actions: APPROVE ALL | APPROVE INDIVIDUALLY | EDIT | HOLD"
    )
