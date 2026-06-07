# 项目配置文件规范

本文档固定 `mdflow` 一阶段的 `mdflow.yaml` 协议。

## 推荐格式

```yaml
name: mdflow-project
workflows_dir: workflows
runs_dir: runs
default_workflow: problem_gen

model:
  provider: micu_main
  model: gpt-5.4-mini
  temperature: 0.7
  max_tokens: 4000

providers:
  mock:
    type: mock

  micu_main:
    type: openai_compatible
    base_url_env: MICU_API_BASE_URL
    api_key_env: MICU_API_KEY
```

## 必填字段

- `name`
- `workflows_dir`
- `runs_dir`
- `default_workflow`
- `model`
- `providers`

## 字段规则

### `model`

项目级默认模型配置。

一阶段支持：

- `provider`
- `model`
- `temperature`
- `max_tokens`

### `providers`

provider 注册表，key 是 provider 名。

一阶段只支持：

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
  micu_main:
    type: openai_compatible
    base_url_env: MICU_API_BASE_URL
    api_key_env: MICU_API_KEY
```

### Base URL 规则

运行时会对 `openai_compatible` 的 base URL 做归一化：

- 如果环境变量是 `https://www.micuapi.ai`
  会自动补成 `https://www.micuapi.ai/v1`
- 如果已经带 `/v1`
  则直接使用

## 路径规则

- `project_root` = `mdflow.yaml` 所在目录
- `workflows_dir`、`runs_dir` 都按相对 `project_root` 解析

## 校验最小集合

- 文件存在且 YAML 可解析
- `name`、`workflows_dir`、`runs_dir`、`default_workflow` 存在
- `model.provider`、`model.model` 存在
- `providers` 非空
- `model.provider` 必须在 `providers` 中定义
- provider `type` 只能是 `mock` 或 `openai_compatible`
- `openai_compatible` 必须声明 `base_url_env`、`api_key_env`
