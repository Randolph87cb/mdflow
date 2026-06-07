# 二阶段执行模型设计

本文档描述 `mdflow` 二阶段的执行模型。

状态说明：

- 本文档当前作为二阶段实现参考
- 已实现能力以仓库中的代码和规范文档为准
- 保留少量设计背景说明，方便继续扩展

## 二阶段目标

二阶段先不追求“通用工作流状态机”，而是解决这两个高价值场景：

1. 根据某个节点的输出结果决定下一个节点
2. 某个节点失败后，支持自动重试；若仍失败，人工修复文件后，从该失败节点重新运行

典型场景：

```text
生成 C++
  ↓
编译 + 最小样例运行检查
  ↓
根据检查结果决定：
  成功 → 生成数据生成器 / 打包
  失败 → 修复
```

```text
某节点自动重试超过 3 次
  ↓
本次 run 失败结束
  ↓
人工修改 outputs/ 下的文件
  ↓
从失败节点重新发起一个新 run
```

## 二阶段范围

二阶段建议只做下面这些能力：

- `router` 节点
- 节点级 `retry.max_attempts`
- `mdflow rerun <run_dir> --from <node_id>`

二阶段先不做：

- `manual` 节点
- `waiting_manual` 状态
- 节点跳过
- 断点暂停
- 并行执行
- 通用表达式语言

## 核心设计原则

### 1. 普通节点继续只负责执行

普通业务节点仍然是：

- `llm`
- `script`

它们负责真正产出结果，不承担分支判断职责。

### 2. 分支判断集中到 `router` 节点

不建议把每个节点的 `next` 直接升级成复杂条件表达式。

建议新增 `router` 节点，由它读取前序节点的执行结果，决定真正的下一个节点。

好处：

- 普通节点协议改动小
- 分支逻辑集中
- validator 和 runner 更容易实现

### 3. 人工处理不是节点，而是 runner 的外部能力

当某节点自动重试耗尽后：

- 当前 run 直接结束为 `failed`
- 用户手工修改 `outputs/` 下的文件
- 再用 `mdflow rerun --from <node_id>` 从失败节点重新发起一个新 run

也就是说：

- 不新增 `manual` 节点
- 不在 workflow 图中画“人工处理节点”
- 人工处理发生在 workflow 外部

## 协议设计

## 节点类型扩展

二阶段新增一种节点类型：

- `router`

现有节点类型保留：

- `llm`
- `script`

## 节点级重试

普通节点新增可选字段：

```yaml
retry:
  max_attempts: 3
```

规则：

- 不写 `retry`：默认只执行 1 次
- 写 `retry.max_attempts: 3`：该节点最多执行 3 次
- 若仍失败：本次 run 结束为 `failed`

这里的 `max_attempts` 表示总尝试次数，不是“额外重试次数”。

## `router` 节点格式

推荐格式：

```md
---
id: route_compile
type: router
routes:
  - when:
      source: compile_std.status
      equals: success
    next: run_std
  - when:
      source: compile_std.status
      equals: failed
    next: fix_std
default_next: fix_std
---

根据编译节点的执行结果决定下一步。
```

## `router` 字段

必填字段：

- `id`
- `type: router`
- `routes`

可选字段：

- `name`
- `default_next`

说明：

### `routes`

有序规则列表，按顺序匹配，命中第一条即停止。

### `default_next`

当所有 `routes` 都未命中时使用。

若未配置 `default_next` 且没有命中任何规则，则当前 run 失败。

## `when.source` 初始支持范围

二阶段建议先只支持：

- `<node_id>.status`
- `<node_id>.returncode`
- `<node_id>.stdout`
- `<node_id>.stderr`
- `<node_id>.attempts`

其中：

- `status` 取值通常是 `success` / `failed`
- `returncode` 主要用于 script 节点
- `stdout` / `stderr` 用于文本判断
- `attempts` 表示某节点在当前 run 中已经执行了多少次

## 条件判断初始支持范围

二阶段建议先只支持：

- `equals`
- `contains`
- `regex`
- `gte`

示例：

```yaml
when:
  source: compile_std.status
  equals: success
```

```yaml
when:
  source: run_std.stderr
  contains: segmentation fault
```

```yaml
when:
  source: compile_std.attempts
  gte: 3
```

## 典型工作流写法

推荐拆成这样的节点链：

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

当前 `problem_gen` 示例就采用这条精简链。

示例中的 `build_and_run_std`：

```md
---
id: build_and_run_std
type: script
next: route_std_result
retry:
  max_attempts: 2
exec:
  program: python
  args:
    - scripts/build_and_run_cpp.py
    - --src
    - outputs/std.cpp
    - --label
    - std.cpp
    - --statement
    - outputs/题面.md
  cwd: .
  timeout_sec: 120
---
```

