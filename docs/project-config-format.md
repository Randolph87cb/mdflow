# 项目配置文件规范

本文档用于固定 `mdflow` 一阶段的 `mdflow.yaml` 协议。

`mdflow.yaml` 只负责项目级默认配置，不负责：

- workflow 执行顺序
- 节点级执行细节
- 运行时状态

配置优先级固定为：

1. `mdflow.yaml`
2. `workflow.md`
3. `node.md`

## 推荐格式

```yaml
name: mdflow-project
workflows_dir: workflows
runs_dir: runs
default_workflow: problem_gen

model:
  provider: mock
  model: mock-llm
  temperature: 0.7
  max_tokens: 4000

providers:
  mock:
    type: mock

  openai_main:
    type: openai_compatible
    base_url_env: OPENAI_BASE_URL
    api_key_env: OPENAI_API_KEY
```

## 必填字段

- `name: string`
- `workflows_dir: string`
- `runs_dir: string`
- `default_workflow: string`
- `model: object`
- `providers: object`

## 字段规则

### `workflows_dir`

- 相对于 `project_root`
- 默认推荐写 `workflows`

### `runs_dir`

- 相对于 `project_root`
- 默认推荐写 `runs`

### `default_workflow`

- CLI `run` 未显式传入 workflow 时使用
- 值应为 workflow id

### `model`

项目级默认模型配置。

一阶段支持：

- `provider`
- `model`
- `temperature`
- `max_tokens`

### `providers`

provider 注册表，key 是 provider 名。

一阶段只支持两类 provider：

- `mock`
- `openai_compatible`

#### `mock`

```yaml
providers:
  mock:
    type: mock
```

#### `openai_compatible`

```yaml
providers:
  openai_main:
    type: openai_compatible
    base_url_env: OPENAI_BASE_URL
    api_key_env: OPENAI_API_KEY
```

一阶段先只校验字段，不实际调用。

## 路径规则

- `project_root` = `mdflow.yaml` 所在目录
- `workflows_dir`、`runs_dir` 都按相对 `project_root` 解析
- 解析后必须仍位于 `project_root` 内

## 校验最小集合

- 文件存在且 YAML 可解析
- `name`、`workflows_dir`、`runs_dir`、`default_workflow` 存在
- `model.provider`、`model.model` 存在
- `providers` 非空
- `model.provider` 必须在 `providers` 中定义
- provider `type` 只能是 `mock` 或 `openai_compatible`
- `openai_compatible` 必须声明 `base_url_env`、`api_key_env`
