---
id: capture_gen_source
type: script
next: fix_gen
exec:
  program: python
  args:
    - scripts/dump_text_file.py
    - --src
    - outputs/gen.cpp
  cwd: .
  timeout_sec: 30
---

# Capture Gen Source

读取当前 `outputs/gen.cpp` 的最新内容，供修复节点使用。
