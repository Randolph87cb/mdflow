---
id: route_std_compile
type: router
routes:
  - when:
      source: compile_std.status
      equals: success
    next: capture_std_ready
  - when:
      source: compile_std.stderr
      regex: "(?i)(compile failed|error:|undefined reference)"
    next: capture_std_source
default_next: capture_std_source
---

# Route Std Compile

根据 `compile_std` 的结果决定是继续生成数据生成器，还是先修复标准程序。
