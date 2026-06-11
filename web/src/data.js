function md({ id, type, next = null, produces = [], body }) {
  const produceBlock = produces.length
    ? `produces:\n${produces.map((item) => `  - ${item}`).join("\n")}\n`
    : "";

  return `---\nid: ${id}\ntype: ${type}\nnext: ${next ?? "null"}\n${produceBlock}---\n\n${body}\n`;
}

export const workflows = [
  {
    id: "summer_feature",
    name: "夏季专题出题流程",
    status: "running",
    workflowState: "草稿",
    lastRunRelative: "12 分钟前",
    nodeCount: 6,
    path: "workflows/summer_feature",
    entryNode: "problem_statement",
    entryLabel: "题面生成",
    outputs: 4,
    latestRunId: "run-2026-06-10-031",
    lastEdited: "今天 14:32",
    owner: "张同学",
    blurb: "围绕专题题目生成题面、样例、标准程序和发布产物，右侧固定栏只处理当前节点的 Markdown 编辑。",
    tags: ["出题类", "节点画布", "可重试"],
    graph: {
      nodes: [
        {
          key: "problem_statement",
          label: "题面生成",
          shortLabel: "题面",
          type: "markdown",
          badge: "M↓",
          state: "running",
          x: 36,
          y: 182,
          file: "workflows/summer/problem.md",
          outputHint: "problem.md",
          routeHint: "下游：样例构造",
          markdown: md({
            id: "problem_statement",
            type: "markdown",
            next: "sample_builder",
            produces: ["problem.md"],
            body: `# 夏季专题一 · 题目 A：清凉的西瓜

## 题目描述
小明在夏天买了一个大西瓜。西瓜可以看作一个半径为 R 的圆。小明想把它切成若干块，分给 n 个好朋友，希望每个人得到的面积都相同。

请输出每块西瓜的面积，保留 6 位小数。

## 输入格式
输入一行两个整数 R 和 n，表示西瓜半径和朋友数量。

## 输出格式
输出一个实数，表示每块西瓜的面积。

## 样例
\`\`\`text
输入：
10 5
\`\`\`

\`\`\`text
输出：
62.831853
\`\`\`

## 提示
- 1 <= n <= 1000
- 1 <= R <= 10^5

## 数据范围
本题共 10 个测试点。`
          })
        },
        {
          key: "sample_builder",
          label: "样例构造",
          shortLabel: "样例",
          type: "python",
          badge: "Py",
          state: "success",
          x: 236,
          y: 190,
          file: "scripts/gen_samples.py",
          outputHint: "samples/",
          routeHint: "上下游：题面生成 → 标准程序",
          markdown: md({
            id: "sample_builder",
            type: "python",
            next: "standard_solution",
            produces: ["samples/"],
            body: `# 样例构造

- 读取题面中的约束范围
- 自动生成基础样例、边界样例和随机样例
- 将样例输出到 \`samples/\` 目录

\`\`\`python
def build_samples(radius, friends):
    area = 3.1415926 * radius * radius / friends
    return {"radius": radius, "friends": friends, "area": area}
\`\`\`
`
          })
        },
        {
          key: "standard_solution",
          label: "标准程序",
          shortLabel: "标程",
          type: "python",
          badge: "Py",
          state: "success",
          x: 436,
          y: 188,
          file: "solutions/solution.py",
          outputHint: "solution.py",
          routeHint: "下游：数据校验、结果汇总",
          markdown: md({
            id: "standard_solution",
            type: "python",
            next: "data_validator",
            produces: ["solution.py"],
            body: `# 标准程序

## 目标
根据半径和朋友数计算每块西瓜面积。

\`\`\`python
import math

r, n = map(int, input().split())
print(f"{math.pi * r * r / n:.6f}")
\`\`\`

## 说明
- 使用 \`math.pi\` 计算圆面积
- 结果格式化为 6 位小数
`
          })
        },
        {
          key: "data_validator",
          label: "数据校验",
          shortLabel: "校验",
          type: "python",
          badge: "Py",
          state: "idle",
          x: 120,
          y: 458,
          file: "scripts/check.py",
          outputHint: "report.json",
          routeHint: "上游：样例构造、标准程序",
          markdown: md({
            id: "data_validator",
            type: "python",
            next: "result_aggregate",
            produces: ["report.json"],
            body: `# 数据校验

## 校验内容
- 样例是否合法
- 标准程序是否可运行
- 输出格式是否满足要求

\`\`\`python
def validate(case):
    assert case["friends"] > 0
    assert case["radius"] > 0
\`\`\`
`
          })
        },
        {
          key: "result_aggregate",
          label: "结果汇总",
          shortLabel: "汇总",
          type: "shell",
          badge: "Sh",
          state: "idle",
          x: 320,
          y: 458,
          file: "scripts/aggregate.sh",
          outputHint: "summary.md",
          routeHint: "上游：标准程序、数据校验",
          markdown: md({
            id: "result_aggregate",
            type: "shell",
            next: "release_ready",
            produces: ["summary.md"],
            body: `# 结果汇总

## 产出
- 合并校验报告
- 写出题面、样例与标程状态

\`\`\`bash
echo "生成 summary.md"
jq '.status' report.json
\`\`\`
`
          })
        },
        {
          key: "release_ready",
          label: "发布准备",
          shortLabel: "发布",
          type: "markdown",
          badge: "M↓",
          state: "idle",
          x: 520,
          y: 458,
          file: "workflows/summer/release.md",
          outputHint: "release/",
          routeHint: "上游：结果汇总",
          markdown: md({
            id: "release_ready",
            type: "markdown",
            next: null,
            produces: ["release/"],
            body: `# 发布准备

## 发布清单
- 题面文档
- 样例数据
- 标准程序
- 校验报告

## 检查项
- 文件命名统一
- 数据包可下载
- 说明文档完整
`
          })
        }
      ],
      edges: [
        ["problem_statement", "sample_builder"],
        ["sample_builder", "standard_solution"],
        ["sample_builder", "data_validator"],
        ["standard_solution", "result_aggregate"],
        ["standard_solution", "data_validator"],
        ["data_validator", "result_aggregate"],
        ["result_aggregate", "release_ready"]
      ]
    }
  },
  {
    id: "daily_report",
    name: "日报汇总流程",
    status: "success",
    workflowState: "已发布",
    lastRunRelative: "1 小时前",
    nodeCount: 5,
    path: "workflows/daily_report",
    entryNode: "collect_sources",
    entryLabel: "采集来源",
    outputs: 2,
    latestRunId: "run-2026-06-10-027",
    lastEdited: "今天 11:08",
    owner: "李同学",
    blurb: "收集输入来源后生成晨会日报，适合总览页验证高密度工作流浏览体验。",
    tags: ["汇总类"],
    graph: {
      nodes: [
        {
          key: "collect_sources",
          label: "采集来源",
          shortLabel: "采集",
          type: "python",
          badge: "Py",
          state: "success",
          x: 120,
          y: 180,
          file: "nodes/01_collect_sources.md",
          outputHint: "source.json",
          routeHint: "下游：生成草稿",
          markdown: md({
            id: "collect_sources",
            type: "python",
            next: "draft_report",
            body: "收集 issue、妙记和待办，整理为统一输入。"
          })
        },
        {
          key: "draft_report",
          label: "生成草稿",
          shortLabel: "草稿",
          type: "markdown",
          badge: "M↓",
          state: "success",
          x: 360,
          y: 180,
          file: "nodes/02_draft_report.md",
          outputHint: "draft.md",
          routeHint: "下游：审核润色",
          markdown: md({
            id: "draft_report",
            type: "markdown",
            next: "review_report",
            body: "根据结构化输入生成晨会日报草稿。"
          })
        },
        {
          key: "review_report",
          label: "审核润色",
          shortLabel: "审核",
          type: "markdown",
          badge: "M↓",
          state: "success",
          x: 610,
          y: 180,
          file: "nodes/03_review_report.md",
          outputHint: "review.md",
          routeHint: "下游：导出发布",
          markdown: md({
            id: "review_report",
            type: "markdown",
            next: "publish_report",
            body: "统一口吻、检查格式、补充风险项。"
          })
        },
        {
          key: "publish_report",
          label: "导出发布",
          shortLabel: "发布",
          type: "shell",
          badge: "Sh",
          state: "success",
          x: 860,
          y: 180,
          file: "scripts/publish_report.sh",
          outputHint: "daily-report.md",
          routeHint: "终点",
          markdown: md({
            id: "publish_report",
            type: "shell",
            next: null,
            body: "输出日报 Markdown 和晨会摘要片段。"
          })
        }
      ],
      edges: [
        ["collect_sources", "draft_report"],
        ["draft_report", "review_report"],
        ["review_report", "publish_report"]
      ]
    }
  },
  {
    id: "benchmark_suite",
    name: "基准评测流程",
    status: "failed",
    workflowState: "草稿",
    lastRunRelative: "34 分钟前",
    nodeCount: 7,
    path: "workflows/benchmark_suite",
    entryNode: "seed_matrix",
    entryLabel: "生成种子",
    outputs: 3,
    latestRunId: "run-2026-06-10-029",
    lastEdited: "今天 13:02",
    owner: "王同学",
    blurb: "并行跑多组评测并汇总结果，适合展示运行失败和节点重试语义。",
    tags: ["评测类", "重任务"],
    graph: {
      nodes: [
        {
          key: "seed_matrix",
          label: "生成种子",
          shortLabel: "种子",
          type: "python",
          badge: "Py",
          state: "success",
          x: 120,
          y: 180,
          file: "nodes/01_seed_matrix.md",
          outputHint: "seeds.json",
          routeHint: "下游：样例 A / B",
          markdown: md({
            id: "seed_matrix",
            type: "python",
            next: "case_a",
            body: "准备评测矩阵和输入数据。"
          })
        },
        {
          key: "case_a",
          label: "评测样例 A",
          shortLabel: "A",
          type: "python",
          badge: "Py",
          state: "failed",
          x: 360,
          y: 120,
          file: "nodes/02_case_a.md",
          outputHint: "case-a.log",
          routeHint: "下游：汇总评分",
          markdown: md({
            id: "case_a",
            type: "python",
            next: "merge_scores",
            body: "样例 A 评测失败，等待重试。"
          })
        },
        {
          key: "case_b",
          label: "评测样例 B",
          shortLabel: "B",
          type: "python",
          badge: "Py",
          state: "success",
          x: 360,
          y: 250,
          file: "nodes/03_case_b.md",
          outputHint: "case-b.log",
          routeHint: "下游：汇总评分",
          markdown: md({
            id: "case_b",
            type: "python",
            next: "merge_scores",
            body: "样例 B 已完成。"
          })
        },
        {
          key: "merge_scores",
          label: "汇总评分",
          shortLabel: "汇总",
          type: "shell",
          badge: "Sh",
          state: "idle",
          x: 640,
          y: 185,
          file: "scripts/merge_scores.sh",
          outputHint: "scores.json",
          routeHint: "下游：导出快照",
          markdown: md({
            id: "merge_scores",
            type: "shell",
            next: "export_suite",
            body: "合并评分结果，等待前序任务完成。"
          })
        },
        {
          key: "export_suite",
          label: "导出快照",
          shortLabel: "导出",
          type: "markdown",
          badge: "M↓",
          state: "idle",
          x: 900,
          y: 185,
          file: "nodes/05_export_suite.md",
          outputHint: "report.md",
          routeHint: "终点",
          markdown: md({
            id: "export_suite",
            type: "markdown",
            next: null,
            body: "导出评测结果和快照报告。"
          })
        }
      ],
      edges: [
        ["seed_matrix", "case_a"],
        ["seed_matrix", "case_b"],
        ["case_a", "merge_scores"],
        ["case_b", "merge_scores"],
        ["merge_scores", "export_suite"]
      ]
    }
  },
  {
    id: "article_flow",
    name: "文章流水线",
    status: "idle",
    workflowState: "草稿",
    lastRunRelative: "未运行",
    nodeCount: 5,
    path: "workflows/article_flow",
    entryNode: "outline_topic",
    entryLabel: "生成提纲",
    outputs: 3,
    latestRunId: "暂无运行记录",
    lastEdited: "昨天 18:42",
    owner: "周同学",
    blurb: "从选题生成提纲、初稿和最终文稿，偏内容生产型。",
    tags: ["内容类"],
    graph: {
      nodes: [
        {
          key: "outline_topic",
          label: "生成提纲",
          shortLabel: "提纲",
          type: "markdown",
          badge: "M↓",
          state: "idle",
          x: 120,
          y: 180,
          file: "nodes/01_outline_topic.md",
          outputHint: "outline.md",
          routeHint: "下游：撰写初稿",
          markdown: md({
            id: "outline_topic",
            type: "markdown",
            next: "draft_article",
            body: "根据主题生成文章提纲。"
          })
        },
        {
          key: "draft_article",
          label: "撰写初稿",
          shortLabel: "初稿",
          type: "markdown",
          badge: "M↓",
          state: "idle",
          x: 390,
          y: 180,
          file: "nodes/02_draft_article.md",
          outputHint: "draft.md",
          routeHint: "下游：润色定稿",
          markdown: md({
            id: "draft_article",
            type: "markdown",
            next: "edit_article",
            body: "结合提纲和资料撰写正文草稿。"
          })
        },
        {
          key: "edit_article",
          label: "润色定稿",
          shortLabel: "润色",
          type: "markdown",
          badge: "M↓",
          state: "idle",
          x: 660,
          y: 180,
          file: "nodes/03_edit_article.md",
          outputHint: "final.md",
          routeHint: "下游：导出产物",
          markdown: md({
            id: "edit_article",
            type: "markdown",
            next: "export_article",
            body: "统一口吻和结构，生成定稿。"
          })
        },
        {
          key: "export_article",
          label: "导出产物",
          shortLabel: "导出",
          type: "shell",
          badge: "Sh",
          state: "idle",
          x: 930,
          y: 180,
          file: "scripts/export_article.sh",
          outputHint: "article.md",
          routeHint: "终点",
          markdown: md({
            id: "export_article",
            type: "shell",
            next: null,
            body: "导出正文、摘要和引用索引。"
          })
        }
      ],
      edges: [
        ["outline_topic", "draft_article"],
        ["draft_article", "edit_article"],
        ["edit_article", "export_article"]
      ]
    }
  }
];

