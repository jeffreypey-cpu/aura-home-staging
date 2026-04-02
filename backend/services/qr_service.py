import qrcode
import os
import logging
import base64
import json
from pathlib import Path
from io import BytesIO

logger = logging.getLogger(__name__)

QR_DIR = "/home/ubuntu/aura-home-staging/client_files/qr_codes"


def generate_qr_code(sku: str, item_name: str) -> dict:
    """Generate a QR code PNG for an inventory item, save it, and return base64."""
    Path(QR_DIR).mkdir(parents=True, exist_ok=True)

    data = json.dumps({"sku": sku, "item_name": item_name, "system": "AHS-Inventory"})

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    qr_path = os.path.join(QR_DIR, f"{sku}.png")
    img.save(qr_path)

    buf = BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    qr_b64 = base64.b64encode(buf.read()).decode("utf-8")

    logger.info(f"QR code generated for SKU {sku} → {qr_path}")
    return {"sku": sku, "qr_path": qr_path, "qr_base64": qr_b64, "item_name": item_name}


def get_qr_base64(sku: str) -> str | None:
    """Return base64 of existing QR PNG, or None if not found."""
    if not sku:
        return None
    qr_path = os.path.join(QR_DIR, f"{sku}.png")
    try:
        with open(qr_path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")
    except FileNotFoundError:
        return None
