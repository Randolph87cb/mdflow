---
id: problem_gen
name: Problem Generation
entry: generate_statement
model:
  provider: mock
  model: mock-llm
final_outputs:
  - statement.md
  - solution.md
  - std.cpp
  - run_result.txt
  - package.json
---

# Problem Generation Workflow

这个示例 workflow 用于演示一阶段协议：

- LLM 节点通过 `{{node_id.stdout}}` 引用上游文本
- script 节点优先通过 `outputs/...` 显式读取最终文件
- `produces` 把节点 stdout 发布到 `outputs/`
- `final_outputs` 只声明必要交付物
