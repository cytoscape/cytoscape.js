## Ledger item 70: the k-clusterings' offload lane

Ledger item 70, taken as a round.  There was no plan file: the spec is
the item's text in `PLAN.md` and its line in the eleventh sitting's
note
(`2026-09-28-01-rnd0000-note-the-eleventh-design-sitting-the-open-calls-one-by-one.md`).

The item (logged 2026-09-18, round 129.1's decision): `kMeans`,
`kMedoids`, `fuzzyCMeans` and `hierarchicalClustering` had no offload
lane.  Their references called the distance per iteration through
per-node caches (`vecOf`, `makeGetDist`) and accept a custom metric, so
the maths was not a self-contained kernel over a snapshot, and
materializing attribute vectors for the *named* metrics beside the
closure path would have been a second implementation — which the
same-kernel rule forbids.  The honest shape: one kernel over
materialized vectors that the in-thread reference *also* runs for the
named-metric case, the closure path kept for custom metrics alone, with
a parity record for the reference's own change of operation order.
Until then `executor: 'workers'` rejected on the four and `'auto'` ran
them in-thread.  **First measurement**: the named-metric share of real
calls (the GPU path already requires attributes and a named metric, so
its parity suite is the fixture), and the in-thread run's length at
1k / 5k nodes.

**Call taken (2026-09-28, the eleventh sitting): build the lane before
alpha** — one named-metric kernel shared by the reference and the
workers, the closure path kept for custom metrics, with its parity
record.

The lane has to honour round 128's `cancel()` and work in every entry
that carries workers (round 131: the full build, `cytoscape/headless`
and `cytoscape/headless-gpu` all carry the pool; the isolate carries
none and `'auto'` stays in-thread there).

### The round, as carried out (2026-09-29)

Landed the day after the sitting, on its call.  Measured on the
i9-9900K (16 threads, 63 GiB; machine 5cf3f79c), Node 24.18, through
the built ESM bundle.

| # | Commit | What landed |
| --- | --- | --- |
| 134.1 | `1e328a67` | the two kernels (`src/algorithms/algo-kernels-cluster.mts`), the four lanes, `runAlgo`'s `workersNoPathReason`, the parity and placement specs, the browser spec's clustering rows, the docs |
| 134.2 | `5662d8d4` | the `algorithms-workers` offload rows for the four, the crossovers stamped, the profile re-published |
| 134.3 | this commit | the close |

**The first measurement.**

*The named-metric share.*  There is no corpus of real applications
here, so the census is of every call site in the tree that names one of
the four (v3's tests and documentation, v4's tests, benchmarks and
browser specs — 83 calls across 14 files; the sources, the typings
tests and the built and archived files excluded): **6 pass a custom distance function, 77 do
not** — 93% named or defaulted — and all six are specs of the
custom-function feature itself; every documentation example (v3's
`kMeans`, `fuzzyCMeans` and `hierarchicalClustering` pages) uses a
named metric.  The GPU parity suite, the item's named fixture, is named
throughout by construction (its path requires it).  The share is a
statement about the tree, not about applications; it says the lane
covers the documented spelling.

*The in-thread run's length*, before the round, through the pre-round
bundle: the `algorithms-gpu` suite's feature fixture (seeded points,
two attributes `a` ∈ [0, 40), `b` ∈ [0, 10)) and its options (k = 8,
ten iterations; k-means from fixed test centroids; hierarchical at
threshold 0.75), median of three, `Math.random` seeded per call so the
random seedings match across bundles:

| family, n = 1024 / 5120 | euclidean | squaredEuclidean | manhattan | max |
| --- | --: | --: | --: | --: |
| kMeans | 11.4 / 45.0 ms | 8.5 / 45.0 | 9.0 / 51.6 | 9.0 / 44.4 |
| kMedoids | 48.7 / 2,979.8 | 47.2 / 3,173.1 | 46.5 / 2,948.5 | 101.4 / 2,698.9 |
| fuzzyCMeans | 44.7 / 207.4 | 39.1 / 201.7 | 38.7 / 200.8 | 40.1 / 205.8 |
| hierarchicalClustering | 25.8 / 646.3 | 21.6 / 634.2 | 25.2 / 621.1 | 26.7 / 629.4 |

