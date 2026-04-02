from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.supabase_client import supabase
import logging

router = APIRouter(prefix="/api/vendors", tags=["vendors"])
logger = logging.getLogger(__name__)


class Vendor(BaseModel):
    vendor_name: str
    service_type: str
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    rate: Optional[float] = None
    rate_type: Optional[str] = "flat"
    notes: Optional[str] = None


class AssignVendor(BaseModel):
    project_id: str
    vendor_id: str
    service_date: Optional[str] = None
    cost: Optional[float] = None
    notes: Optional[str] = None


class UpdateAssignment(BaseModel):
    status: Optional[str] = None
    cost: Optional[float] = None
    notes: Optional[str] = None
    service_date: Optional[str] = None


@router.get("/")
async def list_vendors():
    result = (
        supabase.table("vendors")
        .select("*")
        .order("service_type")
        .order("vendor_name")
        .execute()
    )
    return result.data or []


@router.post("/")
async def create_vendor(body: Vendor):
    result = supabase.table("vendors").insert(body.model_dump()).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create vendor")
    return result.data[0]


@router.get("/project/{project_id}")
async def get_project_vendors(project_id: str):
    result = (
        supabase.table("project_vendors")
        .select("*, vendors(*)")
        .eq("project_id", project_id)
        .execute()
    )
    return result.data or []


@router.post("/assign")
async def assign_vendor(body: AssignVendor):
    vendor = supabase.table("vendors").select("id").eq("id", body.vendor_id).execute()
    if not vendor.data:
        raise HTTPException(status_code=404, detail="Vendor not found")

    result = supabase.table("project_vendors").insert({
        "project_id": body.project_id,
        "vendor_id": body.vendor_id,
        "service_date": body.service_date,
        "cost": body.cost,
        "notes": body.notes,
        "status": "scheduled",
    }).execute()
    return result.data[0] if result.data else {}


@router.put("/assignment/{assignment_id}")
async def update_assignment(assignment_id: str, body: UpdateAssignment):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    result = supabase.table("project_vendors").update(updates).eq("id", assignment_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return result.data[0]


@router.delete("/assignment/{assignment_id}")
async def delete_assignment(assignment_id: str):
    supabase.table("project_vendors").delete().eq("id", assignment_id).execute()
    return {"status": "deleted", "id": assignment_id}


@router.get("/{vendor_id}")
async def get_vendor(vendor_id: str):
    result = supabase.table("vendors").select("*").eq("id", vendor_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return result.data[0]


@router.put("/{vendor_id}")
async def update_vendor(vendor_id: str, body: Vendor):
    result = supabase.table("vendors").update(body.model_dump(exclude_none=True)).eq("id", vendor_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return result.data[0]


@router.delete("/{vendor_id}")
async def delete_vendor(vendor_id: str):
    supabase.table("vendors").delete().eq("id", vendor_id).execute()
    return {"status": "deleted", "id": vendor_id}
