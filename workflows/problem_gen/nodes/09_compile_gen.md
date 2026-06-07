---
id: compile_gen
type: script
next: route_gen_compile
retry:
  max_attempts: 2
exec:
  program: python
  args:
    - scripts/compile_cpp.py
    - --src
    - outputs/gen.cpp
    - --label
    - gen.cpp
  cwd: .
  timeout_sec: 120
---

# Compile Gen

检查当前 `outputs/gen.cpp` 是否可以直接通过 `g++ -std=c++17` 编译。
