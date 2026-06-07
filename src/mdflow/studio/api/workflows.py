from __future__ import annotations

from fastapi import APIRouter, Request

from mdflow.config import load_project_config
from mdflow.studio.schemas import WorkflowCopyRequest
from mdflow.studio.services.workflows import copy_workflow, get_workflow_detail, get_workflow_graph, list_workflows

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


@router.get("")
def get_workflows(request: Request) -> list[dict]:
    return list_workflows(load_project_config(request.app.state.project_root))


@router.get("/{workflow_id}")
def get_workflow(request: Request, workflow_id: str) -> dict:
    return get_workflow_detail(load_project_config(request.app.state.project_root), workflow_id)


@router.get("/{workflow_id}/graph")
def get_workflow_graph_endpoint(request: Request, workflow_id: str) -> dict:
    return get_workflow_graph(load_project_config(request.app.state.project_root), workflow_id)


@router.post("/{workflow_id}/copy")
def copy_workflow_endpoint(request: Request, workflow_id: str, payload: WorkflowCopyRequest) -> dict:
    return copy_workflow(
        load_project_config(request.app.state.project_root),
        workflow_id,
        new_workflow_id=payload.new_workflow_id,
        new_name=payload.new_name,
        copy_scripts=payload.copy_scripts,
        copy_inputs=payload.copy_inputs,
    )
