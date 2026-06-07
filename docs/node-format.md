# 节点文件规范

本文档用于固定 `mdflow` 一阶段的节点文件协议。

目标是让节点定义同时满足这几个要求：

- 适合直接用 Markdown 编辑
- 让 engine 易于解析和校验
- 支持不同节点使用不同模型
- 不显式维护 `uses`、`slot` 或 artifact map
- `script` 节点可以明确执行目录和输入文件
- 节点之间直接引用上游节点的 `stdout` / `stderr`

## 总体格式

每个节点文件统一使用：

```md
---
# YAML front matter
---

# Markdown body
```

规则如下：

- `front matter` 给 engine 读取
- `body` 给人阅读
- 对 `llm` 节点，`body` 直接作为 prompt 模板
- 对 `script` 节点，`body` 仅作说明，不参与执行

## 公共字段

所有节点都必须包含以下字段：

- `id: string`
- `type: llm | script`
- `next: string | null`

可选字段：

- `name: string`
- `produces: string`

### `id`

节点唯一标识，用于：

- 节点连线
- trace 记录
- 运行日志展示

### `type`

一阶段只支持两类节点：

- `llm`
- `script`

### `produces`

表示是否把当前节点的 `stdout` 额外发布到 `outputs/` 目录。

规则如下：

- 这是可选字段
- 只支持单个文件名或相对路径
- 目标路径始终相对于 `outputs/`
- engine 会把 `trace/<node>.stdout.txt` 复制一份到 `outputs/<produces>`

示例：

```yaml
produces: statement.md
```

表示把该节点的 `stdout` 复制到：

```text
outputs/statement.md
```

### `next`

表示下一个节点的 `id`。

规则如下：

- 有后继节点时写字符串
- 最后一个节点写 `null`

## 不再使用的字段

一阶段节点协议中不再使用：

- `uses`
- `slot`

原因是：

- 不显式声明输入依赖
- 不再维护单独的 artifact 映射协议
- 节点直接引用上游节点的标准输出或标准错误

## 节点引用规则

一阶段统一使用双花括号语法引用节点输出：

```text
{{initial.stdout}}
{{generate_statement.stdout}}
{{run_cpp.stderr}}
```

支持的引用目标只有：

- `{{initial.stdout}}`
- `{{node_id.stdout}}`
- `{{node_id.stderr}}`

其中：

- `initial.stdout` 指向 `trace/00_initial.stdout.txt`
- `node_id.stdout` 指向该节点的标准输出文件
- `node_id.stderr` 指向该节点的标准错误文件

### 在 `llm` 节点中

`{{node_id.stdout}}` 或 `{{node_id.stderr}}` 会替换为对应文件的文本内容。

例如：

```text
题面：
{{generate_statement.stdout}}
```

最终会把对应 trace 文件中的内容插入 prompt。

### 在 `script` 节点中

`{{node_id.stdout}}` 或 `{{node_id.stderr}}` 出现在 `exec.args` 里时，会替换为对应的绝对路径。

例如：

```yaml
args: ["scripts/run_cpp.py", "--src", "{{generate_cpp.stdout}}"]
```

最终脚本收到的是可直接读取的真实文件路径。

## LLM 节点规范

### 允许字段

`llm` 节点允许出现这些字段：

- `id`
- `type`
- `next`
- `name`
- `produces`
- `model`

### `model`

`model` 用于节点级模型覆盖。

一阶段先支持这些字段：

- `provider`
- `model`
- `temperature`
- `max_tokens`

这个字段不要求全部写全，实际执行时按以下优先级合并：

1. `mdflow.yaml` 项目默认值
2. `workflow.md` 工作流默认值
3. 当前节点的 `model` 覆盖值

### body 规则

`llm` 节点的 `body` 直接作为 prompt 模板。

示例：

```md
---
id: generate_cpp
type: llm
produces: std.cpp
next: run_cpp
model:
  model: gpt-4.1
  temperature: 0.2
---

请根据下面题面和解法生成 C++17 标准程序。

题面：
{{generate_statement.stdout}}

解法：
{{generate_solution.stdout}}
```

