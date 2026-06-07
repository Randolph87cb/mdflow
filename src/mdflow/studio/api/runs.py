from __future__ import annotations

from fastapi import APIRouter, Request

from mdflow.config import load_project_config
from mdflow.studio.schemas import RunCreateRequest, RunRerunRequest
from mdflow.studio.services.runs import create_run, get_run_detail, get_run_node_detail, list_runs, rerun

router = APIRouter(prefix="/api/workflows/{workflow_id}/runs", tags=["runs"])


@router.get("")
def get_runs(request: Request, workflow_id: str) -> list[dict]:
    return list_runs(load_project_config(request.app.state.project_root), workflow_id)


@router.post("")
def create_run_endpoint(request: Request, workflow_id: str, payload: RunCreateRequest) -> dict:
    return create_run(
        load_project_config(request.app.state.project_root),
        workflow_id,
        input_mode=payload.input_mode,
        input_text=payload.input_text,
        input_file=payload.input_file,
        run_name=payload.run_name,
        note=payload.note,
    )


@router.get("/{run_id}")
def get_run_endpoint(request: Request, workflow_id: str, run_id: str) -> dict:
    return get_run_detail(load_project_config(request.app.state.project_root), workflow_id, run_id)


@router.get("/{run_id}/nodes/{node_id}")
def get_run_node_endpoint(request: Request, workflow_id: str, run_id: str, node_id: str) -> dict:
    return get_run_node_detail(load_project_config(request.app.state.project_root), workflow_id, run_id, node_id)


@router.post("/{run_id}/rerun")
def rerun_endpoint(request: Request, workflow_id: str, run_id: str, payload: RunRerunRequest) -> dict:
    return rerun(
        load_project_config(request.app.state.project_root),
        workflow_id,
        run_id,
        from_node=payload.from_node,
        run_name=payload.run_name,
        note=payload.note,
    )
