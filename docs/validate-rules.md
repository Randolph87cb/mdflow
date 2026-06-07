# 统一校验规则

本文档汇总 `mdflow validate` 与 `mdflow run` 前置校验共用的静态规则。

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

## 节点集合

- `nodes/` 目录存在且至少包含一个节点文件
- 每个节点文件 front matter 可解析
- 所有节点 `id` 唯一
- `entry` 指向的节点存在
- `next` 若为字符串，目标节点必须存在且不能指向自己
- 从 `entry` 出发不允许有环
- 不允许不可达节点

## LLM 节点

- `body` 去空白后不能为空
- `model` 若存在，只允许 `provider`、`model`、`temperature`、`max_tokens`
- `model.provider` 若存在，必须在 `providers` 中定义
- 正文引用只允许：
  - `{{initial.stdout}}`
  - `{{node_id.stdout}}`
  - `{{node_id.stderr}}`
- 被引用节点必须存在，且在执行顺序上先于当前节点可达

## Script 节点

- 必须有 `exec`
- `exec.program` 为非空字符串
- `exec.args` 为字符串列表
- `exec.cwd` 为非空字符串
- `exec.timeout_sec` 为正整数
- `exec.cwd` 按相对 `run_dir` 解析后不得逃出 `run_dir`
- `args[0]` 若识别为 workflow 内脚本路径，按 `workflow_dir` 解析后的文件必须存在
- 参数中的 `outputs/...`、`trace/...` 不允许绝对路径或 `..`
- 参数中的节点引用只允许：
  - `{{initial.stdout}}`
  - `{{node_id.stdout}}`
  - `{{node_id.stderr}}`

## 输出声明

- `produces` 若存在，必须是非空字符串
- `produces` 按相对 `outputs/` 解析
- `produces` 不允许绝对路径、`..`
- 多个节点不允许声明相同的 `produces`
- `final_outputs` 中每个文件都必须至少被某个节点 `produces` 覆盖

补充说明：

- `llm` 节点的 `produces` 总是通过复制 `stdout` 满足
- `script` 节点的 `produces` 允许由脚本直接写出真实文件，只要最终落在 `outputs/<produces>` 即视为满足
