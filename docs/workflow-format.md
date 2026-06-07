# 工作流文件规范

本文档描述当前已实现的 `workflow.md` 协议。

## 总体格式

统一使用：

```md
---
# YAML front matter
---

# Markdown body
```

正文只给人阅读，不参与执行。

## Front Matter 字段

必填：

- `id`
- `entry`
- `final_outputs`

建议：

- `name`
- `model`

## 字段规则

### `id`

- 工作流唯一标识
- 应与目录名一致
- 只允许字母、数字、下划线、短横线

### `entry`

- 入口节点 id
- runner 从这里开始执行

### `model`

工作流级默认模型配置，支持：

- `provider`
- `model`
- `temperature`
- `max_tokens`

优先级：

1. `mdflow.yaml`
2. `workflow.md`
3. 节点 `model`

### `final_outputs`

声明整个 workflow 最终必须交付的文件列表。

规则：

- 每一项都相对于 `outputs/`
- 每一项都必须至少被某个节点 `produces` 覆盖

## 执行图规则

当前实现已不再限定为单链。

支持：

- 普通节点通过 `next` 串联
- `router` 节点通过 `routes[].next` 和 `default_next` 分支
- 图中允许出现环

要求：

- 所有节点都必须从 `entry` 可达
- 所有目标节点都必须存在

## 示例

```md
---
id: problem_gen
name: Problem Generation
entry: generate_statement
model:
  provider: micu_main
  model: gpt-5.4-mini
  temperature: 0.5
  max_tokens: 8000
final_outputs:
  - 题面.md
  - std.cpp
  - gen.cpp
  - data.zip
---

# Problem Generation

这里写工作流说明、节点概览和使用方法。
```

## 当前 `problem_gen` 示例

当前仓库中的 `problem_gen` 是一个二阶段精简示例，节点链为：

```text
generate_statement
  ↓
generate_std
  ↓
build_and_run_std
  ↓
route_std_result
  ├─ success → generate_gen
  └─ failed  → fix_std

fix_std
  ↓
build_and_run_std

generate_gen
  ↓
package_data
```

这个示例同时演示：

- `router` 分支
- `retry.max_attempts`
- 同名 `produces` 的后写覆盖
- `rerun --from <node_id>`
