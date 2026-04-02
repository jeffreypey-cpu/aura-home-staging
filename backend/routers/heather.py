from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from agents.heather import heather_respond, heather_route_task, heather_whatsapp_message
from services.supabase_client import supabase
import logging

router = APIRouter(prefix="/api/heather", tags=["heather"])
logger = logging.getLogger(__name__)


class HeatherMessage(BaseModel):
    message: str
    context: Optional[dict] = {}


class HeatherTask(BaseModel):
    task_type: str
    data: dict
    project_id: Optional[str] = None


class HeatherNotify(BaseModel):
    event_type: str
    data: dict
    project_id: Optional[str] = None


CAPABILITIES = [
    "intake", "validate_intake", "enrich", "contract",
    "followup", "inventory", "chat", "notify",
]


@router.post("/chat")
async def heather_chat(body: HeatherMessage):
    result = heather_respond(body.message, body.context or {})

    if result.get("requires_approval"):
        try:
            supabase.table("approval_queue").insert({
                "action_type": result.get("action_type", "heather_chat"),
                "action_payload": {"message": body.message, "response": result.get("response"), "context": body.context},
                "status": "pending",
                "approval_message": result.get("response", ""),
            }).execute()
        except Exception as e:
            logger.warning(f"Could not queue approval: {e}")

    return result


@router.post("/task")
async def heather_task(body: HeatherTask):
    result = heather_route_task(body.task_type, body.data)

    if result.get("requires_approval") and body.project_id:
        try:
            supabase.table("approval_queue").insert({
                "project_id": body.project_id,
                "action_type": result.get("action_type", body.task_type),
                "action_payload": result,
                "status": "pending",
                "approval_message": result.get("heather_summary", ""),
            }).execute()
        except Exception as e:
            logger.warning(f"Could not queue approval: {e}")

    return result


@router.post("/notify")
async def heather_notify(body: HeatherNotify):
    message = heather_whatsapp_message(body.event_type, body.data)

    queue_result = supabase.table("approval_queue").insert({
        "project_id": body.project_id,
        "action_type": "whatsapp_send",
        "action_payload": {
            "event_type": body.event_type,
            "message": message,
            "data": body.data,
        },
        "status": "pending",
        "approval_message": f"WhatsApp message ready to send:\n\n{message}",
    }).execute()

    approval_id = queue_result.data[0]["id"] if queue_result.data else None
    return {"message_preview": message, "approval_queue_id": approval_id, "status": "pending_approval"}


@router.get("/status")
async def heather_status():
    return {
        "agent": "Heather",
        "status": "online",
        "version": "1.0",
        "capabilities": CAPABILITIES,
    }
