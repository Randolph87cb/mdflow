from __future__ import annotations

import json
import mimetypes
import threading
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, unquote, urlparse, parse_qs

from mdflow.config import find_project_root, load_project_config
from mdflow.errors import CliUsageError, ValidationError
from mdflow.models import NodeSpec, ProjectConfig, WorkflowBundle
from mdflow.runtime import rerun_workflow, run_workflow
from mdflow.trace import read_json
from mdflow.validator import load_and_validate_workflow, validate_project_config

HOST = "127.0.0.1"
PORT = 8765


class StudioState:
    def __init__(self, project_root: Path) -> None:
        self.project_root = project_root
        self.config = load_project_config(project_root)
        validate_project_config(self.config)
        self._lock = threading.Lock()
        self._active_runs: dict[str, dict[str, str]] = {}

    def mark_active(self, workflow_id: str, run_id: str, status: str) -> None:
        with self._lock:
            self._active_runs[f"{workflow_id}/{run_id}"] = {"workflow_id": workflow_id, "run_id": run_id, "status": status}

    def clear_active(self, workflow_id: str, run_id: str) -> None:
        with self._lock:
            self._active_runs.pop(f"{workflow_id}/{run_id}", None)


def make_handler(studio_state: StudioState):
    class StudioHandler(BaseHTTPRequestHandler):
        server_version = "mdflow-studio-api/0.1"

        def do_OPTIONS(self) -> None:
            self._send_empty(204)

        def do_GET(self) -> None:
            try:
                path = self._path_parts()
                if path == ["api", "health"]:
                    self._send_json({"ok": True, "projectRoot": str(studio_state.project_root)})
                    return
                if path == ["api", "workflows"]:
                    self._send_json(build_studio_payload(studio_state.config))
                    return
                if len(path) == 4 and path[:2] == ["api", "runs"]:
                    workflow_id, run_id = path[2], path[3]
                    self._send_json(build_run_payload(studio_state.config, workflow_id, run_id))
                    return
                if len(path) >= 6 and path[:2] == ["api", "runs"] and path[4] == "artifacts":
                    workflow_id, run_id = path[2], path[3]
                    artifact_name = "/".join(path[5:])
                    self._send_file(studio_state.config, workflow_id, run_id, artifact_name)
                    return
                if len(path) == 7 and path[:2] == ["api", "runs"] and path[4] == "nodes" and path[6] == "logs":
                    workflow_id, run_id, node_id = path[2], path[3], path[5]
                    query = parse_qs(urlparse(self.path).query)
                    stream = str(query.get("stream", ["combined"])[0])
                    self._send_json(build_node_log_payload(studio_state.config, workflow_id, run_id, node_id, stream))
                    return
                self._send_json({"error": "not_found"}, status=404)
            except Exception as exc:  # noqa: BLE001 - API must return structured errors.
                self._send_json({"error": type(exc).__name__, "message": str(exc)}, status=500)

        def do_POST(self) -> None:
            try:
                path = self._path_parts()
                body = self._read_body()
                if len(path) == 4 and path[:2] == ["api", "workflows"] and path[3] == "runs":
                    workflow_id = path[2]
                    run_id = str(body.get("runId") or make_ui_run_id())
                    input_path = str(body.get("inputPath") or default_input_path(studio_state.config, workflow_id))
                    start_run_thread(studio_state, workflow_id, input_path, run_id)
                    self._send_json({"ok": True, "workflowId": workflow_id, "runId": run_id, "status": "running"}, status=202)
                    return
                if len(path) == 5 and path[:2] == ["api", "runs"] and path[4] == "rerun":
                    workflow_id, run_id = path[2], path[3]
                    from_node = str(body.get("fromNode") or infer_rerun_node(studio_state.config, workflow_id, run_id))
                    new_run_id = str(body.get("runId") or make_ui_run_id("rerun"))
                    start_rerun_thread(studio_state, workflow_id, run_id, from_node, new_run_id)
                    self._send_json(
                        {
                            "ok": True,
                            "workflowId": workflow_id,
                            "sourceRunId": run_id,
                            "runId": new_run_id,
                            "fromNode": from_node,
                            "status": "running",
                        },
                        status=202,
                    )
                    return
                self._send_json({"error": "not_found"}, status=404)
            except Exception as exc:  # noqa: BLE001
                self._send_json({"error": type(exc).__name__, "message": str(exc)}, status=500)

        def log_message(self, format: str, *args) -> None:  # noqa: A002
            return

        def _path_parts(self) -> list[str]:
            parsed = urlparse(self.path)
            return [unquote(part) for part in parsed.path.split("/") if part]

        def _read_body(self) -> dict[str, object]:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0:
                return {}
            raw = self.rfile.read(length).decode("utf-8")
            data = json.loads(raw)
            return data if isinstance(data, dict) else {}

        def _send_empty(self, status: int) -> None:
            self.send_response(status)
            self._send_cors_headers()
            self.end_headers()

        def _send_json(self, payload: object, status: int = 200) -> None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _send_cors_headers(self) -> None:
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")

        def _send_file(self, config: ProjectConfig, workflow_id: str, run_id: str, artifact_name: str) -> None:
            artifact_path = resolve_artifact_path(config, workflow_id, run_id, artifact_name)
            content_type = mimetypes.guess_type(artifact_path.name)[0] or "application/octet-stream"
            encoded_name = quote(artifact_path.name)
            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(artifact_path.stat().st_size))
            self.send_header("Content-Disposition", f"attachment; filename*=UTF-8''{encoded_name}")
            self.end_headers()
            with artifact_path.open("rb") as file:
                while True:
                    chunk = file.read(1024 * 1024)
                    if not chunk:
                        break
                    self.wfile.write(chunk)

    return StudioHandler


