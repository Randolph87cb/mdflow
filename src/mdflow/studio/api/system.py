from __future__ import annotations

from fastapi import APIRouter, Request

from mdflow.config import load_project_config

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/status")
def get_system_status(request: Request) -> dict:
    project_root = request.app.state.project_root
    config = load_project_config(project_root)
    dist_dir = project_root / "web" / "dist"
    return {
        "project_root": str(project_root),
        "workflows_dir": config.workflows_dir,
        "runs_dir": config.runs_dir,
        "frontend_built": dist_dir.is_dir(),
    }
