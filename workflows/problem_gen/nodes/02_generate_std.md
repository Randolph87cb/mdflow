---
id: generate_std
type: llm
produces: std.cpp
next: generate_gen
model:
  temperature: 0.2
---

# Generate Std

请根据下面题面，生成该题的 C++17 标准程序。

要求：

1. 只输出**完整可编译的 C++17 源码**，不要输出解释，不要加 Markdown 代码块围栏。
2. 程序必须从标准输入读取、向标准输出写入。
3. 程序必须稳定、清晰、可直接用于批量生成标准输出。
4. 禁止使用平台相关扩展或额外文件。

题面：
{{generate_statement.stdout}}
