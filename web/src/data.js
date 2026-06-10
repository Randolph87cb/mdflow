function md({ id, type, next, produces = [], body }) {
  const produceBlock = produces.length
    ? `produces:\n${produces.map((item) => `  - ${item}`).join("\n")}\n`
    : "";
  const nextLine = next ? `next: ${next}\n` : "next: null\n";

  return `---\nid: ${id}\ntype: ${type}\n${nextLine}${produceBlock}---\n\n${body}\n`;
}

export const workflows = [
  {
    id: "problem_gen",
    name: "题目生成",
    status: "failed",
    lastRunRelative: "8 分钟前",
    nodeCount: 12,
    path: "workflows/problem_gen",
    entryNode: "generate_statement",
    entryLabel: "题面生成",
    outputs: 4,
    latestRunId: "run-2026-06-10-021",
    lastEdited: "今天 09:14",
    blurb: "生成题面、标准程序和数据包，并在编译失败时自动回到修复节点继续执行。",
    tags: ["生成类", "支持重跑"],
    graph: {
      nodes: [
        {
          key: "generate_statement",
          label: "题面生成",
          shortLabel: "题面",
          x: 118,
          y: 112,
          state: "success",
          type: "llm",
          file: "nodes/01_generate_statement.md",
          produces: ["题面.md"],
          next: "generate_std",
          markdown: md({
            id: "generate_statement",
            type: "llm",
            next: "generate_std",
            produces: ["题面.md"],
            body: "根据输入主题与难度要求，生成题面草稿，并写入 `outputs/题面.md`。"
          })
        },
        {
          key: "generate_std",
          label: "标准程序",
          shortLabel: "标程",
          x: 338,
          y: 112,
          state: "success",
          type: "llm",
          file: "nodes/02_generate_std.md",
          produces: ["std.cpp"],
          next: "build_and_run_std",
          markdown: md({
            id: "generate_std",
            type: "llm",
            next: "build_and_run_std",
            produces: ["std.cpp"],
            body: "读取题面后生成标准解程序，要求可编译并输出正确答案。"
          })
        },
        {
          key: "build_and_run_std",
          label: "编译检查",
          shortLabel: "编译",
          x: 560,
          y: 112,
          state: "failed",
          type: "script",
          file: "nodes/03_build_and_run_std.md",
          next: "route_std_result",
          markdown: md({
            id: "build_and_run_std",
            type: "script",
            next: "route_std_result",
            body: "调用编译脚本构建 `std.cpp`，失败时把 stderr 交给后续路由节点判断。"
          })
        },
        {
          key: "route_std_result",
          label: "结果路由",
          shortLabel: "路由",
          x: 784,
          y: 112,
          state: "idle",
          type: "router",
          file: "nodes/04_route_std_result.md",
          next: null,
          markdown: md({
            id: "route_std_result",
            type: "router",
            next: null,
            body: "根据 `build_and_run_std` 的状态选择继续生成数据，或回到修复节点。"
          })
        },
        {
          key: "fix_std",
          label: "修复标程",
          shortLabel: "修复",
          x: 560,
          y: 282,
          state: "idle",
          type: "llm",
          file: "nodes/05_fix_std.md",
          next: "build_and_run_std",
          markdown: md({
            id: "fix_std",
            type: "llm",
            next: "build_and_run_std",
            body: "读取编译错误与当前程序内容，生成修复后的 `std.cpp` 并回到编译节点。"
          })
        },
        {
          key: "generate_gen",
          label: "数据生成器",
          shortLabel: "数据",
          x: 998,
          y: 112,
          state: "idle",
          type: "llm",
          file: "nodes/06_generate_gen.md",
          produces: ["gen.cpp"],
          next: "package_data",
          markdown: md({
            id: "generate_gen",
            type: "llm",
            next: "package_data",
            produces: ["gen.cpp"],
            body: "根据题面与标准程序生成数据生成器，用于批量构造输入输出样例。"
          })
        },
        {
          key: "package_data",
          label: "打包产物",
          shortLabel: "打包",
          x: 1220,
          y: 112,
          state: "idle",
          type: "script",
          file: "nodes/07_package_data.md",
          produces: ["data.zip"],
          next: null,
          markdown: md({
            id: "package_data",
            type: "script",
            next: null,
            produces: ["data.zip"],
            body: "执行数据打包脚本，产出 `data.zip` 并收集最终结果文件。"
          })
        }
      ],
      edges: [
        ["generate_statement", "generate_std"],
        ["generate_std", "build_and_run_std"],
        ["build_and_run_std", "route_std_result"],
        ["route_std_result", "generate_gen"],
        ["route_std_result", "fix_std"],
        ["fix_std", "build_and_run_std"],
        ["generate_gen", "package_data"]
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
    entryLabel: "采集来源",
    outputs: 2,
    latestRunId: "run-2026-06-10-019",
    lastEdited: "今天 08:02",
    blurb: "聚合来源笔记，生成日报摘要，并导出给晨会使用的 Markdown 报告。",
    tags: ["汇总类"],
    graph: {
      nodes: [
        {
          key: "collect_sources",
          label: "采集来源",
          shortLabel: "采集",
          x: 140,
          y: 196,
          state: "success",
          type: "script",
          file: "nodes/01_collect_sources.md",
          next: "draft_report",
          markdown: md({
            id: "collect_sources",
            type: "script",
            next: "draft_report",
            body: "汇总晨会前的输入来源，包括 issue、会议纪要和临时记录。"
          })
        },
        {
          key: "draft_report",
          label: "生成草稿",
          shortLabel: "草稿",
          x: 392,
          y: 108,
          state: "success",
          type: "llm",
          file: "nodes/02_draft_report.md",
          next: "review_report",
          markdown: md({
            id: "draft_report",
            type: "llm",
            next: "review_report",
            body: "根据采集结果整理日报草稿，突出进展、风险和待办。"
          })
        },
        {
          key: "review_report",
          label: "审核润色",
          shortLabel: "审核",
          x: 392,
          y: 284,
          state: "success",
          type: "llm",
          file: "nodes/03_review_report.md",
          next: "publish_report",
          markdown: md({
            id: "review_report",
            type: "llm",
            next: "publish_report",
            body: "补充表达一致性与格式检查，确保成文适合直接发送。"
          })
        },
        {
          key: "publish_report",
          label: "导出发布",
          shortLabel: "发布",
          x: 690,
          y: 196,
          state: "success",
          type: "script",
          file: "nodes/04_publish_report.md",
          produces: ["daily-report.md", "summary.txt"],
          next: null,
          markdown: md({
            id: "publish_report",
            type: "script",
            next: null,
            produces: ["daily-report.md", "summary.txt"],
            body: "写出最终日报文件，并生成一份会议摘要供即时复制。"
          })
        }
      ],
      edges: [
        ["collect_sources", "draft_report"],
        ["collect_sources", "review_report"],
        ["draft_report", "publish_report"],
        ["review_report", "publish_report"]
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
    entryLabel: "生成提纲",
    outputs: 3,
    latestRunId: "暂无运行记录",
    lastEdited: "昨天 18:42",
    blurb: "从选题简报生成长文初稿，补充参考资料，并准备最终稿与摘要片段。",
    tags: ["内容类"],
    graph: {
      nodes: [
        {
          key: "outline_topic",
          label: "生成提纲",
          shortLabel: "提纲",
          x: 138,
          y: 196,
          state: "idle",
          type: "llm",
          file: "nodes/01_outline_topic.md",
          next: "research_topic",
          markdown: md({
            id: "outline_topic",
            type: "llm",
            next: "research_topic",
            body: "根据输入主题给出长文提纲、章节划分和预期论证顺序。"
          })
        },
        {
          key: "research_topic",
          label: "资料调研",
          shortLabel: "调研",
          x: 392,
          y: 108,
          state: "idle",
          type: "script",
          file: "nodes/02_research_topic.md",
          next: "draft_article",
          markdown: md({
            id: "research_topic",
            type: "script",
            next: "draft_article",
            body: "抓取参考资料并做结构化整理，供写作阶段引用。"
          })
        },
        {
          key: "draft_article",
          label: "撰写初稿",
          shortLabel: "初稿",
          x: 392,
          y: 284,
          state: "idle",
          type: "llm",
          file: "nodes/03_draft_article.md",
          next: "edit_article",
          markdown: md({
            id: "draft_article",
            type: "llm",
            next: "edit_article",
            body: "结合提纲和参考资料撰写正文草稿，保留可编辑结构。"
          })
        },
        {
          key: "edit_article",
          label: "润色定稿",
          shortLabel: "润色",
          x: 690,
          y: 196,
          state: "idle",
          type: "llm",
          file: "nodes/04_edit_article.md",
          next: "export_article",
          markdown: md({
            id: "edit_article",
            type: "llm",
            next: "export_article",
            body: "统一口吻、收紧结构，并生成适合发布的最终版本。"
          })
        },
        {
          key: "export_article",
          label: "导出产物",
          shortLabel: "导出",
          x: 972,
          y: 196,
          state: "idle",
          type: "script",
          file: "nodes/05_export_article.md",
          produces: ["article.md", "excerpt.txt", "refs.json"],
          next: null,
          markdown: md({
            id: "export_article",
            type: "script",
            next: null,
            produces: ["article.md", "excerpt.txt", "refs.json"],
            body: "导出正文、摘要片段和参考资料索引。"
          })
        }
      ],
      edges: [
        ["outline_topic", "research_topic"],
        ["outline_topic", "draft_article"],
        ["research_topic", "edit_article"],
        ["draft_article", "edit_article"],
        ["edit_article", "export_article"]
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
    entryLabel: "生成种子",
    outputs: 5,
    latestRunId: "run-2026-06-10-022",
    lastEdited: "今天 10:01",
    blurb: "执行多模型基准评测，汇总评分结果，并为回归检查保留产物快照。",
    tags: ["评测类", "重任务"],
    graph: {
      nodes: [
        {
          key: "seed_matrix",
          label: "生成种子",
          shortLabel: "种子",
          x: 112,
          y: 198,
          state: "success",
          type: "script",
          file: "nodes/01_seed_matrix.md",
          next: "case_a",
          markdown: md({
            id: "seed_matrix",
            type: "script",
            next: "case_a",
            body: "准备评测矩阵和样例组合，分发到后续子任务。"
          })
        },
        {
          key: "case_a",
          label: "评测样例 A",
          shortLabel: "样例 A",
          x: 392,
          y: 90,
          state: "running",
          type: "script",
          file: "nodes/02_case_a.md",
          next: "merge_scores",
          markdown: md({
            id: "case_a",
            type: "script",
            next: "merge_scores",
            body: "执行样例 A 评测，当前正在处理本轮模型输出。"
          })
        },
        {
          key: "case_b",
          label: "评测样例 B",
          shortLabel: "样例 B",
          x: 392,
          y: 198,
          state: "success",
          type: "script",
          file: "nodes/03_case_b.md",
          next: "merge_scores",
          markdown: md({
            id: "case_b",
            type: "script",
            next: "merge_scores",
            body: "执行样例 B 评测，当前结果已完成并等待汇总。"
          })
        },
        {
          key: "case_c",
          label: "评测样例 C",
          shortLabel: "样例 C",
          x: 392,
          y: 306,
          state: "idle",
          type: "script",
          file: "nodes/04_case_c.md",
          next: "merge_scores",
          markdown: md({
            id: "case_c",
            type: "script",
            next: "merge_scores",
            body: "第三组样例等待前序资源释放后开始执行。"
          })
        },
        {
          key: "merge_scores",
          label: "汇总评分",
          shortLabel: "汇总",
          x: 738,
          y: 198,
          state: "idle",
          type: "script",
          file: "nodes/05_merge_scores.md",
          next: "export_suite",
          markdown: md({
            id: "merge_scores",
            type: "script",
            next: "export_suite",
            body: "合并各组评分和日志，产出统一的回归对比结果。"
          })
        },
        {
          key: "export_suite",
          label: "导出快照",
          shortLabel: "导出",
          x: 1028,
          y: 198,
          state: "idle",
          type: "script",
          file: "nodes/06_export_suite.md",
          produces: ["scores.json", "report.md"],
          next: null,
          markdown: md({
            id: "export_suite",
            type: "script",
            next: null,
            produces: ["scores.json", "report.md"],
            body: "导出评测结果和回归报告，供后续人工审阅。"
          })
        }
      ],
      edges: [
        ["seed_matrix", "case_a"],
        ["seed_matrix", "case_b"],
        ["seed_matrix", "case_c"],
        ["case_a", "merge_scores"],
        ["case_b", "merge_scores"],
        ["case_c", "merge_scores"],
        ["merge_scores", "export_suite"]
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
    entryLabel: "读取简报",
    outputs: 3,
    latestRunId: "run-2026-06-10-014",
    lastEdited: "昨天 22:10",
    blurb: "从编辑简报生成可发布的博客素材、社媒短文案和 CTA 变体。",
    tags: ["营销类"],
    graph: {
      nodes: [
        {
          key: "fetch_brief",
          label: "读取简报",
          shortLabel: "简报",
          x: 116,
          y: 196,
          state: "success",
          type: "script",
          file: "nodes/01_fetch_brief.md",
          next: "write_article",
          markdown: md({
            id: "fetch_brief",
            type: "script",
            next: "write_article",
            body: "整理营销简报、目标读者和渠道要求，供正文生成使用。"
          })
        },
        {
          key: "write_article",
          label: "撰写正文",
          shortLabel: "正文",
          x: 362,
          y: 196,
          state: "success",
          type: "llm",
          file: "nodes/02_write_article.md",
          next: "generate_snippets",
          markdown: md({
            id: "write_article",
            type: "llm",
            next: "generate_snippets",
            body: "根据营销简报生成博客正文，并对 CTA 保持一致语气。"
          })
        },
        {
          key: "generate_snippets",
          label: "社媒短摘",
          shortLabel: "短摘",
          x: 622,
          y: 96,
          state: "success",
          type: "llm",
          file: "nodes/03_generate_snippets.md",
          next: "package_assets",
          markdown: md({
            id: "generate_snippets",
            type: "llm",
            next: "package_assets",
            body: "提炼微博、朋友圈和邮件摘要等短内容。"
          })
        },
        {
          key: "generate_assets",
          label: "物料变体",
          shortLabel: "素材",
          x: 622,
          y: 296,
          state: "success",
          type: "llm",
          file: "nodes/04_generate_assets.md",
          next: "package_assets",
          markdown: md({
            id: "generate_assets",
            type: "llm",
            next: "package_assets",
            body: "生成 CTA 文案、封面语和配图提示。"
          })
        },
        {
          key: "package_assets",
          label: "打包发布",
          shortLabel: "打包",
          x: 930,
          y: 196,
          state: "success",
          type: "script",
          file: "nodes/05_package_assets.md",
          produces: ["blog.md", "snippets.txt", "cta.json"],
          next: null,
          markdown: md({
            id: "package_assets",
            type: "script",
            next: null,
            produces: ["blog.md", "snippets.txt", "cta.json"],
            body: "写出博客正文、短文案和 CTA 变体文件。"
          })
        }
      ],
      edges: [
        ["fetch_brief", "write_article"],
        ["write_article", "generate_snippets"],
        ["write_article", "generate_assets"],
        ["generate_snippets", "package_assets"],
        ["generate_assets", "package_assets"]
      ]
    }
  }
];