这里把“编译”和“最小样例运行检查”合并到了一个节点里，避免 workflow 被拆得过碎。

## 运行时行为

## 普通节点执行

普通节点执行逻辑升级为：

1. 执行当前节点
2. 若成功：
   - 记录成功事件
   - 进入 `next`
3. 若失败：
   - 查看 `retry.max_attempts`
   - 未耗尽则自动重试
   - 已耗尽则本次 run 失败结束

## `router` 节点执行

`router` 节点不调用 LLM，也不调用脚本。

执行逻辑：

1. 读取 `routes`
2. 依次判断条件
3. 命中第一条则进入该 `next`
4. 若都未命中：
   - 有 `default_next` 则进入它
   - 否则 run 失败

## 自动重试

建议为每次尝试单独落盘 trace 文件，文件名带 attempt 编号：

- `03_build_and_run_std.attempt-01.stdout.txt`
- `03_build_and_run_std.attempt-01.stderr.txt`
- `03_build_and_run_std.attempt-02.stdout.txt`

这样不会覆盖之前的失败证据。

## 当前文件引用补充

二阶段示例里，为了避免再引入额外的“capture”节点，`llm` 正文现在允许直接读取 run 内文件：

```text
{{file:outputs/std.cpp}}
```

适用场景：

- 修复节点直接读取当前 `outputs/std.cpp`
- 后续生成节点直接读取当前 `outputs/std.cpp`

这样 workflow 可以保持更薄，不需要专门加“把文件内容重新打印到 stdout 再引用”的中转节点。

## rerun 设计

新增 CLI：

```bash
mdflow rerun <run_dir> --from <node_id>
```

语义：

- 读取旧 run 的输入和已有输出
- 创建一个新的 run
- 从指定节点开始执行
- 旧 run 保持不变

推荐行为：

- 新 run 复制旧 run 的 `outputs/`
- 新 run 的 `state.json.completed_nodes` 预填为该节点之前的已完成节点
- trace 中记录这是一次 rerun，并记录来源 run 和来源节点

这样适合下面的人工处理流程：

1. `compile_std` 连续失败 3 次
2. 本次 run 结束为 `failed`
3. 用户手工修改 `outputs/std.cpp`
4. 执行：

```bash
mdflow rerun runs/problem_gen/2026-06-07_12-30-00 --from build_and_run_std
```

5. 系统创建一个新 run，从 `build_and_run_std` 继续

## 状态文件扩展建议

`state.json` 最小扩展为：

```json
{
  "run_id": "2026-06-07_12-30-00",
  "workflow_id": "problem_gen",
  "status": "running",
  "current_node": "compile_std",
  "completed_nodes": [
    "generate_statement",
    "generate_std"
  ],
  "outputs": {
    "题面.md": "outputs/题面.md",
    "std.cpp": "outputs/std.cpp"
  },
  "node_attempts": {
    "compile_std": 2
  },
  "last_failure": {
    "node_id": "compile_std",
    "error_type": "script_exit_nonzero",
    "message": "Script exited with non-zero status"
  }
}
```

新增字段：

- `node_attempts`
- `last_failure`

当前阶段不新增 `waiting_manual` 状态。

## trace 事件扩展建议

建议新增这些事件：

- `node_retry_scheduled`
- `router_selected`
- `run_rerun_started`

这样可以清楚记录：

- 哪个节点在重试
- router 选中了哪条分支
- 当前 run 是否来源于旧 run 的 rerun

## Validator 升级方向

当前 validator 默认按单链模型工作。二阶段需要升级为图模型。

建议新增校验：

- `router.routes` 不能为空
- 每条 route 都必须有合法的 `when` 和 `next`
- `source` 中引用的节点必须存在
- `next` 和 `default_next` 指向的节点必须存在
- 图允许出现环
- 但仍要能从入口节点出发覆盖所有需要执行的节点

## Runner 升级方向

当前 runner 是：

- 预先构建 `ordered_nodes`
- 顺序 `for` 循环执行

二阶段建议改成：

- 使用 `while current_node_id is not None`
- 每次根据当前节点类型决定下一个节点

这样才能支持：

- `router` 动态分支
- 环
- 重试

## 二阶段实现顺序建议

1. 先更新文档并锁协议
2. 扩 `models.py`
3. 扩 `parser.py`
4. 扩 `validator.py`
5. 扩 `trace.json` / `state.json`
6. 改 `runner.py`
7. 新增 `mdflow rerun --from`

## 当前结论

二阶段最小可落地方案是：

- 用 `router` 节点做基于输出的分支判断
- 用节点级 `retry.max_attempts` 做自动重试
- 失败后不引入专门的人工节点或等待状态
- 通过 `mdflow rerun <run_dir> --from <node_id>` 支持人工修复文件后的重新执行
