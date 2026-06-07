from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class RunCreateRequest(BaseModel):
    input_mode: Literal["text", "file"]
    input_text: str | None = None
    input_file: str | None = None
    run_name: str | None = None
    note: str | None = None


class RunRerunRequest(BaseModel):
    from_node: str
    run_name: str | None = None
    note: str | None = None


class WorkflowCopyRequest(BaseModel):
    new_workflow_id: str
    new_name: str | None = None
    copy_scripts: bool = True
    copy_inputs: bool = True


class NodeUpdateRequest(BaseModel):
    content: str = Field(min_length=1)


class OutputZipRequest(BaseModel):
    files: list[str] | None = None
