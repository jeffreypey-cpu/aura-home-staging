import qrcode
import os
import logging
import base64
import json
import html as html_module
from pathlib import Path
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger(__name__)

QR_DIR = "/home/ubuntu/aura-home-staging/client_files/qr_codes"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _hex_to_rgb(hex_color: str) -> tuple:
    h = hex_color.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def _make_qr_image(sku: str, item_name: str) -> Image.Image:
    data = json.dumps({"sku": sku, "item_name": item_name, "system": "AHS-Inventory"})
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=4)
    qr.add_data(data)
    qr.make(fit=True)
    return qr.make_image(fill_color="black", back_color="white").convert("RGB")


def _get_font(size: int, bold: bool = False):
    font_paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf" if bold else "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
    ]
    for path in font_paths:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def _draw_centered_text(draw: ImageDraw.Draw, text: str, y: int, width: int, font, color: tuple):
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    x = max(8, (width - text_w) // 2)
    draw.text((x, y), text, font=font, fill=color)


# ── generate_qr_code ─────────────────────────────────────────────────────────

def generate_qr_code(
    sku: str,
    item_name: str,
    project_id: str = None,
    project_address: str = None,
    project_color: dict = None,
) -> dict:
    """Generate a QR label PNG. If project info provided, adds a color band at the top."""
    Path(QR_DIR).mkdir(parents=True, exist_ok=True)

    qr_img = _make_qr_image(sku, item_name)
    qr_img = qr_img.resize((250, 250), Image.LANCZOS)

    W = 400

    if project_id and project_color:
        BAND_H = 120
        QR_H = 270
        INFO_H = 130
        H = BAND_H + QR_H + INFO_H

        label = Image.new("RGB", (W, H), (255, 255, 255))
        draw = ImageDraw.Draw(label)

        # Color band
        band_rgb = _hex_to_rgb(project_color["hex"])
        draw.rectangle([(0, 0), (W, BAND_H)], fill=band_rgb)

        font_addr = _get_font(18, bold=True)
        font_color_name = _get_font(13)
        addr_text = (project_address or "Project")[:40]
        _draw_centered_text(draw, addr_text, 28, W, font_addr, (255, 255, 255))
        _draw_centered_text(draw, f"PROJECT COLOR: {project_color['name'].upper()}", 68, W, font_color_name, (255, 255, 255))

        qr_x = (W - 250) // 2
        qr_y = BAND_H + 10
        label.paste(qr_img, (qr_x, qr_y))

        info_y = BAND_H + QR_H
        draw.rectangle([(0, info_y), (W, H)], fill=(248, 248, 248))
        font_name = _get_font(15, bold=True)
        font_sku = _get_font(12)
        font_brand = _get_font(10)
        _draw_centered_text(draw, item_name[:35], info_y + 14, W, font_name, (20, 20, 20))
        _draw_centered_text(draw, sku, info_y + 42, W, font_sku, (100, 100, 100))
        _draw_centered_text(draw, "AURA HOME STAGING", info_y + 70, W, font_brand, (170, 170, 170))

    else:
        H = 400
        label = Image.new("RGB", (W, H), (255, 255, 255))
        draw = ImageDraw.Draw(label)

        font_brand = _get_font(11)
        font_name = _get_font(16, bold=True)
        font_sku = _get_font(13)
        _draw_centered_text(draw, "AURA HOME STAGING", 12, W, font_brand, (170, 170, 170))

        qr_x = (W - 250) // 2
        label.paste(qr_img, (qr_x, 40))

        _draw_centered_text(draw, item_name[:35], 308, W, font_name, (20, 20, 20))
        _draw_centered_text(draw, sku, 338, W, font_sku, (100, 100, 100))

    qr_path = os.path.join(QR_DIR, f"{sku}.png")
    label.save(qr_path)

    buf = BytesIO()
    label.save(buf, format="PNG")
    buf.seek(0)
    qr_b64 = base64.b64encode(buf.read()).decode("utf-8")

    logger.info(f"QR label generated for SKU {sku} → {qr_path}")
    return {"sku": sku, "qr_path": qr_path, "qr_base64": qr_b64, "item_name": item_name}


# ── get_qr_base64 ─────────────────────────────────────────────────────────────

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


# ── generate_project_label_sheet ─────────────────────────────────────────────

def generate_project_label_sheet(
    project_id: str,
    project_address: str,
    items: list,
    project_color: dict = None,
) -> str:
    """Generate a printable HTML page with all QR labels for a project (2-up layout)."""
    color_hex = project_color["hex"] if project_color else "#c9a84c"
    color_name = project_color["name"] if project_color else "Gold"

    # Split address into street and city/state for larger display
    addr = project_address or ""
    if "," in addr:
        street = addr.split(",", 1)[0].strip()
        city_state = addr.split(",", 1)[1].strip()
    else:
        street = addr
        city_state = ""

    label_cards = []
    for item in items:
        inv = item.get("inventory") or item
        sku = inv.get("sku") or "—"
        name = inv.get("item_name") or "Unknown"
        category = inv.get("category") or ""
        condition = inv.get("condition") or "good"
        qty = item.get("quantity_used", 1)

        qr_b64 = get_qr_base64(sku)
        if not qr_b64:
            qr_data = generate_qr_code(sku, name, project_id, project_address, project_color)
            qr_b64 = qr_data["qr_base64"]

        qr_img_tag = (
            f'<img src="data:image/png;base64,{qr_b64}" style="width:220px;height:220px;" />'
            if qr_b64
            else '<div style="width:220px;height:220px;background:#eee;display:flex;align-items:center;justify-content:center;font-size:14px;color:#aaa;">No QR</div>'
        )

        label_cards.append(f"""
        <div class="label">
          <div class="color-band" style="background:{color_hex};">
            <div class="street">{html_module.escape(street)}</div>
            {f'<div class="city-state">{html_module.escape(city_state)}</div>' if city_state else ''}
            <div class="color-tag">COLOR: {html_module.escape(color_name.upper())}</div>
          </div>
          <div class="qr-section">{qr_img_tag}</div>
          <div class="info-section">
            <div class="item-name">{html_module.escape(name)}</div>
            <div class="sku">{html_module.escape(sku)}</div>
            <div class="badges">
              <span class="badge">{html_module.escape(category)}</span>
              <span class="badge">{html_module.escape(condition)}</span>
              <span class="badge">Qty: {qty}</span>
            </div>
          </div>
          <div class="bottom-strip">AURA HOME STAGING</div>
        </div>""")

    labels_html = "\n".join(label_cards)

    return f"""<!DOCTYPE html>
<html>
<head>
  <title>AURA HOME STAGING — Inventory Labels</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ font-family: Arial, sans-serif; background: #fff; padding: 20px; }}
    .header-bar {{ display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: #f5f5f5; border-radius: 8px; margin-bottom: 20px; }}
    .header-left {{ display: flex; align-items: center; gap: 12px; }}
    .color-dot {{ width: 18px; height: 18px; border-radius: 50%; background: {color_hex}; flex-shrink: 0; }}
    .header-addr {{ font-size: 15px; font-weight: 700; color: #111; }}
    .header-color {{ font-size: 11px; color: #666; margin-top: 2px; letter-spacing: 1px; }}
    .print-btn {{ padding: 10px 24px; background: {color_hex}; color: #fff; border: none; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer; letter-spacing: 1px; text-transform: uppercase; }}
    .grid {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }}
    .label {{ border: 2px solid #ddd; border-radius: 10px; overflow: hidden; break-inside: avoid; }}
    .color-band {{ padding: 18px 12px 14px; text-align: center; color: #fff; min-height: 100px; display: flex; flex-direction: column; justify-content: center; gap: 4px; }}
    .street {{ font-size: 18px; font-weight: 700; line-height: 1.2; }}
    .city-state {{ font-size: 14px; font-weight: 400; opacity: 0.9; }}
    .color-tag {{ font-size: 11px; opacity: 0.8; letter-spacing: 2px; margin-top: 4px; }}
    .qr-section {{ display: flex; justify-content: center; padding: 14px 0 10px; background: #fff; }}
    .info-section {{ padding: 10px 12px; background: #f9f9f9; text-align: center; }}
    .item-name {{ font-size: 16px; font-weight: 700; color: #111; margin-bottom: 5px; }}
    .sku {{ font-family: monospace; font-size: 13px; color: #555; margin-bottom: 8px; }}
    .badges {{ display: flex; flex-wrap: wrap; gap: 5px; justify-content: center; }}
    .badge {{ font-size: 11px; padding: 2px 8px; border-radius: 4px; background: #e8e8e8; color: #444; }}
    .bottom-strip {{ text-align: center; padding: 7px; background: #fff; font-size: 10px; letter-spacing: 3px; color: #bbb; text-transform: uppercase; border-top: 1px solid #eee; }}
    @media print {{
      body {{ margin: 0; padding: 8px; }}
      .no-print {{ display: none !important; }}
      .grid {{ gap: 10px; }}
      .label {{ border: 1px solid #ccc; page-break-inside: avoid; break-inside: avoid; }}
    }}
  </style>
</head>
<body>
  <div class="no-print header-bar">
    <div class="header-left">
      <div class="color-dot"></div>
      <div>
        <div class="header-addr">{html_module.escape(addr or project_id)}</div>
        <div class="header-color">COLOR: {html_module.escape(color_name.upper())} &nbsp;·&nbsp; {len(items)} item{'s' if len(items) != 1 else ''}</div>
      </div>
    </div>
    <button class="print-btn" onclick="window.print()">Print All Labels</button>
  </div>
  <div class="grid">
    {labels_html}
  </div>
  <script>
    if (window.location.search.indexOf('autoprint') !== -1) {{
      window.onload = function() {{ window.print(); }};
    }}
  </script>
</body>
</html>"""
