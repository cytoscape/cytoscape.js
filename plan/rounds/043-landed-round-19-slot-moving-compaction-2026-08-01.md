## Landed (round 19 — slot-moving compaction, 2026-08-01)

All five items of the round-19 plan above landed the same day, each
tests-first in its own commit; the three design calls held as decided
and one plan deviation is recorded below.

- **19.1 — store core.**  `ColumnTable.compact(remap, newCount)` +
  `GraphStore.compact()`: the monotone remap builds from FLAG_ALIVE
  (live slots move down in ascending order — relative order preserved
  by construction), columns and the gen array rebuild into
  right-sized (×2-step) buffers, `highWater` and capacity drop to the
  live count, the free-list clears.  Generation rule: identity slots
  keep their gens (refs to the stable prefix stay valid with zero
  repair); every changed position takes `oldGenAt(pos) + 1`, strictly
  greater than any gen ever handed out there, so all stale refs fail
  plain validation and route to forwarding.  `edge.endpoints` (the
  one cross-group slot column) rewrites on node moves; the id index
  fuses the permutation into its meta walk + a full probe rehash; CSR
  rebuilds via the round-11 path; the order list fuses against the
  pre-move gen snapshot; `resized` marks hand the renderer its
  existing realloc + full re-upload.
- **19.2 — dependent indexes.**  Hierarchy (links slot-indexed *and*
  slot-valued; parentGen re-stamps against post-move gens; child link
  order kept; draw permutation regenerates), curve index (styled
  records permute; node-keyed pair/loop maps rebuild from the
  rewritten endpoints; derived params **byte-identical** with no
  re-derivation — monotone keeps bundle rank/stagger/σ), the three
  blob offset tables, the data sidecar **in place** (bound mapper
  evaluators hold the buffers by reference), label
  entries/dims/dirty, opacityBase/parentFallback, whole-column mapper
  span re-emits, and `markAllLabelsDirty` as the glyph-rebuild feed.

  *Plan deviation, recorded*: the conservative monotone maxima are
  **not** recomputed at compaction — they stay monotone (sound; slack
  can only be loose), and exact recomputation would need per-kind
  record decoding for little benefit.
- **19.3 — ref forwarding + lazy repair.**  Per-group forwarding
  chains (packed (slot, gen) → (newSlot, newGen)) that persist and
  compose; `isCurrent()` repairs a forwarded ref **in place** before
  answering (one gen compare on the fast path; removed elements stay
  dead).  `Collection._refs` became an epoch-guarded accessor —
  one chokepoint syncs all ~115 consumers and drops the packed
  membership cache (materializer sweep unchanged).  `cy._compact()`
  permutes the interned handle pool (handle identity + scratch
  survive), repairs and re-keys element-bound listener qualifiers
  (off() through fresh handles matches), and re-keys animation queues
  with slot lists re-pointed.
- **19.4 — renderer.**  Two real gaps closed: glyph streams **clear
  wholesale** on the compaction epoch (owner slots are baked into
  instances; incremental rebuild could alias a stale run onto a
  different element's new slot), and mid-flight GPU tweens **demote**
  to the CPU (write the reached value, unregister, finish on repaired
  slots — `demoteGpuAll`, unlike the reparent path's early-finishing
  `settleGpuAll`).  A live GPU force run defers compaction
  (`Renderer.forceActive`).  Everything else rides existing
  machinery: resized → mirror capacity-aware realloc + pick-cache
  invalidation; mapper regions rebuild; parent permutation
  re-uploads.

  Browser specs pin the visual no-op **byte-identically**
  (labels + bezier bundle + compound + selection), post-compaction
  picking, and a mid-flight animation completing at target.
- **19.5 — triggers + API + sweep.**  Auto trigger (dead > live count
  past a 1024-slot floor) at the safe boundaries (completed remove;
  outermost endBatch), deferring silently while batching or under a
  force run; public `cy.compact()` (throws mid-batch, warns + defers
  under force).

  `benchmark/compaction.mjs` (200k peak → 10%,
  i9-9900K), extended into a four-section sweep (wins / costs /
  forwarding hot path / honesty controls): compact() ~114 ms
  one-shot, and the auto trigger adds it to a removal whose own
  cascade + emits cost ~1.8 s (~6% overhead; store-level removal
  without the trigger is ~0.7 s); held-collection first-touch repair
  of 20k moved refs ~0.5 ms; CPU pick 2.15 → 0.39 ms miss (~5.5×);
  cull dispatch width 200k → 20k lanes per group per frame (edges
  400k → 0); column memory 37 → 4.6 MiB (nodes), 76 → 0 MiB (edges).

  Forwarding is free on the hot path (isCurrent on a current ref
  1.01× with ~180k forward entries present; a stale chase + rewrite
  ~40 ns once per ref), and the controls confirm order-list scans /
  whole-graph bounds are ≈parity (1.1–1.2×) — compaction changes
  exactly what the design said it would.
- **19.5b — the device side, measured.**  The renderer bench gained a
  gpu-only **compaction scenario** (cut to ~10% live through the
  store — eles.remove() would auto-compact the peak state it exists
  to measure — pan at peak slot widths, `cy.compact()`, pan again)
  plus a `--gpu-only` runner flag for gpu-vs-gpu scenarios.  On the
  RX 580: wall time holds the vsync floor on both sides (a 10%-live
  scene is already fast), while the unbounded GPU pass isolates the
  dead-lane overhead — 10k live nodes panned over 100k + 300k peak
  lanes cost 2.2 ms/frame of device time, 0.5 ms once compacted
  (4.4×; ndex 1.4 → 0.9 ms); in-browser compact() is a ~57–62 ms
  one-shot at those scales.

Verification: 28 store-level + 9 ref-level + 5 trigger Node specs
(all seen red first), the full Node suite (2175), and the `webgpu` +
`visual` Playwright projects (143 specs — goldens and live v3
parity untouched).  With this round the "Follow-up hooks" list in
`src/README.md` holds no open architecture items.
