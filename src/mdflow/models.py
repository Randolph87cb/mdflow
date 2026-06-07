from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class ExecConfig:
    program: str
    args: list[str]
    cwd: str
    timeout_sec: int


@dataclass(slots=True)
class NodeSpec:
    id: str
    type: str
    next: str | None
    body: str
    path: Path
    name: str | None = None
    produces: str | None = None
    model: dict[str, Any] = field(default_factory=dict)
    exec: ExecConfig | None = None


@dataclass(slots=True)
class WorkflowSpec:
    id: str
    entry: str
    path: Path
    workflow_dir: Path
    body: str
    final_outputs: list[str]
    name: str | None = None
    model: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ProjectConfig:
    name: str
    workflows_dir: str
    runs_dir: str
    default_workflow: str
    model: dict[str, Any]
    providers: dict[str, dict[str, Any]]
    project_root: Path


@dataclass(slots=True)
class WorkflowBundle:
    workflow: WorkflowSpec
    nodes: list[NodeSpec]
    nodes_by_id: dict[str, NodeSpec]


@dataclass(slots=True)
class RunMeta:
    run_id: str
    workflow_id: str
    workflow_dir: str
    input_file: str
    entry_node: str
    started_at: str
    finished_at: str | None
    status: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "run_id": self.run_id,
            "workflow_id": self.workflow_id,
            "workflow_dir": self.workflow_dir,
            "input_file": self.input_file,
            "entry_node": self.entry_node,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "status": self.status,
        }


@dataclass(slots=True)
class RunState:
    run_id: str
    workflow_id: str
    status: str
    current_node: str | None
    completed_nodes: list[str]
    outputs: dict[str, str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "run_id": self.run_id,
            "workflow_id": self.workflow_id,
            "status": self.status,
            "current_node": self.current_node,
            "completed_nodes": self.completed_nodes,
            "outputs": self.outputs,
        }


@dataclass(slots=True)
class TraceEvent:
    seq: int
    type: str
    timestamp: str
    payload: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        data = {
            "seq": self.seq,
            "type": self.type,
            "timestamp": self.timestamp,
        }
        data.update(self.payload)
        return data
