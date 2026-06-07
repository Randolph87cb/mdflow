# 运行文件规范

本文档描述当前 run 目录中的核心文件格式：

- `meta.json`
- `state.json`
- `trace.json`

## `meta.json`

定位：一次 run 的静态元信息。

```json
{
  "run_id": "2026-06-07_12-30-00",
  "workflow_id": "problem_gen",
  "workflow_dir": "workflows/problem_gen",
  "input_file": "workflows/problem_gen/inputs/default.md",
  "entry_node": "generate_statement",
  "started_at": "2026-06-07T12:30:00+08:00",
  "finished_at": "2026-06-07T12:31:10+08:00",
  "status": "success",
  "source_run_id": null,
  "source_run_dir": null,
  "rerun_from_node": null
}
```

rerun 时，来源信息会填入：

- `source_run_id`
- `source_run_dir`
- `rerun_from_node`

## `state.json`

定位：当前 run 的轻量状态快照。

```json
{
  "run_id": "2026-06-07_12-30-00",
  "workflow_id": "problem_gen",
  "status": "running",
  "current_node": "compile_std",
  "completed_nodes": [
    "generate_statement",
    "generate_std"
  ],
  "outputs": {
    "题面.md": "outputs/题面.md",
    "std.cpp": "outputs/std.cpp"
  },
  "node_attempts": {
    "compile_std": 2
  },
  "last_failure": {
    "node_id": "compile_std",
    "error_type": "script_exit_nonzero",
    "message": "Script exited with non-zero status"
  }
}
```

新增字段：

- `node_attempts`
- `last_failure`

## `trace.json`

定位：结构化事件时间线。

当前常见事件包括：

- `run_started`
- `run_rerun_started`
- `node_started`
- `node_succeeded`
- `node_failed`
- `node_retry_scheduled`
- `router_selected`
- `run_succeeded`
- `run_failed`

## `trace/` 文件命名

- 初始输入：
  - `00_initial.stdout.txt`
- LLM 节点：
  - `NN_nodeid.attempt-01.prompt.txt`
  - `NN_nodeid.attempt-01.stdout.txt`
  - `NN_nodeid.attempt-01.stderr.txt`
- Script 节点：
  - `NN_nodeid.attempt-01.stdout.txt`
  - `NN_nodeid.attempt-01.stderr.txt`
- rerun 预填的旧结果：
  - `NN_nodeid.attempt-00.stdout.txt`
  - `NN_nodeid.attempt-00.stderr.txt`

同一节点有多次执行时，attempt 编号持续递增。

## `outputs/` 的 rerun 语义

执行：

```bash
mdflow rerun <old_run_dir> --from <node_id>
```

时会：

- 复制旧 run 的 `outputs/` 到新 run
- 复制旧 run 的 `trace/00_initial.stdout.txt` 到新 run
- 对已完成且有 `produces` 的节点，生成 `attempt-00` 的 trace 占位，供后续节点引用
