---
id: generate_gen
type: llm
produces: gen.cpp
next: package_data
model:
  temperature: 0.2
---

# Generate Gen

请根据下面题面和标准程序，生成该题的 C++17 数据生成器。

要求：

1. 只输出**完整可编译的 C++17 源码**，不要输出解释，不要加 Markdown 代码块围栏。
2. 程序接受一个可选命令行参数 `case_id`，若存在则用它控制当前生成的那一组数据。
3. 程序把单组输入数据写到标准输出，不要写额外日志。
4. 生成器应覆盖不同规模和边界情况，但要保证生成的数据符合题面约束。
5. 不需要直接生成输出答案，答案会由标准程序计算。

题面：
{{generate_statement.stdout}}

标准程序：
{{file:outputs/std.cpp}}
