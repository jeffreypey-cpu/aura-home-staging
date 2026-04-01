import logging

from fastapi import APIRouter, HTTPException

from agents.contract_drafter import draft_contract_summary, format_contract_approval_message
from services.supabase_client import supabase

router = APIRouter(prefix="/api/contracts", tags=["contracts"])
logger = logging.getLogger(__name__)


@router.post("/generate/{project_id}")
async def generate_contract(project_id: str):
    """Draft a contract summary for a project and queue it for approval."""
    result = supabase.table("projects").select("*").eq("id", project_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Project not found")

    project = result.data[0]
    contract_data = draft_contract_summary(project)
    approval_message = format_contract_approval_message(contract_data)

    queue_result = supabase.table("approval_queue").insert({
        "project_id": project_id,
        "action_type": "contract_send",
        "action_payload": {
            "contract_data": contract_data,
            "approval_message": approval_message,
        },
        "status": "pending",
    }).execute()

    approval_queue_id = queue_result.data[0]["id"] if queue_result.data else None

    supabase.table("projects").update({"contract_status": "pending_approval"}).eq("id", project_id).execute()

    return {
        "contract_data": contract_data,
        "approval_message": approval_message,
        "approval_queue_id": approval_queue_id,
    }


@router.get("/{project_id}")
async def get_contract(project_id: str):
    """Return the latest contract approval queue item for a project."""
    result = (
        supabase.table("approval_queue")
        .select("*")
        .eq("project_id", project_id)
        .eq("action_type", "contract_send")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="No contract found for this project")
    return result.data[0]
