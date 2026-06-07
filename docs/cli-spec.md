# CLI 规范

一阶段 CLI 只提供四个命令：

- `mdflow validate`
- `mdflow run`
- `mdflow show`
- `mdflow cat`

输出保持纯文本、稳定、无彩色。

## `mdflow validate`

```powershell
mdflow validate workflows/problem_gen
mdflow validate problem_gen
```

- `workflow` 可为 workflow 目录路径，或 workflow id

## `mdflow run`

```powershell
mdflow run workflows/problem_gen --input workflows/problem_gen/inputs/default.md
mdflow run problem_gen --input workflows/problem_gen/inputs/default.md
mdflow run --input workflows/problem_gen/inputs/default.md
```

- `workflow` 可选，省略时使用 `default_workflow`
- `--input <file>` 必填
- `--run-id <id>` 可选

真实 Micu 示例：

```powershell
$env:MICU_API_KEY = "your-api-key"
$env:MICU_API_BASE_URL = "https://www.micuapi.ai/v1"
$env:PYTHONPATH = "src"
python -m mdflow.cli run problem_gen --input workflows/problem_gen/inputs/default.md
```

## `mdflow show`

```powershell
mdflow show runs/problem_gen/2026-06-07_12-30-00
```

- 只接受 run 目录路径

展示内容：

- `workflow`
- `run_id`
- `status`
- `current_node`
- `completed_nodes`
- `outputs`

## `mdflow cat`

```powershell
mdflow cat runs/problem_gen/2026-06-07_12-30-00 generate_std.stdout
mdflow cat runs/problem_gen/2026-06-07_12-30-00 package_data.stderr
mdflow cat runs/problem_gen/2026-06-07_12-30-00 output:题面.md
```

支持目标：

- `initial.stdout`
- `<node_id>.stdout`
- `<node_id>.stderr`
- `output:<filename>`

## 退出码

- `validate`
  - `0` 通过
  - `1` 失败
- `run`
  - `0` 成功
  - `1` 运行失败
  - `2` 参数错误或目标不存在
- `show` / `cat`
  - `0` 成功
  - `1` 目标不存在或文件缺失
