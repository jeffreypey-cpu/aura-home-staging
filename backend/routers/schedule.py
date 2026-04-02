import logging
from datetime import date, timedelta, datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.supabase_client import supabase
from agents.scheduler_agent import generate_weekly_schedule, format_employee_schedule_whatsapp

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/schedule", tags=["schedule"])


# ── Pydantic models ───────────────────────────────────────────────────────────

class ScheduleGenerate(BaseModel):
    week_start: str  # YYYY-MM-DD


class ScheduleDayCreate(BaseModel):
    project_id: Optional[str] = None
    employee_id: str
    day_type: str
    scheduled_date: str
    start_time: str = "08:00"
    end_time: str = "17:00"
    address: Optional[str] = None
    notes: Optional[str] = None


class ScheduleApprove(BaseModel):
    week_start: str
    schedule: list  # list of day objects with assignments


class ScheduleDayUpdate(BaseModel):
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    notes: Optional[str] = None
    employee_id: Optional[str] = None
    address: Optional[str] = None
    status: Optional[str] = None


class SendSchedule(BaseModel):
    week_start: str
    employee_ids: List[str]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_week_start(week_start_str: str) -> date:
    try:
        return date.fromisoformat(week_start_str)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid date: {week_start_str}")


def _enrich_days(days: list) -> list:
    """Add employee/project details to schedule day rows."""
    if not days:
        return days

    # Collect IDs
    emp_ids = list({d["employee_id"] for d in days if d.get("employee_id")})
    proj_ids = list({d["project_id"] for d in days if d.get("project_id")})

    emp_map = {}
    proj_map = {}

    if emp_ids:
        try:
            res = supabase.table("employees").select("id, name, role").in_("id", emp_ids).execute()
            emp_map = {e["id"]: e for e in (res.data or [])}
        except Exception:
            pass

    if proj_ids:
        try:
            res = supabase.table("projects").select("id, client_name, property_address").in_("id", proj_ids).execute()
            proj_map = {p["id"]: p for p in (res.data or [])}
        except Exception:
            pass

    enriched = []
    for d in days:
        row = dict(d)
        if d.get("employee_id") and d["employee_id"] in emp_map:
            row["employee"] = emp_map[d["employee_id"]]
        if d.get("project_id") and d["project_id"] in proj_map:
            row["project"] = proj_map[d["project_id"]]
        enriched.append(row)
    return enriched


def _group_by_date(days: list) -> list:
    """Group enriched schedule day rows by date into a list of day objects."""
    day_map: dict = {}
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    for d in days:
        dt = d.get("scheduled_date", "")
        if dt not in day_map:
            try:
                parsed = date.fromisoformat(str(dt))
                day_name = day_names[parsed.weekday()]
            except Exception:
                day_name = ""
            day_map[dt] = {"date": dt, "day_name": day_name, "assignments": []}
        day_map[dt]["assignments"].append(d)
    return sorted(day_map.values(), key=lambda x: x["date"])


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/week/{week_start}")
async def get_week_schedule(week_start: str):
    ws = _parse_week_start(week_start)
    we = ws + timedelta(days=6)
    try:
        res = supabase.table("schedule_days").select("*").gte(
            "scheduled_date", str(ws)
        ).lte("scheduled_date", str(we)).order("scheduled_date").execute()
        days = _enrich_days(res.data or [])
        return _group_by_date(days)
    except Exception as e:
        logger.error("get_week_schedule: %s", e)
        return []


@router.post("/generate")
async def generate_schedule(body: ScheduleGenerate):
    ws = _parse_week_start(body.week_start)
    result = generate_weekly_schedule(ws)
    return result


