---
id: generate_cpp
type: llm
produces: std.cpp
next: run_cpp
model:
  provider: mock
  model: mock-code-llm
  temperature: 0.2
---

# Generate C++

请根据下面题面和解法生成 C++17 标准程序。

题面：
{{generate_statement.stdout}}

解法：
{{generate_solution.stdout}}