def build_studio_payload(config: ProjectConfig) -> dict[str, object]:
    workflows = []
    workflow_runs: dict[str, list[dict[str, object]]] = {}
    workflows_root = config.project_root / config.workflows_dir
    for workflow_dir in sorted(path for path in workflows_root.iterdir() if path.is_dir()):
        try:
            bundle, _catalog = load_and_validate_workflow(config, workflow_dir)
        except ValidationError as exc:
            workflows.append(build_invalid_workflow(config, workflow_dir, exc.messages))
            workflow_runs[workflow_dir.name] = []
            continue
        runs = build_runs_for_workflow(config, bundle)
        workflows.append(build_workflow_payload(config, bundle, runs))
        workflow_runs[bundle.workflow.id] = runs
    return {"source": "real", "workflows": workflows, "workflowRuns": workflow_runs}


def build_invalid_workflow(config: ProjectConfig, workflow_dir: Path, errors: list[str]) -> dict[str, object]:
    workflow_id = workflow_dir.name
    return {
        "id": workflow_id,
        "name": workflow_id,
        "status": "failed",
        "workflowState": "校验失败",
        "lastRunRelative": "不可运行",
        "nodeCount": 0,
        "path": workflow_dir.relative_to(config.project_root).as_posix(),
        "entryNode": "",
        "entryLabel": "无",
        "outputs": 0,
        "latestRunId": "暂无运行记录",
        "lastEdited": "校验失败",
        "owner": "本地",
        "blurb": "工作流定义校验失败：" + "；".join(errors[:3]),
        "tags": ["真实工作流", "校验失败"],
        "graph": {"nodes": [], "edges": []},
    }


def build_workflow_payload(config: ProjectConfig, bundle: WorkflowBundle, runs: list[dict[str, object]]) -> dict[str, object]:
    latest_run = runs[0] if runs else None
    status = "idle"
    if latest_run is not None:
        status = str(latest_run.get("status") or "idle")
    nodes, edges = build_graph(bundle)
    workflow = bundle.workflow
    entry_node = bundle.nodes_by_id.get(workflow.entry)
    return {
        "id": workflow.id,
        "name": workflow.name or workflow.id,
        "status": status,
        "workflowState": "真实工作流",
        "lastRunRelative": relative_time_from_run(latest_run),
        "nodeCount": len(bundle.nodes),
        "path": workflow.workflow_dir.relative_to(config.project_root).as_posix(),
        "entryNode": workflow.entry,
        "entryLabel": display_node_name(entry_node) if entry_node else workflow.entry,
        "outputs": len(workflow.final_outputs),
        "latestRunId": str(latest_run.get("id")) if latest_run else "暂无运行记录",
        "lastEdited": latest_workflow_edit_time(bundle),
        "owner": "本地",
        "blurb": workflow.body.strip().splitlines()[0] if workflow.body.strip() else "本地 Markdown 工作流。",
        "tags": ["真实工作流", "本地运行"],
        "graph": {"nodes": nodes, "edges": edges},
    }


