## Design discussion (2026-07-24) — GPU geometry & the read-staleness contract

Direction set in discussion after round 9, ahead of building the paint/size
GPU tween extension.  No code yet; these are the locked calls that scope that
work and the expensive-geometry cases (multiline labels, bundled bezier) that
sit behind it.  `src/README.md` ("Design decisions") is the maintained
record.

- **Paint tween is the clean next extension; size is a geometry-tier
  project.**  The `gpu-tween.mts` runtime generalizes to paint channels
  (`node.opacity`, fill/border/line color, `edge.opacity`) with low risk —
  paint has **no CPU consumer** (cull, CPU pick and columnar scans never read
  it, which is why it went GPU-evaluable in the mapper split), so a paint
  tween owns its column with no staleness hazard.

  Work: widen `fromTo` for
  color (two `vec4f` per slot; sRGB per-channel to match the current CPU
  tween unless we deliberately unify on OKLab), fold `edge.opacity` into
  arrow alpha in-kernel, and an ownership-precedence rule so an active tween
  wins over the mapper eval kernel writing the same channel.  **Size**
  (`width`/`height`/`border-width`, `edge.width`) is *not* a peer: it is
  geometry read by cull, CPU pick, and every columnar scan, so a GPU-owned
  size tween reopens the store→style layering seam R8.5 flagged and belongs
  with that geometry work.  Recommendation: ship paint-only (an R9.4), bundle
  size with the R8.5 geometry-seam work.

- **The read-staleness contract.**  A frame-stale sync-read contract (GPU
  owns expensive geometry, CPU reads a frame behind) was floated and
  **rejected as a default**, for three reasons: (1) read-after-write is
  pervasive and load-bearing — `data()`/`position()` then `width()`/`bb()`
  in one synchronous tick must reflect the write (layouts, extensions, user
  code all rely on it); (2) headless has no frame and no readback, so it
  would still need the complete CPU implementation *plus* a weaker contract —
  strictly worse than CPU-canonical; (3) "a frame stale" is undefined in
  synchronous code (a build-graph → query-bbs loop never yields to a frame,
  so staleness is unbounded, not one frame; real GPU→CPU latency is 1–3
  frames regardless).

  Staleness is admitted **only for values already in
  frame-driven motion** — the position tween lease is exactly that, and
  `edge.bb()` mid-tween inheriting it is consistent, not a new rule.  A
  discrete user write is never stale.  Escape hatch for GPU-exact geometry
  after a write batch: an explicit `await` on a settle/flush, not a relaxed
  sync default.

- **Expensive GPU geometry → dual implementations, not readback** (multiline
  labels, bundled bezier — v4-but-not-yet; since superseded for bundled
  bezier + self-loops, which landed round 12a under exactly this model).  These are expensive *and* read
  by `.bb()`, so the position lease's no-readback trick doesn't apply
  directly (they aren't cheaply CPU-reproducible).  The model: **two
  deterministic implementations that agree by construction** — WGSL for
  render, CPU for reads, run on the same inputs, neither reading back the
  other — the OKLab-LUT/mapper-table discipline generalized to expensive
  computations.

  The standing cost is keeping the two impls bit-agreeable
  (divergence = bb-doesn't-match-pixels), which is the actual gate on whether
  GPU is worth it per case.  Two consumer tiers keep it affordable: **cull/
  fit read a cheap conservative CPU over-approximation** (guaranteed to
  contain the true box), **public `.bb()` triggers the exact lazy CPU
  compute, memoized per element**.  For bezier: control points are
  `f(positions, membership)` — stale via the position lease mid-tween
  (consistent), settle when positions are reclaimed; bundle *membership* is a
  cheap CPU structural index rebuilt on add/remove edge, not per frame.

- **Labels are model-space only** (no viewport-fixed mode).  `font-size` and
  the wrap width are both model coordinates (v3 parity).  Load-bearing three
  ways: (1) line breaking is zoom-invariant (font-size and wrap width share a
  space), so shaping — the expensive part — **memoizes** and the GPU metrics
  pass runs on text/font/wrap writes, not per frame (a *mixed* space reflows
  on zoom and defeats both memo and offload); (2) **image export is WYSIWYG**
  — a `full`/high-`scale` export is the screen arrangement over identical
  shaping, so scientific figures don't reflow between screen and export and
  the export reuses the screen memo; (3) v3 parity, so existing figures
  reproduce.

  Screen-space labels were rejected: they break export WYSIWYG
  (reflow at a scale ≠ current zoom) and their apparent legibility win on
  dense graphs is overlap that makes a worse figure (a data-density limit,
  answered editorially, not by a coordinate system).  The visibility
  sub-decision was taken in round 9.6: label LOD thresholds evaluate at
  **export scale** (self-consistent figure), as leaned.

### Deferred by design (out of scope for the prototype)

- ~~**Compounds**~~: `parent`/`parents`/`children`/`descendants`/
  `commonAncestors`/`siblings`/`orphans`/`nonorphans`/`isParent`/
  `isChild`/`isChildless`/`isOrphan`, and compound-relative
  `relativePosition`/`padding`/bounds — **landed in round 14**.
- ~~**Animations**~~ — landed in round 9 (CPU-canonical path; below).
- **Graph algorithms** (`v3/src/collection/algorithms/*`): bfs/dfs,
  dijkstra, aStar, kruskal, bellmanFord, floydWarshall, pageRank, all
  centralities (degree/closeness/betweenness), all clustering
  (markov/k-means/k-medoids/fuzzy-c-means/hierarchical/affinity), tarjan
  & hopcroft-tarjan, hierholzer, kargerStein.
- **Bezier/segment geometry**: `controlPoints`/`segmentPoints`/
  `isBundledBezier` and curved edge rendering — a v4 direction, in the
  expensive-geometry tier (see the design discussion above): dual CPU/WGSL
  impls, conservative CPU bound for cull/fit, exact lazy CPU `.bb()`,
  membership as a structural index.  (Since superseded: bundled bezier +
  self-loops landed round 12a exactly in this tier, incl.
  `controlPoints`/`isBundledBezier`; `segmentPoints` and the
  unbundled/segments/taxi families landed in pass 12b, same tier.)
- **Full stylesheet + mappers** beyond the constant blocks and the label
  `data(key)` mapper; layouts beyond grid/preset.  (Since superseded:
  mappers landed round 7–8; circle/concentric/breadthfirst/random
  layouts landed round 10.)
