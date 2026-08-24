## Landed (round 8 — conditionals + fn removal, 2026-07-24)

Direction set in discussion: maximize GPU offload / minimize CPU resolve
by making the analyzable mapper IR the *only* way to style, and removing
the one construct that can never be offloaded — the opaque style
function.  Isolated commits; all green (typecheck, lint, `test:js`,
`test:modules`, 20 Playwright renderer specs).

- **CPU-evaluable invariant (established).**  Every mapper must be cheaply
  CPU-evaluable.  That is what keeps `ele.style()` synchronous, keeps
  headless mode and Node tests working (one IR runs on CPU, GPU, and in
  tests), and keeps determinism.  Reads stay **sync** — async reads were
  considered and rejected (viral, reentrancy windows, breaks
  headless/testability, and unnecessary while the IR is CPU-evaluable).
  GPU eval is an optimization over the IR, never a value source the CPU
  can't reproduce.  Async is reserved for genuinely GPU-only reads
  (rendered pixels, image export).
- **`case` conditional mapper.**  `{ case: [{ when: { data,
  gt/lt/eq/ne/in/... }, then }], else }` — ordered clauses, conditions
  AND-ed within a clause, first match wins; `when` reads any data key or
  the first-class `id`.  The declarative replacement for `(ele) => cond ?
  a : b` and the form for typed edges.  Compiles to a closure-free
  program; CPU-evaluated (multi-key), so the GPU eval kernel is
  untouched.  Dependency tracking generalized to `CompiledMapper.keys`.
- **The `(ele) => props` fn form removed.**  `GpuStyleFn` is gone; the
  sheet is props-only.  The engine collapsed to one path (no `def.fn`
  branches in applyBulk/refreshMapped/labelChannels/setSheet, no
  fn-return throw, `eleFor` dropped).  Selection-dependent recolouring
  is intentionally gone (the accent ring is shader-drawn); id-based
  styling migrates to `case` on `data: 'id'`.  Tests/docs migrated.
- **Deferred:** derived-data *expression* mappers (arithmetic over keys —
  no current use needs them); and geometry channels → GPU eval (the
  direct ~48 ms/200k offload, but it inverts the store→style layering
  since `boundingBox`/`refsInBox`/CPU-pick read resolved size — a later
  round).
