---
id: capture_std_ready
type: script
next: generate_gen
exec:
  program: python
  args:
    - scripts/dump_text_file.py
    - --src
    - outputs/std.cpp
  cwd: .
  timeout_sec: 30
---

# Capture Std Ready

读取当前已通过编译检查的 `outputs/std.cpp`，供后续生成数据生成器使用。
