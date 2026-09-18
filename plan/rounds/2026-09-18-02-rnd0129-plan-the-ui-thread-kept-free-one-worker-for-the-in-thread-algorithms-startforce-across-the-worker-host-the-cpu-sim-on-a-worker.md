## The UI thread kept free: one worker for the in-thread algorithms, `startForce` across the worker host, the CPU sim on a worker

Raised by the maintainer on 2026-09-18, reading round 74's close and
item 51's measurement together: "for algorithms on the CPU, it would
make sense to at least use N=1 worker for algorithms that can't
productively be sped up via workers — this would keep the main/UI
thread free"; and the worker host's force layout, which item 51 found
running its CPU simulation synchronously on the main thread (12.8 s
frozen at 19.6k nodes / 465k edges where the GPU integrator takes
1.7 s).  One round, because the three pieces are one fact: the
execution model rounds 65, 72, 74 and 128 settled routes work by
*speed*, and the main thread's availability was never a lane's value.
What the code does today, verified:

1. **Every whole-graph algorithm without a pool or GPU lane runs its
   reference synchronously on the calling thread** — `runAlgo`'s
   fallthrough is `settled(cpu())` (`executor.mts`), and after round
   128 that call completes inside the entry (the round-128 correction:
   no await precedes it).  The families in that position: pageRank and
   Katz (`'auto'` gates at `Infinity`, the 72.1 verdict), Floyd–Warshall
   and closeness's weighted route, triangles, neighborhood similarity
   and the motif census below their mean-degree gate, SimRank,
   effective resistance, Markov clustering and affinity propagation
   below `GPU_MIN_N`, the k-clusterings and hierarchical clustering
   below theirs — and every run on a page without an adapter.  A
   pageRank on ndex-x-large is 16–80 ms of main thread; an MCL at
   n = 1024 is seconds.
2. **The reference implementations already split into a main-thread
   build and a typed-array loop** — `buildPageRankSparse`,
   `buildKatzSparse`, `initFloydWarshall` + `relaxFloydWarshall`,
   `buildTriangleAdjacency` + `triangleCount`, `buildNeighborhoods` +
   `neighborhoodSimilarity`, `buildTriadStructure` + `motifCensus`,
   `buildSimRankNeighborhoods` + `simRank`, `buildResistanceSystem` +
   `invertDense`, `buildMarkovMatrix` + the expand/inflate loop,
   `buildAffinitySimilarity` + the message-passing loop — each with a
   `*ResultFrom` wrapper the GPU path already shares.  The user
   closures (`weight`, MCL's `attributes`, AP's `attributes` and
   `distance`) are consumed by the *builders*, on the main thread,
   never inside the loops.  The k-clusterings and hierarchical
   clustering are the exception: `kMeans` calls the distance per
   iteration through `vecOf`'s per-node cache (`k-clustering.mts`)
   and the merge chain calls `makeGetDist` per pair
   (`hierarchical-clustering.mts`), so a custom metric is *in* the
   loop by design.
3. **The pool carries one body as source text and partitions every run
   over every worker** — `_algoWorkerSource` stringifies
   `algoWorkerBody` alone (`algo-workers.mts`), `acquireAlgoWorkers`
   spawns `algoWorkersSize()` workers at once and pings each, and
   `run` serializes whole-pool runs behind one promise queue.  The
   bundles carry no `__publicField` (grep: 0 in the ESM build, target
   es2018), and the body's rule — no imports, no outer references, no
   class syntax — is what `test/modules/algo-worker-body.mjs` gates.
4. **The worker host has no `startForce`** — `WorkerRenderer.forceActive()`
   answers false always, the proxy's module note records the deferral,
   and the force layout's `runOnce` reaches the renderer only through
   `typeof renderer.startForce === 'function'` (`force.mts:1467`), so
   under `renderer: { worker: true }` a flat graph takes the CPU
   executor.  The renderer's own `startForce` (`renderer.mts:987`)
   answers null only when not ready, destroyed, or a run is already
   open; the engine polls `converged()`/`idle()` per frame and protects
   the leased column through `ownedColumns()` (`renderer.mts:1563`).
   The message contract (`worker-protocol.mts`) has no force messages.
5. **The CPU sim's settle-then-land loop is synchronous** —
   `while (!sim.converged() && !this.stopped) sim.step(50)`
   (`force.mts:1530`) — and it is the path every compound graph,
   every constrained run, every no-adapter page and every headless
   `animate: false` run takes.  The live loop (`animateLive`,
   `infinite`) ticks per animation frame and writes positions back
   through `ctx.setPositions`.  `ForceSim` (`force-sim.mts`) depends
   on `OverlapGrid` (`separation.mts`) and reads `ForceConstraints`
   inside `project()`, whose body touches only positions, pins and
   the constraint arrays.  The inputs (`ForceSimInputs`) are typed
   arrays and plain objects throughout — structured-cloneable.
