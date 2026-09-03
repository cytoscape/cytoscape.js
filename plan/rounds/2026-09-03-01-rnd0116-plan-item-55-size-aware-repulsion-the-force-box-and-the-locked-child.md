## Item 55: size-aware repulsion, the force box and the locked child

Raised by the maintainer on 2026-09-03: open call 55 carries the three
follow-ups round 114 declined for the round rather than the library, and
all three are taken here.  Two calls were put to the maintainer before a
line was written and answered:

- **(b) `boundingBox` on force takes flow's rule** — scale the settle
  down, never up, so the bodies fit; centre it in the box; uniform, so
  the sim's structure is kept.  v3 cose stretched centres to fill the
  box, up or down and size-blind; that is not carried.
- **(a) size-aware repulsion is on by default**, driven by `avoidOverlap`
  (default true): the sim reads the same padded boxes the settle
  separates.  `avoidOverlap: false` restores the point sim.  No new
  public option.

### What the survey found

Verified against HEAD `4d9bebde` before planning:

| # | Fact | Where |
| --- | --- | --- |
| 1 | The repulsion law is `repulsion · cutoff² / max(1, d²) / d` per pair on both executors, centre distance only; the sim has no per-node size input | `force-sim.mts:505-517`, `gpu-force.mts:268-282` |
| 2 | Near field = exact pairs over a 3×3 cell block with `cell = cutoff` on both executors; the far field is a size-blind monopole pyramid | `force-sim.mts:300-303`, `gpu-force.mts:479` |
| 3 | The force kernel sits at its 8-storage-binding budget; the gravity anchors already ride the CSR buffer's tail (`params.anchorBase`) to avoid a ninth | `gpu-force.mts:30-37, 552-577` |
| 4 | Force already reads padded boxes for every sim node but hands them only to the settle's `separateBodies` | `force.mts:639-644, 934-936` |
| 5 | `ForceLayoutOptions extends LayoutBaseOptions`, so `boundingBox` is accepted by the type and silently ignored; the quality suite lists force as `bbox: false` | `public-types.mts:567`, `test/layout-quality.mjs:262` |
| 6 | Flow's `applyBoundingBox` is private: body extents, scale down only, centre | `flow.mts:862-935` |
| 7 | `GraphStore.shiftSubtree` moves every descendant raw, no lock check; `setPosition` then writes the parent's position exactly ("uniform translation, so only its ancestors re-derive") | `graph-store.mts:1716-1748, 2128-2150` |
| 8 | v3's `beforePositionSet` shifts `children()` through the locked-aware `shift`, so a locked child and its subtree stay and the parent re-derives from all children; v3's drag list excludes locked descendants | `v3/src/collection/dimensions/position.mts:47-66`, `v3/src/extensions/renderer/base/load-listeners.mts:176-205` |
| 9 | The drag gesture writes a grabbed parent through `position()` / `shift()` — the store path in #7 | `pointer.mts:662-667` |
| 10 | Executors agree on invariants, not trajectories (the README's force section), so the GPU twin needs no bitwise parity | `src/README.md` |

### The passes

**116.1 — size-aware repulsion in the sim.**  The inverse-square law and
its scale stay; it is measured from the *gap* rather than the centre
distance.  For a pair at centre distance `d` along the unit direction
`u`, `s = separationAlong(dims, i, j, u)` is the exact centre distance at
which two axis-aligned boxes stop overlapping (round 115's rule, already
in `separation.mts`), `g = max(1, d − s)` is the gap softened at one
pixel, and the force is `repulsion · cutoff² / g² / d`.  With no extents
`s = 0` and the arithmetic is byte-identical to today, so every
extent-less run and the determinism specs are untouched.  At contact the
pair feels `repulsion · cutoff²` — orders above any spring pull — so the
steady state is overlap-free with a few px of gap beyond the padded box;
the settle's separation stays as the exact guarantee and becomes a near
no-op.  A hard per-tick guarantee is not promised: the seed can overlap,
and it clears within the first frames under the displacement cap.

The near field must see every overlapping pair, and two boxes overlap
only if `|dx| < maxW` and `|dy| < maxH`, so the grid cell becomes
`max(cutoff, maxW, maxH)` on both executors — `cutoff`, the law's scale,
is unchanged; only the exact-pair radius grows.  Data path: the CPU sim
takes optional `extents` (sim-indexed, node-local, padded); the GPU
runtime packs the four floats per node onto the CSR buffer's tail after
the anchors (`params.extBase`), the kernel ports `separationAlong` into
its near-field loop, and a run without extents keeps today's arithmetic
by a flag.  No new binding; the far field stays monopole.

**116.2 — `boundingBox` on force.**  Flow's `applyBoundingBox` lifts into
a shared `fitBodiesToBox` in `pack.mts`; flow delegates to it, and force
calls it in the settle after separation, projection and the re-pack,
before `ctx.finish`.  The rules: scale down, never up; uniform; centre
the body extents in the box; skipped exactly when the re-pack is (a
pinned node or constraints — a scale would move a locked node or break a
relative gap); under `animateLive` the stream shows the sim's own frame
and the box lands with the end-of-run adjustment.

**116.3 — a locked child stays when its parent moves.**
`shiftSubtree` skips a locked descendant and its whole subtree (v3: the
child's `shift` is refused, so its own children never move), and when it
skipped anything `setPosition` marks the parent's own geometry stale
instead of trusting the exact write, so the parent re-derives about the
stayers and the movers.  Per pointer move the drag writes `p + delta`
from the flushed derived value, so unlocked children keep moving by the
full delta while the parent's box stretches — the v3 result.
`_emitSubtreePositions` skips locked descendants (nothing moved there).
The store does not know `autolock` and need not: under autolock every
API-tier write to the parent is refused before the store is reached, and
the animation channel moves nothing.

**116.4 — the record.**  This file, item 55 in `PLAN.md`, the README's
force and locked-nodes paragraphs, the `MIGRATING.md` cose row, the
changelog, and the summary rewritten at close.

### The specs that discriminate

- `test/force-sim.mjs`: with extents, no two padded boxes overlap at
  convergence (a 30-clique of 40 px bodies; a labelled clique); control:
  the same run without extents overlaps; a point run is bit-identical
  with the extents field absent; a wide pair two cutoffs apart is gathered
  exactly because the cell grew to the largest box.
- `test/force-layout.mjs`: the settle's separation has nothing to move
  under the default; control: `avoidOverlap: false`.  A `boundingBox`
  holds the bodies, scaling down only; a box larger than the drawing
  leaves the pairwise distances alone; a pinned node skips the box.
- `test/layout-quality.mjs`: force's row becomes `bbox: true`.
- `playwright-tests/renderer.spec.js`: the executor-invariants test
  counts overlapping pairs on the live GPU run at readback, before the
  settle — zero; control: `avoidOverlap: false` overlaps.
- `test/grab-lock.mjs`: a locked child stays when its parent is
  positioned, shifted or dragged, and the parent re-derives about it; the
  locked child's own subtree stays; no `position` event on the locked
  child, one on its moved sibling; control: an unlocked child travels.