def build_graph(bundle: WorkflowBundle) -> tuple[list[dict[str, object]], list[list[str]]]:
    edges: list[list[str]] = []
    for node in bundle.nodes:
        for target in node_targets(node):
            edges.append([node.id, target])
    ordered_nodes = topological_order(bundle, edges)
    positions = layout_positions(ordered_nodes)
    nodes = []
    for node in ordered_nodes:
        x, y = positions[node.id]
        nodes.append(
            {
                "key": node.id,
                "label": display_node_name(node),
                "shortLabel": short_label(node),
                "type": normalize_node_type(node.type),
                "badge": badge_for_node_type(node.type),
                "state": "idle",
                "x": x,
                "y": y,
                "file": node.path.relative_to(bundle.workflow.workflow_dir).as_posix(),
                "outputHint": node.produces or "无产物",
                "routeHint": route_hint(bundle, node),
                "markdown": node.path.read_text(encoding="utf-8"),
            }
        )
    return nodes, edges


def node_targets(node: NodeSpec) -> list[str]:
    targets = []
    if node.next:
        targets.append(node.next)
    for route in node.routes:
        if route.next:
            targets.append(route.next)
    if node.default_next:
        targets.append(node.default_next)
    return list(dict.fromkeys(targets))


def topological_order(bundle: WorkflowBundle, edges: list[list[str]]) -> list[NodeSpec]:
    node_map = bundle.nodes_by_id
    visited: set[str] = set()
    order: list[str] = []

    def visit(node_id: str) -> None:
        if node_id in visited or node_id not in node_map:
            return
        visited.add(node_id)
        order.append(node_id)
        for from_id, to_id in edges:
            if from_id == node_id:
                visit(to_id)

    visit(bundle.workflow.entry)
    for node in bundle.nodes:
        visit(node.id)
    return [node_map[node_id] for node_id in order]


def layout_positions(nodes: list[NodeSpec]) -> dict[str, tuple[int, int]]:
    positions: dict[str, tuple[int, int]] = {}
    for index, node in enumerate(nodes):
        column = index % 3
        row = index // 3
        positions[node.id] = (36 + column * 234, 40 + row * 220)
    return positions


def build_runs_for_workflow(config: ProjectConfig, bundle: WorkflowBundle) -> list[dict[str, object]]:
    runs_root = config.project_root / config.runs_dir / bundle.workflow.id
    if not runs_root.is_dir():
        return []
    runs = []
    for run_dir in sorted((path for path in runs_root.iterdir() if path.is_dir()), key=lambda item: item.stat().st_mtime, reverse=True):
        try:
            runs.append(build_run_payload(config, bundle.workflow.id, run_dir.name, bundle=bundle))
        except (OSError, KeyError, json.JSONDecodeError):
            continue
    return runs


def build_run_payload(config: ProjectConfig, workflow_id: str, run_id: str, bundle: WorkflowBundle | None = None) -> dict[str, object]:
    run_dir = get_run_dir(config, workflow_id, run_id)
    meta = read_json(run_dir / "meta.json")
    state = read_json(run_dir / "state.json")
    if bundle is None:
        workflow_dir = (config.project_root / str(meta["workflow_dir"])).resolve()
        bundle, _catalog = load_and_validate_workflow(config, workflow_dir)
    trace_events = read_trace_events(run_dir)
    node_payloads = {}
    last_failure = state.get("last_failure")
    failed_node = last_failure.get("node_id") if isinstance(last_failure, dict) else None
    selected_node = state.get("current_node") or failed_node or meta.get("entry_node")
    for node in bundle.nodes:
        node_payloads[node.id] = build_run_node_payload(run_dir, node, state, trace_events)
    return {
        "id": meta["run_id"],
        "status": state["status"],
        "trigger": "重跑" if meta.get("source_run_id") else "手动运行",
        "actor": "本地 CLI",
        "startedAt": format_time(meta.get("started_at")),
        "duration": duration_text(meta.get("started_at"), meta.get("finished_at"), state["status"]),
        "summary": run_summary(state),
        "selectedNodeKey": selected_node,
        "metrics": run_metrics(bundle, state, node_payloads),
        "nodes": node_payloads,
    }


