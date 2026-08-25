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
