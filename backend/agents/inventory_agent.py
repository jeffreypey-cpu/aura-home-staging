import anthropic
import os
import json
import logging
import base64
import random
from pathlib import Path
from agents.base_system_prompt import AURA_SYSTEM_PROMPT

logger = logging.getLogger(__name__)
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

CATEGORIES = [
    "Sofa", "Chair", "Table", "Bed", "Dresser", "Lamp",
    "Art", "Rug", "Mirror", "Curtain", "Pillow", "Throw",
    "Side Table", "Coffee Table", "Dining Table", "Bookshelf",
    "Desk", "Bench", "Ottoman", "Decor", "Plant", "Other"
]


def generate_sku(category: str, item_name: str, existing_skus: list) -> str:
    """Generate a unique SKU in format AHS-{CAT}-{4digit}."""
    code = category[:3].upper() if category else "OTH"
    for _ in range(100):
        number = random.randint(0, 9999)
        sku = f"AHS-{code}-{number:04d}"
        if sku not in existing_skus:
            return sku
    # Fallback: append extra digit
    return f"AHS-{code}-{random.randint(10000, 99999)}"


def analyze_inventory_image(image_data: bytes, mime_type: str) -> dict:
    """Use Claude vision to identify a furniture/decor item in an image."""
    categories_str = ", ".join(CATEGORIES)
    try:
        image_b64 = base64.standard_b64encode(image_data).decode("utf-8")
        response = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=1000,
            system=AURA_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": mime_type,
                                "data": image_b64,
                            },
                        },
                        {
                            "type": "text",
                            "text": (
                                "You are Heather, inventory specialist for Aura Home Staging. "
                                "Analyze this image and identify the furniture or decor item. "
                                "Return JSON only with these fields: "
                                "item_name (string: specific descriptive name e.g. 'Grey Linen Sectional Sofa'), "
                                f"category (string: must be one of: {categories_str}), "
                                "description (string: brief description including color, material, style), "
                                "condition (string: excellent/good/fair based on what you can see), "
                                "estimated_value (number: estimated USD retail value), "
                                "confidence (string: high/medium/low)"
                            ),
                        },
                    ],
                }
            ],
        )

        raw = response.content[0].text.strip()
        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()
        result = json.loads(raw)

        # Ensure category is valid
        if result.get("category") not in CATEGORIES:
            result["category"] = "Other"

        logger.info(f"AI identified item: {result.get('item_name')} (confidence: {result.get('confidence')})")
        return result

    except Exception as e:
        logger.error(f"Image analysis failed: {e}")
        return {
            "item_name": "Unknown Item",
            "category": "Other",
            "description": "",
            "condition": "good",
            "estimated_value": None,
            "confidence": "low",
        }


def process_inventory_item(image_data: bytes, mime_type: str, existing_skus: list) -> dict:
    """Analyze image and generate SKU. Returns full item dict for review."""
    analysis = analyze_inventory_image(image_data, mime_type)
    sku = generate_sku(analysis.get("category", "Other"), analysis.get("item_name", ""), existing_skus)

    return {
        "item_name": analysis.get("item_name", "Unknown Item"),
        "category": analysis.get("category", "Other"),
        "description": analysis.get("description", ""),
        "condition": analysis.get("condition", "good"),
        "estimated_value": analysis.get("estimated_value"),
        "confidence": analysis.get("confidence", "low"),
        "sku": sku,
        "requires_approval": True,
        "action_type": "inventory_add",
        "heather_note": "I've identified this item and generated a SKU. Please review and confirm to add it to inventory.",
    }
