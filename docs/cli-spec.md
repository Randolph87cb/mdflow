# CLI 规范

一阶段 CLI 只提供四个命令：

- `mdflow validate`
- `mdflow run`
- `mdflow show`
- `mdflow cat`

输出保持纯文本、稳定、无彩色。

## `mdflow validate`

用法：

```bash
mdflow validate workflows/problem_gen
mdflow validate problem_gen
```

参数：

- `workflow`：可为 workflow 目录路径，或 workflow id

规则：

1. 如果参数是现有目录，直接按目录处理
2. 否则按 workflow id 处理，拼到 `<workflows_dir>/<workflow_id>`

退出码：

- `0`：通过
- `1`：校验失败

## `mdflow run`

用法：

```bash
mdflow run workflows/problem_gen --input workflows/problem_gen/inputs/default.md
mdflow run problem_gen --input workflows/problem_gen/inputs/default.md
mdflow run --input workflows/problem_gen/inputs/default.md
```

参数：

- `workflow`：可选，省略时使用 `default_workflow`
- `--input <file>`：必填
- `--run-id <id>`：可选

行为：

- 自动先执行 validate
- 创建 `run_dir`
- 写入 `meta.json`、`state.json`
- 写入 `trace/00_initial.stdout.txt`
- 顺序执行节点直到成功或失败

退出码：

- `0`：运行成功
- `1`：运行失败
- `2`：参数错误或目标不存在

## `mdflow show`

用法：

```bash
mdflow show runs/problem_gen/2026-06-07_12-30-00
```

参数：

- `run_dir`

一阶段只接受 run 目录路径，不支持只传 run_id。

展示内容：

- `workflow`
- `run_id`
- `status`
- `current_node`
- `completed_nodes`
- `outputs`

## `mdflow cat`

用法：

```bash
mdflow cat runs/problem_gen/2026-06-07_12-30-00 generate_cpp.stdout
mdflow cat runs/problem_gen/2026-06-07_12-30-00 run_cpp.stderr
mdflow cat runs/problem_gen/2026-06-07_12-30-00 output:statement.md
```

参数：

- `run_dir`
- `target`

支持目标：

- `initial.stdout`
- `<node_id>.stdout`
- `<node_id>.stderr`
- `output:<filename>`

规则：

- 节点目标直接映射到 `trace/`
- `output:<filename>` 从 `state.json.outputs` 中查找

退出码：

- `0`：成功
- `1`：目标不存在或文件缺失
