import logging

from fastapi import APIRouter, HTTPException

from agents.followup_drafter import draft_completion_emails, format_followup_approval_message
from services.supabase_client import supabase

router = APIRouter(prefix="/api/complete", tags=["completions"])
logger = logging.getLogger(__name__)


@router.post("/{project_id}")
async def complete_project(project_id: str):
    """Mark a project complete and generate follow-up email drafts for approval."""
    result = supabase.table("projects").select("*").eq("id", project_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Project not found")

    project = result.data[0]

    supabase.table("projects").update({"project_status": "completed"}).eq("id", project_id).execute()

    emails = draft_completion_emails(project)
    client_name = project.get("client_name", "")
    approval_message = format_followup_approval_message(emails, client_name)

    queue_result = supabase.table("approval_queue").insert({
        "project_id": project_id,
        "action_type": "followup_send",
        "action_payload": {
            "emails": emails,
            "approval_message": approval_message,
        },
        "status": "pending",
    }).execute()

    approval_queue_id = queue_result.data[0]["id"] if queue_result.data else None

    supabase.table("projects").update({"followup_status": "pending_approval"}).eq("id", project_id).execute()

    return {
        "project_id": project_id,
        "emails": emails,
        "approval_queue_id": approval_queue_id,
    }
