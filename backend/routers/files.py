import logging
import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from services.supabase_client import supabase
from services.file_storage import get_client_files, list_all_client_folders

router = APIRouter(prefix="/api/files", tags=["files"])
logger = logging.getLogger(__name__)

BASE_FILES_DIR = "/home/ubuntu/aura-home-staging/client_files"


@router.get("/client/{project_id}")
async def list_client_files(project_id: str):
    """Return all stored files for a given project."""
    try:
        files = get_client_files(project_id)
        return files
    except Exception as e:
        logger.error(f"Failed to fetch files for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/folders")
async def list_folders():
    """Return a summary of all client file folders."""
    try:
        folders = list_all_client_folders()
        return folders
    except Exception as e:
        logger.error(f"Failed to list folders: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload/{project_id}")
async def upload_file(
    project_id: str,
    file: UploadFile = File(...),
    file_type: str = Form(...),
    client_name: str = Form(...),
    notes: Optional[str] = Form(None),
):
    """Upload a file and store it in the client's folder."""
    try:
        safe_name = client_name.replace(" ", "_").replace("/", "_")
        folder = Path(BASE_FILES_DIR) / f"{safe_name}_{project_id[:8]}"
        folder.mkdir(parents=True, exist_ok=True)

        # Avoid overwriting — prefix with a short unique id if collision
        dest = folder / file.filename
        if dest.exists():
            stem = Path(file.filename).stem
            suffix = Path(file.filename).suffix
            import time
            dest = folder / f"{stem}_{int(time.time())}{suffix}"

        contents = await file.read()
        dest.write_bytes(contents)

        result = supabase.table("client_files").insert({
            "project_id": project_id,
            "client_name": client_name,
            "file_type": file_type,
            "file_name": dest.name,
            "file_path": str(dest),
            "notes": notes,
        }).execute()

        record = result.data[0] if result.data else {}
        logger.info(f"Uploaded {dest.name} ({file_type}) for project {project_id}")
        return {
            "success": True,
            "file_name": dest.name,
            "file_type": file_type,
            "file_path": str(dest),
            "id": record.get("id"),
        }
    except Exception as e:
        logger.error(f"Upload failed for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/file/{file_id}")
async def delete_file(file_id: str):
    """Delete a file record from the database."""
    try:
        result = supabase.table("client_files").delete().eq("id", file_id).execute()
        logger.info(f"Deleted file record {file_id}")
        return {"success": True, "deleted": file_id}
    except Exception as e:
        logger.error(f"Failed to delete file {file_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
