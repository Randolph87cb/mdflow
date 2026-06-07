---
id: package
type: script
produces: package.json
next: null
exec:
  program: python
  args:
    - scripts/package.py
    - --statement
    - outputs/statement.md
    - --solution
    - outputs/solution.md
    - --code
    - outputs/std.cpp
    - --run-result
    - outputs/run_result.txt
    - --out
    - outputs/package.json
  cwd: outputs
  timeout_sec: 300
---

# Package Outputs

读取最终输出文件并生成 `package.json`。