So at 5k every one of the four holds the calling thread for tens of
milliseconds to three seconds — the lane is worth building on its own
terms, as the sitting judged.

**The design, as built.**

- **Two kernels, in a sibling of `algo-kernels.mts`**
  (`algo-kernels-cluster.mts`, registered in `ALGO_KERNELS` as
  `kClustering` and `hierarchical`; a sibling because
  `algo-kernels.mts` was at 1,045 lines and item 71 left the large
  files as they are rather than growing them).  `kClusteringKernel`
  is k-means, k-medoids and fuzzy c-means in one function (the
  reference was one module with one `getDist` over the three modes, and
  one function keeps one copy of the metric); `hierarchicalKernel` is
  round 65.10's flat merge engine, moved whole, with the named metrics
  inline as they already were.  Both obey the kernel rule — no
  imports, no outer references, no class syntax — so the pool carries
  them as source text beside the body and every build's worker
  answers with them.
- **The snapshot**: the attribute vectors, evaluated once per node on
  the calling thread (`vectorsOf`, f64), the metric as a code
  (`namedMetricKind`, with euclidean below two attributes folded to
  manhattan — the reference's own 1-D shortcut), and the seeding done
  where it was: `randomCentroids` / `randomMedoids` / fuzzy c-means'
  uniform-then-normalized memberships call `Math.random` on the
  calling thread, in the reference's order, so a seeded caller gets the
  same run.  k-medoids' starting medoids travel as extra vector rows
  (a caller's test medoid may sit outside the collection; its vector is
  a row of its own), and the medoids after that are node rows.
- **The in-thread reference runs the kernel** for a named metric —
  `kMeans()`, `kMedoids()`, `fuzzyCMeans()` and
  `hierarchicalClustering()` are `inThread(lane)` when a lane exists —
  and the closure path (the pre-round bodies, renamed `*ByClosure` in
  `k-clustering.mts`; `hierarchicalRun`'s object path) runs a custom
  distance function and, for hierarchical, a per-pair linkage.  The GPU
  executor's hierarchical merge phase runs `hierarchicalKernel`
  in-thread over its read-back matrix (`hierarchicalRun` fills the
  lower triangle and hands it over), so the flat engine exists once.
- **The routing**: each async entry hands `runAlgo` its lane as the
  eighth argument, so `'auto'` takes it last before the in-thread run,
  above the family's stamped crossover, where a worker can be
  constructed; an explicit `'workers'` runs it.  Where the options
  leave no lane, `runAlgo`'s new ninth argument, `workersNoPathReason`,
  names why — "a custom distance function runs on the calling thread"
  or "a linkage other than 'min', 'max' or 'mean' runs on the calling
  thread" — instead of the generic "no workers path", which now fires
  only on the one-column seed forms (`heatDiffusion`,
  `randomWalkWithRestart`).
- **Cancellation** is the offload lane's, unchanged: the token is
  polled before the snapshot is posted and after the kernel answers, so
  a cancel while queued posts nothing and a cancel mid-run drops the
  answer (`test/algorithms-offload-clustering.mjs` pins both).

**The parity record — the reference's own change.**  The arithmetic is
the closure path's operation for operation: the same visit order
(`q − p` per dimension, the node's vector minus the centre's), the same
`Math.abs`, the same strict `<` classification (first centre wins a
tie), the same convergence tests including their NaN readings, the
same member order (node order within a cluster), the same sums from
`0.0`.  One respelling: the square is `diff * diff` where the closure
path's `addSquaredDiff` says `Math.pow(diff, 2)`; fdlibm's `pow`, which
V8's `Math.pow` is, returns `x * x` for an exponent of exactly 2.  Two
records, both exact:

1. **Against the pre-round bundle**, the probe above re-run on the
   post-round bundle: every result digest (the clusters' member ids in
   order, and fuzzy c-means' full membership matrix as bytes) is
   **identical** — 32 of 32 cells, four families × four metrics × 1024 /
   5120 nodes.  And faster, because the closure path spawned every
   cluster's collection every iteration and rebuilt each cluster with
   a pass over all nodes:

   | family, n = 1024 / 5120 (euclidean) | before | after |
   | --- | --: | --: |
   | kMeans | 11.4 / 45.0 ms | 4.7 / 15.3 |
   | kMedoids | 48.7 / 2,979.8 | 9.4 / 311.1 |
   | fuzzyCMeans | 44.7 / 207.4 | 20.1 / 59.9 |
   | hierarchicalClustering | 25.8 / 646.3 | 26.1 / 622.9 |

   (Cold medians of three, first call included — the probe's numbers,
   not the bench's warm ones below.  Hierarchical was already the flat
   engine; it moved, it did not change.)
2. **In the suite**, `test/algorithms-offload-clustering.mjs` (59
   specs): the kernel under a metric's *name* against the closure path
   under a custom function that *is* that metric (`resolveDistance`'s
   implementation), `===` on every cluster member and every membership
   value — k-means from test centroids and from seeded random ones,
   k-medoids from test medoids (one outside the collection) and seeded
   random ones, fuzzy c-means, each over four metrics in one, two and
   three dimensions on an integer-coordinate fixture (ties on purpose);
   hierarchical over four metrics × three linkages in both modes.  A
   sweep of 200,000 doubles across the whole exponent range pins
   `Math.pow(x, 2) === x * x`.

Two behaviours the parity work surfaced and kept, each pinned:

- **A k-means cluster that empties keeps the members it last held.**
  The reference assigns `clusters[c]` only for a non-empty cluster, so
  one that emptied in a later iteration answers its stale membership
  (a node then sits in two clusters) — v3's behaviour.  The kernel
  carries each cluster's last non-empty member list to match; a
  searched-for fixture (six points, three centroids) pins it against
  the closure path.
- **The caller's `testCentroids` are no longer written.**  The
  reference adopted the caller's array as its centroid list and
  overwrote its entries each iteration; the snapshot copies them.  A
  spec pins that the array is unchanged; MIGRATING and CHANGELOG say so.

And one deviation, taken deliberately: **an unknown hierarchical `mode`
reads as threshold mode.**  The flat engine tested for `'threshold'`
and `'dendrogram'` by name, and any other string never met a stop
condition — verified on the pre-round bundle: five nodes, `mode:
'foo'`, still running at the 10 s timeout.  The kernel takes a boolean
`dendrogram`, so the loop terminates.

**The worker against the reference**: the same function from its own
source text, so `'workers'` answers `'cpu'`'s bits by construction —
asserted per family with the pool's `offloads` counter moving by one,
plus dendrogram mode with `addDendrogram` building the same tree from a
worker's merge log.  The bare-scope module spec runs both kernels (all
three k modes) from every bundle — the five full builds and the six
headless and headless-gpu ones — and under tsx; the browser spec runs
k-means and hierarchical on a Blob worker from the served UMD and from
the minified build, member for member against `'cpu'`.

**Controls**, each restored: the kernel's classification `<` turned
into `<=` (last-wins ties) turned eleven k-means / k-medoids parity
specs red; dropping the stale-cluster carry turned the stale-cluster
spec red; skipping `moving = true` after a k-medoids swap turned twelve
k-medoids parity specs red; routing a custom metric to the lane
(dropping the `typeof` test) turned the custom-metric placement and
rejection specs red.

**The bench rows and the crossovers.**  `benchmark/algorithms-workers.mjs`'s
offload tier gains the four, on the `algorithms-gpu` feature fixture
and options (k-medoids from fixed test medoids so every sample runs the
same iterations; fuzzy c-means has no test mode), at the item's scales,
each row asserting where it ran as the tier's rows do.  Published
(`--repeat 3`, serial, the whole profile re-run so the archive carries
one run at the new fingerprint):

| family | n | cpu | offload | first call | held cpu → offload |
| --- | --: | --: | --: | --: | --: |
| kMeans | 1024 / 2048 / 5120 | 1.6 / 3.1 / 7.3 ms | 2.6 / 4.9 / 9.0 | 28 / 30 / 40 | 1.6 → 1.4 / 3.1 → 0.4 / 7.3 → 1.1 |
| kMedoids | 1024 / 2048 / 5120 | 8.4 / 28.4 / 265.4 | 11.5 / 31.4 / 286.6 | 32 / 46 / 169 | 8.4 → 0.2 / 28.4 → 0.0 / 265.4 → 0.0 |
| fuzzyCMeans | 1024 / 2048 / 5120 | 16.4 / 19.4 / 48.4 | 13.3 / 24.4 / 59.8 | 43 / 51 / 74 | 16.4 → 0.7 / 19.4 → 1.1 / 48.4 → 2.5 |
| hierarchicalClustering | 1024 / 2048 / 5120 | 22.5 / 94.7 / 629.5 | 25.4 / 107.1 / 679.7 | 51 / 116 / 577 | 22.5 → 0.0 / 94.7 → 0.0 / 629.5 → 0.0 |

(`repeatSpread` 1.01–1.18; the in-thread column is the new reference,
warm — hence below the probe's cold medians above.  The lane's own cost
is the clone, the wake and the transfer back: 1–3 ms at 1k–2k, 8–10% at
5k, where the worker's JIT is colder than the calling thread's.  The
pool tier's rows and the other offload families read within their
spread of round 129.4's published run.)

The crossovers, stamped by round 129.4's rule — the smallest measured
size whose in-thread run reaches ~4 ms, a quarter frame — from the
same instrument at n = 64 … 1024 (and 2048 … 16384 for k-means, 640 /
768 / 896 for k-medoids): **fuzzy c-means 512** (2.5 ms at 256, 9.5 at
512), **hierarchical 512** (1.3 at 256, 5.3 at 512), **k-medoids 768**
(3.4 at 640, 5.0 at 768, 8.7 at 1024), **k-means 4096** (3.1–3.9 ms at
2048 — the published median and the sweep, just under — 5.9 at 4096).
Each is its own exported constant beside its entry point, stamped with
the figures.  The GPU's `'auto'` crossovers are unchanged (k-means
1024, k-medoids 256, fuzzy c-means 512, hierarchical never), so on a
page with an adapter the GPU still runs those sizes; the lane serves
headless Node, adapter-less pages and the sizes below the GPU's
crossover.

**What the lane frees is the kernel's share.**  The snapshot (the
attribute calls, `Math.random`) and the result (spawning the
collections) stay on the calling thread: the held-thread rows read
0–2.5 ms for all four at 1k–5k, which is most of a 1.6 ms k-means at
1024 (its vectors and the spawns are its run) and nothing measurable
of a 630 ms hierarchical clustering.  Item 69's builder question, in
this family's shape.

**The docs.**  JSDoc on the four `Collection` members (what `'workers'`
does now, and its rejection), `src/README.md`'s executor paragraph (the
four join the lane, the reshaping, the parity record, the crossovers),
`docs/features.csv` (the two capability rows and the four API rows),
MIGRATING and CHANGELOG, `dist/*.d.ts` regenerated.

**Gates at close**: `npm run -s test:node:quiet` green (zero bytes);
the `algorithms-workers` Playwright spec on Chromium and WebKit.

### What the round did not do

- A custom distance function stays in-thread, by the sitting's call:
  it is called inside the iteration.  For hierarchical clustering with
  a named linkage the metric is only the initial matrix, so the merge
  chain could be offloaded after an in-thread fill — the affinity
  propagation pattern — but the matrix is n² f64 (200 MB at n = 5120),
  a clone the lane would pay per run; not taken.
- The builders' in-thread share (item 69) is this family's too; not
  taken here.
