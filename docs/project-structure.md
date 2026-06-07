# 项目目录规范

本文档固定 `mdflow` 一阶段的项目结构。

## 推荐结构

```text
mdflow-project/
  README.md
  .gitignore
  pyproject.toml
  mdflow.yaml

  docs/
    project-structure.md
    node-format.md
    workflow-format.md
    project-config-format.md
    run-files-format.md
    cli-spec.md
    validate-rules.md
    execution-v2-design.md

  src/
    mdflow/
      __init__.py
      cli.py
      config.py
      parser.py
      resolver.py
      runner.py
      trace.py
      validator.py
      executors/
        llm.py
        script.py

  tests/
    unit/
    integration/
    fixtures/

  workflows/
    problem_gen/
      workflow.md
      nodes/
        01_generate_statement.md
        02_generate_std.md
        03_generate_gen.md
        04_package_data.md
      scripts/
        package_data.py
      inputs/
        default.md

  runs/
    .gitkeep
```

## 顶层职责

### `mdflow.yaml`

项目级默认配置：

- 项目名
- `workflows` 根目录
- `runs` 根目录
- 默认 workflow
- 默认模型配置
- provider 注册表

### `src/`

Python 核心控制层，负责：

- 解析 Markdown 工作流
- 校验协议
- 执行节点
- 落盘 `meta.json`、`state.json`、`trace.json`
- 暴露 `validate`、`run`、`show`、`cat`

### `tests/`

测试目录：

- `unit/` 覆盖解析、校验、路径规则、执行器辅助逻辑
- `integration/` 覆盖 CLI 和完整 workflow 行为
- `fixtures/` 放测试夹具

### `workflows/`

所有工作流定义的根目录，属于 Git 管理的源码。

### `runs/`

每次运行的现场落盘目录，不属于源码。

## `problem_gen` 示例

当前示例工作流目标是稳定产出：

- `题面.md`
- `std.cpp`
- `gen.cpp`
- `data.zip`

其中 `data.zip` 内包含 25 组平铺的 `.in` / `.out`。

## 单次运行结构

```text
runs/
  problem_gen/
    2026-06-07_12-30-00/
      meta.json
      state.json

      trace/
        trace.json
        00_initial.stdout.txt

        01_generate_statement.prompt.txt
        01_generate_statement.stdout.txt
        01_generate_statement.stderr.txt

        02_generate_std.prompt.txt
        02_generate_std.stdout.txt
        02_generate_std.stderr.txt

        03_generate_gen.prompt.txt
        03_generate_gen.stdout.txt
        03_generate_gen.stderr.txt

        04_package_data.stdout.txt
        04_package_data.stderr.txt

      outputs/
        题面.md
        std.cpp
        gen.cpp
        data.zip
```

## 结构原则

1. 工作流定义和运行实例分离
2. 调试过程和最终产物分离
3. Markdown 负责声明，Python engine 负责调度
4. 复杂逻辑交给脚本，不塞进协议
