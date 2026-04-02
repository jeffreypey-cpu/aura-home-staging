import anthropic
import os
import json
import logging
from datetime import date, timedelta, datetime
from agents.heather import HEATHER_SYSTEM_PROMPT
from services.supabase_client import supabase

logger = logging.getLogger(__name__)
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def get_week_dates(week_start: date) -> list:
    """Returns list of 7 dates starting from week_start."""
    return [week_start + timedelta(days=i) for i in range(7)]


def generate_weekly_schedule(week_start: date) -> dict:
    """Fetch context and ask Heather to generate a weekly schedule."""
    week_dates = get_week_dates(week_start)
    week_end = week_dates[-1]

    # Fetch active projects
    try:
        proj_res = supabase.table("projects").select(
            "id, client_name, property_address, staging_date, final_day_of_service, status"
        ).in_("status", ["active", "approved", "pending"]).execute()
        projects = proj_res.data or []
    except Exception as e:
        logger.error("fetch projects: %s", e)
        projects = []

    # Fetch employees
    try:
        emp_res = supabase.table("employees").select("id, name, role, status").execute()
        employees = emp_res.data or []
    except Exception as e:
        logger.error("fetch employees: %s", e)
        employees = []

    # Fetch existing schedule_days for this week
    try:
        existing_res = supabase.table("schedule_days").select("*").gte(
            "scheduled_date", str(week_start)
        ).lte("scheduled_date", str(week_end)).execute()
        existing = existing_res.data or []
    except Exception as e:
        logger.error("fetch existing schedule: %s", e)
        existing = []

    # Build context strings
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    week_context = "\n".join(
        f"  {day_names[i]} {d.strftime('%Y-%m-%d')}" for i, d in enumerate(week_dates)
    )

    projects_context = "\n".join(
        f"  - id={p['id']} | {p.get('client_name','?')} | {p.get('property_address','?')} | "
        f"staging={p.get('staging_date','?')} | final_day={p.get('final_day_of_service','?')} | status={p.get('status','?')}"
        for p in projects
    ) or "  (no active projects)"

    employees_context = "\n".join(
        f"  - id={e['id']} | {e['name']} | {e.get('role','General')}"
        for e in employees
    ) or "  (no employees)"

    existing_context = "\n".join(
        f"  - {ex.get('scheduled_date')} | {ex.get('day_type')} | emp={ex.get('employee_id')} | proj={ex.get('project_id')}"
        for ex in existing
    ) or "  (none)"

    user_message = f"""Generate a weekly work schedule for Aura Home Staging employees.
Week: {week_start} to {week_end}

Week dates:
{week_context}

Active projects:
{projects_context}

Employees:
{employees_context}

Existing scheduled days this week:
{existing_context}

Rules:
- Prep day (warehouse loading) should be 1-2 days BEFORE the staging_date. Use address: 3857 Breakwater Ave, Hayward CA
- Staging day should be ON the staging_date from the project. Use the project's property_address.
- De-stage day should be ON or AFTER final_day_of_service. Use the project's property_address.
- Assign at least 1 employee per day. Try to balance workload between employees.
- Only schedule days within the week dates shown above.
- If a project's staging_date or final_day_of_service falls outside this week, skip it.
- If no projects fall in this week, return an empty schedule array.

Return JSON only with this exact structure:
{{
  "week_start": "{week_start}",
  "schedule": [
    {{
      "date": "YYYY-MM-DD",
      "day_name": "Monday",
      "assignments": [
        {{
          "project_id": "uuid-or-null",
          "project_name": "client name + address",
          "employee_id": "uuid",
          "employee_name": "string",
          "day_type": "prep_day",
          "address": "string",
          "start_time": "08:00",
          "end_time": "17:00",
          "notes": "string"
        }}
      ]
    }}
  ],
  "heather_summary": "Short plain-English explanation of the schedule",
  "requires_approval": true
}}"""

    try:
        response = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=2000,
            system=HEATHER_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        result = json.loads(raw)
        return result
    except Exception as e:
        logger.error("generate_weekly_schedule: %s", e)
        return {
            "week_start": str(week_start),
            "schedule": [],
            "heather_summary": f"I had trouble generating the schedule: {e}",
            "requires_approval": True,
            "error": str(e),
        }


DAY_TYPE_EMOJI = {
    "prep_day": "🚛",
    "staging_day": "🏠",
    "destage_day": "📦",
}

DAY_TYPE_LABEL = {
    "prep_day": "Prep & Load (Warehouse)",
    "staging_day": "Staging Day",
    "destage_day": "De-Stage",
}


def format_employee_schedule_whatsapp(employee_name: str, schedule: dict) -> str:
    """Generate a personal WhatsApp schedule message for one employee."""
    lines = [f"Hi {employee_name}! Here's your schedule for the week 📅\n"]
    count = 0

    for day in schedule.get("schedule", []):
        emp_assignments = [
            a for a in day.get("assignments", [])
            if a.get("employee_name", "").lower() == employee_name.lower()
        ]
        if not emp_assignments:
            continue
        for a in emp_assignments:
            count += 1
            dt = a.get("day_type", "")
            emoji = DAY_TYPE_EMOJI.get(dt, "📋")
            label = DAY_TYPE_LABEL.get(dt, dt.replace("_", " ").title())
            lines.append(f"{day.get('day_name', '')} {day.get('date', '')}:")
            lines.append(f"{emoji} {label} — {a.get('project_name', '')}")
            lines.append(f"📍 {a.get('address', '')}")
            lines.append(f"🕐 {a.get('start_time', '08:00')} - {a.get('end_time', '17:00')}")
            if a.get("notes"):
                lines.append(f"   {a['notes']}")
            lines.append("")

    lines.append(f"Total days this week: {count}")
    lines.append("Please reply CONFIRM to acknowledge.")
    lines.append("\n— Heather, Aura Home Staging")
    return "\n".join(lines)
