# mdflow

`mdflow` 是一个 Markdown-native、文本流优先、本地可执行的轻量工作流引擎。

当前仓库已经包含第一版本地 CLI，重点能力是：

- 用 Markdown 定义工作流和节点
- 用 Python 实现解析、校验、执行和落盘
- 用 `runs/` 保存每次运行的 `trace/` 与 `outputs/`
- 支持 `mock` 和 `openai_compatible` 两类 provider
- 示例 `problem_gen` 可产出 `题面.md`、`std.cpp`、`gen.cpp`、`data.zip`

## Micu API 配置

真实调用 Micu 时，使用环境变量配置，不把密钥写入仓库：

```powershell
$env:MICU_API_KEY = "your-api-key"
$env:MICU_API_BASE_URL = "https://www.micuapi.ai/v1"
```

如果只设置成 `https://www.micuapi.ai`，运行时会自动补成 `/v1`。

运行示例：

```powershell
$env:PYTHONPATH = "src"
python -m mdflow.cli run problem_gen --input workflows/problem_gen/inputs/default.md
```

当前已确定的规范文档：

- 目录结构：[docs/project-structure.md](docs/project-structure.md)
- 节点格式：[docs/node-format.md](docs/node-format.md)
- 工作流格式：[docs/workflow-format.md](docs/workflow-format.md)
- 项目配置：[docs/project-config-format.md](docs/project-config-format.md)
- 运行文件：[docs/run-files-format.md](docs/run-files-format.md)
- CLI 规范：[docs/cli-spec.md](docs/cli-spec.md)
- 校验规则：[docs/validate-rules.md](docs/validate-rules.md)
