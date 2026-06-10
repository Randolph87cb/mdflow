export const workflows = [
  {
    id: "problem_gen",
    name: "题目生成",
    status: "failed",
    lastRunRelative: "8 分钟前",
    nodeCount: 12,
    path: "workflows/problem_gen",
    entryNode: "generate_statement",
    outputs: 4,
    latestRunId: "run-2026-06-10-021",
    lastEdited: "今天 09:14",
    blurb: "生成题面、标准程序和数据包，并在编译失败时自动回到修复节点继续执行。",
    tags: ["生成类", "支持重跑"],
    graph: {
      nodes: [
        { id: "题面", x: 94, y: 82, state: "success" },
        { id: "标程", x: 280, y: 82, state: "success" },
        { id: "编译", x: 468, y: 82, state: "failed" },
        { id: "修复", x: 468, y: 216, state: "idle" },
        { id: "数据", x: 666, y: 82, state: "idle" },
        { id: "打包", x: 848, y: 82, state: "idle" }
      ],
      edges: [
        [0, 1],
        [1, 2],
        [2, 4],
        [2, 3],
        [3, 2],
        [4, 5]
      ]
    }
  },
  {
    id: "daily_report",
    name: "日报汇总",
    status: "success",
    lastRunRelative: "1 小时前",
    nodeCount: 6,
    path: "workflows/daily_report",
    entryNode: "collect_sources",
    outputs: 2,
    latestRunId: "run-2026-06-10-019",
    lastEdited: "今天 08:02",
    blurb: "聚合来源笔记，生成日报摘要，并导出给晨会使用的 Markdown 报告。",
    tags: ["汇总类"],
    graph: {
      nodes: [
        { id: "采集", x: 110, y: 150, state: "success" },
        { id: "草稿", x: 320, y: 80, state: "success" },
        { id: "审核", x: 320, y: 220, state: "success" },
        { id: "发布", x: 560, y: 150, state: "success" }
      ],
      edges: [
        [0, 1],
        [0, 2],
        [1, 3],
        [2, 3]
      ]
    }
  },
  {
    id: "article_flow",
    name: "文章流水线",
    status: "idle",
    lastRunRelative: "未运行",
    nodeCount: 9,
    path: "workflows/article_flow",
    entryNode: "outline_topic",
    outputs: 3,
    latestRunId: "暂无运行记录",
    lastEdited: "昨天 18:42",
    blurb: "从选题简报生成长文初稿，补充参考资料，并准备最终稿与摘要片段。",
    tags: ["内容类"],
    graph: {
      nodes: [
        { id: "提纲", x: 116, y: 150, state: "idle" },
        { id: "调研", x: 322, y: 80, state: "idle" },
        { id: "初稿", x: 322, y: 220, state: "idle" },
        { id: "润色", x: 570, y: 150, state: "idle" },
        { id: "导出", x: 806, y: 150, state: "idle" }
      ],
      edges: [
        [0, 1],
        [0, 2],
        [1, 3],
        [2, 3],
        [3, 4]
      ]
    }
  },
  {
    id: "benchmark_suite",
    name: "基准评测",
    status: "running",
    lastRunRelative: "运行中",
    nodeCount: 15,
    path: "workflows/benchmark_suite",
    entryNode: "seed_matrix",
    outputs: 5,
    latestRunId: "run-2026-06-10-022",
    lastEdited: "今天 10:01",
    blurb: "执行多模型基准评测，汇总评分结果，并为回归检查保留产物快照。",
    tags: ["评测类", "重任务"],
    graph: {
      nodes: [
        { id: "种子", x: 90, y: 154, state: "success" },
        { id: "样例 A", x: 280, y: 72, state: "running" },
        { id: "样例 B", x: 280, y: 154, state: "success" },
        { id: "样例 C", x: 280, y: 236, state: "idle" },
        { id: "汇总", x: 520, y: 154, state: "idle" },
        { id: "导出", x: 762, y: 154, state: "idle" }
      ],
      edges: [
        [0, 1],
        [0, 2],
        [0, 3],
        [1, 4],
        [2, 4],
        [3, 4],
        [4, 5]
      ]
    }
  },
  {
    id: "blog_pipeline",
    name: "博客流水线",
    status: "success",
    lastRunRelative: "3 小时前",
    nodeCount: 8,
    path: "workflows/blog_pipeline",
    entryNode: "fetch_brief",
    outputs: 3,
    latestRunId: "run-2026-06-10-014",
    lastEdited: "昨天 22:10",
    blurb: "从编辑简报生成可发布的博客素材、社媒短文案和 CTA 变体。",
    tags: ["营销类"],
    graph: {
      nodes: [
        { id: "简报", x: 110, y: 150, state: "success" },
        { id: "正文", x: 306, y: 150, state: "success" },
        { id: "短摘", x: 522, y: 88, state: "success" },
        { id: "素材", x: 522, y: 220, state: "success" },
        { id: "打包", x: 788, y: 150, state: "success" }
      ],
      edges: [
        [0, 1],
        [1, 2],
        [1, 3],
        [2, 4],
        [3, 4]
      ]
    }
  }
];
