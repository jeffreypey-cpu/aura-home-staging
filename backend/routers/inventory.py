from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from services.supabase_client import supabase
from agents.inventory_agent import process_inventory_item, generate_sku
from services.qr_service import generate_qr_code, get_qr_base64, generate_project_label_sheet
from services.color_service import get_project_color
import logging
import os
from pathlib import Path

router = APIRouter(prefix="/api/inventory", tags=["inventory"])
logger = logging.getLogger(__name__)

INVENTORY_IMAGES_DIR = "/home/ubuntu/aura-home-staging/client_files/inventory_images"

# Try to import WhatsApp service — optional
try:
    from services.whatsapp_service import send_whatsapp_message as _send_wa
    _whatsapp_available = True
except ImportError:
    _whatsapp_available = False


class InventoryItem(BaseModel):
    item_name: str
    category: str
    description: Optional[str] = None
    quantity_total: int = 1
    condition: str = "good"
    purchase_price: Optional[float] = None
    estimated_value: Optional[float] = None
    sku: Optional[str] = None
    notes: Optional[str] = None


class ConfirmItem(BaseModel):
    item_name: str
    category: str
    description: Optional[str] = None
    condition: str = "good"
    estimated_value: Optional[float] = None
    sku: str
    quantity_total: int = 1
    purchase_price: Optional[float] = None
    notes: Optional[str] = None
    image_path: Optional[str] = None


class AssignInventory(BaseModel):
    project_id: str
    inventory_id: str
    quantity_used: int = 1
    notes: Optional[str] = None


def _attach_qr(item: dict) -> dict:
    sku = item.get("sku")
    item["qr_base64"] = get_qr_base64(sku) if sku else None
    item["image_url"] = f"/api/inventory/image/{item['id']}" if item.get("image_path") else None
    return item


def _get_existing_skus() -> list:
    result = supabase.table("inventory").select("sku").execute()
    return [r["sku"] for r in (result.data or []) if r.get("sku")]


# ── GET / ──────────────────────────────────────────────────────────────────────

@router.get("/")
async def list_inventory():
    result = (
        supabase.table("inventory")
        .select("*")
        .order("category")
        .order("item_name")
        .execute()
    )
    items = result.data or []
    return [_attach_qr(item) for item in items]


# ── POST / ────────────────────────────────────────────────────────────────────

@router.post("/")
async def create_inventory_item(body: InventoryItem):
    existing_skus = _get_existing_skus()
    data = body.model_dump()
    data["quantity_available"] = data["quantity_total"]

    if not data.get("sku"):
        data["sku"] = generate_sku(data["category"], data["item_name"], existing_skus)

    result = supabase.table("inventory").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create inventory item")

    item = result.data[0]
    qr = generate_qr_code(item["sku"], item["item_name"])
    item["qr_base64"] = qr["qr_base64"]
    return item


# ── POST /analyze ─────────────────────────────────────────────────────────────

@router.post("/analyze")
async def analyze_item(file: UploadFile = File(...), notes: Optional[str] = Form(None)):
    Path(INVENTORY_IMAGES_DIR).mkdir(parents=True, exist_ok=True)

    image_bytes = await file.read()
    safe_name = Path(file.filename or "upload.jpg").name
    image_path = os.path.join(INVENTORY_IMAGES_DIR, safe_name)
    with open(image_path, "wb") as f:
        f.write(image_bytes)

    existing_skus = _get_existing_skus()
    mime = file.content_type or "image/jpeg"
    ai_result = process_inventory_item(image_bytes, mime, existing_skus)

    qr = generate_qr_code(ai_result["sku"], ai_result["item_name"])
    logger.info(f"Analyzed image {safe_name}: {ai_result['item_name']} ({ai_result['confidence']} confidence)")

    return {
        "ai_result": ai_result,
        "qr_base64": qr["qr_base64"],
        "image_path": image_path,
    }


# ── POST /confirm ─────────────────────────────────────────────────────────────

@router.post("/confirm")
async def confirm_item(body: ConfirmItem):
    data = body.model_dump()
    data["quantity_available"] = data["quantity_total"]
    # image_path is kept so it persists for serving via /image/{item_id}

    result = supabase.table("inventory").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save inventory item")

    item = result.data[0]
    qr = generate_qr_code(item["sku"], item["item_name"])
    item["qr_base64"] = qr["qr_base64"]

    # Optional WhatsApp notification
    whatsapp_sent = False
    if _whatsapp_available and os.getenv("WHATSAPP_ACCESS_TOKEN"):
        try:
            msg = (
                f"New Inventory Item Added\n"
                f"Name: {item['item_name']}\n"
                f"SKU: {item['sku']}\n"
                f"Category: {item['category']}\n"
                f"Condition: {item['condition']}\n"
                f"Est. Value: ${item.get('estimated_value') or 'N/A'}"
            )
            _send_wa(msg)
            whatsapp_sent = True
        except Exception as e:
            logger.warning(f"WhatsApp notification failed: {e}")

    item["whatsapp_sent"] = whatsapp_sent
    return item


