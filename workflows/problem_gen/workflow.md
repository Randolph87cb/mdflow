---
id: problem_gen
name: Problem Generation
entry: generate_statement
model:
  model: gpt-5.4-mini
  temperature: 0.5
  max_tokens: 8000
final_outputs:
  - 题面.md
  - std.cpp
  - gen.cpp
  - data.zip
---

# Problem Generation Workflow

这个示例 workflow 用于演示真实出题链：

- 先生成题面
- 再生成标准程序 `std.cpp`
- 再生成数据生成器 `gen.cpp`
- 最后编译并生成 25 组平铺数据，打包为 `data.zip`
