---
id: capture_std_source
type: script
next: fix_std
exec:
  program: python
  args:
    - scripts/dump_text_file.py
    - --src
    - outputs/std.cpp
  cwd: .
  timeout_sec: 30
---

# Capture Std Source

读取当前 `outputs/std.cpp` 的最新内容，供修复节点使用。
