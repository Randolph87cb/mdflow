# 工作流文件规范

本文档固定 `mdflow` 一阶段的 `workflow.md` 协议。

`workflow.md` 只负责两件事：

- 保存工作流级配置
- 保存给人看的说明文档

真实执行顺序只认各节点里的 `next`。

## 总体格式

统一使用：

```md
---
# YAML front matter
---

# Markdown body
```

正文只给人阅读，不参与执行。

## 推荐格式

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

这里写工作流说明、使用场景和节点概览。
```

## Front Matter 字段

### 必填

- `id: string`
- `entry: string`
- `final_outputs: string[]`

### 建议

- `name: string`
- `model: object`

## 字段规则

### `id`

- 工作流唯一标识
- 应与目录名一致
- 只允许字母、数字、下划线、短横线

### `entry`

- 入口节点 id
- 是实际执行起点

### `model`

工作流级默认模型配置。

一阶段支持：

- `provider`
- `model`
- `temperature`
- `max_tokens`

优先级：

1. `mdflow.yaml`
2. `workflow.md`
3. `node.md`

### `final_outputs`

声明这个工作流最终必须交付哪些文件。

规则：

- 每一项都相对于 `outputs/`
- 这里只写必要的最终输出文件
- 每一项都必须至少被某个节点 `produces` 覆盖

示例：

```yaml
final_outputs:
  - 题面.md
  - std.cpp
  - gen.cpp
  - data.zip
```

## Body 规则

正文完全按说明文档处理，可以写：

- 工作流目标
- 节点概览
- 输入约定
- 输出约定
- Mermaid 图
- 维护备注

但 engine 不会解析正文结构，也不会从正文推断执行逻辑。

## Validator 最小检查项

1. `workflow.md` 存在
2. front matter 可解析
3. `id`、`entry`、`final_outputs` 存在且格式合法
4. `entry` 指向的节点存在
5. `final_outputs` 不允许绝对路径、`..` 和重复项

## 当前规范总结

1. `workflow.md` 是工作流级配置和说明文档
2. 正文不参与执行
3. 执行顺序只认节点里的 `next`
4. `final_outputs` 必填，并写必要的最终交付文件
