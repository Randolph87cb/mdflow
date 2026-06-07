from __future__ import annotations

from fastapi import APIRouter, Request

from mdflow.config import load_project_config
from mdflow.studio.schemas import NodeUpdateRequest
from mdflow.studio.services.nodes import get_node, list_nodes, update_node

router = APIRouter(prefix="/api/workflows/{workflow_id}/nodes", tags=["nodes"])


@router.get("")
def get_nodes(request: Request, workflow_id: str) -> list[dict]:
    return list_nodes(load_project_config(request.app.state.project_root), workflow_id)


@router.get("/{node_id}")
def get_node_endpoint(request: Request, workflow_id: str, node_id: str) -> dict:
    return get_node(load_project_config(request.app.state.project_root), workflow_id, node_id)


@router.put("/{node_id}")
def update_node_endpoint(request: Request, workflow_id: str, node_id: str, payload: NodeUpdateRequest) -> dict:
    return update_node(load_project_config(request.app.state.project_root), workflow_id, node_id, payload.content)
