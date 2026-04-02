import logging
from datetime import datetime, date, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.supabase_client import supabase

router = APIRouter(prefix="/api/extensions", tags=["extensions"])
logger = logging.getLogger(__name__)


class ExtensionRequest(BaseModel):
    project_id: str
    new_end_date: str
    extension_notes: Optional[str] = None


class ApproveExtension(BaseModel):
    new_end_date: str
    notes: Optional[str] = None


@router.get("/approaching")
async def get_approaching_projects():
    """Return active projects whose final_day_of_service is within 14 days."""
    today = date.today()
    cutoff = today + timedelta(days=14)

    result = (
        supabase.table("projects")
        .select("*")
        .eq("project_status", "active")
        .lte("final_day_of_service", cutoff.isoformat())
        .gte("final_day_of_service", today.isoformat())
        .order("final_day_of_service", desc=False)
        .execute()
    )

    projects = result.data or []
    for p in projects:
        if p.get("final_day_of_service"):
            end = date.fromisoformat(p["final_day_of_service"])
            p["days_remaining"] = (end - today).days
        else:
            p["days_remaining"] = None

    return projects


@router.post("/request")
async def request_extension(body: ExtensionRequest):
    """Flag a project as extension-requested and queue for approval."""
    result = supabase.table("projects").select("*").eq("id", body.project_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Project not found")

    project = result.data[0]

    supabase.table("projects").update({
        "extension_requested": True,
        "extension_notes": body.extension_notes,
    }).eq("id", body.project_id).execute()

    queue_result = supabase.table("approval_queue").insert({
        "project_id": body.project_id,
        "action_type": "extension_request",
        "action_payload": {
            "new_end_date": body.new_end_date,
            "extension_notes": body.extension_notes,
            "current_end_date": project.get("final_day_of_service"),
            "client_name": project.get("client_name"),
            "property_address": project.get("property_address"),
        },
        "status": "pending",
    }).execute()

    approval_queue_id = queue_result.data[0]["id"] if queue_result.data else None
    logger.info(f"Extension requested for project {body.project_id}, approval {approval_queue_id}")

    return {
        "project": project,
        "approval_queue_id": approval_queue_id,
    }


@router.post("/approve/{project_id}")
async def approve_extension(project_id: str, body: ApproveExtension):
    """Approve an extension — update end date and extension counters."""
    result = supabase.table("projects").select("*").eq("id", project_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Project not found")

    project = result.data[0]
    current_count = project.get("extension_count") or 0
    existing_notes = project.get("notes") or ""
    extension_note = f"\n[Extension {current_count + 1} approved {date.today().isoformat()}]: {body.notes or 'No notes'}"

    updated = supabase.table("projects").update({
        "final_day_of_service": body.new_end_date,
        "extension_approved": True,
        "extension_requested": False,
        "extension_count": current_count + 1,
        "project_status": "active",
        "notes": existing_notes + extension_note,
    }).eq("id", project_id).execute()

    logger.info(f"Extension approved for project {project_id}, new end date {body.new_end_date}")
    return updated.data[0] if updated.data else {"project_id": project_id}


@router.get("/history/{project_id}")
async def extension_history(project_id: str):
    """Return all extension requests for a project from the approval queue."""
    result = (
        supabase.table("approval_queue")
        .select("*")
        .eq("project_id", project_id)
        .eq("action_type", "extension_request")
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []
