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

## Landed

Executed 2026-09-18 on the benchmark machine (the RX 580 / i9-9900K;
`npm run gpu` reads HARDWARE), in the plan's order.  Every design
call above was taken except where the code proved one wrong; each
deviation is stated with its sub-round.

### 129.1 — the offload lane

`src/algorithms/algo-kernels.mts` holds the ten references, moved:
pageRank, Katz, Floyd–Warshall, triangles, neighborhood similarity,
the motif census, SimRank, effective resistance, MCL and affinity
propagation, each one self-contained function over a snapshot of
typed arrays under the worker body's own rule (no imports, no outer
references, no class syntax — MCL's expand / inflate / convergence
helpers became inner functions, AP's exemplar scan too).  Every
family's builder evaluates its closures on the calling thread into
the snapshot (weights as round 74 does; MCL's `attributes`, AP's
`attributes` and `distance` — including a custom distance function,
which the spec exercises), the neighbor-list families cross as CSR
pairs through one `listsToCsr`, the in-thread `'cpu'` path calls the
kernel through `inThread(lane)`, and the pool carries each kernel's
source text beside the body (`_algoWorkerSource` builds a `kernels`
registry the body receives as its second argument).  So the reference
and the worker run one function: `test/algorithms-offload.mjs` asserts
every score with `===` across the ten families and the weighted
closeness route (which rides Floyd–Warshall's kernel).

The executor gained the lane — `runAlgo`'s eighth parameter, an
`OffloadLane` with `minN`, `snapshot()` and `wrap()` — and the order
under `'auto'` is GPU → pool → offload → cpu, the lane taken only where
a worker can be constructed (an acquisition failure falls through to
the reference).  **An explicit `'workers'` on an offload family runs
the lane** where it rejected through round 128: a worker is the
workers executor, the maintainer's ask read literally.  The
k-clusterings and hierarchical clustering keep the rejection (fact 2;
item 70).

**The pool spawns lazily** — one worker at acquisition, the size on
the first whole-pool run — behind per-worker locks: single-kernel runs
take an idle worker each (a fresh one while the pool is under its
size) and interleave, whole-pool runs hold every worker for their
span.  `_algoWorkersStats()` gained `offloads`.  Found by the
round-74 spec for a worker's error event: a worker still spawning is
not in the pool's list yet, so its ping never failed and the spec
hung — `failAll` now fails the spawning worker's pending too.

Specs: 26 in `test/algorithms-offload.mjs` (bit-equality per family,
the lane's placement through the counters, lazy spawn, two offloads
interleaving, cancel while queued and mid-run, the body's kernel
guards through the port, the pool's failures under a stubbed
platform); the bare-scope module spec runs every kernel from every
bundle on a two-node input and has a control that plants a free
identifier inside one.  Controls, each restored: scaling the pageRank
kernel's ranks by 1 + 1e-15 turned the bit-equality spec red and left
the round-65 tolerance specs green (why `===` is the assertion);
dropping `stats.offloads++` turned every placement spec red; posting
the kernel job without its `throwIfCancelled` turned the
cancel-while-queued spec red.

### 129.2 — `startForce` across the worker boundary

The protocol gained the run (`forcestart` with the inputs as one
cloned message, the publish map as an `Int32Array` and the boxes
flattened; `forceupdate` for the position / pin / reheat verbs;
`forcewake`; `forceread`; `forcefinish`) and its answers (`forcestate`
when converged / idle flip — a 30 ms poll beside the engine, since the
layout polls its mirror every 60 ms — and `forcepositions` with the
readback transferred).  The proxy's `startForce` answers a
`RemoteForceRuntime` at once, or null under the same two conditions
the same-thread renderer answers null (not ready, a run open);
`finishForce` and `wakeForce` are one message each; `forceActive()`
mirrors the run so compaction defers under it; `destroy()` rejects a
pending readback so the layout resolves through 128.4's branch.  The
layout drives both hosts through one duck type (`ForceHostLike` /
`ForceRuntimeLike`, declared beside `ForceInputs`) instead of the
`Renderer` class.

**Measured** by the item-51 probe (its force rows carry a rAF count
and, since 129.3, a 5 ms timer count, and warn on a held thread
instead of expecting the position spans they no longer carry): the
worker host's `animate: true` force run on ndex-x-large **12.8 s
with the main thread held → 1.4 s with 24 rAF ticks**, the streaming
run 11.5 s → 1.4 s / 38 ticks; the same-thread host reads 1.75 s / 30
and 1.65 s / 30.  Both hosts draw one frame in their first ~300 ms —
the force pipelines' compile stall — then 60 fps, which is why the
browser spec samples 700 ms.

Browser specs (the renderer project, hardware adapter): frames drawn
and the main thread ticking during a worker-hosted run with the lease
holding and the settle landing; the silent `animate: true` run
settling to the same invariants as the same-thread host; cancel
restoring the snapshot with the mirror following (the 128 pick); a
destroy mid-run rejecting the layout's promise.

### 129.3 — the CPU simulation on a worker

`src/layout/force-worker.mts` is the loop (a run nobody watches steps
in 8 ms chunks that yield so a `stop` lands; a live run ticks
`stepsPerFrame` per 16 ms and posts each frame's positions
transferred; an idle infinite run sleeps until a verb), `force-remote.mts`
the spawn and the run handle (one worker per page or process, spawned
lazily and kept — the bundle's parse is paid once; a second concurrent
run while it is busy runs in-thread; Node workers `unref()`ed between
runs), and `src/util/self-url.mts` the artifact's URL, shared with the
render worker and extended for Node (`import.meta.url` under ESM,
`__filename` under CJS, the package index under the source tree).  The
constraint projection is a pure function (`projectConstraints`), so
the settle projects a remote run's positions as it projects the
in-thread sim's.  `cytoscape.__runForceSimWorker__` is the entry.

The layout gained `executor: 'auto' | 'cpu' | 'gpu' | 'workers'`
(validated at start; on the public `ForceLayoutOptions` and in the
type test).  **Deviation: `'auto'` takes the worker on a rendered
instance only.**  The plan said "or `animate: true`, `animateLive`,
`infinite`"; headless Node has no UI thread to free, its live runs
are the Node suites' timing, and a worker that loads the source tree
pays tsx's registration — so a headless run keeps its contract
(`animate: false` synchronous, a live run on its in-thread clock),
and `'workers'` is the explicit spelling anywhere.  `'gpu'` throws at
start where no integrator is available.

**Found: a Node worker thread inherits tsx's loader hooks but not its
`.mjs` → `.mts` aliasing** ("Cannot find module …/src/core.mjs imported
from …/src/index.mts", from `[worker eval]`), so a worker that
`import()`s the source entry fails at its first import unless tsx
registers inside the worker first (`register()` from `tsx/esm/api`,
56 ms).  The library names no loader — the runtime-clean invariant
(`test/modules/import-graph.mjs` caught the first draft, which spelled
`import('tsx/esm/api')` inside a string) — so `_setForceWorkerLoader`
is the test-setup hook, installed by `test/node-test-setup.mjs` and
the soak's child script; a bundle needs none.

**Found: headless Chromium issues no begin-frames while nothing
draws** — 2 rAF ticks over an idle 300 ms against 60 ticks of a 5 ms
timer, and 0 timer ticks over a held 300 ms — so a run that lands its
positions only at the end cannot be measured for availability by rAF;
the browser spec and the probe use the timer where nothing draws.

Specs: 17 in `test/force-worker.mjs` (bit-equality per fixture —
plain, compound, constrained — the asynchronous contract, a live run
streaming, cancel restoring the snapshot, an infinite run reheating
through a drag on the worker (118.3's spec on the worker), destroy
closing the run, the busy fallback, `'auto'` headless never asking
the worker, the three throws and the start-failure rejection);
`test/soak/force-worker.mjs` (one worker across twelve runs with the
instances collecting, a reset closing an open run, a child process
exiting on its own); two browser specs on the hardware adapter — a
compound graph's `'auto'` run on each host takes the worker, is
asynchronous, answers `'cpu'`'s bits and leaves the main thread
ticking.  Controls, each restored: nudging the worker's final
positions by 1e-6 turned the three bit-equality specs red; dropping
the `stopped` test from the remote `wake` left the infinite run's
`stop()` pending (the spec's 5 s guard fired); skipping the projection
before the worker's first tick turned the constrained spec red.

### 129.4 — the bench rows, the crossovers, the close

`benchmark/algorithms-workers.mjs` gained the offload tier (`--tier
pool|offload|all`): per family, `cpu` / `offload` / `offload first
call` and beside them **`main thread held (cpu)` / `main thread held
(offload)`** — the wall time over which a 1 ms interval on the
calling thread did not tick, calibrated idle first — each row
asserting its property (a held row over half the wall for the cpu
executor, under half for the offload, judged where the run is long
enough for a tick to see; an `offload` sample that did not add an
offload fails the cell).  Single-run readings on the i9-9900K, one
worker; the published run (`--repeat 3` serial, 50 cells, 3.7 min,
in the archive with its note) reads within its own spread of every
figure here — Floyd–Warshall 3.1 / 23.0 / 177.5 ms in-thread against
3.3 / 21.6 / 165.9 on the worker with 1.0 / 0.3 / 0.0 ms held,
SimRank 6.3 / 20.7 / 77.9 against 7.0 / 27.1 / 101.8 with 0.1 / 0.0 /
0.0 held, MCL 11.4 / 78.5 / 592.8 against 11.7 / 81.4 / 597.4 with
0.5 / 0.0 / 0.0 held, affinity propagation 48.1 / 186.9 / 1,016.8
against 57.8 / 227.7 / 940.2 with 7.0 / 0.0 / 0.0 held:

| family | n | cpu | offload | held cpu → offload |
| --- | --: | --: | --: | --: |
| floydWarshall | 128 / 256 / 512 | 3.2 / 23.6 / 180.8 ms | 3.1 / 21.8 / 164.1 | 3.2 → 0.9 / 23.6 → 0.0 / 180.8 → 0.0 |
| simRank | 128 / 256 / 512 | 6.3 / 25.0 / 80.1 | 7.1 / 26.2 / 104.8 | 6.3 → 0.4 / 25.0 → 0.0 / 80.1 → 0.0 |
| effectiveResistance | 128 / 256 / 512 | 6.2 / 47.2 / 346.2 | 6.4 / 47.5 / 379.2 | 6.2 → 0.3 / 47.2 → 0.0 / 346.2 → 0.0 |
| markovClustering | 64 / 128 / 256 | 11.5 / 79.6 / 593.0 | 12.3 / 84.9 / 592.9 | 11.5 → 0.0 / 79.6 → 0.0 / 593.0 → 0.0 |
| affinityPropagation | 64 / 128 / 256 | 51.2 / 185.8 / 989.4 | 57.1 / 223.9 / 940.0 | all → 0.0 |
| neighborhoodSimilarity | 512 / 1024 / 2048 | 0.2 / 4.1 / 10.4 | 1.3 / 4.2 / 12.6 | 0.2 → 1.1 / 4.1 → 0.0 / 10.4 → 0.7 |
| motifCensus | 2048 / 4096 / 8192 | 2.2 / 3.4 / 7.2 | 2.7 / 4.2 / 9.0 | 2.2 → 0.4 / 3.4 → 1.8 / 7.2 → 3.6 |
| triangleCount | 2048 / 4096 / 8192 | 0.8 / 1.4 / 2.9 | 1.0 / 1.7 / 3.5 | 0.8 → 0.0 / 1.4 → 0.6 / 2.9 → 2.4 |
| pageRank | 2048 / 8192 / 16384 / 32768 | 0.7 / 1.2 / 2.4 / 5.5 | 0.9 / 1.9 / 2.9 / 6.3 | … / 2.4 → 1.1 / 5.5 → 4.0 |
| katzCentrality | 2048 / 8192 / 16384 / 32768 | 0.8 / 2.7 / 5.4 / 12.2 | 1.2 / 2.9 / 6.2 / 13.7 | … / 5.4 → 1.7 / 12.2 → 4.6 |

The lane's own cost is 0.2–0.6 ms at the small end and within noise
above it (the worker relaxes Floyd–Warshall *faster* than the loaded
main thread); a first call on a fresh pool is 25–130 ms, the one
worker's spawn.  **The crossovers were stamped by one rule** — the
smallest measured size whose in-thread run reaches a quarter frame
(~4 ms; a shorter run blocks nothing perceptible): affinity
propagation 32, MCL 64, Floyd–Warshall / SimRank / effective
resistance 128 (`OFFLOAD_MIN_N`), the similarity count 1024, the
census 4096, triangles 8192, Katz 16384, pageRank 32768.  **What the
lane frees is the kernel's share**: the snapshot is built in-thread,
and on a sparse graph that build is most of a cheap family's call —
pageRank's 4.0 of 5.5 ms at 32k, the triangle walk's 12.5 of 13.6,
the census's 27.7 of 45.4 — which the held-thread row read exactly as
it should (the last two fail its assertion at that size).  Logged as
item 69; item 70 logs the k-clusterings and hierarchical clustering.

The pool tier's rows are unchanged; the whole profile was re-run
`--repeat 3` serial and published so the archive carries one run at
the new fingerprint.

### What the round did not do

- No offload lane for the k-clusterings and hierarchical clustering
  (item 70), and none for the round-74 families below their pool
  crossover (their pool bodies are not the reference function, and
  the runs there are single-digit milliseconds).
- The worker sim under `'auto'` on headless instances (the deviation
  above); `executor: 'workers'` is the spelling.
- The builders' in-thread share (item 69).
- The worker host's images and fonts (item 51's two remaining
  deferrals) and the GPU tween proxy (item 68).
