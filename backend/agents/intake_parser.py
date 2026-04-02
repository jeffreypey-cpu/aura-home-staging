import anthropic
import os
import json
import logging

from agents.base_system_prompt import AURA_SYSTEM_PROMPT

logger = logging.getLogger(__name__)
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def parse_intake_message(raw_message: str) -> dict:
    """Parse a raw WhatsApp or form message and extract client intake fields."""
    user_message = f"""Acting as Heather, AI operations manager for Aura Home Staging:

Parse the following client intake message and return JSON only, no extra text.

Extract these fields:
- client_name
- client_phone
- client_email
- property_address
- contract_price
- staging_date

Set null for any missing fields. Include a missing_fields list with the names of any null fields.
Set requires_approval to true.

Input message:
{raw_message}"""

    try:
        response = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=1000,
            system=AURA_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
        raw_text = response.content[0].text.strip()
        # Strip markdown code fences if present
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
            raw_text = raw_text.strip()
        return json.loads(raw_text)
    except json.JSONDecodeError as e:
        logger.error("Failed to parse intake JSON: %s", e)
        return {
            "error": "Failed to parse intake message",
            "raw_response": raw_text if "raw_text" in dir() else "",
            "requires_approval": True,
        }


def validate_intake(data: dict) -> dict:
    """Check which required fields are missing from parsed intake data."""
    required_fields = [
        "client_name",
        "client_phone",
        "client_email",
        "property_address",
        "contract_price",
        "staging_date",
    ]
    missing = [f for f in required_fields if not data.get(f)]
    return {
        "is_valid": len(missing) == 0,
        "missing_fields": missing,
        "data": data,
    }