6. **A Node worker inherits the tsx loader** (measured 2026-09-18:
   `new Worker(src, { eval: true })` under `node --import tsx` has
   `execArgv ['--import', 'tsx']` and `import()`s a `.mts` module), so
   a worker that loads *the bundle itself* — the render worker's
   mechanism (86.3, `spawnRenderWorker`) — can be driven from `src/`
   in the Node suites as well as from the built artifacts in a page.
   The root package is not `"type": "module"`, so `import()` of the
   CJS/UMD `.js` bundles resolves in Node too.

### Design calls

- **`'auto'` gains an offload lane, last before the in-thread
  reference: one pool worker running the family's kernel.**  A family
  is *snapshot-runnable* when its reference is a self-contained kernel
  over a snapshot (CSR / dense typed arrays + scalars) with no user
  closure inside the loop; the builders evaluate the closures on the
  main thread as round 74 pre-evaluates weights.  The kernels move to
  `src/algorithms/algo-kernels.mts` under the body's own rule (no
  imports, no outer references, no class syntax), the in-thread
  `'cpu'` path calls the very same function, and the pool carries each
  kernel's source text beside the body — **bit-identical by
  construction**, and the module spec evaluates every kernel in a bare
  scope from every bundle.  `'cpu'` keeps its meaning exactly.  An
  explicit `'workers'` on a family with no pool lane now runs the
  offload lane instead of rejecting — the maintainer's ask, read
  literally: a worker *is* the workers executor.
- **Which families**: pageRank, Katz, Floyd–Warshall (and closeness's
  weighted route through it), triangles, neighborhood similarity, the
  motif census, SimRank, effective resistance, Markov clustering,
  affinity propagation — ten.  Logged, not this round: the
  k-clusterings and hierarchical clustering (fact 2 — their references
  call the metric per iteration; materializing vectors for the named
  metrics would be a second copy of the maths beside the closure path,
  which the same-kernel rule forbids), and the round-74 families
  *below* their pool crossover (their pool bodies are not the
  reference function — betweenness is f64-tight, not bits — and the
  runs there are single-digit milliseconds; measured and recorded, not
  assumed).  The traversal tier (bfs/dfs, dijkstra, aStar, bellmanFord,
  kruskal, tarjan, hopcroft-tarjan, hierholzer, kargerStein, the
  degree centralities) stays synchronous by design: called per root in
  tight loops, the round-65 reading.
- **The pool spawns lazily** — one worker on acquisition, grown to
  `algoWorkersSize()` by the first whole-pool run — so an offload never
  pays for eight workers it will not use; whole-pool runs still
  serialize behind the queue, single-worker runs take an idle worker
  each and interleave, and the counters gain `offloads`.
- **The gate is the thread, not the speed.**  Two instruments: the
  main thread's availability during a run (a 1 ms `setInterval` tick
  count in Node, a rAF count on a page — in-thread reads ~0, offloaded
  reads ~the run's length) and the offload overhead (clone + wake +
  transfer) as a share of the run.  A family is declined only if the
  overhead exceeds the run at its typical size; below a measured
  per-family `offloadMinN` the run stays in-thread because a run
  shorter than a frame's spare time blocks nothing perceptible.
- **`startForce` crosses the worker boundary**: the proxy answers a
  `RemoteForceRuntime` synchronously (null before ready or while a run
  is open — the engine's own two conditions), the inputs cross as one
  cloned message, the worker's engine runs the integrator it already
  owns, `converged()`/`idle()` mirror a state message the worker posts
  while a run is open, `readPositions()` is a request/reply with the
  positions transferred, `setPosition`/`setPinned`/`reheat`/`wake`
  and `finishForce` are one message each.  `animateLive` streams from
  the worker's own mirror (the integrator publishes into the leased
  column on-device, as on the same-thread host).  `cancel()` and
  `stop()` propagate through the same poll; `destroy()` rejects the
  pending read as it rejects a pending export, so the run resolves
  through 128.4's branch.  The proxy's `forceActive()` becomes true
  while a run is open and not converged, so compaction defers under it.
- **The CPU sim runs on a worker that loads the bundle** — not a
  stringified kernel: `ForceSim` is a class over `OverlapGrid` and the
  constraint projection, and the render worker's mechanism (load the
  same artifact inside a worker, call a static) is the one that
  carries it without a rewrite; the same code runs on both sides by
  construction.  `cytoscape.__runForceSimWorker__` is the entry; the
  spawn resolves the bundle's URL through the same `selfUrl()` the
  render worker uses, extended for Node (`import.meta.url` under ESM
  and tsx, `__filename` under CJS).  One sim worker per page/process,
  lazily, `unref()`ed in Node, `_resetForceWorker()` as the test hook;
  a second concurrent force run while the worker is busy runs
  in-thread.  The constraint projection is extracted as a pure
  function so the settle can project without a sim.
