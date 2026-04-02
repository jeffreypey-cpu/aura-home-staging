from fastapi import APIRouter
from services.supabase_client import supabase
from datetime import date, timedelta
import logging

router = APIRouter(prefix="/api/notifications", tags=["notifications"])
logger = logging.getLogger(__name__)

PRIORITY_ORDER = {"urgent": 0, "high": 1, "medium": 2, "low": 3}


@router.get("/")
async def get_notifications():
    result = (
        supabase.table("projects")
        .select("*")
        .eq("project_status", "active")
        .execute()
    )
    projects = result.data or []
    today = date.today()
    notifications = []

    for p in projects:
        pid = p.get("id")
        client = p.get("client_name", "")
        address = p.get("property_address", "")

        staging_date = None
        if p.get("staging_date"):
            try:
                staging_date = date.fromisoformat(p["staging_date"])
            except ValueError:
                pass

        end_date = None
        days_remaining = None
        if p.get("final_day_of_service"):
            try:
                end_date = date.fromisoformat(p["final_day_of_service"])
                days_remaining = (end_date - today).days
            except ValueError:
                pass

        base = {"project_id": pid, "client_name": client, "property_address": address, "days_remaining": days_remaining}

        # Staging starts today or tomorrow
        if staging_date and 0 <= (staging_date - today).days <= 1:
            notifications.append({**base, "type": "staging_start", "priority": "urgent",
                "message": f"Staging starts tomorrow — {client}"})

        # Ending in 0–3 days
        if days_remaining is not None and 0 <= days_remaining <= 3:
            notifications.append({**base, "type": "ending_urgent", "priority": "urgent",
                "message": f"Ending in {days_remaining} days — {client} at {address}"})
        elif days_remaining is not None and 4 <= days_remaining <= 7:
            notifications.append({**base, "type": "ending_soon", "priority": "high",
                "message": f"Ending soon — {client}"})
        elif days_remaining is not None and 8 <= days_remaining <= 14:
            notifications.append({**base, "type": "ending_approaching", "priority": "medium",
                "message": f"Approaching end — {client}"})

        # Contract not sent, staging within 7 days
        if (p.get("contract_status") == "draft" and staging_date is not None
                and 0 <= (staging_date - today).days <= 7):
            notifications.append({**base, "type": "contract_pending", "priority": "high",
                "message": f"Contract not sent — {client}"})

        # DocuSign awaiting
        if p.get("docusign_status") == "sent":
            notifications.append({**base, "type": "docusign_pending", "priority": "medium",
                "message": f"Awaiting DocuSign signature — {client}"})

        # Invoice not sent, contract sent
        if p.get("invoice_status") == "draft" and p.get("contract_status") == "sent":
            notifications.append({**base, "type": "invoice_pending", "priority": "medium",
                "message": f"Invoice not sent — {client}"})

    notifications.sort(key=lambda n: PRIORITY_ORDER.get(n["priority"], 99))
    logger.info(f"Generated {len(notifications)} notifications")
    return notifications
