# 项目目录规范

本文档用于固定 `mdflow` 一阶段的项目结构，作为开工前的统一规范。目标是把以下几层边界先定清楚：

- `workflows/`：工作流定义
- `src/`：Python 核心控制层
- `tests/`：测试代码与测试数据
- `runs/`：每次运行的现场落盘

## 一阶段推荐结构

```text
mdflow-project/
  README.md
  .gitignore
  pyproject.toml
  mdflow.yaml

  docs/
    project-structure.md

  src/
    mdflow/
      __init__.py

  tests/
    README.md
    unit/
    integration/
    fixtures/

  workflows/
    problem_gen/
      workflow.md

      nodes/
        01_generate_statement.md
        02_generate_solution.md
        03_generate_cpp.md
        04_run_cpp.md
        05_package.md

      scripts/
        run_cpp.py
        package.py

      inputs/
        default.md

  runs/
    .gitkeep
```

## 顶层目录职责

### `README.md`

仓库入口说明。用于解释项目定位、阶段目标和关键文档入口。

### `.gitignore`

用于排除本地虚拟环境、Python 缓存和运行产物。  
一阶段约定 `runs/` 下的真实运行目录默认不提交，只保留空目录占位。

### `pyproject.toml`

Python 项目入口配置。  
一阶段先承担这些职责：

- 固定项目是 Python 实现
- 固定源码目录是 `src/`
- 为后续 CLI、测试、依赖管理留标准入口

### `mdflow.yaml`

项目级配置文件。  
一阶段先只放轻量全局配置，例如：

- 项目名
- `workflows` 根目录
- `runs` 根目录
- 默认工作流

后续再扩展 provider、模型默认值、环境变量映射等。

## 核心源码层

### `src/`

Python 源码根目录。  
这个目录负责承载真正的 engine，也就是“怎么跑”的实现。

### `src/mdflow/`

主包目录。  
一阶段后续代码会放在这里，职责包括：

- 解析 `workflow.md` 和 `nodes/*.md`
- 校验工作流定义
- 创建运行目录
- 顺序执行节点
- 调用 LLM executor 和 Script executor
- 维护 `state.json`
- 记录 `trace.json`
- 提供 `validate`、`run`、`show`、`cat` 等 CLI 命令

当前只保留包骨架，不提前写执行逻辑。

## 测试层

### `tests/`

测试根目录。  
这是这次补充后正式纳入一阶段结构的组成部分，用于保证 parser、validator、runner 和 executor 行为可验证。

### `tests/unit/`

单元测试目录。  
主要覆盖：

- 配置解析
- Markdown/front matter 解析
- 节点校验
- 状态与 trace 更新逻辑

### `tests/integration/`

集成测试目录。  
主要覆盖：

- 用示例工作流跑完整链路
- Script 节点调用
- run 目录生成
- 失败即停止的行为

### `tests/fixtures/`

测试夹具目录。  
用于存放测试所需的样例工作流、样例输入、样例节点文件和期望输出。

## 工作流定义层

### `workflows/`

所有工作流定义的根目录。  
每个子目录对应一个 workflow，属于可长期维护、适合 Git 管理的源码内容。

### `workflows/problem_gen/`

示例工作流目录。  
当前用于固定一阶段的样板结构，帮助后续开发围绕真实场景推进。

### `workflow.md`

工作流总说明文件。  
一阶段职责是描述：

- 工作流名称
- 入口节点
- 整体说明
- Mermaid 流程图
- 工作流默认模型配置

Mermaid 目前只用于展示，不作为执行源。

### `nodes/`

节点定义目录。  
每个 Markdown 文件对应一个节点，后续由 engine 解析其 front matter 和正文。

一阶段节点文件应描述的核心信息包括：

- `id`
- `type`
- `uses`
- `produces`
- `next`
- 节点级模型配置（仅 `llm` 节点需要）
- prompt 正文或脚本说明

### `scripts/`

工作流私有脚本目录。  
复杂逻辑不写进节点协议本身，而是通过本地脚本实现，例如：

- 编译运行 C++
- 打包产物
- 对拍或数据整理

### `inputs/`

样例输入目录。  
用于放默认输入和测试输入，方便直接运行 workflow。

## 运行产物层

### `runs/`

每次运行的输出根目录。  
这个目录不是源码，而是运行现场。应按 `workflow_id/run_id` 分组生成。

仓库中只保留占位目录，不提交真实运行结果。

一阶段单次运行的目标结构如下：

```text
runs/
  problem_gen/
    2026-06-07_12-30-00/
      meta.json
      state.json

      trace/
        trace.json
        00_initial.txt

        01_generate_statement.input.txt
        01_generate_statement.prompt.txt
        01_generate_statement.output.txt

        02_generate_solution.input.txt
        02_generate_solution.prompt.txt
        02_generate_solution.output.txt

        03_generate_cpp.input.txt
        03_generate_cpp.prompt.txt
        03_generate_cpp.output.txt

        04_run_cpp.input.txt
        04_run_cpp.stdout.txt
        04_run_cpp.stderr.txt
        04_run_cpp.output.txt

        05_package.input.txt
        05_package.stdout.txt
        05_package.stderr.txt
        05_package.output.txt

      outputs/
        statement.md
        solution.md
        std.cpp
        run_result.txt
        package.json
```

### `trace/`

执行过程目录。  
职责是保存调试和复盘所需的证据，包括：

- 初始输入
- 节点输入
- 渲染后的 prompt
- LLM 输出
- 脚本 stdout/stderr
- 结构化事件日志

### `outputs/`

最终交付目录。  
职责是保存真正要拿走、分享、归档或继续处理的产物，不混入调试过程文件。

### `meta.json`

运行元信息文件。  
建议记录：

- `run_id`
- `workflow_id`
- 创建时间
- 输入来源
- 入口节点

### `state.json`

运行状态文件。  
一阶段建议只保存路径映射，不直接内嵌大文本，例如：

- `slots.<slot_name> -> trace/...`
- `outputs.<output_name> -> outputs/...`

### `trace.json`

事件时间线文件。  
用于记录节点开始、结束、成功、失败等摘要事件，不承担大文本承载职责。

## 结构原则

这套结构背后的原则是：

1. 工作流定义和运行实例分离
2. 调试过程和最终产物分离
3. Markdown 负责声明，Python engine 负责调度
4. 复杂逻辑交给脚本，不塞进协议
5. 测试目录从第一天起纳入结构，而不是后补
