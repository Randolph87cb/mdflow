# Workflow Studio 页面职责

本文档固定 `mdflow Workflow Studio` 当前阶段的页面边界，避免把“工作流定义”、“单次运行调试”和“最终产物查看”混在同一页里。

## 页面总览

当前 Studio 只保留 3 个主页面：

1. workflow 列表页
2. workflow 详情页
3. run 详情页

原则：

- 列表页负责“找到”
- workflow 详情页负责“理解和编辑定义”
- run 详情页负责“观察执行、排查问题、查看产物、决定 rerun”

---

## 1. Workflow 列表页

路由：

- `/`

一句话职责：

> 在首页完成 workflow 选择、当前摘要查看、关键操作和结构预览。

### 应承载的功能

- 四区工作台布局
  - 顶部红色区：当前 workflow 信息栏
  - 左侧绿色区：workflow 列表
  - 右上蓝色区：四个关键操作
  - 右下黑色区：当前 workflow 节点图预览
- 顶部当前 workflow 信息栏
  - `workflow_id`
  - `name`
  - `workflow_path`
  - `entry`
  - 节点数
  - final outputs 数
  - 最近一次 run 状态
  - 最近一次 run 时间
  - 最近一次 `run_id`
- 左侧 workflow 列表
  - `workflow_id`
  - `name`
  - 节点数
  - 最近一次 run 状态
  - 最近一次 run 时间
- 四个固定动作
  - `打开最新运行`
  - `历史运行列表`
  - `运行`
  - `复制`
- 当前 workflow 节点图预览
  - graph
  - 入口节点
  - 节点数
  - final outputs 数
  - workflow_path

### 不应承载的功能

- 节点 trace 查看
- outputs 预览
- 节点源码编辑
- rerun from node

### 页面目标

- 10 秒内找到目标 workflow
- 不离开首页即可理解当前 workflow 的整体结构
- 1 次点击进入 workflow 详情或最近一次 run
- 1 次点击直接发起新 run

---

## 2. Workflow 详情页

路由：

- `/workflows/:workflowId`

一句话职责：

> 看 workflow 定义，理解结构，编辑节点，查看历史 runs。

### 应承载的功能

- workflow 基本信息
  - `workflow_id`
  - `entry`
  - 节点数
  - final outputs 数
- graph
- 节点列表
- 历史 runs 列表
- 节点查看与编辑
- 操作
  - `Run workflow`
  - `Copy workflow`
  - `Edit node`

### 右侧 Inspector 的职责

workflow 详情页里的 inspector 只看 **live workflow 定义**：

- `Source`
- `Meta`

这里不展示运行时 trace，不展示 stdout/stderr，不展示 outputs 文件内容。

### 不应承载的功能

- 当前 run 的实时 stdout/stderr
- 大块 trace 调试信息
- outputs 下载区
- rerun from node

### 页面目标

- 回答“这个 workflow 是怎么构成的”
- 回答“应该改哪个节点”
- 回答“最近跑过哪些 run”

---

## 3. Run 详情页

路由：

- `/workflows/:workflowId/runs/:runId`

一句话职责：

> 一次运行的调试工作台。

run 详情页不是 workflow 说明页，也不是 live workflow 编辑页。

它只回答 5 个问题：

1. 这次 run 现在是什么状态
2. 卡在哪个节点，或者最后失败在哪个节点
3. 这个节点到底输出了什么，报了什么错
4. 这次 run 最终产出了什么
5. 是否要从某个节点重新发起 rerun

### 3.1 顶部状态条

职责：

> 提供 run 全局摘要。

应展示：

- `run_id`
- `workflow_id`
- `status`
- `current_node`
- `started_at`
- duration
- snapshot 标识
- 若为 rerun，则显示 `source_run_id`
- 若为 rerun，则显示 `rerun_from_node`
- 完成节点数量
- outputs 数量

不展示：

- 长 trace 内容
- 节点源码
- workflow 长说明

### 3.2 左栏：Run Graph

职责：

> 成为调试导航器。

应展示：

- 节点图
- 节点状态色
- 当前选中节点高亮
- 节点 attempts
- router 分支边
- 失败节点强调

交互：

- 点击节点，切换当前选中节点
- 默认聚焦规则：
  - 运行中：`current_node`
  - 失败：`last_failure.node_id`
  - 成功：最后一个完成节点

左栏底部应展示：

- 当前选中节点摘要
  - `id`
  - `type`
  - `status`
  - `attempts`
- `Rerun from selected node`

### 3.3 中栏上半：Trace

职责：

> 展示当前选中节点的执行证据。

对 LLM 节点展示：

- input
- prompt
- stdout / output
- attempt 编号

对 script 节点展示：

- input
- stdout
- stderr
- output
- attempt 编号

对 router 节点展示：

- route match
- selected next
- source
- operator

交互要求：

- 折叠和滚动应友好
- 文本可复制
- 标题要明确当前节点和当前状态

### 3.4 中栏下半：Node Definition

职责：

> 展示当前 run snapshot 中的节点定义。

这里必须明确是 **workflow snapshot** 视角，而不是 live workflow。

应展示：

- `Source`
- `Meta`

`Meta` 至少应包含：

- `type`
- `produces`
- `next`
- `retry`
- `default_next`
- `path`

若是 router 节点，还应展示：

- routes 列表

这里不承载 trace，不承载 outputs 预览。

### 3.5 右栏：Outputs

职责：

> 只看最终交付物，不混 trace。

应展示：

- outputs 列表
- 文件大小
- 文件类型
- 是否可预览
- 选中后预览
- 单文件下载
- 多选下载 zip

文本可预览类型：

- `.md`
- `.txt`
- `.cpp`
- `.py`
- `.json`
- `.yaml`
- `.yml`

二进制文件：

- 只显示 metadata
- 提供下载，不做正文预览

### 3.6 Run 页默认交互

run 页当前交互目标固定为：

1. 进入页面后自动聚焦当前最相关节点
2. 沿图点击节点，trace 和 definition 同步切换
3. 选择 outputs 文件，在右栏预览
4. 从选中节点重新发起 rerun

### 3.7 Run 页不应承载的功能

- live workflow 节点编辑
- workflow 结构编辑
- workflow 长说明
- 最近 runs 大列表
- provider 或项目级设置

换句话说：

> run 页只处理“这一趟执行发生了什么”，不处理“整个 workflow 的所有事情”。

---

## 当前页面边界总结

### Workflow 列表页

找 workflow，快速进入和运行。

### Workflow 详情页

看定义，改节点，看历史 runs。

### Run 详情页

看执行、查问题、看产物、决定 rerun。