def build_run_node_payload(run_dir: Path, node: NodeSpec, state: dict[str, object], trace_events: list[dict[str, object]]) -> dict[str, object]:
    attempts = int(state.get("node_attempts", {}).get(node.id, 0)) if isinstance(state.get("node_attempts"), dict) else 0
    failed_node = None
    if isinstance(state.get("last_failure"), dict):
        failed_node = state["last_failure"].get("node_id")
    if node.id in state.get("completed_nodes", []):
        status = "success"
    elif failed_node == node.id:
        status = "failed"
    elif state.get("current_node") == node.id and state.get("status") == "running":
        status = "running"
    else:
        status = "waiting"
    stdout, stderr = latest_trace_texts(run_dir, node.id)
    artifacts = build_artifact_payloads(run_dir, state, node)
    error = state.get("last_failure", {}).get("message") if failed_node == node.id and isinstance(state.get("last_failure"), dict) else None
    return {
        "status": status,
        "duration": node_duration_text(trace_events, node.id, status),
        "retries": max(0, attempts - 1),
        "progress": {"success": 100, "failed": 100, "running": 50, "waiting": 0}.get(status, 0),
        "startedAt": event_time(trace_events, node.id, "node_started") or "未开始",
        "finishedAt": event_time(trace_events, node.id, "node_succeeded") or event_time(trace_events, node.id, "node_failed") or "未完成",
        "summary": node_summary(status, node),
        "output": node.produces or "无产物",
        "artifacts": artifacts,
        "logs": summarize_logs(stdout, stderr),
        "logUrl": f"/api/runs/{quote(str(state['workflow_id']))}/{quote(str(state['run_id']))}/nodes/{quote(node.id)}/logs",
        "error": error,
    }


def build_artifact_payloads(run_dir: Path, state: dict[str, object], node: NodeSpec) -> list[dict[str, object]]:
    outputs = state.get("outputs", {})
    if not isinstance(outputs, dict) or not node.produces:
        return []
    artifact_rel = outputs.get(node.produces)
    if not isinstance(artifact_rel, str):
        return []
    artifact_path = safe_run_child(run_dir, artifact_rel)
    if not artifact_path.is_file():
        return []
    workflow_id = str(state["workflow_id"])
    run_id = str(state["run_id"])
    artifact_name = str(node.produces)
    return [
        {
            "name": artifact_name,
            "size": artifact_path.stat().st_size,
            "url": f"/api/runs/{quote(workflow_id)}/{quote(run_id)}/artifacts/{quote(artifact_name, safe='')}",
        }
    ]


def build_node_log_payload(config: ProjectConfig, workflow_id: str, run_id: str, node_id: str, stream: str) -> dict[str, object]:
    run_dir = get_run_dir(config, workflow_id, run_id)
    stdout, stderr = latest_trace_texts(run_dir, node_id)
    if stream not in {"combined", "stdout", "stderr"}:
        raise CliUsageError(f"unsupported log stream: {stream}")
    if stream == "stdout":
        text = stdout
    elif stream == "stderr":
        text = stderr
    else:
        text = combine_logs(stdout, stderr)
    return {
        "workflowId": workflow_id,
        "runId": run_id,
        "nodeId": node_id,
        "stream": stream,
        "text": text,
        "lines": text.splitlines() if text else [],
        "stdoutBytes": len(stdout.encode("utf-8")),
        "stderrBytes": len(stderr.encode("utf-8")),
    }


def read_trace_events(run_dir: Path) -> list[dict[str, object]]:
    trace_path = run_dir / "trace" / "trace.json"
    if not trace_path.is_file():
        return []
    data = json.loads(trace_path.read_text(encoding="utf-8"))
    return data if isinstance(data, list) else []


