import os
import shutil
import logging
from datetime import datetime
from pathlib import Path
from services.supabase_client import supabase

logger = logging.getLogger(__name__)

BASE_FILES_DIR = "/home/ubuntu/aura-home-staging/client_files"


def get_client_folder(project_id: str, client_name: str) -> Path:
    safe_name = client_name.replace(" ", "_").replace("/", "_")
    folder_name = f"{safe_name}_{project_id[:8]}"
    folder = Path(BASE_FILES_DIR) / folder_name
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def save_contract_file(project_id: str, client_name: str, file_content: bytes, filename: str) -> dict:
    folder = get_client_folder(project_id, client_name)
    full_path = folder / filename
    full_path.write_bytes(file_content)

    result = supabase.table("client_files").insert({
        "project_id": project_id,
        "client_name": client_name,
        "file_type": "contract",
        "file_name": filename,
        "file_path": str(full_path),
    }).execute()

    file_id = result.data[0]["id"] if result.data else None
    logger.info(f"Saved contract file {filename} for project {project_id}")
    return {"success": True, "path": str(full_path), "file_id": file_id}


def save_invoice_file(project_id: str, client_name: str, file_content: bytes, filename: str) -> dict:
    folder = get_client_folder(project_id, client_name)
    full_path = folder / filename
    full_path.write_bytes(file_content)

    result = supabase.table("client_files").insert({
        "project_id": project_id,
        "client_name": client_name,
        "file_type": "invoice",
        "file_name": filename,
        "file_path": str(full_path),
    }).execute()

    file_id = result.data[0]["id"] if result.data else None
    logger.info(f"Saved invoice file {filename} for project {project_id}")
    return {"success": True, "path": str(full_path), "file_id": file_id}


def get_client_files(project_id: str) -> list:
    result = (
        supabase.table("client_files")
        .select("*")
        .eq("project_id", project_id)
        .order("uploaded_at", desc=True)
        .execute()
    )
    return result.data or []


def list_all_client_folders() -> list:
    result = supabase.table("client_files").select("*").order("uploaded_at", desc=True).execute()
    rows = result.data or []

    # Group by (client_name, project_id)
    groups: dict = {}
    for row in rows:
        key = (row.get("client_name", ""), row.get("project_id", ""))
        if key not in groups:
            groups[key] = {
                "client_name": row.get("client_name", ""),
                "project_id": row.get("project_id", ""),
                "file_count": 0,
                "file_types": set(),
                "latest_upload": row.get("uploaded_at", ""),
            }
        groups[key]["file_count"] += 1
        groups[key]["file_types"].add(row.get("file_type", ""))

    summary = []
    for entry in groups.values():
        summary.append({
            "client_name": entry["client_name"],
            "project_id": entry["project_id"],
            "file_count": entry["file_count"],
            "file_types": list(entry["file_types"]),
            "latest_upload": entry["latest_upload"],
        })

    return summary