@router.post("/approve")
async def approve_schedule(body: ScheduleApprove):
    ws = _parse_week_start(body.week_start)
    we = ws + timedelta(days=6)
    saved = []

    # Delete existing draft days for this week first
    try:
        supabase.table("schedule_days").delete().gte(
            "scheduled_date", str(ws)
        ).lte("scheduled_date", str(we)).eq("status", "scheduled").execute()
    except Exception as e:
        logger.warning("clear existing schedule: %s", e)

    # Insert new assignments
    for day in body.schedule:
        for a in day.get("assignments", []):
            try:
                row = {
                    "project_id": a.get("project_id") or None,
                    "employee_id": a.get("employee_id"),
                    "day_type": a.get("day_type", "staging_day"),
                    "scheduled_date": day.get("date"),
                    "start_time": a.get("start_time", "08:00"),
                    "end_time": a.get("end_time", "17:00"),
                    "address": a.get("address"),
                    "notes": a.get("notes"),
                    "status": "scheduled",
                    "week_start": str(ws),
                }
                res = supabase.table("schedule_days").insert(row).execute()
                if res.data:
                    saved.append(res.data[0])
            except Exception as e:
                logger.error("insert schedule_day: %s", e)

    # Log to approval_queue
    try:
        supabase.table("approval_queue").insert({
            "action_type": "schedule_approved",
            "action_payload": {"week_start": str(ws), "total_assignments": len(saved)},
            "status": "approved",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as e:
        logger.warning("approval_queue insert: %s", e)

    return {"success": True, "saved": len(saved), "week_start": str(ws)}


@router.post("/send-whatsapp")
async def send_schedule_whatsapp(body: SendSchedule):
    ws = _parse_week_start(body.week_start)
    we = ws + timedelta(days=6)

    # Fetch approved schedule for this week
    try:
        res = supabase.table("schedule_days").select("*").gte(
            "scheduled_date", str(ws)
        ).lte("scheduled_date", str(we)).execute()
        days = _enrich_days(res.data or [])
        grouped = _group_by_date(days)
    except Exception as e:
        logger.error("fetch schedule for whatsapp: %s", e)
        return {"error": str(e)}

    # Convert grouped back to generate_weekly_schedule format
    schedule_dict = {
        "week_start": str(ws),
        "schedule": [
            {
                "date": g["date"],
                "day_name": g["day_name"],
                "assignments": [
                    {
                        "employee_name": a.get("employee", {}).get("name", ""),
                        "project_name": a.get("project", {}).get("client_name", "") + " — " + (a.get("address") or ""),
                        "day_type": a.get("day_type", ""),
                        "address": a.get("address", ""),
                        "start_time": a.get("start_time", "08:00"),
                        "end_time": a.get("end_time", "17:00"),
                        "notes": a.get("notes", ""),
                    }
                    for a in g["assignments"]
                ],
            }
            for g in grouped
        ],
    }

    queued = []
    for emp_id in body.employee_ids:
        try:
            emp_res = supabase.table("employees").select("id, name, phone").eq("id", emp_id).single().execute()
            emp = emp_res.data
            if not emp:
                continue
            message = format_employee_schedule_whatsapp(emp["name"], schedule_dict)
            supabase.table("approval_queue").insert({
                "action_type": "whatsapp_send",
                "action_payload": {
                    "to": emp.get("phone", ""),
                    "message": message,
                    "employee_id": emp_id,
                    "employee_name": emp["name"],
                    "week_start": str(ws),
                },
                "status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
            queued.append({"employee_id": emp_id, "employee_name": emp["name"], "message_preview": message[:200]})
        except Exception as e:
            logger.error("queue whatsapp for %s: %s", emp_id, e)

    return {"queued": len(queued), "messages": queued}


@router.get("/employee/{employee_id}")
async def get_employee_schedule(employee_id: str):
    today = date.today()
    future = today + timedelta(days=14)
    try:
        res = supabase.table("schedule_days").select("*").eq(
            "employee_id", employee_id
        ).gte("scheduled_date", str(today)).lte("scheduled_date", str(future)).order("scheduled_date").execute()
        return _enrich_days(res.data or [])
    except Exception as e:
        logger.error("get_employee_schedule: %s", e)
        return []


@router.put("/day/{day_id}")
async def update_schedule_day(day_id: str, body: ScheduleDayUpdate):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    try:
        res = supabase.table("schedule_days").update(updates).eq("id", day_id).execute()
        return res.data[0] if res.data else {}
    except Exception as e:
        logger.error("update_schedule_day: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/day/{day_id}")
async def delete_schedule_day(day_id: str):
    try:
        supabase.table("schedule_days").delete().eq("id", day_id).execute()
        return {"success": True}
    except Exception as e:
        logger.error("delete_schedule_day: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/upcoming")
async def get_upcoming_schedule():
    today = date.today()
    future = today + timedelta(days=30)
    try:
        res = supabase.table("schedule_days").select("*").gte(
            "scheduled_date", str(today)
        ).lte("scheduled_date", str(future)).order("scheduled_date").execute()
        days = _enrich_days(res.data or [])
        return _group_by_date(days)
    except Exception as e:
        logger.error("get_upcoming_schedule: %s", e)
        return []
