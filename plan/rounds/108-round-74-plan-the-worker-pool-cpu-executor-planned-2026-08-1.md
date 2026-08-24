## Round 74 plan — the worker-pool CPU executor (planned 2026-08-14)

The seed is ledger item 29 (raised at 65.10): the per-source-parallel
algorithms behind a pool of plain workers — Node `worker_threads`,
browser `Worker`, transferable typed arrays, no SharedArrayBuffer and
so no COOP/COEP, deliberately not wasm (SIMD reorders float sums, wasm
threads inherit the SAB constraint, and a toolchain fights code
standard 7).  Planning re-read the sources rather than the ledger's
sentences, which mattered twice: the ledger's **bit-reproducibility
claim is half wrong** (fact 5 below), and the per-source-parallel
family is larger than the one algorithm the ledger names (fact 3).
What the code does today, verified:

1. **Weighted betweenness is contracted CPU-only and is n independent
   Dijkstras** — `betweenness-centrality.mts:52-57` passes `gpu: null`
   with the no-GPU-path rejection message whenever `weight` is given,
   and the reference loop (`:207-277`) runs one heap-driven Dijkstra
   per source, accumulating `C[w] += e[w]` (`:270`) across sources.
   The only cross-source coupling is that sum.
2. **The weight is a user closure and cannot cross a worker** —
   `weightAt` (`algo-shared.mts:198-207`) calls the caller's fn on an
   interned element per edge slot.  A worker snapshot must
   pre-evaluate weights on the main thread into a Float64Array, one
   per representative edge, with the same edge choice
   `buildBrandesNeighbors` makes (`betweenness-centrality.mts:70-134`
   — which also returns `number[][]`, so the snapshot flattens to CSR
   rowPtr/colIdx anyway).
3. **The per-source-parallel family is five wide, not one.**  Beyond
   weighted betweenness: unweighted betweenness (same loop, but it has
   a GPU lane with a measured 512 crossover,
   `betweenness-centrality.mts:43-49`); `heatKernel`'s n independent
   `diffuseVector` columns (`heat-kernel.mts:344`); `rwrProximity`'s n
   independent `solveWalk` columns (`random-walk.mts:402`); and — only
   once round 72.3 lands — the closeness per-source BFS (today
   closeness is Floyd–Warshall on both executors,
   `closeness-centrality.mts:146-148`).  `motifCensus`'s s-loop
   (`motif-census.mts:160`) shares dyad counters mid-walk and is not
   independent; excluded.
4. **The executor contract has the slot** — `AlgoExecutor` is
   `'cpu' | 'gpu' | 'auto'` (`executor.mts:36`), `runAlgo` routes with
   per-family `minGpuN` and falls back to CPU only on acquisition
   failure or `GpuUnfitError` (`executor.mts:116-141`), and the GPU
   side caches a lazy module singleton with a `_resetAlgoGpu` test
   hook (`algo-gpu.mts:32`, `:95`) — the exact lifecycle shape the
   pool should copy.
