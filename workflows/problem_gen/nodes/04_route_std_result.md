---
id: route_std_result
type: router
routes:
  - when:
      source: build_and_run_std.status
      equals: success
    next: generate_gen
  - when:
      source: build_and_run_std.stderr
      regex: "(?i)(compile failed|run failed|error:|undefined reference)"
    next: fix_std
default_next: fix_std
---

# Route Std Result

根据 `build_and_run_std` 的结果决定是继续生成数据生成器，还是先修复标准程序。
