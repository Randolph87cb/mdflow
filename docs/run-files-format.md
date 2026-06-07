# 运行文件规范

本文档用于固定 `mdflow` 一阶段运行目录中的核心文件格式：

- `meta.json`
- `state.json`
- `trace.json`

## `meta.json`

定位：一次 run 的静态元信息。

推荐格式：

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

字段：

- `run_id`
- `workflow_id`
- `workflow_dir`
- `input_file`
- `entry_node`
- `started_at`
- `finished_at`
- `status`

规则：

- `workflow_dir`、`input_file` 存相对于 `project_root` 的路径
- `status` 只允许 `running`、`success`、`failed`
- `finished_at` 在 run 创建时可为 `null`

## `state.json`

定位：当前 run 的轻量状态快照。

推荐格式：

```json
{
  "run_id": "2026-06-07_12-30-00",
  "workflow_id": "problem_gen",
  "status": "running",
  "current_node": "generate_cpp",
  "completed_nodes": [
    "generate_statement",
    "generate_solution"
  ],
  "outputs": {
    "statement.md": "outputs/statement.md",
    "solution.md": "outputs/solution.md",
    "std.cpp": "outputs/std.cpp"
  }
}
```

字段：

- `run_id`
- `workflow_id`
- `status`
- `current_node`
- `completed_nodes`
- `outputs`

规则：

- `outputs` 的 value 存相对于 `run_dir` 的路径
- `outputs` 只记录最终交付物，不记录 trace 文件
- `success` 时 `current_node = null`
- `failed` 时保留失败节点作为 `current_node`

## `trace.json`

定位：结构化事件时间线。

推荐格式：

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

公共字段：

- `seq`
- `type`
- `timestamp`

补充字段：

- run 事件：`run_id`、`workflow_id`
- 节点事件：`node_id`、`node_type`
- 成功事件：`duration_ms`、`produces`
- 失败事件：`duration_ms`、`error_type`、`message`
- script 失败可额外带 `returncode`
- 超时失败可额外带 `timeout_sec`

## `trace/` 中文件命名

固定规则：

- 初始输入：`00_initial.stdout.txt`
- LLM 节点：
  - `NN_nodeid.prompt.txt`
  - `NN_nodeid.stdout.txt`
  - `NN_nodeid.stderr.txt`
- Script 节点：
  - `NN_nodeid.stdout.txt`
  - `NN_nodeid.stderr.txt`

`produces` 若存在，仅表示把对应节点的 `stdout` 复制到 `outputs/<produces>`。