5. **The ledger's bit-identity claim does not survive re-derivation.**
   Contiguous source ranges merged in range order give
   `(c0+c1)+(c2+c3)`, the sequential reference `((c0+c1)+c2)+c3` —
   different f64 grouping wherever an output sums *across* sources
   (betweenness's `C[w]`).  What contiguous ranges *do* buy, exactly:
   any family whose output element is computed whole from one source
   (closeness scores, heat/RWR columns) is **bit-identical** to the
   CPU reference, and betweenness is **deterministic per input** if
   the partition is a pure function of n (never of pool size), with
   CPU parity at f64-tight tolerance — far tighter than the GPU's f32
   invariants, but not bits.
6. **No worker exists anywhere in the tree today** (grep: zero hits
   for `worker_threads`/`new Worker` outside `node_modules`), and the
   build emits five single-file bundles (`rolldown.config.mjs`) whose
   agreement the packaging chain gates — a second emitted worker
   chunk would break every one of them.

**Entry condition — the measure-first gate, as ledger 29 wrote it:**
weighted betweenness at n=2048 through 4- and 8-worker pools against
the sequential reference on the same box; the round proceeds past 74.1
only if the 8-worker speedup clears **~3× after pool-startup
amortization**, and the per-worker CSR copy cost is re-checked against
SAB before concluding SAB is unnecessary.  If the gate fails, the
numbers go in this record, ledger 29 closes as measured-and-declined
(the `pageRankDense` losing-configuration precedent), and 74.2–74.5 do
not run.

Round-72 interaction, stated up front: round 72 is planned the same
sitting and sequenced first (the round-71 sitting's decision 2).  The
closeness workers lane depends on 72.3's BFS path existing; if 74 runs
before 72.3 lands, closeness stays out of 74.3's wiring and is logged.
Both rounds edit the algorithm bench files, so their fingerprint moves
land batched per suite, not interleaved.

### 74.1 — the gate measurement

A standalone probe, scratch at the root (`bc-workers.scratch.mjs` —
the `d2.scratch.mjs` shape; disposable, its numbers live here in the
round record), run as plain `.mjs` **without tsx**: the sequential
baseline goes through `build/cytoscape.esm.mjs`, because a per-source
loop that builds closures is exactly the shape the `__name` lesson
says tsx distorts.  The worker half hand-rolls what 74.2 would ship:
a self-contained body function (CSR Dijkstra–Brandes over
rowPtr/colIdx/weights, indexed heap inline), spawned via
`worker_threads`.  Fixture: the deterministic degree-4 graph at
n=2048 with a data-driven weight (sizes from `bench-size.mjs`, never
`graph.mjs` — the v3-free rule).  Measured, each `--repeat 3`-style
thrice: sequential reference; 4- and 8-worker warm runs (pool reused,
per-call snapshot included); cold first call (spawn + first run, the
amortization the gate names); the snapshot build + per-worker
structured-clone cost in isolation; and the same clone measured
against a SAB variant (Node needs no isolation flags, so the probe
can price both).  Record: the 3× verdict, the 4→8 scaling shape, the
clone-vs-SAB delta (expected trivial at ~100 KB CSR; if it is not,
that finding goes to the maintainer before 74.2), and a browser spot
check of the same body through a Blob worker on the debug page —
manual, numbers noted, because 74.2's one-code-path claim rests on it.

### 74.2 — the pool: lifecycle and the worker entry

Two new files.  `src/algorithms/algo-worker-body.mts`: the worker
body as one exported, fully self-contained function — no imports, no
outer references, no class syntax — that receives jobs and answers
results through a tiny injected port adapter.  It computes one
contiguous source range of Brandes–Dijkstra over a CSR snapshot and
returns the range's partial `C` as a *transferred* Float64Array.
`src/algorithms/algo-workers.mts`: the pool — a lazy module singleton
(the `algo-gpu.mts:32` shape) with `_resetAlgoWorkers()` beside it
(the `:95` precedent); size `min(availableParallelism() - 1, 8)`
(Node) / `hardwareConcurrency - 1` capped likewise (browser) as a
starting figure, 74.5 stamps it; Node workers `unref()`ed so a pool
never holds a process open.

The bundle carries the worker entry as **source text, not a chunk**:
the pool stringifies the body (`Function.prototype.toString`), wraps
it in an environment preamble, and constructs Node workers with
`new Worker(src, { eval: true })` and browser workers from
`URL.createObjectURL(new Blob([src]))`.  This keeps all five
single-file bundles single-file and asks nothing of rolldown's worker
bundling (which exists for chunk-emitting outputs but is declined
here *by shape*, not capability — to-verify only if the string path
fails).  Three hazards named now: tsx injects `__name` wrappers on
closure creation (the AGENTS hot-path lesson), so the preamble
defines a no-op `__name` before evaluating the body, and 74.4's
bare-scope spec is the tripwire for any *other* helper a transpiler
sneaks in; Node's eval-mode worker source is CJS-flavored (the
preamble `require`s `node:worker_threads` for its port) — to-verify
on the pinned Node; and a CSP `worker-src` policy can refuse blob
workers — construction failure under `'auto'` falls back to CPU
exactly as GPU acquisition failure does (`executor.mts:124-128`),
and an explicit `'workers'` rejects loudly.

Determinism is designed here, honestly (fact 5): the partition is a
pure function of n alone — fixed range count, never the pool size —
and the merge adds range partials in range order.  So the workers
executor is bit-stable across runs, machines and pool sizes; the
per-column families are additionally bit-identical to `'cpu'`; and
betweenness is documented as f64-tight-but-not-bit-equal to the
reference, which corrects ledger 29's sentence on the record.
Weights are pre-evaluated main-thread into the snapshot (fact 2);
the CSR is structured-cloned per worker (priced in 74.1), results
come back transferred.

### 74.3 — the 'workers' executor, wired

`AlgoExecutor` grows `'workers'` (`executor.mts:36`), `resolveExecutor`
accepts it and its throw message updates (`:66-68`), and `runAlgo`
grows a workers lane with a per-family `minWorkersN`: explicit
`'workers'` rejects loudly when the family has no workers path or the
environment cannot construct one; `'auto'` keeps its GPU preference
where a GPU lane exists and fits, then takes workers when there is no
GPU path, no adapter, or a `GpuUnfitError` — and n clears
`WORKERS_MIN_N` (a starting figure from 74.1, stamped in 74.5) — then
CPU.  Wired this round: **weighted betweenness** (the headline — its
`gpu: null` slot at `betweenness-centrality.mts:52` gains the workers
lane) and **unweighted betweenness** (workers behind the GPU's 512
crossover until 74.5 measures the three-way ordering).  Enumerated
and scope-gated: heatKernel and rwrProximity join only if 74.1's
scaling generalizes to the column shape (each is a mechanical column
partition, bit-identical by fact 5); closeness joins only after
72.3's BFS lands.  Whatever is not wired is logged with its reason.
JSDoc on every `executor` option doc that now names four values,
d.ts regenerated, `src/README.md`'s executor section extended,
MIGRATING/CHANGELOG rows for the public value.

### 74.4 — tests: parity, throws, soak

Node parity (`test/algorithms-workers.mjs`): cpu-vs-workers weighted
betweenness at tolerance with the tie-tolerant ordering invariant
(the 65.5 shape — do not tighten it past fact 5's grouping analysis);
**exact bit-equality** asserted where it truly holds — the per-column
families if wired, and closeness plain sums post-72.3 (integer
distances, exact in f64).  Pool-size independence is its own spec:
forced pools of 1, 2 and 3 workers answer identical bits.  Controls
before trusting any of it: skew one range's partial, drop a range —
each spec goes red or it discriminates nothing.  Every new guard is
pinned in `test/` (the throw gate reads neither `test/modules/` nor
`test/soak/`): the invalid-executor message, the explicit-'workers'
rejection under a stubbed `Worker` constructor (the stubbed-navigator
precedent in `test/algorithms-executor.mjs`).  A module spec proves
the entry-carriage claim where it can actually break: extract the
stringified body from the built ESM *and* UMD and under tsx, evaluate
it with `new Function` in a bare scope (a stray `__name` or helper is
a ReferenceError), and ping a real `worker_threads` worker through
it.  Soak (`test/soak/workers.mjs`, under `--expose-gc`): repeated
runs grow neither worker count nor reachable instances (WeakRef
collection, not bytes — the 48.1 rule, with the probe's own control
first); `_resetAlgoWorkers` lets workers collect; two instances
interleaving runs stay isolated (`isolation.mjs` shape); and a
spawned child process exits cleanly after a workers run — the
`unref()` claim, asserted rather than believed.  Browser: one
Playwright spec beside `algorithms-gpu.spec.js` running cpu-vs-workers
through the built UMD — it needs no adapter and carries no
`hasAdapter` skip (the `routing.spec.js` precedent), and it is the
one place the Blob path and the *minified* stringified body are
exercised for real.

### 74.5 — bench rows, crossover constants, and the close

New standalone `benchmark/algorithms-workers.mjs` under its own
profile (the 65.9 precedent — standard results shape, promoted by
`benchmark:publish`): per wired family, `cpu` / `workers` /
`workers first call` rows, sized where 74.1 showed separation so the
rows discriminate; each row asserts it ran where its name says via a
pool stats hook (runs, worker count — the row-asserts-its-property
rule) and the cpu row asserts the pool stayed untouched.  The suite
saturates cores, so it schedules **exclusive** under `--jobs` —
`schedule.mjs:209` keys exclusivity on `browser: true` today, so the
job table gains the flag under an honest name; a new file has no
archive, so no `EQUIVALENT_HARNESSES` question arises.  On the
benchmark machine: publish `--repeat 3` serial, then one commit
stamps `WORKERS_MIN_N` per family and the pool-size cap with the
machine and figures, and — where GPU and workers lanes coexist —
re-checks the three-way `'auto'` ordering against the GPU crossovers
(jointly with 72.6's sweep if round 72 has landed, so each suite's
fingerprint moves once).  Standing close: this record, the ledger-29
entry closed with its correction noted, `src/README.md`,
MIGRATING/CHANGELOG, `EXECUTIVE_SUMMARY.md` rewritten from this file,
d.ts regenerated, `npm run format`, gates green (`test:js`,
`test:modules`, `test:soak`, `test:throws` at zero, JSDoc 100%, the
new Playwright spec).

### Risks named at planning

- The stringified-body scheme is the round's novel mechanism and its
  failure mode is environmental: a transpiler helper in the body, an
  eval-mode semantics change, a CSP refusal.  Each has a named
  tripwire (the bare-scope spec, the pinned-Node verify, the loud
  explicit-'workers' rejection); the residual risk is `'auto'`
  *silently* never using workers on locked-down pages — accepted, as
  the exact symmetry of GPU acquisition failure, and documented.
- Fact 5 corrects a ledger claim this plan was asked to build on.
  The parity specs must not overclaim: bit-equality only where
  derived, tolerance elsewhere, and the executor-contract comment in
  `executor.mts` updated so the determinism ladder (cpu > workers >
  gpu) is written where callers read it.
- Oversubscription: a pool at cores−1 beside the test runner's own
  parallelism is the Playwright half-cores lesson in Node form — the
  soak and parity specs force small pools, and only the exclusive
  bench job runs wide.
- Sequencing: 74.1 gates everything; 72.3 gates closeness; bench
  edits batch with 72's so each fingerprint moves once.

**Open:** four maintainer decisions.  (1) The public name of the
executor value — `'workers'` as planned, or `'threads'`; it ships in
d.ts and is expensive to rename later.  (2) Whether `'auto'` may ever
prefer workers over a *present* GPU where both lanes exist — the plan
keeps GPU precedence until 74.5 measures a family where workers win
on real hardware, but that default is a policy, not a measurement.
(3) Whether betweenness's not-bit-identical merge is accepted as
designed (fixed partition, f64-tight parity — recommended), or exact
bit-identity is bought with per-source delta replay at O(n²) transfer
— the cost that made the ledger's claim tempting and wrong.  (4)
Whether a `poolSize` option ships publicly now or the cap stays an
internal stamped constant until someone asks — and, smaller, whether
the 74.1 probe is committed as a scratch (the `d2.scratch.mjs`
precedent) or discarded once its numbers are in this record.
