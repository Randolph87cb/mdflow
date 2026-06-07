---
id: build_and_run_std
type: script
next: route_std_result
retry:
  max_attempts: 2
exec:
  program: python
  args:
    - scripts/build_and_run_cpp.py
    - --src
    - outputs/std.cpp
    - --label
    - std.cpp
    - --statement
    - outputs/题面.md
  cwd: .
  timeout_sec: 120
---

# Build And Run Std

编译当前 `outputs/std.cpp`，并尽量从题面中提取样例输入做一次最小运行检查。
