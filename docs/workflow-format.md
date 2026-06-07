# 工作流文件规范

本文档用于固定 `mdflow` 一阶段的 `workflow.md` 协议。

`workflow.md` 的定位很明确：

- 保存工作流级配置
- 保存给人看的说明文档

它不负责：

- 推断执行图
- 推断节点依赖
- 决定真实执行顺序

真实执行顺序只认各节点里的 `next`。

## 总体格式

统一使用：

```md
---
# YAML front matter
---

# Markdown body
```

规则如下：

- `front matter` 给 engine 读取
- `body` 只给人阅读
- 正文不参与执行

## 推荐格式

```md
---
id: problem_gen
name: Problem Generation
entry: generate_statement
model:
  provider: openai_main
  model: gpt-4.1-mini
  temperature: 0.7
  max_tokens: 4000
final_outputs:
  - statement.md
  - solution.md
  - std.cpp
  - run_result.txt
  - package.json
---

# Problem Generation

这里写这个工作流是做什么的。

可以写：

- 目标
- 适用场景
- 主要节点说明
- 输入约定
- 最终交付物说明
- Mermaid 图

这些内容都只用于阅读，不参与执行。
```

## Front Matter 字段

### 必填字段

- `id: string`
- `entry: string`
- `final_outputs: string[]`

### 建议字段

- `name: string`
- `model: object`

## 字段含义

### `id`

工作流唯一标识。

建议规则：

- 与工作流目录名一致
- 只使用字母、数字、下划线和短横线

示例：

```yaml
id: problem_gen
```

### `name`

工作流展示名称。

示例：

```yaml
name: Problem Generation
```

### `entry`

入口节点的 `id`。

示例：

```yaml
entry: generate_statement
```

这是实际执行的起点。

### `model`

工作流级默认模型配置。

它为所有 `llm` 节点提供默认值，节点可以单独覆盖。

一阶段先支持：

- `provider`
- `model`
- `temperature`
- `max_tokens`

实际执行时优先级为：

1. `mdflow.yaml` 项目默认值
2. `workflow.md` 工作流默认值
3. `node.md` 节点覆盖值

### `final_outputs`

声明这个工作流最终应该交付哪些文件。

规则如下：

- 必填
- 每一项都相对于 `outputs/`
- 这里只写必要的最终输出文件

示例：

```yaml
final_outputs:
  - statement.md
  - solution.md
  - std.cpp
```

这个字段主要用于：

- `validate` 检查配置是否合理
- `show` 展示工作流交付目标
- 运行完成后检查最终产物是否齐全

## Body 规则

正文完全按说明文档处理。

可以写：

- 工作流目标
- 使用场景
- 节点概览
- 输入说明
- 输出说明
- Mermaid 图
- 维护备注

但 engine 不解析正文结构，也不根据正文决定执行逻辑。

## Validator 最小检查项

一阶段建议只检查这些内容：

1. `workflow.md` 文件存在
2. front matter 能被正确解析
3. `id` 存在且格式合法
4. `entry` 存在
5. `entry` 指向的节点存在
6. `final_outputs` 必须存在且必须是字符串列表
7. 如果存在 `model`，其字段必须合法

## 当前规范总结

一阶段的 `workflow.md` 固定为：

1. 使用 `YAML front matter + Markdown body`
2. 承担工作流级配置和说明文档职责
3. 正文不参与执行
4. Mermaid 可写，但只用于展示
5. 执行顺序只认节点里的 `next`
