# 统一校验规则

本文档汇总 `mdflow validate` 与 `mdflow run` / `rerun` 前的静态校验规则。

## 项目级

- `mdflow.yaml` 文件存在且 YAML 可解析
- `name`、`workflows_dir`、`runs_dir`、`default_workflow` 存在
- `model.provider`、`model.model` 存在
- `providers` 非空
- provider `type` 只能是 `mock` 或 `openai_compatible`
- `openai_compatible` 必须声明 `base_url_env`、`api_key_env`

## workflow 级

- `workflow.md` 存在且 front matter 可解析
- `id`、`entry`、`final_outputs` 必填
- `id` 只允许字母、数字、下划线、短横线
- `final_outputs` 为非空字符串列表
- `final_outputs` 不允许绝对路径、`..`、重复

## 图结构

- 所有节点 `id` 唯一
- `entry` 指向存在节点
- `next`、`routes[].next`、`default_next` 指向存在节点
- 图允许有环
- 从 `entry` 出发必须能覆盖所有节点
- 不可达节点视为错误

## LLM / Script 节点

- `llm` 节点 body 去空白后不能为空
- `script` 节点必须有合法 `exec`
- `retry.max_attempts` 若存在，必须为正整数
- 正文和 `exec.args` 中只允许：
  - `{{initial.stdout}}`
  - `{{node_id.stdout}}`
  - `{{node_id.stderr}}`
- 普通节点中的这些引用，必须指向文件顺序上更早的节点

## Router 节点

- `type` 必须为 `router`
- 不允许声明 `produces`
- 不允许声明 `exec`
- 不允许声明 `model`
- 不允许声明普通 `next`
- `routes` 必须非空
- `default_next` 必填
- `when.source` 只允许：
  - `<node_id>.status`
  - `<node_id>.returncode`
  - `<node_id>.attempts`
  - `<node_id>.stdout`
  - `<node_id>.stderr`
- 每条 route 只能包含一个判断字段：
  - `equals`
  - `contains`
  - `regex`
  - `gte`
- 第一版保守规则：
  - `router.when.source` 只允许引用该 router 的直接前驱节点

## 输出声明

- `produces` 若存在，必须是非空字符串
- `produces` 按相对 `outputs/` 解析
- `produces` 不允许绝对路径、`..`
- 多个节点不允许声明相同的 `produces`
- `final_outputs` 中每个文件都必须至少被某个节点 `produces` 覆盖
