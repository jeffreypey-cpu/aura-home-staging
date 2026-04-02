import os
import logging
from datetime import datetime, timezone
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from services.supabase_client import supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/employees", tags=["employees"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


class EmployeeCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    role: Optional[str] = None
    email: Optional[str] = None
    pin: Optional[str] = None


class ClockInRequest(BaseModel):
    employee_id: str
    project_id: Optional[str] = None
    note: Optional[str] = None


class ClockOutRequest(BaseModel):
    employee_id: str
    note: Optional[str] = None


class SendClockInLinkRequest(BaseModel):
    employee_id: str
    project_id: Optional[str] = None


# ── CRUD ─────────────────────────────────────────────────────────────────────

@router.get("/")
async def list_employees():
    try:
        res = supabase.table("employees").select("*").order("name").execute()
        return res.data or []
    except Exception as e:
        logger.error("list_employees: %s", e)
        return []


@router.post("/")
async def create_employee(body: EmployeeCreate):
    try:
        res = supabase.table("employees").insert({
            "name": body.name,
            "phone": body.phone,
            "role": body.role,
            "email": body.email,
            "pin": body.pin or "",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
        return res.data[0] if res.data else {}
    except Exception as e:
        logger.error("create_employee: %s", e)
        return {"error": str(e)}


@router.get("/{employee_id}")
async def get_employee(employee_id: str):
    try:
        res = supabase.table("employees").select("*").eq("id", employee_id).single().execute()
        return res.data or {}
    except Exception as e:
        logger.error("get_employee: %s", e)
        return {"error": str(e)}


# ── CLOCK-IN LINK ─────────────────────────────────────────────────────────────

@router.post("/send-clockin-link")
async def send_clockin_link(body: SendClockInLinkRequest):
    """Generate a clock-in link and queue WhatsApp message for Tran's approval."""
    try:
        # Fetch employee
        emp_res = supabase.table("employees").select("*").eq("id", body.employee_id).single().execute()
        employee = emp_res.data
        if not employee:
            return {"error": "Employee not found"}

        # Resolve project address
        project_address = "Warehouse"
        if body.project_id:
            try:
                proj_res = supabase.table("projects").select("property_address").eq("id", body.project_id).single().execute()
                if proj_res.data:
                    project_address = proj_res.data.get("property_address", "Warehouse")
            except Exception:
                pass

        # Build clock-in URL
        params = f"?employee_id={body.employee_id}"
        if body.project_id:
            params += f"&project_id={body.project_id}"
        clockin_url = f"{FRONTEND_URL}/clockin{params}"

        # Generate WhatsApp message via Heather
        from agents.heather import heather_whatsapp_message
        message = heather_whatsapp_message("employee_clockin_link", {
            "employee_name": employee["name"],
            "clockin_url": clockin_url,
        })

        # Queue to approval queue
        supabase.table("approval_queue").insert({
            "action_type": "whatsapp_send",
            "action_payload": {
                "to": employee.get("phone", ""),
                "message": message,
                "employee_id": body.employee_id,
                "employee_name": employee["name"],
                "project_address": project_address,
            },
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()

        return {
            "success": True,
            "employee_name": employee["name"],
            "clockin_url": clockin_url,
            "message_preview": message,
            "queued_for_approval": True,
        }
    except Exception as e:
        logger.error("send_clockin_link: %s", e)
        return {"error": str(e)}


# ── CLOCK IN ──────────────────────────────────────────────────────────────────

@router.post("/clockin")
async def clock_in(body: ClockInRequest):
    try:
        now = datetime.now(timezone.utc)

        # Fetch employee
        emp_res = supabase.table("employees").select("*").eq("id", body.employee_id).single().execute()
        employee = emp_res.data
        if not employee:
            return {"error": "Employee not found"}

        # Check for existing open shift
        open_res = supabase.table("time_entries").select("*").eq("employee_id", body.employee_id).is_("clockout_time", "null").execute()
        if open_res.data:
            return {"error": "Already clocked in", "entry": open_res.data[0]}

        # Resolve project address
        project_address = "Warehouse"
        if body.project_id:
            try:
                proj_res = supabase.table("projects").select("property_address").eq("id", body.project_id).single().execute()
                if proj_res.data:
                    project_address = proj_res.data.get("property_address", "Warehouse")
            except Exception:
                pass

        # Insert time entry
        entry = supabase.table("time_entries").insert({
            "employee_id": body.employee_id,
            "project_id": body.project_id,
            "clockin_time": now.isoformat(),
            "note": body.note,
        }).execute()
        entry_data = entry.data[0] if entry.data else {}

        # Update employee status
        supabase.table("employees").update({"status": "clocked_in", "last_clockin": now.isoformat()}).eq("id", body.employee_id).execute()

        # Queue Heather WhatsApp alert
        try:
            from agents.heather import heather_whatsapp_message
            alert = heather_whatsapp_message("employee_clockin_alert", {
                "employee_name": employee["name"],
                "clockin_time": now.strftime("%I:%M %p"),
                "project_address": project_address,
            })
            supabase.table("approval_queue").insert({
                "action_type": "whatsapp_send",
                "action_payload": {
                    "to": "TRAN_OWNER",
                    "message": alert,
                    "employee_id": body.employee_id,
                    "employee_name": employee["name"],
                },
                "status": "pending",
                "created_at": now.isoformat(),
            }).execute()
        except Exception as alert_err:
            logger.warning("Clock-in alert queue failed: %s", alert_err)

        return {
            "success": True,
            "entry": entry_data,
            "employee_name": employee["name"],
            "clockin_time": now.isoformat(),
        }
    except Exception as e:
        logger.error("clock_in: %s", e)
        return {"error": str(e)}


# ── CLOCK OUT ─────────────────────────────────────────────────────────────────

@router.post("/clockout")
async def clock_out(body: ClockOutRequest):
    try:
        now = datetime.now(timezone.utc)

        # Fetch employee
        emp_res = supabase.table("employees").select("*").eq("id", body.employee_id).single().execute()
        employee = emp_res.data
        if not employee:
            return {"error": "Employee not found"}

        # Find open shift
        open_res = supabase.table("time_entries").select("*").eq("employee_id", body.employee_id).is_("clockout_time", "null").execute()
        if not open_res.data:
            return {"error": "Not currently clocked in"}

        entry = open_res.data[0]
        clockin_dt = datetime.fromisoformat(entry["clockin_time"].replace("Z", "+00:00"))
        duration = now - clockin_dt
        total_hours = round(duration.total_seconds() / 3600, 2)

        # Resolve project address
        project_address = "Warehouse"
        if entry.get("project_id"):
            try:
                proj_res = supabase.table("projects").select("property_address").eq("id", entry["project_id"]).single().execute()
                if proj_res.data:
                    project_address = proj_res.data.get("property_address", "Warehouse")
            except Exception:
                pass

        # Update time entry
        updated = supabase.table("time_entries").update({
            "clockout_time": now.isoformat(),
            "total_hours": total_hours,
            "note": body.note or entry.get("note"),
        }).eq("id", entry["id"]).execute()

        # Update employee status
        supabase.table("employees").update({"status": "clocked_out", "last_clockout": now.isoformat()}).eq("id", body.employee_id).execute()

        # Queue Heather WhatsApp alert
        try:
            from agents.heather import heather_whatsapp_message
            alert = heather_whatsapp_message("employee_clockout_alert", {
                "employee_name": employee["name"],
                "clockout_time": now.strftime("%I:%M %p"),
                "total_hours": f"{total_hours}h",
                "project_address": project_address,
            })
            supabase.table("approval_queue").insert({
                "action_type": "whatsapp_send",
                "action_payload": {
                    "to": "TRAN_OWNER",
                    "message": alert,
                    "employee_id": body.employee_id,
                    "employee_name": employee["name"],
                    "total_hours": total_hours,
                },
                "status": "pending",
                "created_at": now.isoformat(),
            }).execute()
        except Exception as alert_err:
            logger.warning("Clock-out alert queue failed: %s", alert_err)

        return {
            "success": True,
            "entry": updated.data[0] if updated.data else {},
            "employee_name": employee["name"],
            "clockout_time": now.isoformat(),
            "total_hours": total_hours,
        }
    except Exception as e:
        logger.error("clock_out: %s", e)
        return {"error": str(e)}


# ── TIME ENTRIES ──────────────────────────────────────────────────────────────

@router.get("/{employee_id}/time-entries")
async def get_time_entries(employee_id: str, limit: int = 30):
    try:
        res = supabase.table("time_entries").select("*").eq("employee_id", employee_id).order("clockin_time", desc=True).limit(limit).execute()
        return res.data or []
    except Exception as e:
        logger.error("get_time_entries: %s", e)
        return []
