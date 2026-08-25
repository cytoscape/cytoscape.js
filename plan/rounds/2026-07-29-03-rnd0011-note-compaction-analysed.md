## Compaction, analysed

Discussed 2026-07-27 while planning round 10 and **deliberately left
out of that sprint**: the analysis below is settled.  The
**slot-stable tier landed in round 11** (above) with auto thresholds —
the "plausibly auto regardless" lean below, taken.  The *slot-moving*
policy calls were decided with the user 2026-08-01 and **the tier
landed as round 19** (the plan and Landed sections at the end of this
file); the analysis below is kept as the record that motivated it.

**When compaction is motivated** — three distinct profiles:

1. **Shrink** (big removals without re-add — e.g. a filter UI cuts 200k
   elements to 20k).  Dead slots pile up and `highWater` never falls:
   every compute dispatch (cull count/scan/scatter, mapper eval) still
   runs over `highWater` lanes; every CPU columnar scan
   (`scanRefsInto`, `boundingBox`, `refsInBox`, CPU pick) still
   iterates `highWater` slots — cost proportional to the *peak* graph,
   not the current one.  CPU columns and GPU mirrors stay at peak
   capacity, and one-coalesced-span dirty tracking uploads dead bytes
   when writes straddle dead regions.
2. **Churn** (sustained remove+add at stable size — streaming /
   sliding-window dashboards, expand/collapse exploration).  The
   free-list recycles slots, so the tables don't grow — but three
   append-only structures leak unboundedly in *time*: the **id blob**
   (removed ids' UTF-8 bytes + probe entries never reclaimed; new ids
   append fresh bytes), the **CSR adjacency** (removed edges strand CSR
   space; incremental adds accumulate in the per-node overlay), and
   **string-dictionary data columns** (dictionaries only grow).  This
   is the most motivated real-world case — and it is invisible to a
   dead-slot-ratio meter, since slots recycle.
3. **Peak-then-small memory reclaim** (transient huge load, then
   narrow): capacity stays at peak until slots compact and columns
   realloc down.

Not motivated: add-only or stable graphs (zero waste), and moderate
removal on big graphs (cull already keeps draw cost O(visible); dead
slots only cost pass-iteration width and memory).

**The tier split** — the tiers differ by trigger meter, not just
difficulty.  Blob/CSR/dictionary compaction is **slot-stable**: no
identity moves, no renderer or ref implications, metered by plain waste
counters — it could safely run automatically.  (That is exactly how it
landed in round 11: waste-over-half thresholds with small floors, no
new API.)

**Slot compaction**
moves live elements, is metered by dead-slot ratio, and carries all the
policy weight: outstanding refs (plain `{group, slot, gen}` objects in
user-held collections, plus packed-int membership-set caches — they
cannot be found and rewritten eagerly), z-order (slot order is draw
order), GPU full re-upload (the existing `resized` path), and remap of
in-flight animation slot lists.

**Open policy questions** — these apply to the *slot-moving* tier only
(round 11 took the slot-stable lean of (b)); options discussed —
**all three decided with the user 2026-08-01, see the round-19 plan
at the end of this file**: (a) ref
survival across a slot move — a forwarding table with lazy ref repair +
an epoch stamp invalidating cached membership sets (**taken**), vs
handles-survive-collections-stale, vs everything-stale; (b) trigger —
explicit `cy.compact()` vs auto thresholds (**both taken**: auto
threshold + the explicit call); (c) draw order after
compacting — stable
(visually a no-op) (**taken**) vs restore-insertion-order (heals the
recycled-slot
z-order wart at the cost of a visible change and a per-slot sequence
number).

**Settled adjacent question**: removed-element readability is
*orthogonal* to compaction — v4 already gave it up when it chose
tombstones + a free-list (the next add may recycle the slot), and the
round-10 design call above makes that permanent.  Compaction changes
nothing for removed refs under any option: a removed ref matches no
forwarding entry and its generation is already stale, and the cached
`id()`/`group()` live on the JS handle, not in the columns.