def latest_trace_texts(run_dir: Path, node_id: str) -> tuple[str, str]:
    trace_dir = run_dir / "trace"
    stdout_matches = sorted(trace_dir.glob(f"*_{node_id}.attempt-*.stdout.txt"))
    stderr_matches = sorted(trace_dir.glob(f"*_{node_id}.attempt-*.stderr.txt"))
    stdout = stdout_matches[-1].read_text(encoding="utf-8", errors="replace") if stdout_matches else ""
    stderr = stderr_matches[-1].read_text(encoding="utf-8", errors="replace") if stderr_matches else ""
    return stdout, stderr


def summarize_logs(stdout: str, stderr: str) -> list[str]:
    lines = []
    if stdout.strip():
        lines.extend(stdout.strip().splitlines()[-8:])
    if stderr.strip():
        lines.extend(stderr.strip().splitlines()[-8:])
    return lines or ["暂无节点日志。"]


def combine_logs(stdout: str, stderr: str) -> str:
    parts = []
    if stdout:
        parts.append(stdout.rstrip())
    if stderr:
        parts.append("[stderr]\n" + stderr.rstrip())
    return "\n".join(part for part in parts if part).strip()


def resolve_artifact_path(config: ProjectConfig, workflow_id: str, run_id: str, artifact_name: str) -> Path:
    run_dir = get_run_dir(config, workflow_id, run_id)
    state = read_json(run_dir / "state.json")
    outputs = state.get("outputs", {})
    if not isinstance(outputs, dict) or artifact_name not in outputs:
        raise CliUsageError(f"artifact not found: {artifact_name}")
    rel_path = outputs[artifact_name]
    if not isinstance(rel_path, str):
        raise CliUsageError(f"artifact path is invalid: {artifact_name}")
    artifact_path = safe_run_child(run_dir, rel_path)
    if not artifact_path.is_file():
        raise CliUsageError(f"artifact file not found: {artifact_name}")
    return artifact_path


def safe_run_child(run_dir: Path, rel_path: str) -> Path:
    child = (run_dir / rel_path).resolve()
    run_root = run_dir.resolve()
    if child != run_root and run_root not in child.parents:
        raise CliUsageError(f"path escapes run directory: {rel_path}")
    return child


def start_run_thread(studio_state: StudioState, workflow_id: str, input_path: str, run_id: str) -> None:
    studio_state.mark_active(workflow_id, run_id, "running")

    def worker() -> None:
        try:
            run_workflow(config=studio_state.config, workflow_arg=workflow_id, input_mode="file", input_file_arg=input_path, run_id=run_id)
        finally:
            studio_state.clear_active(workflow_id, run_id)

    threading.Thread(target=worker, daemon=True).start()


def start_rerun_thread(studio_state: StudioState, workflow_id: str, source_run_id: str, from_node: str, new_run_id: str) -> None:
    studio_state.mark_active(workflow_id, new_run_id, "running")

    def worker() -> None:
        try:
            old_run_arg = f"{studio_state.config.runs_dir}/{workflow_id}/{source_run_id}"
            rerun_workflow(config=studio_state.config, old_run_arg=old_run_arg, from_node=from_node, run_id=new_run_id)
        finally:
            studio_state.clear_active(workflow_id, new_run_id)

    threading.Thread(target=worker, daemon=True).start()


def infer_rerun_node(config: ProjectConfig, workflow_id: str, run_id: str) -> str:
    run_dir = get_run_dir(config, workflow_id, run_id)
    meta = read_json(run_dir / "meta.json")
    state = read_json(run_dir / "state.json")
    last_failure = state.get("last_failure")
    if isinstance(last_failure, dict) and last_failure.get("node_id"):
        return str(last_failure["node_id"])
    return str(state.get("current_node") or meta.get("entry_node"))


def get_run_dir(config: ProjectConfig, workflow_id: str, run_id: str) -> Path:
    run_dir = (config.project_root / config.runs_dir / workflow_id / run_id).resolve()
    if not run_dir.is_dir():
        raise CliUsageError(f"run directory not found: {config.runs_dir}/{workflow_id}/{run_id}")
    return run_dir


def default_input_path(config: ProjectConfig, workflow_id: str) -> str:
    candidate = config.project_root / config.workflows_dir / workflow_id / "inputs" / "default.md"
    if candidate.is_file():
        return candidate.relative_to(config.project_root).as_posix()
    raise CliUsageError(f"default input not found for workflow: {workflow_id}")


