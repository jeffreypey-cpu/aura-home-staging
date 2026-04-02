import anthropic
import os
import json
import logging

from agents.base_system_prompt import AURA_SYSTEM_PROMPT

logger = logging.getLogger(__name__)
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def enrich_property(address: str, client_name: str) -> dict:
    """Given a property address, use Claude to estimate or look up property details."""
    user_message = f"""Acting as Heather, AI operations manager for Aura Home Staging:\n\nAct as a real estate data assistant.

Given the following property address, estimate the property details needed for a staging agreement.
Return JSON only with these fields:
- sqft (integer or null)
- bedrooms (integer or null)
- bathrooms (float or null)
- confidence ("low", "medium", or "high")
- notes (brief note about the estimate)
- requires_approval (true)
- action_type ("property_enrichment")

Be honest if data cannot be confirmed — use "low" confidence and note that the owner should verify.

Client: {client_name}
Address: {address}"""

    try:
        response = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=1000,
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
        logger.error("Property enrichment failed: %s", e)
        return {
            "error": "Property enrichment failed",
            "address": address,
            "requires_approval": True,
            "confidence": "low",
        }


def format_property_summary(enriched: dict, client_name: str, address: str) -> str:
    """Format enriched property data into a clean approval message for Tran."""
    return (
        f"Property Lookup Complete — Pending Your Review\n\n"
        f"Client: {client_name}\n"
        f"Address: {address}\n"
        f"Bedrooms: {enriched.get('bedrooms')}\n"
        f"Bathrooms: {enriched.get('bathrooms')}\n"
        f"Sqft: {enriched.get('sqft')}\n"
        f"Confidence: {enriched.get('confidence')}\n"
        f"Notes: {enriched.get('notes')}\n\n"
        f"Reply APPROVE to proceed with contract generation."
    )
