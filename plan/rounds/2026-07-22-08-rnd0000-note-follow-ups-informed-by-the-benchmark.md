## Follow-ups informed by the benchmark

1. ~~Compute-shader culling + `drawIndirect`~~ — done (see the culling/LOD
   section above).
2. ~~Batch the one-time glyph build~~ — **dead on re-measurement**: 100k
   labels (588,890 glyphs) build in ~160 ms (~1.6 µs/label; init-time delta
   110 ms wall), not the ~4.1 s / ~40 µs per label originally recorded.  The
   build path is unchanged since labels landed, so the original figure did
   not survive a controlled re-measurement (runtime `style()` apply → stable
   frame, CPU-profiled).  SDF raster/EDT is per *unique* glyph and cached in
   the atlas; per-label work is layout + instance emission only.
3. ~~Bulk element load~~ — **done** (the actual init bottleneck).
   Profiling the ndex-x-large load (28.6 MB JSON, 19.6k nodes / 465k
   edges, ~960 ms end to end) showed `cytoscape` init at 662 ms —
   dominated not by the columnar model but by eager per-element handle
   materialization (`Collection` interning for 484k elements the loader
   never touches), a per-element `add` emit with no listener early-out,
   def-clone churn and the ~110 ms GC echo.

   Landed as two pieces: (a) a
   bulk add path — no handles or emits on the factory load, clone-free def
   partitioning, one up-front table reservation, and `applyBulk` (the mini
   selector language resolves per (group, selected), not per element) —
   init 662 → 236 ms; (b) a **columnar elements form** (`{ columnar:
   true, ... }`, typed-array columns, integer-indexed edge endpoints,
   contiguous-slot memcpy ingest) with the compat converter
   `cytoscape.toColumnarElements(json)` — init 236 → 80 ms, and ~76 ms
   with a prebuilt payload (what fetching a binary format would enable;
   `JSON.parse` itself is 90–113 ms on this fixture).

   The serialized
   wire layout for the columnar form is also **done**: one little-endian
   ArrayBuffer (header + columns; ids as a UTF-8 blob + prefix offsets
   with an ASCII fast path) via `cytoscape.serializeElements` /
   `deserializeElements`, accepted directly by
   `options.elements`/`cy.add()`.  Numeric columns deserialize as
   zero-copy views; deserialize is ~5 ms on this fixture (replacing the
   90–113 ms parse + 27–48 ms convert of the JSON path) and the payload
   is 9.2 MB vs 30 MB JSON.
4. ~~`data()` sidecar~~ — **done**, columnar like everything else:
   per-(group, key) adaptive columns (f64 + presence for numbers,
   dictionary-encoded strings, plain-array fallback), `ele.data()` with
   v3 semantics (immutable id/source/target, `data` events), ingest from
   defs, columnar `data:` columns and the wire (v2 data blocks — f64 and
   dictionary indices deserialize zero-copy).  Labels now take any
   `data(key)` mapper and refresh on data writes.
5. ~~Perf round 2 (post-load-path)~~ — **done**: (a) grid layout got a
   slot path (no handles; bulk `setPositions`; 200k nodes 270 → 24 ms)
   plus a new **preset layout**; (b) the id index went blob-native —
   UTF-8 blob + open-addressing probe table, no stored JS strings, lazy
   per-slot decode; packed wire ids ingest with zero string
   materialization (484k ids: ~69 ms Map inserts / ~50 MB → ~10 ms /
   ~9 MB); (c) adjacency is CSR built in two counting passes from the
   endpoints column, with a per-node overlay for incremental adds
   (~15.5 MB of per-node arrays → ~4 MB).  Wire-payload init on
   ndex-x-large: ~106 → 68 ms median (deserialize itself ~0 ms).
6. ~~Cheap wins remaining: arrows, pinch zoom~~ — **done**.  Triangle
   source/target arrowheads render as one quad per visible edge per
   enabled end off the edge cull stream, tips on the endpoint node's
   boundary computed on-GPU (drags/layouts need no rebuild); the vertex
   stage stays within WebGPU's base 8-storage-buffer limit (per-end
   color column binding; edge opacity folded into stored arrow alpha).
   Two-finger pinch zooms about the touch midpoint with grab
   cancellation and an inert leftover finger.  Playwright also runs on
   WebKit now (classic renderer specs green; WebGPU specs soft-skip
   until Playwright's WebKit build ships navigator.gpu).

All follow-ups are done.  The open hooks this list once tracked have
all since closed: ~~slot compaction~~ (slot-stable tier round 11;
slot-moving round 19), ~~z-index ranks~~ (z-index dropped by decided
design 2026-08-01), ~~compound nodes~~ (round 14), ~~curved edges~~
(rounds 12a/12b/12c), ~~a binary export of live graphs~~
(`cy.serialize()`, round 10), and mappers landed as the round-7
object DSL below.  "More layouts" remains demand-gated (the round-17
extension contract is the vehicle).