def make_ui_run_id(prefix: str = "ui") -> str:
    return f"{prefix}-{datetime.now().strftime('%Y%m%d-%H%M%S-%f')}"


def display_node_name(node: NodeSpec | None) -> str:
    if node is None:
        return ""
    return node.name or node.id.replace("_", " ")


def short_label(node: NodeSpec) -> str:
    name = display_node_name(node)
    return name[:4]


def normalize_node_type(node_type: str) -> str:
    if node_type == "llm":
        return "markdown"
    if node_type == "script":
        return "shell"
    return node_type


def badge_for_node_type(node_type: str) -> str:
    return {"llm": "AI", "script": "Sh", "router": "Rt"}.get(node_type, node_type[:2].title())


def route_hint(bundle: WorkflowBundle, node: NodeSpec) -> str:
    targets = [display_node_name(bundle.nodes_by_id.get(target)) for target in node_targets(node)]
    return "下游：" + "、".join(target for target in targets if target) if targets else "终点"


def format_time(value: object) -> str:
    return str(value).replace("T", " ") if value else "未记录"


def latest_workflow_edit_time(bundle: WorkflowBundle) -> str:
    latest = max([bundle.workflow.path.stat().st_mtime, *[node.path.stat().st_mtime for node in bundle.nodes]])
    return datetime.fromtimestamp(latest).strftime("%Y-%m-%d %H:%M")


def relative_time_from_run(run: dict[str, object] | None) -> str:
    if run is None:
        return "未运行"
    return str(run.get("startedAt") or "已有运行")


def duration_text(started_at: object, finished_at: object, status: object) -> str:
    if not started_at:
        return "未记录"
    if status == "running" or not finished_at:
        return "进行中"
    return "已结束"


def run_summary(state: dict[str, object]) -> str:
    if state.get("status") == "success":
        return "工作流真实运行已完成。"
    if state.get("status") == "failed":
        failure = state.get("last_failure")
        if isinstance(failure, dict):
            return f"节点 {failure.get('node_id')} 失败：{failure.get('message')}"
        return "工作流真实运行失败。"
    return f"正在执行节点：{state.get('current_node')}"


def run_metrics(bundle: WorkflowBundle, state: dict[str, object], nodes: dict[str, dict[str, object]]) -> dict[str, int]:
    statuses = [str(node.get("status")) for node in nodes.values()]
    return {
        "total": len(bundle.nodes),
        "success": statuses.count("success"),
        "running": statuses.count("running"),
        "failed": statuses.count("failed"),
        "waiting": statuses.count("waiting"),
    }


def node_duration_text(trace_events: list[dict[str, object]], node_id: str, status: str) -> str:
    if status == "waiting":
        return "等待中"
    failed = next((event for event in trace_events if event.get("type") == "node_failed" and event.get("node_id") == node_id), None)
    succeeded = next((event for event in trace_events if event.get("type") == "node_succeeded" and event.get("node_id") == node_id), None)
    event = failed or succeeded
    if isinstance(event, dict) and isinstance(event.get("duration_ms"), int):
        return f"{event['duration_ms']} ms"
    return "进行中" if status == "running" else "已完成"


def event_time(trace_events: list[dict[str, object]], node_id: str, event_type: str) -> str | None:
    for event in trace_events:
        if event.get("type") == event_type and event.get("node_id") == node_id:
            return format_time(event.get("timestamp"))
    return None


def node_summary(status: str, node: NodeSpec) -> str:
    return {
        "success": f"{display_node_name(node)} 已完成。",
        "failed": f"{display_node_name(node)} 执行失败。",
        "running": f"{display_node_name(node)} 正在执行。",
        "waiting": f"{display_node_name(node)} 等待上游节点。",
    }.get(status, display_node_name(node))


def main() -> int:
    project_root = find_project_root(Path.cwd())
    studio_state = StudioState(project_root)
    server = ThreadingHTTPServer((HOST, PORT), make_handler(studio_state))
    print(f"mdflow studio API listening on http://{HOST}:{PORT}")
    print(f"project_root: {project_root}")
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
