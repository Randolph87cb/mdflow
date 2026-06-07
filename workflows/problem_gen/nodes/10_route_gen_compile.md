---
id: route_gen_compile
type: router
routes:
  - when:
      source: compile_gen.status
      equals: success
    next: package_data
  - when:
      source: compile_gen.stderr
      regex: "(?i)(compile failed|error:|undefined reference)"
    next: capture_gen_source
default_next: capture_gen_source
---

# Route Gen Compile

根据 `compile_gen` 的结果决定是继续打包数据，还是先修复数据生成器。
