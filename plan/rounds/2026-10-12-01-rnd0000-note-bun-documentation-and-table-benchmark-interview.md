## Bun, documentation and table benchmark interview

**Depends on:** 46, 84, 99, 2026-10-11-01

Maintainer answers from the 12 October interview. These decisions supersede
conflicting alternatives in rounds 46, 84 and 99. This is an implementation
scope decision record: no runtime removal, documentation parity or benchmark
result is claimed implemented, and none of these rounds is closed here.

### Bun and runtime scope (99)

- Drop Deno completely from v4 support: remove its existing runtime tests,
  CI, support claims and planned work, including the GPU integration already
  shipped through round 131. Preserve historical measurement records as history.
  Keep Bun; this does not remove other supported runtimes.
- Use npm publication for alpha. Drop the planned JSR publication from alpha;
  reconsider JSR after alpha. Actual publication remains a release action.
- Require the complete Node verification tier to run under Bun: public specs,
  module/packaging tests, soak tests and throws checks. Check executed-test
  counts against Node, with equivalent coverage and no silent partial runs.
  Browser tests remain in Playwright.
- Smoke-only Bun coverage is not an acceptable closure outcome. Adapt the
  harness until the full tier runs. Bun-specific adapters/preloads/build steps
  and shared runner-neutral refactoring are allowed; preserve complete Node
  coverage as well. Bun jobs gate as already decided.
- The investigation must identify actual incompatibilities and pin runtime
  versions. The old 99.1 fallback allowing an incompatible full runner to leave
  only smoke coverage is superseded. Refresh the pass/verification plan around
  this larger tier before implementation; do not treat the old test:js-only
  experiment as satisfying the new acceptance contract.

### Prose and API documentation parity pass (46)

- Audit v3's Markdown prose sections and API documentation as the baseline,
  then produce a detailed parity/implementation plan and write v4 prose and API
  documentation in this pass. Preserve v3's frozen source files.
- Cover at least v3's sections or equivalent content, with comparable detail;
  additional v4 sections are welcome. Demos are excluded from this pass.
- Reference coverage is for v4 APIs. Flag any v3 API absent from v4 for which
  there is no clear migration or removal decision, rather than inventing a
  replacement or restoring it. Decided removals do not require full v4 entries.
- Document settled implemented behavior and provisional behavior already
  specified in plans/interviews. Every provisional claim carries a searchable
  TODO_PROVISIONAL marker and its source reference. In that provisional note,
  identify specification holes too; do not invent behavior or API signatures to
  fill them. Clearly distinguish provisional APIs from available runtime APIs.
- Keep source JSDoc as the API documentation source of truth; the coverage
  audit must inspect prose and function documentation, not just member counts.
- This is substantial progress within round 46, not its closure. Leave a
  concrete follow-up plan and maintainer questions for remaining gaps and site
  work. Demos, final site/deployment completion and further review remain later.

### Benchmark-only table pass (84)

- Benchmark visible rectangular reads, sequential scrolling, distant jumps,
  dirty updates and allocations through current public APIs against
  benchmark-only column prototypes. Include whole-table sort/filter/facet
  operations as context; whole-table throughput alone does not justify an API.
- Test 10k, 100k and 1m rows with mixed/sparse columns, sparse updates and bulk
  updates. Record latency and allocation costs without adding a new pass/fail
  performance budget. Include snapshot construction and dirty refresh costs.
- Deliver reproducible measurements and an evidence-backed recommendation.
  No new public column/table/query API in this pass. The previously approved
  internal filtering improvements are separate work, not part of this
  benchmark-only scope. API decisions and round closure remain follow-up.

### Readiness after the interview

The bounded 46 documentation pass and 84 benchmark pass can proceed without
further scope answers. Round 99's acceptance scope is decided, but its plan must
be revised from the old native-runner experiment to full-tier Bun adaptation
and complete Deno withdrawal. Unknown implementation details are investigated
within these contracts; uncovered public design decisions are logged for the
maintainer rather than silently chosen.
