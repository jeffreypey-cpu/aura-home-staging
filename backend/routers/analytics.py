from fastapi import APIRouter
from services.supabase_client import supabase
from datetime import date, timedelta
import logging

router = APIRouter(prefix="/api/analytics", tags=["analytics"])
logger = logging.getLogger(__name__)


@router.get("/revenue")
async def revenue_analytics():
    result = supabase.table("projects").select("contract_price, project_status, staging_date, created_at").execute()
    projects = result.data or []

    today = date.today()
    month_start = today.replace(day=1)
    year_start = today.replace(month=1, day=1)

    completed = [p for p in projects if p.get("project_status") == "completed"]
    total_revenue = sum(p.get("contract_price") or 0 for p in completed)

    month_revenue = sum(
        p.get("contract_price") or 0
        for p in completed
        if p.get("staging_date") and p["staging_date"] >= month_start.isoformat()
    )
    year_revenue = sum(
        p.get("contract_price") or 0
        for p in completed
        if p.get("staging_date") and p["staging_date"] >= year_start.isoformat()
    )
    avg_contract = (total_revenue / len(completed)) if completed else 0

    # Revenue by month for last 12 months
    monthly = {}
    for i in range(11, -1, -1):
        d = today.replace(day=1) - timedelta(days=i * 30)
        key = d.strftime("%Y-%m")
        monthly[key] = 0

    for p in completed:
        sd = p.get("staging_date") or ""
        if sd and len(sd) >= 7:
            key = sd[:7]
            if key in monthly:
                monthly[key] += p.get("contract_price") or 0

    revenue_by_month = [{"month": k, "revenue": v} for k, v in monthly.items()]

    return {
        "total_revenue": total_revenue,
        "revenue_this_month": month_revenue,
        "revenue_this_year": year_revenue,
        "avg_contract_value": round(avg_contract, 2),
        "revenue_by_month": revenue_by_month,
    }


@router.get("/projects")
async def project_analytics():
    result = supabase.table("projects").select("project_status, staging_date, final_day_of_service").execute()
    projects = result.data or []

    total = len(projects)
    active = sum(1 for p in projects if p.get("project_status") == "active")
    completed = sum(1 for p in projects if p.get("project_status") == "completed")

    durations = []
    for p in projects:
        if p.get("staging_date") and p.get("final_day_of_service"):
            try:
                start = date.fromisoformat(p["staging_date"])
                end = date.fromisoformat(p["final_day_of_service"])
                durations.append((end - start).days)
            except ValueError:
                pass
    avg_duration = round(sum(durations) / len(durations), 1) if durations else 0

    status_counts: dict[str, int] = {}
    for p in projects:
        s = p.get("project_status") or "unknown"
        status_counts[s] = status_counts.get(s, 0) + 1

    return {
        "total_projects": total,
        "active_projects": active,
        "completed_projects": completed,
        "avg_staging_duration_days": avg_duration,
        "by_status": status_counts,
    }


@router.get("/pipeline")
async def pipeline_analytics():
    projects_result = supabase.table("projects").select("contract_price, project_status, contract_status, invoice_status, docusign_status").execute()
    projects = projects_result.data or []

    approvals_result = supabase.table("approval_queue").select("id").eq("status", "pending").execute()
    pending_approvals = len(approvals_result.data or [])

    active = [p for p in projects if p.get("project_status") == "active"]
    pipeline_value = sum(p.get("contract_price") or 0 for p in active)

    pending_signatures = sum(
        1 for p in active if p.get("docusign_status") == "sent"
    )
    unpaid_invoices = sum(
        1 for p in active
        if p.get("invoice_status") in ("draft", "sent") and p.get("contract_status") == "sent"
    )

    return {
        "pipeline_value": pipeline_value,
        "pending_signatures": pending_signatures,
        "unpaid_invoices": unpaid_invoices,
        "pending_approvals": pending_approvals,
    }
