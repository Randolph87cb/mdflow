---
id: compile_std
type: script
next: route_std_compile
retry:
  max_attempts: 2
exec:
  program: python
  args:
    - scripts/compile_cpp.py
    - --src
    - outputs/std.cpp
    - --label
    - std.cpp
  cwd: .
  timeout_sec: 120
---

# Compile Std

检查当前 `outputs/std.cpp` 是否可以直接通过 `g++ -std=c++17` 编译。
