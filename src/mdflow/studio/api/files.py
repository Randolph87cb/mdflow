from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, Response

from mdflow.config import load_project_config
from mdflow.studio.schemas import OutputZipRequest
from mdflow.studio.services.files import build_output_zip, get_output_file, get_trace_file, list_outputs

router = APIRouter(prefix="/api/workflows/{workflow_id}/runs/{run_id}", tags=["files"])


@router.get("/trace/{file_name:path}")
def get_trace_endpoint(request: Request, workflow_id: str, run_id: str, file_name: str) -> dict:
    return get_trace_file(load_project_config(request.app.state.project_root), workflow_id, run_id, file_name)


@router.get("/outputs")
def list_outputs_endpoint(request: Request, workflow_id: str, run_id: str) -> list[dict]:
    return list_outputs(load_project_config(request.app.state.project_root), workflow_id, run_id)


@router.get("/outputs/{file_name:path}")
def get_output_endpoint(request: Request, workflow_id: str, run_id: str, file_name: str, download: bool = False):
    path, payload = get_output_file(load_project_config(request.app.state.project_root), workflow_id, run_id, file_name)
    if download:
        return FileResponse(path, filename=file_name)
    return payload


@router.post("/outputs/download-zip")
def download_outputs_zip_endpoint(request: Request, workflow_id: str, run_id: str, payload: OutputZipRequest) -> Response:
    data = build_output_zip(load_project_config(request.app.state.project_root), workflow_id, run_id, payload.files)
    headers = {"Content-Disposition": f'attachment; filename="{workflow_id}-{run_id}-outputs.zip"'}
    return Response(content=data, media_type="application/zip", headers=headers)