export const workflowRuns = {
  summer_feature: [
    {
      id: "run-2026-06-10-031",
      status: "running",
      trigger: "手动运行",
      actor: "张同学",
      startedAt: "今天 14:44:09",
      duration: "12 分 18 秒",
      summary: "正在从数据校验继续执行，前置题面、样例和标准程序已经完成。",
      selectedNodeKey: "data_validator",
      metrics: {
        total: 6,
        success: 3,
        running: 1,
        failed: 0,
        waiting: 2
      },
      nodes: {
        problem_statement: {
          status: "success",
          duration: "18 秒",
          retries: 0,
          progress: 100,
          startedAt: "14:44:09",
          finishedAt: "14:44:27",
          summary: "题面 Markdown 已生成并写入产物。",
          output: "problem.md",
          artifacts: ["problem.md", "statement.preview.html"],
          logs: [
            "14:44:09 读取 workflows/summer/problem.md",
            "14:44:15 生成题面结构与样例段落",
            "14:44:27 写入 problem.md"
          ]
        },
        sample_builder: {
          status: "success",
          duration: "42 秒",
          retries: 0,
          progress: 100,
          startedAt: "14:44:28",
          finishedAt: "14:45:10",
          summary: "样例目录已生成，包含基础样例和边界样例。",
          output: "samples/",
          artifacts: ["samples/basic.in", "samples/basic.out", "samples/boundary.in"],
          logs: [
            "14:44:28 解析题面约束",
            "14:44:39 生成 4 组基础样例",
            "14:45:10 写入 samples/"
          ]
        },
        standard_solution: {
          status: "success",
          duration: "1 分 06 秒",
          retries: 1,
          progress: 100,
          startedAt: "14:45:12",
          finishedAt: "14:46:18",
          summary: "标准程序已通过样例回放。",
          output: "solution.py",
          artifacts: ["solution.py", "solution.run.log"],
          logs: [
            "14:45:12 启动 Python 运行环境",
            "14:45:33 第一次格式化检查失败，自动重试",
            "14:46:18 样例回放通过"
          ]
        },
        data_validator: {
          status: "running",
          duration: "进行中 4 分 28 秒",
          retries: 0,
          progress: 68,
          startedAt: "14:46:20",
          finishedAt: "进行中",
          summary: "正在执行随机数据与边界数据校验。",
          output: "report.json",
          artifacts: ["report.partial.json"],
          logs: [
            "14:46:20 加载 samples/ 和 solution.py",
            "14:47:02 校验基础样例：通过",
            "14:48:41 校验边界样例：通过",
            "14:50:37 正在运行随机数据 68/100"
          ]
        },
        result_aggregate: {
          status: "waiting",
          duration: "等待中",
          retries: 0,
          progress: 0,
          startedAt: "未开始",
          finishedAt: "未完成",
          summary: "等待数据校验完成后开始汇总。",
          output: "summary.md",
          artifacts: [],
          logs: ["等待上游节点：数据校验"]
        },
        release_ready: {
          status: "waiting",
          duration: "等待中",
          retries: 0,
          progress: 0,
          startedAt: "未开始",
          finishedAt: "未完成",
          summary: "等待结果汇总后生成发布清单。",
          output: "release/",
          artifacts: [],
          logs: ["等待上游节点：结果汇总"]
        }
      }
    },
    {
      id: "run-2026-06-10-029",
      status: "failed",
      trigger: "定时运行",
      actor: "系统",
      startedAt: "今天 13:50:11",
      duration: "8 分 03 秒",
      summary: "数据校验在随机用例 73 处失败，等待人工重试。",
      selectedNodeKey: "data_validator",
      metrics: {
        total: 6,
        success: 3,
        running: 0,
        failed: 1,
        waiting: 2
      },
      nodes: {
        problem_statement: { status: "success", duration: "17 秒", retries: 0, progress: 100, startedAt: "13:50:11", finishedAt: "13:50:28", summary: "题面已生成。", output: "problem.md", artifacts: ["problem.md"], logs: ["13:50:28 写入 problem.md"] },
        sample_builder: { status: "success", duration: "39 秒", retries: 0, progress: 100, startedAt: "13:50:29", finishedAt: "13:51:08", summary: "样例已生成。", output: "samples/", artifacts: ["samples/"], logs: ["13:51:08 写入 samples/"] },
        standard_solution: { status: "success", duration: "51 秒", retries: 0, progress: 100, startedAt: "13:51:10", finishedAt: "13:52:01", summary: "标准程序通过。", output: "solution.py", artifacts: ["solution.py"], logs: ["13:52:01 样例回放通过"] },
        data_validator: { status: "failed", duration: "5 分 19 秒", retries: 2, progress: 73, startedAt: "13:52:04", finishedAt: "13:57:23", summary: "随机用例 73 输出格式不一致。", output: "report.json", artifacts: ["report.failed.json", "case-73.in", "case-73.out"], logs: ["13:55:41 随机数据 72/100 通过", "13:57:23 AssertionError: expected 6 decimals, got 5"], error: "AssertionError: expected 6 decimals, got 5" },
        result_aggregate: { status: "waiting", duration: "等待中", retries: 0, progress: 0, startedAt: "未开始", finishedAt: "未完成", summary: "上游失败，未开始。", output: "summary.md", artifacts: [], logs: ["等待上游节点：数据校验"] },
        release_ready: { status: "waiting", duration: "等待中", retries: 0, progress: 0, startedAt: "未开始", finishedAt: "未完成", summary: "上游失败，未开始。", output: "release/", artifacts: [], logs: ["等待上游节点：结果汇总"] }
      }
    }
  ]
};
