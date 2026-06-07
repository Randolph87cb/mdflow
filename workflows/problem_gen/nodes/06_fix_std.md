---
id: fix_std
type: llm
produces: std.cpp
next: compile_std
model:
  temperature: 0.1
---

# Fix Std

请修复下面这份 C++17 标准程序，使它能正确编译并符合题面要求。

要求：

1. 只输出**完整可编译的 C++17 源码**，不要输出解释，不要加 Markdown 代码块围栏。
2. 保持标准输入输出，不要依赖文件。
3. 优先修复编译错误和明显的实现错误，不要改题意。
4. 如果原代码基本正确，尽量做最小必要修改。

题面：
{{generate_statement.stdout}}

当前标准程序：
{{capture_std_source.stdout}}

最近一次编译错误：
{{compile_std.stderr}}
