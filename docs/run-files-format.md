# 运行文件规范

本文档固定 `mdflow` 一阶段运行目录中的核心文件格式：

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
  "status": "success"
}
```

规则：

- `workflow_dir`、`input_file` 存相对于 `project_root` 的路径
- `status` 只允许 `running`、`success`、`failed`

## `state.json`

定位：当前 run 的轻量状态快照。

```json
{
  "run_id": "2026-06-07_12-30-00",
  "workflow_id": "problem_gen",
  "status": "running",
  "current_node": "generate_gen",
  "completed_nodes": [
    "generate_statement",
    "generate_std"
  ],
  "outputs": {
    "题面.md": "outputs/题面.md",
    "std.cpp": "outputs/std.cpp"
  }
}
```

规则：

- `outputs` 的 value 存相对于 `run_dir` 的路径
- `outputs` 只记录最终交付物，不记录 trace 文件
- `success` 时 `current_node = null`

## `trace.json`

定位：结构化事件时间线。

```json
{
  "events": [
    {
      "seq": 1,
      "type": "run_started",
      "timestamp": "2026-06-07T12:30:00+08:00",
      "run_id": "2026-06-07_12-30-00",
      "workflow_id": "problem_gen"
    }
  ]
}
```

一阶段事件类型固定为：

- `run_started`
- `node_started`
- `node_succeeded`
- `node_failed`
- `run_succeeded`
- `run_failed`

## `trace/` 中文件命名

- 初始输入：`00_initial.stdout.txt`
- LLM 节点：
  - `NN_nodeid.prompt.txt`
  - `NN_nodeid.stdout.txt`
  - `NN_nodeid.stderr.txt`
- Script 节点：
  - `NN_nodeid.stdout.txt`
  - `NN_nodeid.stderr.txt`

## `produces` 的落盘语义

- `llm` 节点：
  始终把当前节点 `stdout` 复制到 `outputs/<produces>`
- `script` 节点：
  如果脚本已经写出了 `outputs/<produces>`，则直接登记该文件
  否则 fallback 为把当前节点 `stdout` 复制到 `outputs/<produces>`