- **When the sim goes remote**: the force layout gains `executor:
  'auto' | 'cpu' | 'gpu' | 'workers'` (default `'auto'`).  `'auto'`
  is availability-driven, as 87.2 made it: the GPU integrator where
  the renderer offers one, else the worker sim **where the run is
  already asynchronous by contract** — a rendered host, `animate:
  true`, `animateLive`, `infinite` — else in-thread.  Headless
  `animate: false` keeps its documented synchronous spelling.  `'cpu'`
  is the in-thread reference; `'workers'` is the worker sim even
  headless (asynchronous), and throws at `run()` where no worker can
  be constructed; `'gpu'` throws where no integrator is available.
  `infinite` runs are supported on the worker sim (the wake/reheat/
  position verbs are messages; a topology change rebuilds the run as
  it does in-thread).

### The plan

- **129.1 — the offload lane.**  `algo-kernels.mts` (ten kernels, a
  registry); the body's `kernel` snapshot and `result` reply; the
  pool's lazy spawn, per-worker scheduling and `runOne`; `runAlgo`'s
  `offload` parameter and the lane order GPU → pool → offload → cpu;
  each family's reference refactored to `wrap(kernel(build()))` with
  the GPU builders untouched (list-shaped inputs cross as CSR through
  one shared converter).  Verified by: bit-equality specs per family
  (`===` on every score, in-thread vs offload), the pool untouched
  after a `'cpu'` run and `offloads` counting after an `'auto'` run
  above `offloadMinN`, an explicit `'workers'` on pageRank running
  (was a rejection — the throw entry retires), cancel before post and
  mid-run, controls that skew a kernel's output and show the spec red.
- **129.2 — `startForce` across the worker boundary.**  Protocol,
  proxy runtime, worker-side handling, the state poll; the module note
  and `forceActive()` updated; the item-51 probe's force rows gain the
  rAF count and re-measure both hosts.  Verified by the worker-renderer
  Playwright project on the RX 580: frames drawn during the run, the
  settle's invariants equal to the same-thread host's, a cancelled run
  restored (the 128.3 pick), the main thread responsive (rAF count).
- **129.3 — the CPU sim on the worker.**  `force-worker.mts` (the
  loop: chunked stepping that yields to messages, streaming per tick
  under live runs, idle sleep for infinite ones), `force-remote.mts`
  (the spawn, the runtime), `selfUrl` shared, the projection
  extracted, the layout's `executor` option and the remote path
  sharing the GPU poll's shape.  Verified by: bit-identical
  trajectories (`'workers'` vs `'cpu'`, headless, every position
  `===`), the live stream landing per tick, stop/cancel/destroy, a
  compound graph and a constrained run on the worker, `infinite`
  reheat through the worker, the throw for `'workers'` under a stubbed
  platform, the soak (one worker, instances collect).
- **129.4 — the bench rows and the close.**  `algorithms-workers`
  gains `offload` rows per family asserting `offloads` moved, plus a
  main-thread-ticks row per family (in-thread vs offload); the
  item-51 probe's force rows carry the rAF counts; the sweep stamps
  `offloadMinN`.  The record, `src/README.md` (executor section, the
  force layout's executors, design decisions), MIGRATING/CHANGELOG
  (`'workers'` now runs the offload families; the force layout's
  `executor`; rendered compound runs become asynchronous),
  `docs/features.csv`, d.ts, the ledger (item 51's force deferral
  closed; item 68 untouched), the executive summary.

### Risks named at planning

- A kernel that references a module constant is a ReferenceError in
  the worker and silently fine in-thread; the bare-scope module spec
  runs every kernel from every bundle for exactly this.
- Lazy spawn changes what `_algoWorkersStats().workers` reads after
  an offload-only run (1, not the size); the round-74 specs assert the
  size after whole-pool runs, which still grow the pool.
- The remote force runtime's state trails the worker by a message;
  the layout's 60 ms poll already tolerates that on the same-thread
  host (the GPU readback's 4–100 ms latency, 119).
- A worker that loads the bundle pays the bundle's parse once per
  page (~50–100 ms); one sim worker per page, never per run.
- The force layout's remote path makes rendered compound runs
  asynchronous; every spec that read positions synchronously after a
  rendered compound run needs `promise()` — the headless contract is
  unchanged, so the Node suites are unaffected by default.
