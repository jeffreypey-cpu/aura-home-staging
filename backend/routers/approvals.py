import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.supabase_client import supabase

router = APIRouter(prefix="/api/approvals", tags=["approvals"])
logger = logging.getLogger(__name__)


class ApprovalAction(BaseModel):
    status: str  # "approved", "rejected", or "hold"
    notes: Optional[str] = None


class EditPayload(BaseModel):
    action_payload: dict
    notes: Optional[str] = None


@router.get("/")
async def list_pending_approvals():
    """Return all pending approval queue items."""
    result = (
        supabase.table("approval_queue")
        .select("*, projects(*)")
        .eq("status", "pending")
        .order("created_at", desc=False)
        .execute()
    )
    return result.data


@router.get("/{approval_id}")
async def get_approval(approval_id: str):
    """Return a single approval queue item by ID."""
    result = (
        supabase.table("approval_queue")
        .select("*, projects(*)")
        .eq("id", approval_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Approval not found")
    return result.data[0]


@router.post("/{approval_id}/approve")
async def approve_action(approval_id: str):
    """Approve an action — marks resolved and updates project approval_status."""
    now = datetime.now(timezone.utc).isoformat()

    result = (
        supabase.table("approval_queue")
        .update({"status": "approved", "resolved_at": now})
        .eq("id", approval_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Approval not found")

    approval = result.data[0]
    project_id = approval.get("project_id")
    if project_id:
        supabase.table("projects").update({"approval_status": "approved"}).eq("id", project_id).execute()

    return {"approval": approval, "message": "Approved. Ready to execute action."}


@router.post("/{approval_id}/reject")
async def reject_action(approval_id: str):
    """Reject an action — marks resolved and puts project on hold."""
    now = datetime.now(timezone.utc).isoformat()

    result = (
        supabase.table("approval_queue")
        .update({"status": "rejected", "resolved_at": now})
        .eq("id", approval_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Approval not found")

    approval = result.data[0]
    project_id = approval.get("project_id")
    if project_id:
        supabase.table("projects").update({"approval_status": "hold"}).eq("id", project_id).execute()

    return {"approval": approval, "message": "Rejected and held."}


@router.post("/{approval_id}/edit")
async def edit_approval(approval_id: str, body: EditPayload):
    """Replace the action_payload of a pending approval item."""
    result = (
        supabase.table("approval_queue")
        .update({"action_payload": body.action_payload})
        .eq("id", approval_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Approval not found")
    return result.data[0]
