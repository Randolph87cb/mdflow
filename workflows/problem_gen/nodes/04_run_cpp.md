---
id: run_cpp
type: script
produces: run_result.txt
next: package
exec:
  program: python
  args:
    - scripts/run_cpp.py
    - --src
    - outputs/std.cpp
    - --out
    - outputs/run_result.txt
  cwd: outputs
  timeout_sec: 300
---

# Run C++

读取 `outputs/std.cpp` 并生成运行结果。
