# mdflow

`mdflow` 是一个 Markdown-native、文本流优先、本地可执行的轻量工作流引擎。

当前仓库先完成开工前的目录规范和项目骨架，后续实现重点放在：

- 用 Markdown 定义工作流和节点
- 用 Python 实现解析、校验、执行和落盘
- 用 `runs/` 保存每次运行的 `trace/` 与 `outputs/`

当前已确定的规范文档：

- 目录结构：[docs/project-structure.md](docs/project-structure.md)
- 节点格式：[docs/node-format.md](docs/node-format.md)
- 工作流格式：[docs/workflow-format.md](docs/workflow-format.md)
- 项目配置：[docs/project-config-format.md](docs/project-config-format.md)
- 运行文件：[docs/run-files-format.md](docs/run-files-format.md)
- CLI 规范：[docs/cli-spec.md](docs/cli-spec.md)
- 校验规则：[docs/validate-rules.md](docs/validate-rules.md)
