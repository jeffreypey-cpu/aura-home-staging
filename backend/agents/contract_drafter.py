import anthropic
import os
import json
import logging
from datetime import datetime

from agents.base_system_prompt import AURA_SYSTEM_PROMPT

logger = logging.getLogger(__name__)
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def draft_contract_summary(project: dict) -> dict:
    """Review project data, flag missing fields, and return a structured contract summary."""
    user_message = f"""Acting as Heather, AI operations manager for Aura Home Staging:

Review the following project data and prepare a contract summary.

Identify any fields that are missing or incomplete. Return JSON only with these fields:
- client_name (string)
- client_email (string)
- client_phone (string)
- property_address (string)
- contract_price (string formatted as dollar amount, e.g. "$5,000")
- staging_date (string formatted as Month DD, YYYY)
- sqft (string)
- bedrooms (string)
- bathrooms (string)
- agreement_date (string: today's date formatted as Month DD, YYYY)
- missing_fields (list)
- requires_approval (true)
- action_type ("contract_draft")
- notes (string: any flags or issues you notice)

Project data:
{json.dumps(project, indent=2)}"""

    try:
        response = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=1500,
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
        logger.error("Contract draft failed: %s", e)
        return {
            "error": "Contract draft failed",
            "requires_approval": True,
        }


def format_contract_approval_message(contract_data: dict) -> str:
    """Format the contract draft into the approval card Tran sees in the dashboard."""
    missing = contract_data.get("missing_fields") or []
    missing_display = ", ".join(missing) if missing else "None"
    return (
        f"New Contract Ready for Your Review\n\n"
        f"Client: {contract_data.get('client_name')}\n"
        f"Address: {contract_data.get('property_address')}\n"
        f"Price: {contract_data.get('contract_price')}\n"
        f"Beds / Baths / Sqft: {contract_data.get('bedrooms')} / {contract_data.get('bathrooms')} / {contract_data.get('sqft')}\n"
        f"Staging Date: {contract_data.get('staging_date')}\n"
        f"Agreement Date: {contract_data.get('agreement_date')}\n\n"
        f"Missing Fields: {missing_display}\n"
        f"Notes: {contract_data.get('notes')}\n\n"
        f"Actions: APPROVE to send DocuSign | EDIT | HOLD"
    )
