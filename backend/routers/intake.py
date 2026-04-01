import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from agents.intake_parser import parse_intake_message, validate_intake
from agents.property_enricher import enrich_property, format_property_summary
from services.supabase_client import supabase

router = APIRouter(prefix="/api/intake", tags=["intake"])
logger = logging.getLogger(__name__)


class RawMessageIntake(BaseModel):
    message: str


class ManualIntake(BaseModel):
    client_name: str
    client_phone: str
    client_email: str
    property_address: str
    contract_price: float
    staging_date: str
    notes: Optional[str] = None


@router.post("/parse")
async def parse_intake(body: RawMessageIntake):
    """Parse a raw WhatsApp or form message — returns data for review, does not save."""
    parsed = parse_intake_message(body.message)
    validation = validate_intake(parsed)
    return {"parsed": parsed, "validation": validation}


@router.post("/create")
async def create_project(data: ManualIntake):
    """Create a new project, enrich property data, and queue for approval."""
    # Insert project record
    insert_payload = {
        "client_name": data.client_name,
        "client_phone": data.client_phone,
        "client_email": data.client_email,
        "property_address": data.property_address,
        "contract_price": data.contract_price,
        "staging_date": data.staging_date,
        "notes": data.notes,
        "contract_status": "draft",
        "project_status": "active",
    }
    project_result = supabase.table("projects").insert(insert_payload).execute()
    if not project_result.data:
        raise HTTPException(status_code=500, detail="Failed to create project")

    project = project_result.data[0]
    project_id = project["id"]

    # Enrich property details
    enrichment = enrich_property(data.property_address, data.client_name)

    # Update project with enriched property data
    update_payload = {
        "sqft": enrichment.get("sqft"),
        "bedrooms": enrichment.get("bedrooms"),
        "bathrooms": enrichment.get("bathrooms"),
    }
    supabase.table("projects").update(update_payload).eq("id", project_id).execute()

    # Build approval summary
    property_summary = format_property_summary(enrichment, data.client_name, data.property_address)

    # Add to approval queue
    queue_result = supabase.table("approval_queue").insert({
        "project_id": project_id,
        "action_type": "property_review",
        "action_payload": {**enrichment, "property_summary": property_summary},
        "status": "pending",
    }).execute()

    approval_queue_id = queue_result.data[0]["id"] if queue_result.data else None

    return {
        "project_id": project_id,
        "enrichment": enrichment,
        "approval_queue_id": approval_queue_id,
    }


@router.get("/")
async def list_projects():
    """Return the 50 most recent projects."""
    result = supabase.table("projects").select("*").order("created_at", desc=True).limit(50).execute()
    return result.data
