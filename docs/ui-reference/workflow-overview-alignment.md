# Workflow 工作台参考与截图对齐

## 基线文件

- 参考图：`docs/ui-reference/workflow-overview-reference-1440.png`
- 目标页面：`/`
- 主基线视口：`1440 x 1200`
- 样例工作流：默认使用首页自动选中的第一条活跃工作流；当前仓库应优先落在 `problem_gen`

## 四个首屏模块

1. 顶部红色区：当前工作流信息栏
2. 左侧绿色区：现有工作流列表
3. 右上蓝色区：四个固定动作按钮
4. 下方黑色区：当前工作流节点图预览

## 顶部红色区字段

- `workflow_id`
- `name`
- `workflow_path`
- `entry`
- 节点数
- final outputs 数
- 最近一次 run 状态
- 最近一次 run 时间
- 最近一次 `run_id`

## 截图命名

- `workflow-overview-step-01-reference.png`
- `workflow-overview-step-02-hero.png`
- `workflow-overview-step-03-sidebar.png`
- `workflow-overview-step-04-actions.png`
- `workflow-overview-step-05-graph.png`
- `workflow-overview-step-06-final.png`

所有对齐截图都保存在 `docs/ui-reference/checkpoints/`。

## 通过标准

- 模块位置：四个区域与参考图分区关系一致，首屏不混入详情信息。
- 尺寸比例：左栏明显窄于右侧主区，动作条横向占满主区上方，图区占据最大面积。
- 色块层级：红、绿、蓝、黑四个主分区要清晰，但仍维持当前项目的浅色马卡龙与圆角语言。
- 交互顺序：按钮顺序固定为“打开最新运行 / 历史运行列表 / 运行 / 复制”。

## 回归检查

- 选择左侧不同工作流后，顶部当前工作流信息和节点图同步切换。
- `打开最新运行` 直达最近一次运行页；无运行时禁用。
- `历史运行列表` 直达工作流详情页。
- 首页不再展示历史运行列表、当前节点定义或工作流产物。
