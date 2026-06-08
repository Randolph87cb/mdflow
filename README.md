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
- 支持 `mdflow serve` 启动本地 Workflow Studio
- 示例 `problem_gen` 已演示“生成 -> 编译检查 -> 路由修复 -> 继续执行”的二阶段闭环，并可产出 `题面.md`、`std.cpp`、`gen.cpp`、`data.zip`

## Workflow Studio

阶段三已经补上本地 Studio：

- 后端：`FastAPI`，挂在 `src/mdflow/studio/`
- 前端：`React + Vite`，代码在 `web/`
- 启动命令：

```powershell
$env:PYTHONPATH = "src"
python -m mdflow.cli serve --host 127.0.0.1 --port 7832
```

打开：

- [http://127.0.0.1:7832](http://127.0.0.1:7832)

当前 Studio 已支持：

- 首页四区工作台
  - 顶部查看当前 workflow 摘要
  - 左侧切换 workflow 列表
  - 右上执行关键操作
  - 右下预览 workflow 节点图
- 查看 workflow graph、nodes、runs
- 发起 run
- 查看 run graph、trace、outputs
- 编辑节点 Markdown
- 复制 workflow
- 从某个节点 rerun

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

当前已确定的规范文档：

- 目录结构：[docs/project-structure.md](docs/project-structure.md)
- Studio 页面职责：[docs/studio-pages.md](docs/studio-pages.md)
- Workflow 首页对齐参考：[docs/ui-reference/workflow-overview-alignment.md](docs/ui-reference/workflow-overview-alignment.md)
- 节点格式：[docs/node-format.md](docs/node-format.md)
- 工作流格式：[docs/workflow-format.md](docs/workflow-format.md)
- 项目配置：[docs/project-config-format.md](docs/project-config-format.md)
- 运行文件：[docs/run-files-format.md](docs/run-files-format.md)
- CLI 规范：[docs/cli-spec.md](docs/cli-spec.md)
- 校验规则：[docs/validate-rules.md](docs/validate-rules.md)
- 执行模型设计：[docs/execution-v2-design.md](docs/execution-v2-design.md)
