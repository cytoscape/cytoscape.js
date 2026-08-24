## Landed (round 7 — the mapper DSL, 2026-07-24)

Ten isolated commits (after a `{ nodes, edges }` sheet-key rename to
match the group names): OKLab + scheme tables → mapper compile/IR →
engine integration → data-write plumbing → program packing → GPU eval
(scalars, then colors) → ordinal dict path + mixed demotion → benchmark
→ docs.  All green throughout: typecheck, lint, `test:js` (1360 tests;
three new mapper suites), `test:modules`, 20 Playwright renderer specs on
a real adapter.  `src/README.md` ("Design decisions") is the
maintained record; the shape, briefly:

- **Spec**: plain serializable objects as style prop values —
  `{ data, scale?, domain?, range?, clamp?, fallback?, ... }`.  Scales:
  linear/log/sqrt/pow/symlog, diverging ([min, mid, max]), ordinal,
  threshold, quantize.  Colors interpolate in OKLab (opt-out
  `interpolate: 'srgb'`) with named schemes (viridis family, ColorBrewer
  ramps, category10/dark2) and multi-stop ranges.  Missing/unmappable
  data → `fallback` else the channel default.  `domain` omitted/'auto'
  is a **live extent** (Vega-Lite semantics): re-checked on writes of
  the mapped key, whole-channel re-derive when moved.

  Compiles to a
  closure-free IR (`style-scales.mts`): everything continuous lowers to
  one piecewise program over transformed stops; refresh is gated per
  (group, key); edge data writes now refresh edge channels; fn-sheet
  returns may not contain mappers; `label` takes the passthrough only.
- **GPU eval — the paint/geometry split**: paint channels (fill/border/
  line colors, opacities, arrow colors) evaluate in a per-group compute
  kernel that interprets a packed program array (64 B uniform structs +
  vec4 stop/LUT tables + f32 data-region shadows with present masks)
  and writes the *existing* channel buffers — render pipelines
  untouched, zero permutations, fits base device limits.  Data writes
  upload only the touched bytes and dispatch once (200k color write:
  78.5 → 15.9 ms; the getter answers by evaluating the shared IR
  lazily, within ±1/byte of pixels — Playwright-pinned).

  Geometry
  (size, border-width, shape, edge width) + labels stay eagerly
  CPU-evaluated: anything read by culling, CPU picking, or columnar
  scans stays CPU-canonical.  Arrow alpha folds in-kernel; mapped arrow
  *shapes* and mixed-promoted columns demote to CPU; string ordinals
  run as dict-index LUTs (dict growth repacks); headless stays fully
  CPU-correct with no renderer.
