# 节点文件规范

本文档描述当前已实现的节点协议。

## 总体格式

每个节点文件统一使用：

```md
---
# YAML front matter
---

# Markdown body
```

规则：

- `front matter` 给 engine 读取
- `body` 给人阅读
- `llm` 节点的 `body` 直接作为 prompt 模板
- `script` 和 `router` 节点的 `body` 只作说明，不参与执行

## 节点类型

当前支持三种节点：

- `llm`
- `script`
- `router`

## 公共字段

所有节点都支持：

- `id: string`
- `type: llm | script | router`
- `name: string` 可选

普通执行节点还支持：

- `next: string | null`
- `produces: string` 可选
- `retry.max_attempts: int` 可选

`router` 节点支持：

- `routes`
- `default_next`

## `produces`

`produces` 表示声明一个最终输出文件，路径始终相对于 `outputs/`。

行为：

- `llm` 节点：
  把当前节点最后一次 attempt 的 `stdout` 复制到 `outputs/<produces>`
- `script` 节点：
  如果脚本执行后已经写出了 `outputs/<produces>`，则直接登记该文件
  否则 fallback 为把最后一次 attempt 的 `stdout` 复制到 `outputs/<produces>`
- `router` 节点：
  不允许声明 `produces`

## 节点引用规则

统一使用双花括号语法引用节点输出：

```text
{{initial.stdout}}
{{generate_statement.stdout}}
{{compile_std.stderr}}
```

只支持：

- `{{initial.stdout}}`
- `{{node_id.stdout}}`
- `{{node_id.stderr}}`

语义：

- 在 `llm` 节点里，替换为对应文件内容
- 在 `script` 节点 `exec.args` 里，替换为对应 trace 文件的绝对路径
- 若某节点存在多次 attempt，默认引用该节点**最后一次 attempt** 的结果

## `retry`

普通执行节点支持：

```yaml
retry:
  max_attempts: 3
```

规则：

- 不写 `retry` 时，默认只执行 1 次
- `max_attempts` 表示该节点在**一次进入该节点时**最多自动尝试的次数
- runner 会在同一 run 内自动重试
- 若节点失败且其 `next` 是 `router`，失败结果会交给 router 决策
- 若节点失败且没有后续 router 接管，则当前 run 结束为 `failed`

## `router` 节点

推荐格式：

```md
---
id: route_compile
type: router
routes:
  - when:
      source: compile_std.status
      equals: success
    next: package
  - when:
      source: compile_std.stderr
      contains: compile error
    next: fix_std
default_next: package
---

根据编译结果决定下一步。
```

### `routes`

有序规则列表，命中第一条后停止。

每条 route 固定包含：

- `when.source`
- 一个判断字段：
  - `equals`
  - `contains`
  - `regex`
  - `gte`
- `next`

### `when.source`

当前支持：

- `<node_id>.status`
- `<node_id>.returncode`
- `<node_id>.attempts`
- `<node_id>.stdout`
- `<node_id>.stderr`

### `default_next`

当所有 route 都未命中时使用。

当前实现要求 `router` 必须显式写 `default_next`。

## `script` 节点规范

`script` 节点仍使用结构化执行配置：

```yaml
exec:
  program: python
  args:
    - scripts/package_data.py
    - --std
    - outputs/std.cpp
    - --gen
    - outputs/gen.cpp
    - --out
    - outputs/data.zip
  cwd: outputs
  timeout_sec: 300
```

规则：

- `scripts/...` 按 `workflow_dir` 解析
- `outputs/...`、`trace/...` 按 `run_dir` 解析
- `exec.cwd` 相对 `run_dir`
- `exec.timeout_sec` 必填

## 当前节点协议总结

1. 业务执行节点用 `llm` / `script`
2. 分支判断用 `router`
3. 节点失败可在同一 run 内自动重试
4. 文本引用统一使用 `{{node_id.stdout}}` / `{{node_id.stderr}}`
5. rerun 时，已完成节点若有 `produces`，会通过复制旧 run 的 `outputs/` 重新作为新 run 的起点
