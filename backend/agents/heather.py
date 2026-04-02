import anthropic
import os
import json
import logging
from agents.base_system_prompt import AURA_SYSTEM_PROMPT
from agents.intake_parser import parse_intake_message, validate_intake
from agents.property_enricher import enrich_property
from agents.contract_drafter import draft_contract_summary, format_contract_approval_message
from agents.followup_drafter import draft_completion_emails
from agents.inventory_agent import process_inventory_item

logger = logging.getLogger(__name__)
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

HEATHER_SYSTEM_PROMPT = """
You are Heather, the AI operations manager for Aura Home Staging.
You are professional, warm, and efficient.
You manage all operations including client intake, contracts, inventory, and follow-ups.
You communicate on behalf of Aura Home Staging via WhatsApp.
You always prepare everything for Tran's approval before sending anything.
You never send, sign, or commit to anything without Tran's explicit approval.
Owner name: Tran. Company: Aura Home Staging.
Warehouse: 3857 Breakwater Ave, Hayward, CA.
WhatsApp is the primary communication channel.
Always respond in a professional, luxury brand tone.
Keep messages concise, clear, and action-oriented.
"""


def heather_respond(message: str, context: dict = {}) -> dict:
    """Heather responds to a message, optionally with project/task context."""
    context_str = ""
    if context:
        context_str = f"\n\nContext:\n{json.dumps(context, indent=2)}"

    try:
        response = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=1500,
            system=HEATHER_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": message + context_str,
                }
            ],
        )
        text = response.content[0].text.strip()

        # Try to parse JSON response, otherwise wrap in plain response
        try:
            result = json.loads(text)
        except (json.JSONDecodeError, ValueError):
            result = {
                "response": text,
                "action_type": "chat",
                "requires_approval": False,
                "suggested_actions": [],
            }

        if "response" not in result:
            result["response"] = text
        result.setdefault("action_type", "chat")
        result.setdefault("requires_approval", False)
        result.setdefault("suggested_actions", [])
        return result

    except Exception as e:
        logger.error(f"Heather respond failed: {e}")
        return {
            "response": "I'm having trouble processing that right now. Please try again.",
            "action_type": "error",
            "requires_approval": False,
            "suggested_actions": [],
        }


def heather_route_task(task_type: str, data: dict) -> dict:
    """Route a task to the appropriate sub-agent and wrap with Heather context."""
    try:
        if task_type == "intake":
            result = parse_intake_message(data.get("message", ""))
            heather_summary = f"I've parsed the intake message for {result.get('client_name', 'the client')}. Please review the extracted details."

        elif task_type == "validate_intake":
            result = validate_intake(data)
            heather_summary = "I've validated the intake data. " + (
                "All required fields are present." if result.get("is_valid")
                else f"Missing fields: {', '.join(result.get('missing_fields', []))}"
            )

        elif task_type == "enrich":
            result = enrich_property(data.get("address", ""), data.get("client_name", ""))
            heather_summary = f"I've looked up property details for {data.get('address', 'the address')} with {result.get('confidence', 'low')} confidence."

        elif task_type == "contract":
            result = draft_contract_summary(data)
            heather_summary = f"I've drafted the contract for {data.get('client_name', 'the client')}. Ready for your review and approval."

        elif task_type == "followup":
            result = draft_completion_emails(data)
            heather_summary = f"I've drafted 4 follow-up emails for {data.get('client_name', 'the client')}. Please review before I send them."

        elif task_type == "inventory":
            image_data = data.get("image_data", b"")
            mime_type = data.get("mime_type", "image/jpeg")
            existing_skus = data.get("existing_skus", [])
            result = process_inventory_item(image_data, mime_type, existing_skus)
            heather_summary = f"I've identified this item as '{result.get('item_name')}' with {result.get('confidence', 'low')} confidence. SKU {result.get('sku')} has been generated."

        else:
            result = {"error": f"Unknown task type: {task_type}"}
            heather_summary = f"I don't know how to handle task type '{task_type}'."

        return {**result, "heather_summary": heather_summary, "task_type": task_type}

    except Exception as e:
        logger.error(f"Heather route task failed ({task_type}): {e}")
        return {
            "error": str(e),
            "heather_summary": "I encountered an error processing this task.",
            "task_type": task_type,
        }


def heather_whatsapp_message(event_type: str, data: dict) -> str:
    """Generate a WhatsApp message for a given event type."""
    templates = {
        "new_inventory": (
            "Hi Tran! I've added a new item to inventory:\n"
            "{item_name}\n"
            "SKU: {sku}\n"
            "Category: {category}\n"
            "Condition: {condition}\n"
            "Est. Value: ${estimated_value}\n\n"
            "QR label is ready to print."
        ),
        "new_project": (
            "New project added:\n"
            "Client: {client_name}\n"
            "Address: {property_address}\n"
            "Price: ${contract_price}\n"
            "Staging: {staging_date}\n\n"
            "Contract draft is ready for your review."
        ),
        "ending_soon": (
            "Reminder: Staging ending soon\n"
            "Client: {client_name}\n"
            "Address: {property_address}\n"
            "Days remaining: {days_remaining}\n\n"
            "Would you like to send a follow-up or request extension?"
        ),
        "contract_ready": (
            "Contract ready for review:\n"
            "Client: {client_name}\n"
            "${contract_price}\n\n"
            "Reply APPROVE to send DocuSign."
        ),
        "invoice_ready": (
            "Invoice ready:\n"
            "Client: {client_name}\n"
            "${contract_price} via Zelle\n\n"
            "Reply APPROVE to send."
        ),
        "employee_clockin_link": (
            "Hi {employee_name}! Here is your clock-in link for today:\n"
            "{clockin_url}\n\n"
            "Tap the link to clock in when you arrive on site.\n"
            "— Aura Home Staging"
        ),
        "employee_clockin_alert": (
            "Clock-in alert:\n"
            "{employee_name} clocked in\n"
            "Time: {clockin_time}\n"
            "Project: {project_address}\n\n"
            "No action needed."
        ),
        "employee_clockout_alert": (
            "Clock-out alert:\n"
            "{employee_name} clocked out\n"
            "Time: {clockout_time}\n"
            "Total hours: {total_hours}\n"
            "Project: {project_address}\n\n"
            "No action needed."
        ),
        "employee_late_alert": (
            "Late alert:\n"
            "{employee_name} has not clocked in\n"
            "Expected: {expected_time}\n"
            "Project: {project_address}\n\n"
            "Would you like me to send them a reminder?"
        ),
    }

    template = templates.get(event_type, "Notification from Aura Home Staging: {event_type}")
    try:
        return template.format(**data, event_type=event_type)
    except KeyError as e:
        logger.warning(f"Missing key in whatsapp template: {e}")
        return template.format_map({**data, event_type: event_type, **{str(e).strip("'"): "N/A"}})
