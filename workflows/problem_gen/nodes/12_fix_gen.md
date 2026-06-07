---
id: fix_gen
type: llm
produces: gen.cpp
next: compile_gen
model:
  temperature: 0.1
---

# Fix Gen

请修复下面这份 C++17 数据生成器，使它能正确编译并符合题面要求。

要求：

1. 只输出**完整可编译的 C++17 源码**，不要输出解释，不要加 Markdown 代码块围栏。
2. 保持命令行参数 `case_id` 的约定。
3. 生成器输出必须严格符合题面输入格式。
4. 如果原代码基本正确，尽量做最小必要修改。

题面：
{{generate_statement.stdout}}

标准程序：
{{capture_std_ready.stdout}}

当前数据生成器：
{{capture_gen_source.stdout}}

最近一次编译错误：
{{compile_gen.stderr}}
