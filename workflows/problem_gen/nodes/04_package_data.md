---
id: package_data
type: script
produces: data.zip
next: null
exec:
  program: python
  args:
    - scripts/package_data.py
    - --statement
    - outputs/题面.md
    - --std
    - outputs/std.cpp
    - --gen
    - outputs/gen.cpp
    - --out
    - outputs/data.zip
    - --cases
    - "25"
  cwd: outputs
  timeout_sec: 300
---

# Package Data

编译标准程序与数据生成器，固定生成 25 组 `.in` / `.out`，并打包为 `data.zip`。
