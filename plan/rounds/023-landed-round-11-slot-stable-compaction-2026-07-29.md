## Landed (round 11 — slot-stable compaction, 2026-07-29)

The buildable tier from the compaction analysis (next section): the
append-only structures that leak under churn now meter their waste and
reclaim it automatically on a threshold, extending the policy the
insertion-order list has always used (`compactOrder` at > half stale).
No element slot moves — refs, draw order and the GPU mirrors are
untouched — which is what the analysis identified as making
auto-trigger safe for this tier; the *slot-moving* tier's policy calls
(ref survival, trigger, draw order) stay open below.  Each piece lands
as an isolated commit with Node tests.

- **En route fix**: adjacency's `overlayCount` counted +1 per
  `addEdge` but decremented per overlay-list entry (an edge holds two:
  `out[source]` + `inn[target]`), so it could hit zero with entries
  still live and let `addBulk` build a "fresh" CSR under a non-empty
  overlay, drawing bulk edges ahead of earlier incremental ones in
  per-node incident order.  It now counts entries; regression test
  pins the ordering.
- **Id blob** (`store/id-map.mts`): `remove()` meters the removed id's
  stranded UTF-8 bytes; when they exceed half the blob (≥ 4 KiB
  floor), the live ranges compact into a fresh right-sized blob, so
  peak-then-small graphs also shrink back toward the floor.  The probe
  table stores (group, slot) codes, never byte offsets, so it — and
  the per-slot hashes and decoded-name cache — survive compaction
  untouched; probe-table tombstones already self-reclaimed via the
  rehash in `ensure()`.  Cost is O(live bytes), amortized over the
  removals that stranded the waste.  A 20k add/remove churn loop that
  used to strand ~200 KB now holds the blob ≤ 8 KiB.
- **CSR adjacency** (`store/adjacency.mts`): removals strand CSR
  entries (fixed per-node segments can't refill) and post-build adds
  accumulate in the per-node overlay arrays — both metered now
  (`csrStranded`/`overlayEntries`).  When their sum exceeds half the
  live entry count (64-entry floor), `GraphStore` rebuilds CSR from
  the live edges in insertion order — the same two counting passes as
  the bulk build — folding the overlay back into the compact typed-
  array shape and dropping the stranded space.

  Insertion order is
  what the incremental paths produce anyway, so per-node incident
  order is preserved across a rebuild (the one exception: an edge
  re-pointed by `moveEdge` sits at its re-add position until a rebuild
  returns it to insertion order).  A side effect closes a gap from
  round 5: a *purely incremental* graph (never bulk-loaded) used to
  keep all its edges in JS overlay arrays forever; it now folds into
  CSR once past the floor, at geometric intervals (amortized O(1) per
  add).
- **String dictionaries** (`store/data-store.mts`): dicts only grew,
  so entries whose last reference was overwritten or cleared leaked
  under churn.  String columns now keep a per-entry refcount (one
  extra indices read per write); when dead entries exceed half the
  dict (8-entry floor) the dict compacts — live entries keep their
  relative order, the indices column remaps **in place** (bound CPU
  evaluators hold the array and col by reference), and a per-column
  `epoch` bumps.  Values never change, only the private index space,
  so no mapper output moves (ordinal domains are explicit — there is
  no dict-order-derived domain).

  GPU interplay: `onDictRemap` →
  `GraphStore.markDataWrite` over the whole column (watched keys
  re-upload their remapped index shadow), and the mapper runtime packs
  `dictEpochs` beside `dictSizes` — the span handler reconfigures on
  either mismatch, since a same-frame shrink-then-regrow can return
  the dict to its packed *length* with a different index mapping
  (spec-pinned: the epoch test fails on the length check alone).  The
  ingest path also compacts adopted wire dicts that arrive with
  unreferenced entries.

**Verification**: typecheck, lint, `test:js` (1638 → 1645) and
`test:modules` (58) green per commit.  Write-path cost checked against
the pre-round baseline (`benchmark/mutators.mjs` at N=2k, same
machine, same run): remove+re-add 5.45 vs 5.32 ms/iter (noise), data
set at parity — after re-splitting the DataStore write path so the
numeric case stays inlinable (the first cut regressed numeric bulk
writes ~16% by growing `write()` past the inline budget; caught by the
baseline comparison, pinned back to 50.5 vs 50.7 µs).

Churn
measurement (sliding-window store scenario: 20k nodes / ~21k edges
stable, 1k-node bands removed and re-added with fresh ids and
per-element strings): after 40 rounds the id blob holds 699 KB vs
1.84 MB pre-round, the string dictionary 21.2k entries vs 60k, and
adjacency lives in typed-array CSR (38k live entries, 41k capacity,
4k overlay) vs 42k permanent JS-array entries; at 80 rounds the
pre-round numbers keep growing linearly (3.03 MB blob / 100k dict)
while round 11 stays flat (492 KB / 23.1k) — churn profile 2's
unbounded-in-time leak is closed.

The `webgpu` Playwright projects
could not be validated on this Linux machine: the SwiftShader adapter
acquires (vendor google/swiftshader) but renders blank — identical
failures on the pre-round baseline commit, so a pre-existing
environment limitation, not this round; the mapper-runtime
epoch/repack behaviour is pinned by the Node mock-device suite
instead, and the webgpu projects should be re-run on a machine with a
working adapter before release.  (**Resolved 2026-07-29** — the blank
rendering was a Linux canvas-presentation issue in headless Chromium,
fixed with ANGLE-on-Vulkan compositing flags; all 51 specs now pass on
this machine.  See the next entry.)
