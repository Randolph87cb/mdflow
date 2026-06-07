from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class RetryConfig:
    max_attempts: int


@dataclass(slots=True)
class RouteSpec:
    source: str
    operator: str
    value: object
    next: str


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
    retry: RetryConfig | None = None
    routes: list[RouteSpec] = field(default_factory=list)
    default_next: str | None = None


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
    source_run_id: str | None = None
    source_run_dir: str | None = None
    rerun_from_node: str | None = None

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
            "source_run_id": self.source_run_id,
            "source_run_dir": self.source_run_dir,
            "rerun_from_node": self.rerun_from_node,
        }


@dataclass(slots=True)
class RunState:
    run_id: str
    workflow_id: str
    status: str
    current_node: str | None
    completed_nodes: list[str]
    outputs: dict[str, str]
    node_attempts: dict[str, int] = field(default_factory=dict)
    last_failure: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "run_id": self.run_id,
            "workflow_id": self.workflow_id,
            "status": self.status,
            "current_node": self.current_node,
            "completed_nodes": self.completed_nodes,
            "outputs": self.outputs,
            "node_attempts": self.node_attempts,
            "last_failure": self.last_failure,
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