# ── GET /qr/{sku} ─────────────────────────────────────────────────────────────

@router.get("/qr/{sku}")
async def get_qr(sku: str):
    qr_b64 = get_qr_base64(sku)
    if not qr_b64:
        # Generate on demand if missing
        inv = supabase.table("inventory").select("item_name").eq("sku", sku).execute()
        if not inv.data:
            raise HTTPException(status_code=404, detail="SKU not found")
        qr = generate_qr_code(sku, inv.data[0]["item_name"])
        qr_b64 = qr["qr_base64"]
    return {"sku": sku, "qr_base64": qr_b64}


# ── GET /project/{project_id} ─────────────────────────────────────────────────

@router.get("/project/{project_id}")
async def get_project_inventory(project_id: str):
    result = (
        supabase.table("project_inventory")
        .select("*, inventory(*)")
        .eq("project_id", project_id)
        .is_("returned_at", "null")
        .execute()
    )
    return result.data or []


# ── POST /assign ──────────────────────────────────────────────────────────────

@router.post("/assign")
async def assign_inventory(body: AssignInventory):
    inv = supabase.table("inventory").select("*").eq("id", body.inventory_id).execute()
    if not inv.data:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    item = inv.data[0]
    if item["quantity_available"] < body.quantity_used:
        raise HTTPException(status_code=400, detail="Insufficient quantity available")

    assignment = supabase.table("project_inventory").insert({
        "project_id": body.project_id,
        "inventory_id": body.inventory_id,
        "quantity_used": body.quantity_used,
        "notes": body.notes,
    }).execute()

    supabase.table("inventory").update({
        "quantity_available": item["quantity_available"] - body.quantity_used
    }).eq("id", body.inventory_id).execute()

    return assignment.data[0] if assignment.data else {}


# ── POST /return/{assignment_id} ──────────────────────────────────────────────

@router.post("/return/{assignment_id}")
async def return_inventory(assignment_id: str):
    assignment = supabase.table("project_inventory").select("*").eq("id", assignment_id).execute()
    if not assignment.data:
        raise HTTPException(status_code=404, detail="Assignment not found")
    a = assignment.data[0]

    supabase.table("project_inventory").update({
        "returned_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", assignment_id).execute()

    inv = supabase.table("inventory").select("quantity_available").eq("id", a["inventory_id"]).execute()
    if inv.data:
        supabase.table("inventory").update({
            "quantity_available": inv.data[0]["quantity_available"] + a["quantity_used"]
        }).eq("id", a["inventory_id"]).execute()

    return {"status": "returned", "assignment_id": assignment_id}


# ── GET /labels/{project_id} ─────────────────────────────────────────────────

@router.get("/labels/{project_id}", response_class=HTMLResponse)
async def get_project_labels(project_id: str):
    # Fetch project details
    proj_res = supabase.table("projects").select("property_address, client_name").eq("id", project_id).execute()
    project_address = ""
    if proj_res.data:
        p = proj_res.data[0]
        project_address = p.get("property_address") or p.get("client_name") or ""

    # Fetch assigned inventory
    inv_res = (
        supabase.table("project_inventory")
        .select("*, inventory(*)")
        .eq("project_id", project_id)
        .is_("returned_at", "null")
        .execute()
    )
    items = inv_res.data or []

    color = get_project_color(project_id)
    html = generate_project_label_sheet(project_id, project_address, items, color)
    return HTMLResponse(content=html)


# ── GET /image/{item_id} ──────────────────────────────────────────────────────

@router.get("/image/{item_id}")
async def get_inventory_image(item_id: str):
    result = supabase.table("inventory").select("image_path, item_name").eq("id", item_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Item not found")
    image_path = result.data[0].get("image_path")
    if not image_path or not Path(image_path).exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(image_path)


# ── GET /{item_id} ────────────────────────────────────────────────────────────

@router.get("/{item_id}")
async def get_inventory_item(item_id: str):
    result = supabase.table("inventory").select("*").eq("id", item_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Item not found")
    return _attach_qr(result.data[0])


# ── PUT /{item_id} ────────────────────────────────────────────────────────────

@router.put("/{item_id}")
async def update_inventory_item(item_id: str, body: InventoryItem):
    result = supabase.table("inventory").update(
        body.model_dump(exclude_none=True)
    ).eq("id", item_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Item not found")
    return _attach_qr(result.data[0])


# ── DELETE /{item_id} ─────────────────────────────────────────────────────────

@router.delete("/{item_id}")
async def delete_inventory_item(item_id: str):
    supabase.table("inventory").delete().eq("id", item_id).execute()
    return {"status": "deleted", "id": item_id}
