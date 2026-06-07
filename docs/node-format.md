# 节点文件规范

本文档固定 `mdflow` 一阶段的节点文件协议。

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
- `script` 节点的 `body` 仅作说明，不参与执行

## 公共字段

所有节点都必须包含：

- `id: string`
- `type: llm | script`
- `next: string | null`

可选字段：

- `name: string`
- `produces: string`

### `produces`

`produces` 表示这个节点声明一个最终输出文件，路径始终相对于 `outputs/`。

一阶段的实际行为分两类：

- `llm` 节点：
  把当前节点的 `trace/<node>.stdout.txt` 复制到 `outputs/<produces>`
- `script` 节点：
  如果脚本执行后已经在 `outputs/<produces>` 写出了真实文件，则直接登记该文件
  如果该文件不存在，才 fallback 为把当前节点的 `stdout` 复制到 `outputs/<produces>`

示例：

```yaml
produces: std.cpp
```

## 节点引用规则

一阶段统一使用双花括号语法引用节点输出：

```text
{{initial.stdout}}
{{generate_statement.stdout}}
{{package_data.stderr}}
```

只支持：

- `{{initial.stdout}}`
- `{{node_id.stdout}}`
- `{{node_id.stderr}}`

其中：

- `initial.stdout` 对应 `trace/00_initial.stdout.txt`
- `node_id.stdout` 对应该节点的标准输出文件
- `node_id.stderr` 对应该节点的标准错误文件

### 在 `llm` 节点里

引用会替换成对应文件的文本内容。

### 在 `script` 节点里

当引用出现在 `exec.args` 中时，会替换成对应 trace 文件的绝对路径。

## LLM 节点规范

### 允许字段

- `id`
- `type`
- `next`
- `name`
- `produces`
- `model`

### `model`

一阶段支持：

- `provider`
- `model`
- `temperature`
- `max_tokens`

实际执行时按以下顺序合并：

1. `mdflow.yaml`
2. `workflow.md`
3. 当前节点 `model`

### 示例

```md
---
id: generate_std
type: llm
produces: std.cpp
next: generate_gen
model:
  model: gpt-5.4-mini
  temperature: 0.2
---

请根据下面题面直接输出可编译的 C++17 标准程序。
不要输出解释，不要使用代码围栏。

题面：
{{generate_statement.stdout}}
```

## Script 节点规范

### 允许字段

- `id`
- `type`
- `next`
- `name`
- `produces`
- `exec`

### `exec`

一阶段使用结构化执行配置：

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
    - --cases
    - "25"
  cwd: outputs
  timeout_sec: 300
```

支持字段：

- `program: string`
- `args: string[]`
- `cwd: string`
- `timeout_sec: integer`

### `exec.args`

规则：

- 按数组逐项传入，不走 shell 拼接
- `scripts/...` 这类 workflow 内脚本路径，会按 `workflow_dir` 解析成绝对路径
- `outputs/...`、`trace/...` 这类 run 内显式路径，会按 `run_dir` 解析成绝对路径
- 需要直接消费 trace 原件时，也可以用 `{{node_id.stdout}}` / `{{node_id.stderr}}`

推荐风格：

- workflow 私有脚本：`scripts/...`
- run 内最终文件：`outputs/...`
- run 内 trace 文件：`trace/...`

### `exec.cwd`

- 相对于当前 `run_dir`
- 必须留在 `run_dir` 内

### `exec.timeout_sec`

- 单位为秒
- 一阶段要求显式填写
- 超时后节点立即失败

### 示例

```md
---
id: package_data
type: script
produces: data.zip
next: null
exec:
  program: python
  args:
    - scripts/package_data.py
    - --statement
    - outputs/题面.md
    - --std
    - outputs/std.cpp
    - --gen
    - outputs/gen.cpp
    - --out
    - outputs/data.zip
    - --cases
    - "25"
  cwd: outputs
  timeout_sec: 300
---

编译标准程序和数据生成器，生成 25 组平铺的 .in/.out，并打成 data.zip。
```

## 当前节点协议总结

1. 使用 `YAML front matter + Markdown body`
2. 节点引用统一使用 `{{initial.stdout}}`、`{{node_id.stdout}}`、`{{node_id.stderr}}`
3. `llm` 节点的 `body` 参与执行，`script` 节点的 `body` 不参与执行
4. `script` 节点优先使用显式文件路径，如 `outputs/std.cpp`
5. `produces` 对 `llm` 是发布 stdout，对 `script` 是声明最终输出目标，优先认脚本实际写出的文件
