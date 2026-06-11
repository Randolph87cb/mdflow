# mdflow

`mdflow` 是一个 Markdown-native、文本流优先、本地可执行的轻量工作流引擎。

当前仓库已经包含本地 CLI，重点能力是：

- 用 Markdown 定义工作流和节点
- 用 Python 实现解析、校验、执行和落盘
- 用 `runs/` 保存每次运行的 `trace/` 与 `outputs/`
- 支持 `mock` 和 `openai_compatible` 两类 provider
- 支持 `router` 分支节点
- 支持节点级自动重试
- 支持 `mdflow rerun --from <node_id>` 从失败节点发起新 run
- 示例 `problem_gen` 已演示“生成 -> 编译检查 -> 路由修复 -> 继续执行”的二阶段闭环，并可产出 `题面.md`、`std.cpp`、`gen.cpp`、`data.zip`

## Micu API 配置

真实调用 Micu 时，使用环境变量配置，不把密钥写入仓库：

推荐做法是在项目根目录新建 `.env`，仓库里已经提供了 [.env.example](.env.example)：

```dotenv
MICU_API_KEY=your-micu-api-key
MICU_API_BASE_URL=https://www.micuapi.ai/v1
PYTHONUTF8=1
```

你可以直接复制：

```powershell
Copy-Item .env.example .env
```

`mdflow` 在启动时会自动读取项目根目录的 `.env`。如果系统环境变量里已经存在同名配置，则优先使用系统环境变量。

也可以临时在 PowerShell 里设置：

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

## 本地 UI 接入真实运行

前端默认会尝试连接本地 Studio API；连接成功后页面会显示“真实数据”，并从 `workflows/` 与 `runs/` 读取工作流和运行记录。

```powershell
$env:PYTHONPATH = "src"
python -m mdflow.studio_api
```

另开一个终端启动前端：

```powershell
cd web
npm run dev -- --host 127.0.0.1 --port 4176
```

在真实数据模式下，页面里的“运行”和“重跑”按钮会调用真实 `mdflow run/rerun`，会使用 `.env` 中配置的 provider，并可能消耗 API 额度。

当前已确定的规范文档：

- 目录结构：[docs/project-structure.md](docs/project-structure.md)
- 节点格式：[docs/node-format.md](docs/node-format.md)
- 工作流格式：[docs/workflow-format.md](docs/workflow-format.md)
- 项目配置：[docs/project-config-format.md](docs/project-config-format.md)
- 运行文件：[docs/run-files-format.md](docs/run-files-format.md)
- CLI 规范：[docs/cli-spec.md](docs/cli-spec.md)
- 校验规则：[docs/validate-rules.md](docs/validate-rules.md)
- 执行模型设计：[docs/execution-v2-design.md](docs/execution-v2-design.md)