## Script 节点规范

### 允许字段

`script` 节点允许出现这些字段：

- `id`
- `type`
- `next`
- `name`
- `produces`
- `exec`

### `exec`

一阶段使用结构化执行配置，不使用单个字符串 `cmd`。

格式如下：

```yaml
exec:
  program: python
  args: ["scripts/run_cpp.py", "--src", "outputs/std.cpp", "--out", "outputs/run_result.txt"]
  cwd: outputs
  timeout_sec: 300
```

支持字段：

- `program: string`
- `args: string[]`
- `cwd: string`
- `timeout_sec: integer`

### `exec.program`

表示要执行的程序，例如：

- `python`
- `node`
- `cmd`

### `exec.args`

表示传给程序的参数列表。

规则如下：

- 按数组逐项传入，不走 shell 拼接
- 参数中优先推荐写显式路径
- `outputs/...`、`trace/...` 这类 run 内路径按 `run_dir` 解析为绝对路径
- 参数中也允许写 `{{initial.stdout}}`、`{{node_id.stdout}}`、`{{node_id.stderr}}`
- 这些引用会替换为对应 trace 文件的绝对路径

额外约定：

- 当 `program` 是解释器程序时，`args` 的第一个脚本路径参数可以写成相对于 `workflow_dir` 的路径
- 例如 `scripts/run_cpp.py`
- engine 在实际执行前应先把它解析成绝对路径，再传给子进程
- 其余普通参数不做自动路径改写，仍按原样传入

推荐风格：

- workflow 内脚本：`scripts/...`
- run 内最终文件：`outputs/...`
- run 内 trace 文件：`trace/...`
- 只有需要直接消费节点 trace 原件时，才使用 `{{node_id.stdout}}` / `{{node_id.stderr}}`

### `exec.cwd`

表示子进程执行时的工作目录。

规则如下：

- 相对于当前 `run_dir`
- 用于约束脚本默认写文件的位置

例如：

- `cwd: trace`
- `cwd: outputs`

如果 `cwd: outputs`，那么脚本里写相对路径 `statement.md`，实际会落到：

```text
runs/<workflow_id>/<run_id>/outputs/statement.md
```

### `exec.timeout_sec`

表示脚本执行超时时间，单位为秒。

规则如下：

- 一阶段要求显式填写
- 超时后节点立即失败
- `stderr` 中应记录超时信息

### body 规则

`script` 节点的 `body` 不参与执行，只保留说明用途。

示例：

```md
---
id: run_cpp
type: script
produces: run_result.txt
next: package
exec:
  program: python
  args: ["scripts/run_cpp.py", "--src", "outputs/std.cpp", "--out", "outputs/run_result.txt"]
  cwd: outputs
  timeout_sec: 300
---

编译并运行生成的标准程序。
```

## 打包节点示例

```md
---
id: package
type: script
produces: package.json
next: null
exec:
  program: python
  args:
    - "scripts/package.py"
    - "--statement"
    - "outputs/statement.md"
    - "--solution"
    - "outputs/solution.md"
    - "--code"
    - "outputs/std.cpp"
    - "--run-result"
    - "outputs/run_result.txt"
    - "--out"
    - "outputs/package.json"
  cwd: outputs
  timeout_sec: 300
---

整理最终交付物。
```

## 当前节点协议总结

一阶段节点协议固定为：

1. 使用 `YAML front matter + Markdown body`
2. 去掉 `uses`
3. 去掉 `slot`
4. 节点引用统一使用 `{{initial.stdout}}`、`{{node_id.stdout}}`、`{{node_id.stderr}}`
5. `llm` 节点在正文里引用内容
6. `script` 节点在 `exec.args` 里优先使用显式文件路径，需要时才引用节点输出
7. `produces` 可选，作用是把当前节点的 `stdout` 复制到 `outputs/`
8. `script` 节点必须支持 `exec.cwd` 和 `exec.timeout_sec`
9. `llm` 的 `body` 参与执行，`script` 的 `body` 不参与执行
