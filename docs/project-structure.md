# 项目目录规范

本文档固定 `mdflow` 当前阶段的项目结构。

## 推荐结构

```text
mdflow-project/
  README.md
  .gitignore
  pyproject.toml
  mdflow.yaml

  docs/
    project-structure.md
    studio-pages.md
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
      runtime.py
      runner.py
      trace.py
      validator.py
      studio/
        app.py
        schemas.py
        api/
        services/
      executors/
        llm.py
        script.py

  web/
    src/
    index.html
    package.json
    vite.config.ts

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
        03_build_and_run_std.md
        04_route_std_result.md
        05_fix_std.md
        06_generate_gen.md
        07_package_data.md
      scripts/
        build_and_run_cpp.py
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
- 暴露 `validate`、`run`、`rerun`、`show`、`cat`、`serve`

### `src/mdflow/studio/`

Workflow Studio 的后端服务层，负责：

- 暴露 FastAPI API
- 聚合 workflow / node / run / trace / output 数据
- 处理 workflow 复制、节点编辑、run 创建与 rerun
- 安全限制 trace / outputs 文件访问

### `web/`

Workflow Studio 的前端代码：

- React + Vite
- 3 个主页面：workflow 列表、workflow 详情、run 详情
- 通过 `/api/*` 调用本地 Studio 后端

页面职责边界见：

- [studio-pages.md](studio-pages.md)

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

同时 `problem_gen` 也是当前二阶段能力示例，演示：

- `router` 条件分支
- `retry.max_attempts`
- 修复节点覆盖同名输出文件
- LLM 直接读取 `outputs/...` 文件内容
- 失败后可用 `rerun --from <node_id>` 从指定节点重跑

## 单次运行结构

```text
runs/
  problem_gen/
    2026-06-07_12-30-00/
      meta.json
      state.json
      input.md
      workflow_snapshot/
        workflow.md
        nodes/
        scripts/
        inputs/

      trace/
        trace.json
        00_initial.stdout.txt

        01_generate_statement.attempt-01.prompt.txt
        01_generate_statement.attempt-01.stdout.txt
        01_generate_statement.attempt-01.stderr.txt

        02_generate_std.attempt-01.prompt.txt
        02_generate_std.attempt-01.stdout.txt
        02_generate_std.attempt-01.stderr.txt

        03_build_and_run_std.attempt-01.stdout.txt
        03_build_and_run_std.attempt-01.stderr.txt

        05_fix_std.attempt-01.prompt.txt
        05_fix_std.attempt-01.stdout.txt
        05_fix_std.attempt-01.stderr.txt

        06_generate_gen.attempt-01.prompt.txt
        06_generate_gen.attempt-01.stdout.txt
        06_generate_gen.attempt-01.stderr.txt

        07_package_data.attempt-01.stdout.txt
        07_package_data.attempt-01.stderr.txt

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
