## Slot-moving compaction

The last open architectural item ("Logged — compaction" above): move
live element slots so `highWater`, column capacity and pass-iteration
widths shrink after big removals (the shrink profile) and sustained
churn (the free-list keeps tables from growing, but peak-sized scans
and dispatches persist).  The slot-stable tier (id blob, CSR,
dictionaries) has self-compacted since round 11; this round moves the
slots themselves.

**The three policy calls, decided with the user (2026-08-01):**

1. **Ref survival: forwarding + lazy repair.**  A per-group
   forwarding table maps a moved element's old (slot, gen) to its new
   slot; refs repair lazily on access, and a store-wide compaction
   epoch invalidates cached packed-int membership sets.  User-held
   collections keep working — the interned-singleton invariant and
   the hold-a-query-result app pattern survive, with the cost paid
   only on first post-compaction access.  (Rejected:
   handles-survive-collections-stale, everything-stale — both make
   compaction an app-visible event, which an *auto* trigger cannot
   afford.)
2. **Trigger: auto threshold + explicit `cy.compact()`.**  Auto on a
   dead-slot-ratio threshold (the round-11 waste-over-half policy
   with a floor, metered per group), gated to safe boundaries — never
   mid-batch, mid-emit, mid-frame-encode, or while a GPU force run or
   GPU-offloaded tween is live (live tweens settle first via the
   round-14.11 `settleGpuAll` precedent, or the check defers to the
   next safe boundary).  `cy.compact()` is also public for
   deterministic timing (throws mid-batch; defers with a warn while a
   force run is live).  The shrink profile is exactly where apps
   won't know to call `compact()` — auto is the user-serving default.
3. **Draw order: stable — a visual no-op.**  Compaction preserves
   the current relative slot order.

**The load-bearing consequence: the remap is monotone.**  Moving live
slots down in ascending order (each live slot drops to the lowest
free position below it) preserves relative order by construction,
which is what makes call 3 free — and it is *also* what keeps derived
curve geometry identical: bundle rank (`bundleOffset` over the
sorted bundle), loop stagger index, and the σ orientation sign all
derive from relative slot order (`curve-index.mts`), so a monotone
remap leaves every derived curve param byte-identical and no pair
re-derivation is needed.  CSR per-node incident order (insertion
order) and the cpu-pick z-rule (topmost = highest slot) are likewise
unchanged.

A non-monotone remap would silently change z-order and
curve geometry; the implementation asserts monotonicity in dev.

**Remap inventory** (surveyed 2026-08-01; classification per
structure): the store tables permute per column (`arrays`, `gen`;
`free` clears; `highWater` shrinks to the live count; capacity
shrinks realloc the columns); `edge.endpoints` is the one column
holding cross-group slots (a node remap rewrites it wholesale); the
id index fuses the permutation into its `compactBlob` walk + full
probe rehash; CSR rebuilds via the round-11 `Adjacency.rebuild`;
hierarchy permutes `parent`/`parentGen`/`depth` and rebuilds
`children`, nulling the parent draw permutation (renderer re-uploads
on identity change); the curve index permutes its per-edge records
and rebuilds `pairs`/`loops` keys (params untouched — monotone); the
three blobs permute their slot-indexed offset tables (pools are
offset-space); the data sidecar permutes `values`/`present`/
`indices` **in place** (bound mapper evaluators close over those
buffers by reference — the dict-remap precedent); label sidecar
entries/dims/dirty rekey per stream; the misc slot-keyed maps
(`opacityBase`, `parentFallback`, `compoundStyle`, `resolvedPad`)
rekey; `geoEpoch` bumps (edge-bb memo); monotone maxima recompute
exactly (a compaction is the natural moment); mapper spans re-emit
whole-column.

Renderer: both groups' `resized` flags are set — the
existing paths do the rest (mirror full realloc + re-upload — a
capacity change already forces it — pick-cache invalidation, cull
`meta` rewrite); the mapper runtime reconfigures (region layout is
capacity-aligned); glyph streams rebuild owner words via
`markAllLabelsDirty` + `process` (the re-raster path); GPU tween
channels re-register their slot buffers after the settle;
`ChannelWrite.slots`/animation-queue packRef keys rebuild.

**Items (tests-first, one isolated commit each):**

- **19.1 — store-core compaction.**  `ColumnTable.compact(perm)` +
  `GraphStore.compact(group?)`: the monotone permutation build, column
  moves with capacity shrink, order-list fusion (`compactOrder`
  already drops tombstones), id-index fusion, `edge.endpoints`
  rewrite on node moves, CSR rebuild, dirty/`resized` signaling, and
  the vacated-tail zeroing (tombstoned flags).  Node specs: state
  identity pre/post (ids, data, positions, flags, adjacency,
  ordering), `highWater === count`, shrink-profile capacity actually
  falls, idempotence (compacting a compact store is a no-op).
- **19.2 — dependent store indexes.**  Hierarchy, curve index +
  blobs, data sidecar in-place permute, label sidecar, misc maps,
  epochs/maxima/spans.  Node specs: compound geometry, curve
  accessors (`controlPoints`/`midpoint`/`boundingBox`) and style
  readback byte-identical pre/post; blob record integrity; mapped
  channels re-evaluate correctly after the permute.
- **19.3 — ref forwarding + lazy repair.**  The forwarding table
  (packed (group, oldSlot, oldGen) → newSlot), gen handling for
  vacated slots so stale refs *fail* plain validation and route to
  repair, `isCurrent`/`_eleFromRef` repair paths that rewrite the
  `Ref` in place (repairing every holder of that object), handle-pool
  permutation with `_refs[0]` rewrite (scratch survives), the
  membership-set epoch, packRef-keyed animation queues, event
  listener re-keying (`'ref:'` qualifiers), forwarding-chain
  composition across consecutive compactions.

  Node specs: held
  collections and handles keep answering across a compaction
  (id/data/position/traversals), removed refs stay dead, membership
  caches invalidate, `off()` by handle still matches.
- **19.4 — renderer integration.**  The `resized` handshake, mapper
  reconfigure, glyph rebuild, parent-permutation re-upload, pick
  invalidation, GPU-tween settle + re-register, force-run gating.
  Playwright: pixel self-diff pre/post compaction on a styled scene
  (labels, curves, compounds, images — a visual no-op by assertion),
  pick correctness post-compaction, a mid-animation compaction
  settles and completes correctly.
- **19.5 — triggers, API, meters, benchmarks, docs.**  The auto
  threshold (dead-ratio > 1/2 with floor, per group) at safe
  boundaries, `cy.compact()` (+ the mid-batch throw and live-run
  deferral), `stats()`/store meters for observability, a
  `benchmark/` shrink/churn sweep (peak-then-small scan widths,
  dispatch counts, memory before/after), and the README section
  (design decision + deviations note) with the "Logged — compaction"
  closure.

**Recorded limits (pass 1):** compaction never runs concurrently with
a live GPU force run (defer, not settle — the sim owns positions);
`cy.compact()` inside a batch throws; a compaction mid-animation
settles GPU-offloaded tweens to the CPU first (CPU tweens remap and
continue); forwarding tables persist until the next compaction and
compose, so repair is total for any ref the app ever re-touches.

### Landed

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
