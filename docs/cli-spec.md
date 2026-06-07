# CLI 规范

当前 CLI 提供五个命令：

- `mdflow validate`
- `mdflow run`
- `mdflow rerun`
- `mdflow serve`
- `mdflow show`
- `mdflow cat`

## `mdflow validate`

```powershell
mdflow validate workflows/problem_gen
mdflow validate problem_gen
```

## `mdflow run`

```powershell
mdflow run problem_gen --input workflows/problem_gen/inputs/default.md
mdflow run problem_gen --input workflows/problem_gen/inputs/default.md --run-id demo-run
```

## `mdflow rerun`

```powershell
mdflow rerun runs/problem_gen/2026-06-07_12-30-00 --from build_and_run_std
mdflow rerun runs/problem_gen/2026-06-07_12-30-00 --from build_and_run_std --run-id rerun-1
```

语义：

- 读取旧 run 的 `outputs/` 和初始输入
- 新建一个 run
- 从指定节点重新开始执行
- 旧 run 保持不变

## `mdflow serve`

```powershell
mdflow serve
mdflow serve --host 127.0.0.1 --port 7832
```

语义：

- 启动本地 Workflow Studio
- 默认监听 `127.0.0.1:7832`
- 如果 `web/dist` 已构建，直接提供前端页面
- 如果前端尚未构建，返回占位页提示

## `mdflow show`

```powershell
mdflow show runs/problem_gen/2026-06-07_12-30-00
```

展示：

- `workflow`
- `run_id`
- `status`
- `current_node`
- `completed_nodes`
- `outputs`

## `mdflow cat`

```powershell
mdflow cat runs/problem_gen/2026-06-07_12-30-00 generate_std.stdout
mdflow cat runs/problem_gen/2026-06-07_12-30-00 compile_std.stderr
mdflow cat runs/problem_gen/2026-06-07_12-30-00 output:题面.md
```

支持目标：

- `initial.stdout`
- `<node_id>.stdout`
- `<node_id>.stderr`
- `output:<filename>`

如果某节点存在多个 attempt，`cat <node_id>.stdout` / `stderr` 默认返回最后一次 attempt 的文件。
