export const workflows = [
  {
    id: "problem_gen",
    name: "Problem Generator",
    status: "failed",
    lastRunRelative: "8m ago",
    nodeCount: 12,
    path: "workflows/problem_gen",
    entryNode: "generate_statement",
    outputs: 4,
    latestRunId: "run-2026-06-10-021",
    lastEdited: "Today, 09:14",
    blurb: "Generates statements, standard solutions, data packages, and reroutes on compiler failure.",
    tags: ["generator", "rerun-ready"],
    graph: {
      nodes: [
        { id: "Statement", x: 94, y: 82, state: "success" },
        { id: "Std", x: 280, y: 82, state: "success" },
        { id: "Compile", x: 468, y: 82, state: "failed" },
        { id: "Fix", x: 468, y: 216, state: "idle" },
        { id: "Generator", x: 666, y: 82, state: "idle" },
        { id: "Package", x: 848, y: 82, state: "idle" }
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
    name: "Daily Report",
    status: "success",
    lastRunRelative: "1h ago",
    nodeCount: 6,
    path: "workflows/daily_report",
    entryNode: "collect_sources",
    outputs: 2,
    latestRunId: "run-2026-06-10-019",
    lastEdited: "Today, 08:02",
    blurb: "Aggregates source notes, drafts the summary, and exports report markdown for morning review.",
    tags: ["reporting"],
    graph: {
      nodes: [
        { id: "Collect", x: 110, y: 150, state: "success" },
        { id: "Draft", x: 320, y: 80, state: "success" },
        { id: "Review", x: 320, y: 220, state: "success" },
        { id: "Publish", x: 560, y: 150, state: "success" }
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
    name: "Article Flow",
    status: "idle",
    lastRunRelative: "Never",
    nodeCount: 9,
    path: "workflows/article_flow",
    entryNode: "outline_topic",
    outputs: 3,
    latestRunId: "No runs yet",
    lastEdited: "Yesterday, 18:42",
    blurb: "Drafts long-form content from a brief, adds references, and prepares final markdown and excerpts.",
    tags: ["content"],
    graph: {
      nodes: [
        { id: "Outline", x: 116, y: 150, state: "idle" },
        { id: "Research", x: 322, y: 80, state: "idle" },
        { id: "Draft", x: 322, y: 220, state: "idle" },
        { id: "Edit", x: 570, y: 150, state: "idle" },
        { id: "Export", x: 806, y: 150, state: "idle" }
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
    name: "Benchmark Suite",
    status: "running",
    lastRunRelative: "Live now",
    nodeCount: 15,
    path: "workflows/benchmark_suite",
    entryNode: "seed_matrix",
    outputs: 5,
    latestRunId: "run-2026-06-10-022",
    lastEdited: "Today, 10:01",
    blurb: "Executes multi-model benchmarks, merges scorecards, and snapshots artifacts for regression review.",
    tags: ["evaluation", "heavy-run"],
    graph: {
      nodes: [
        { id: "Seed", x: 90, y: 154, state: "success" },
        { id: "Case A", x: 280, y: 72, state: "running" },
        { id: "Case B", x: 280, y: 154, state: "success" },
        { id: "Case C", x: 280, y: 236, state: "idle" },
        { id: "Merge", x: 520, y: 154, state: "idle" },
        { id: "Export", x: 762, y: 154, state: "idle" }
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
    name: "Blog Pipeline",
    status: "success",
    lastRunRelative: "3h ago",
    nodeCount: 8,
    path: "workflows/blog_pipeline",
    entryNode: "fetch_brief",
    outputs: 3,
    latestRunId: "run-2026-06-10-014",
    lastEdited: "Yesterday, 22:10",
    blurb: "Creates publish-ready blog assets, social snippets, and CTA variations from editorial briefs.",
    tags: ["marketing"],
    graph: {
      nodes: [
        { id: "Brief", x: 110, y: 150, state: "success" },
        { id: "Article", x: 306, y: 150, state: "success" },
        { id: "Snippets", x: 522, y: 88, state: "success" },
        { id: "Assets", x: 522, y: 220, state: "success" },
        { id: "Package", x: 788, y: 150, state: "success" }
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
