# mdflow

`mdflow` 是一个 Markdown-native、文本流优先、本地可执行的轻量工作流引擎。

当前仓库先完成开工前的目录规范和项目骨架，后续实现重点放在：

- 用 Markdown 定义工作流和节点
- 用 Python 实现解析、校验、执行和落盘
- 用 `runs/` 保存每次运行的 `trace/` 与 `outputs/`

目录规范见 [docs/project-structure.md](docs/project-structure.md)。
