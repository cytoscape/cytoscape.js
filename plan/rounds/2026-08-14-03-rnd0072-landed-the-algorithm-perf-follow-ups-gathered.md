## The algorithm perf follow-ups, gathered

Rounds 65.8, 69.6 and 70.4 each closed leaving logged follow-ups;
this round gathers them.  Planning re-read the sources rather than
the logged sentences, which mattered twice: one item is mostly
**stale** (the "two-stage reductions" — 65.8 already landed
workgroup-per-line tree reductions; the live remainder is a
coalescing defect), and one is bigger than its sentence (the
closeness BFS path changes the CPU side's asymptotics, not just the
GPU's).  What the code does today, verified:

1. **pageRank/Katz GPU SpMV is genuinely dense** —
   `algo-gpu-pagerank.mts` uploads the full n×n f32 matrix from
   `buildPageRankMatrix` and runs the workgroup-per-row `MATVEC`;
   `algo-gpu-katz.mts` reuses the same kernel.  The CPU sides went
   sparse in 65.10 (O(E+n)/iteration), which is why both wrappers
   pass `minGpuN: Infinity` (`page-rank.mts:54`,
   `katz-centrality.mts:119`) — the kernels serve only explicit
   `'gpu'` and the parity suite.
2. **AP's `A_UPDATE` walks `rr[j*n+i]`/`a[j*n+i]` with stride n** —
   uncoalesced column access, ~2.6 ms/iteration at n=1024 per the
   65.8 record.  The surviving single-workgroup epilogues
   (PR/Katz epilogues, `AP_CONVERGE`) cost microseconds.
3. **Closeness is Floyd–Warshall on both executors** — O(n³) even
   unweighted.  The GPU already owns a batched level-synchronous
   BFS in `algo-gpu-brandes.mts` whose forward half is exactly the
   distance computation closeness needs, but it is not exported as
   a reusable plan the way `fwRelaxPlan` is.
4. **The heat family is combinatorial-Laplacian only** —
   `buildHeatStructure` builds L = D − A; no `laplacian` option.
   A normalized Laplacian (‖L_norm‖ ≤ 2) would bound `squarings`
   by t alone instead of by weighted degree.
5. **No device-side timing exists on the algo path** —
   `acquireAlgoGpu` requests no features; the machinery exists on
   the render side (`src/render/gpu-timer.mts`).

Standing debt the round absorbs: the 69.6/70.4 **crossover sweep on
the benchmark machine never ran** — the density gates (n²/32,
n²/16), closeness's `GPU_MIN_N` and the resistance parity bound are
still starting figures — and the `EQUIVALENT_HARNESSES` entry for
the bench-file moves is unaddable until a run under the new hash is
published.

### 72.1 — sparse CSR SpMV for pageRank + Katz

The one change that could flip the 65.10/69.4 `'auto'` verdicts.  A
shared CSR plan (new `algo-gpu-spmv.mts`): rowPtr/colIdx/vals upload
(O(E) instead of O(n²) — which also lifts the n²-buffer `assertFits`
ceiling), a workgroup-per-row CSR kernel replacing `MATVEC` for
these two families only (the dense matmul families are untouched).
Katz is the easy half: CSR of α·Aᵀ (both directions when undirected,
as the CPU gather does) plus the existing `KATZ_EPILOGUE`.  pageRank
needs the structural split the CPU made in 65.10: the kernel
computes only the edge-gather term; the teleport and dangling
rank-1 terms move into the epilogue (a dangling-index buffer; the
epilogue already tree-reduces Σtmp, it gains Σv and Σ_dangling·v).
The dense builders become GPU-dead and are removed; d.ts
regenerated.

**Verified by** the existing pageRank/Katz parity specs — tolerance
absorbs the summation-order change — after one control run with the
CSR vals deliberately skewed proves they discriminate the *new*
path.  **Measure-first gate:** the CPU is 0.3–0.6 ms on the sparse
fixture and per-iteration dispatch overhead alone may exceed that at
bench sizes.  If the SpMV wins only past some edge count, `'auto'`
gains an **edge-count gate** (more edges favor the GPU here — the
inverse of the triangle family's density gate), machine-stamped; if
it never wins, `Infinity` stays and the wrapper comments carry the
measured number — the losing configuration stays measured, the
`pageRankDense` precedent.

### 72.2 — AP coalescing, and the reduction item closed honestly

(a) Close the stale half on the record: measure the surviving
single-workgroup epilogues once in isolation, record the µs figure,
and decline a true two-stage reduction (it adds a dispatch per
iteration to save microseconds).  (b) The live remainder: coalesce
`A_UPDATE`'s stride-n walks via a transposed R copy — either
`R_UPDATE` writes rrᵀ alongside rr (it already owns the row) or a
tiled transpose kernel joins the iteration; `A_UPDATE` then reads
rows of rrᵀ/aᵀ coalesced.  **Measure-first gate:** confirm the
~2.6 ms/iteration figure still stands locally before writing the
kernel; land only if iteration time moves ≥ ~20%, else record and
drop.  **Verified by** the AP parity spec (identical-partition,
discrete — it reruns green or the transpose is wrong) plus one
skewed-transpose control; the `affinityPropagation` bench row
re-prices it; the crossover (currently 256) re-tunes in 72.6.

### 72.3 — closeness centrality: the unweighted BFS path

Decision: build it, **CPU first** — the BFS reference is a
guaranteed asymptotic win (O(n·m) vs O(n³)) independent of any GPU
question, and it is the 65.10 pageRank story again: once the CPU
goes sparse, the honest `'auto'` gate changes shape.

(a) **CPU:** when `weight` is absent, per-source BFS accumulating
row sums directly (reuse `closenessOfRowSum`/`closenessResultFrom`);
weighted inputs keep FW on both executors (the weighted-betweenness
contract precedent).  Unweighted distances are exact integers on
both paths, so plain-mode sums are bit-identical and harmonic sums
differ only in f64 summation order — pin with a Node spec comparing
BFS vs FW rows on unweighted fixtures, plus a disconnected fixture.
(b) **Measure:** if the CPU BFS beats the GPU-FW route at every
bench size on sparse graphs (expected), the sparse-unweighted
`'auto'` route to GPU-FW is already wrong and gets density-gated
regardless of (c).  (c) **GPU, gated on (b)'s numbers:** extract the
forward-BFS half of `algo-gpu-brandes.mts` as an exported plan (the
`fwRelaxPlan` refactor pattern from 69.1) — batched level-sync
distances, frontier-empty probes, no sigma/delta sweep — plus a
per-batch row fold with the existing unreachable-sentinel
discipline.  If the sparse CPU owns the family the way it owns
pageRank, the GPU BFS serves only explicit `'gpu'` or is logged with
the measurement attached.

**Bench:** the existing unweighted closeness row silently switches
paths — a `src/` change, correct per the fingerprint rules, but the
round record must say the row's meaning moved.  Add a **weighted**
closeness row so the FW route stays measured rather than asserted;
extend the unweighted row's sizes upward within the REPS×slow-side
budget rule from 70.4.  Parity spec addition for the GPU path if
built (sparse unweighted multi-component fixture, both modes), with
a control run red (drop the unreachable mark or skew the level
increment).

### 72.4 — `laplacian: 'normalized'` for the heat family

A `laplacian?: 'combinatorial' | 'normalized'` option (default
`'combinatorial'`) on the heat options, honored by `heatDiffusion`
and `heatKernel`.  Implementation lands almost entirely in
`buildHeatStructure`: normalized scales `ws[a] → w/√(d_s·d_t)` with
a 1/0 diagonal (an isolated node's heat stays put), norm bound
‖L_norm‖∞ ≤ 2 so `squarings = ceil(log2(4t))⁺` independent of
degree; `diffuseVector` and the GPU dense build consume the same
struct unchanged.  One new throw (invalid value) with its spec.
**Verified by** closed-form Node specs on a **weighted pair** —
weight 4 discriminates the modes: combinatorial L = [[4,−4],[−4,4]],
normalized [[1,−1],[−1,1]] — plus a triangle; the parity spec runs
heatKernel normalized (1e-4, symmetry — and asserts the *absence* of
row conservation deliberately, a combinatorial-only invariant);
control with the √-scaling skewed.  JSDoc, d.ts, `src/README.md`,
MIGRATING/CHANGELOG rows.  No new bench row — same cost shape, and
changing the existing row's mode would break cross-run
comparability; its comment notes it prices combinatorial.

### 72.5 — device-side bench rows (optional)

Adopt only if 72.1–72.3's tuning needs the kernel-vs-transfer split.
`acquireAlgoGpu` requests `'timestamp-query'` when the adapter
offers it; a bench-only timer hook on `AlgoGpu` consulted by
`submitPass` (reuse `gpu-timer.mts`'s querySet/resolve machinery,
accumulating across the multiple submits Brandes-style runs make);
the bench gains a `gpu (device)` row per family beside
`cpu`/`gpu`/`gpu first call`, each asserting 0 < device ≤ wall-gpu —
its purpose is attribution, exactly what an SpMV/BFS crossover
argument needs.  **Batch all bench-file edits** (this plus 72.3's
rows) so the `algorithms-gpu` fingerprint moves once.

### 72.6 — the sweep, the re-tune, and the close (hardware-gated)

On the benchmark machine: full `benchmark:algorithms-gpu`
(SwiftShader refused, adapter identity reported), published
`--repeat 3` serial.  From the measurements, one commit re-tunes
every touched `'auto'` constant — the 72.1 edge gate or `Infinity`,
the AP crossover, the closeness gates for both routes — **plus the
standing 69.6/70.4 debt**: the triangle/similarity density gates,
closeness `GPU_MIN_N`, the resistance parity bound on that card's
f32.  Every constant's comment machine-stamped.  Then the
`EQUIVALENT_HARNESSES` entries the published run now permits.
Standing close: this record, `src/README.md`,
MIGRATING/CHANGELOG rows for the public surface (the `laplacian`
option, the closeness path note), `EXECUTIVE_SUMMARY.md` rewritten
from this file, d.ts regenerated, gates green (`test:js`,
`test:modules`, `test:throws` at zero, JSDoc 100%, the Playwright
`algorithms-gpu` project).

### Risks named at planning

- 72.1's epilogue restructure changes pageRank's summation shape —
  the tie-tolerant parity ordering invariant (65.5) exists for
  exactly this; do not tighten it.
- 72.3 changes what an existing bench row measures without a
  harness edit.  Correct per the fingerprint rules, but only the
  round record can say so — and the weighted row exists so the
  comparison page can attribute the move.
- The stranded-doc-block hazard has fired in this tier before
  (65.4, 65.8), and 72.3's Brandes extraction is the same refactor
  shape — run the JSDoc gate before each commit.
- Sequencing: 72.1–72.5 land before 72.6 so the sweep and the
  re-tune happen exactly once.

## Landed

Executed 2026-09-18 on the benchmark machine (amd gcn-4, the RX 580;
`npm run gpu` reads HARDWARE), sub-round by sub-round, each with its
measurement before its decision.

### 72.1 — sparse CSR SpMV: landed for `'gpu'`, declined for `'auto'` (2026-09-18)

The kernel landed and the verdict did not move.  `algo-gpu-spmv.mts`
holds the CSR builder (counting sort on the row, input order kept
within a row), the `SPMV` kernel and its dispatch; pageRank and Katz
both run it.  The dense `MATVEC`, `buildPageRankMatrix` and
`buildKatzMatrix` are gone — each family now has **one** build
(`buildPageRankSparse`, `buildKatzSparse`) that both executors call,
so the GPU path can no longer drift from the CPU's edge semantics by
construction, and the n²-buffer `assertFits` ceiling went with the
dense matrix (the CSR is O(E)).  pageRank's epilogue carries the two
rank-1 terms the CPU split out in 65.10: Σv and Σ_dangling·v reduce
beside Σtmp in the same single-workgroup kernel, and a dangling-index
buffer rides the bind group.

**Lane shape, measured.**  1000 forced iterations at n=2048, whole
call, median of 5, every cell checked against the CPU result (see
below for why):

| lanes per row | sparse (2.3k edges) | dense (350k edges) |
|---:|---:|---:|
| 1 | 25.6 ms | 229.3 ms |
| 8 | 25.1 ms | 65.1 ms |
| 16 | 25.2 ms | 64.5 ms |
| 32 | 26.1 ms | **55.8 ms** |
| 64 | 29.6 ms | 56.7 ms |
| CPU | 15.8 ms | 1007 ms |

Sparse sits at the two-dispatch floor whatever the shape; dense picks
32.  Per iteration the kernel is 18× the CPU on the dense fixture
(56 µs against 1.0 ms) and *slower* than the CPU on the sparse one
(25 µs against 16 µs — dispatch overhead against a 2.3k-edge loop).

**The whole call, on the bench fixtures** (REPS 5 medians, the
`pageRank` / `pageRankDense` / `katzCentrality` rows):

| family | n | cpu | gpu (72.1) | gpu (dense, 2 Sep) |
|---|---:|---:|---:|---:|
| pageRank (sparse) | 512 | 0.6 ms | 3.7 ms | 6.6 ms |
| | 1024 | 0.3 ms | 3.6 ms | 18.2 ms |
| | 2048 | 0.6 ms | 3.7 ms | 69.0 ms |
| pageRankDense | 512 | 1.2 ms | 4.5 ms | 6.7 ms |
| | 1024 | 3.8 ms | 7.8 ms | 19.3 ms |
| | 2048 | 15.4 ms | 20.6 ms | 80.5 ms |
| katzCentrality | 512 | 0.3 ms | 3.6 ms | 6.0 ms |
| | 1024 | 0.2 ms | 3.5 ms | 13.0 ms |
| | 2048 | 0.3 ms | 3.7 ms | 34.9 ms |

An explicit `'gpu'` call is 2–19× cheaper than before and flat in n
on sparse graphs; `'auto'` still never takes it.  The phase split
says why, and it is not the kernel: on sparse n=2048 the GPU call is
build 0.2–1.0 ms, CSR 0.1–0.6, upload ~0, encode 0.1, submit 0.2 and
**readback 3.5 ms** — one `mapAsync` round trip on this box is the
floor, and the CPU's whole run is under it.  On dense n=2048 the
shared build is 17–18 ms of both sides, the CSR pack another 3–6 and
the readback 3.6–4.4, so the GPU pays ~8–10 ms over the build against
the CPU's ~10–15 iterations at 1 ms each: a wash, measured 20.6
against 15.4.  Extrapolating the per-iteration ratio, the GPU wins
only past ~1M edges — beyond the sweep and beyond the sizes anyone
runs pageRank on in a browser — so an edge-count gate was **declined
with these numbers** rather than stamped from an extrapolation.
`PAGE_RANK_GPU_MIN_N` and `KATZ_GPU_MIN_N` spell `Infinity` once
each, exported, with the reason on the constant.

**Verified by** the existing pageRank and Katz parity specs (green;
maxDelta 1.8e-8 on the pageRank fixture), and a control with the CSR
values skewed ×1.01 turned **both** red — the specs discriminate the
new path.  Two hazards found while measuring, both now written on the
module: (1) `precision` is a WGSL reserved word; the first epilogue
draft used it as a uniform field, the module failed to compile, and
the run *read back its initial vector* — WebGPU makes an invalid
pipeline a silent no-op.  The parity spec caught it (the vector was
nowhere near the reference), and the bench had already priced the
no-op at 3.6 ms as if it were a kernel.  (2) The first lane sweep
interpolated `ROW_LANES / 2` for a 1-lane variant, produced `0.5u`,
and measured another invalid pipeline as the fastest shape.  The rule
the module now states: **a timing row must check its result, or it
will price an empty command buffer as a fast kernel.**  d.ts
regenerated (the Katz option comment moved).

### 72.2 — AP coalesced, the reduction item closed with its figure (2026-09-18)

**Attribution first, by omission.**  The AP GPU call at n=1024
(the bench row's knobs: damping 0.8, median preference, 100/20
iterations) was rebuilt four ways and timed whole (median of 5):

| variant | ms | per iteration |
|---|---:|---:|
| full run (converges ~iteration 70, the rest no-op) | 300.8 | — |
| without track + converge (never converges: all 100 run) | 410.9 | R + A = 4.1 ms |
| without A_UPDATE (no exemplars: all 100 run) | 169.2 | R + T + C = 1.69 ms |
| R_UPDATE alone | 168.2 | R = 1.68 ms |

So A_UPDATE was **2.4 ms** of a 4.1 ms iteration — the 65.8 figure
(~2.6) stood — and the two tracking kernels together ~10 µs.
pageRank's fused epilogue, priced the same way over 1000 forced
iterations at n=2048: 17.5 µs per dispatch (25.7 ms with it, 8.2 ms
without) — microseconds, as the item said, and (a) is closed: a true
two-stage reduction would add a dispatch (~5–8 µs on this box) to
shave part of 17, and is declined.

**(b) landed, but not as a transpose.**  The stride-n walk was
`A_UPDATE` reading column i from one workgroup, lane j at
rr[j·n + i].  A transposed R copy would have fixed the read and moved
the same stride onto the write of A (which `R_UPDATE` then reads
row-wise — two transposes per iteration).  Instead the update is two
kernels in the natural layout: `A_COLSUM` — a workgroup owns 32
consecutive columns × 8 row-lanes, so each row's read is 32
consecutive floats, tree-reduced across the row-lanes — and
`A_APPLY`, one invocation per cell with the column as the fast axis.
Same maths, same diagonal rule, summation order changed.  Measured:
**300.8 → 174.5 ms at n=1024 (−42%)**, the same 53 clusters; the
column width bracketed at 16/32/64 → 168/174/172 ms (noise), 32
kept.  Well past the ≥20% gate.

**Verified by** the AP parity spec — which turned out to verify
nothing here: the six-node fixture is two well-separated triples and
stayed green with the column sums *halved*.  A second spec joined:
the bench's seeded 2-D cloud at n=128, partitions compared exactly
(11 exemplars; the scene asserts more than four), and the same
fixture agrees pair-for-pair at n=64/128/256 on both the old and the
new kernel.  Its control: colSum × 0.5 turns it red (× 1.01 does
not — recorded on the spec so the next control is not too gentle).
The `affinityPropagation` bench row re-prices in 72.6's sweep.

### 72.3 — closeness: the unweighted BFS path, on both executors (2026-09-18)

**(a) CPU, landed.**  `closenessRowSumsBfs`: one queue-driven BFS per
source over the deduped neighbor lists Brandes already builds,
flattened once to CSR (84 → 72 ms at n=2048 over the nested lists),
each row's sum accumulated as levels are assigned; plain mode marks a
row infinite when the queue drains short of n.  The whole-collection
entry routes on `weight`: absent → BFS, present → the FW relaxation
as before.  Against the old CPU (FW) on the sparse bench fixture:
21.8 → 1.2 ms at n=256 and 389 → 8.3 ms at n=512 — the asymptotic win
the plan promised, 18–47× at the sizes the row prices.

**Verified by** a Node spec that runs the same unweighted graph
through both CPU routes — the BFS by default, the FW route forced by
`weight: () => 1` — and asserts plain scores bit-equal (integer sums)
and harmonic scores within 1e-12, directed and undirected, on a
two-component ring-and-chords fixture (plain answers 0 everywhere,
harmonic survives) and on a connected one (plain positive, still
bit-equal).  Its first control taught something: `dist + 2` in
place of `+ 1` stayed green, because a uniform scale on every
distance cancels under max-normalization — the control has to be
non-uniform (`+1` on each term, run red, restored).

**(b) measured, three ways.**  Whole call, median of 3, the bench's
generators plus a mean-degree-18 middle fixture (amd gcn-4):

| fixture | n | arcs/n² | CPU BFS | GPU BFS | GPU FW |
|---|---:|---:|---:|---:|---:|
| sparse (deg ~2.3) | 256 | 0.009 | 1.2 | 5.9 | 3.6 |
| | 512 | 0.0045 | 8.3 | 8.6 | 8.7 |
| | 1024 | 0.0022 | 18.8 | **12.7** | 36.8 |
| | 2048 | 0.0011 | 70.7 | **25.3** | — |
| | 4096 | 0.0006 | 285.7 | **83.0** | — |
| mid (deg 18) | 256 | 0.071 | 3.5 | 3.9 | 4.3 |
| | 512 | 0.036 | 13.2 | **7.0** | 12.7 |
| | 1024 | 0.018 | 52.1 | **16.8** | 30.1 |
| | 2048 | 0.009 | 199.7 | **56.2** | — |
| dense (E = n²/12) | 256 | 0.17 | 6.5 | 4.3 | **4.0** |
| | 512 | 0.17 | 46.6 | 13.4 | **9.6** |
| | 1024 | 0.17 | 337.3 | 55.4 | **34.1** |
| | 2048 | 0.17 | 2575.6 | 460.0 | — |

The sparse CPU BFS beats the GPU-FW route at every bench size (the
`'auto'` route to GPU-FW for sparse unweighted graphs *was* wrong, as
(b) predicted), but it does not own the family the way the CPU owns
pageRank: the GPU BFS is ahead from n=1024 sparse and n=512 at
degree 18, 3.4× at n=4096.  And on very dense graphs the blocked FW
is still the cheaper *kernel* — the pulled BFS rescans every reverse
list per level.

**(c) GPU, built.**  The forward half of `algo-gpu-brandes.mts` is
now `algo-gpu-bfs.mts` — `bfsPlan` (CSR upload, reverse CSR when
directed, the BATCH×n working arrays, the per-batch dispatches) and
`bfsForwardBatch` (seed, CHUNK-level encodes, the 16-byte
frontier-empty probes) — and the Brandes driver keeps only what is
its own (the dependency sweep, the C fold, and a delta-zero kernel,
since the shared init clears d and sigma).  Closeness gains
`closenessCentralityNormalizedBfsGpu`: the same plan, and after each
batch a fold kernel — one workgroup per lane — that sums the lane's
levels (harmonic 1/level, plain level) and marks a plain row with an
unreached node for the sentinel.  The `'auto'` routing for unweighted
runs is three constants, each carrying its row of the table:
`CLOSENESS_BFS_GPU_MIN_N = 1024` (sparse), `CLOSENESS_BFS_DENSE_DIVISOR
= 64` (arcs ≥ n²/64 takes the GPU at `GPU_MIN_N`), and
`CLOSENESS_FW_DENSE_DIVISOR = 8` (arcs ≥ n²/8: the GPU relaxes FW
instead of walking).  The CPU side walks the BFS at every density —
it beats the CPU's FW everywhere.

**Verified by** two Playwright specs: the multi-batch one (n=300 —
two source batches, so the fold runs on a short last batch — three
components, both modes, both directions: harmonic within 1e-4 and
positive everywhere, plain exactly 0 everywhere) and a connected one
(plain scores bit-equal across executors at n=300, the discrete
invariant the disconnected fixture cannot pin).  Controls: `level +
1` in the plain fold turns the connected spec red; `1/(level + 1)`
in the harmonic fold turns the multi-batch spec red; both restored.
The betweenness parity specs stay green over the extracted plan (23
of 23 in the suite).  The bench's unweighted closeness row now
measures a different path on both sides — recorded here, since the
harness hash cannot see a `src/` change — and 72.6 adds the weighted
row so the FW route stays measured.

### 72.4 — `laplacian: 'normalized'` for the heat family (2026-09-18)

Landed as planned, almost entirely inside `buildHeatStructure`:
under `'normalized'` each arc's weight is scaled by 1/√(d_s·d_t)
and the diagonal becomes 1 (0 on an isolated node, whose heat stays
put), so `degrees` reads as "the diagonal of L" on either setting —
which is all `diffuseVector` and the GPU's dense build ever consumed,
so neither changed.  The norm bound is 2 regardless of degree, so
`squarings = ⌈log₂(4t)⌉⁺` depends on `time` alone.  `heatDiffusion`
and `heatKernel` both honor it; both entries validate it
synchronously (a `TypeError` naming the option, the throw gate at
zero with its spec in `test/`).  `HeatLaplacian` ships in the
declaration; d.ts regenerated.

**Verified by** closed forms on a *weighted* pair (w = 4: the
combinatorial ½(1 ± e^{−8t}) against the normalized ½(1 ± e^{−2t}) —
the weight is what makes the two Laplacians disagree) and on the
triangle (every degree 2, eigenvalues 0, 3/2, 3/2 → (1 + 2e^{−1.5t})/3
on the diagonal); a path a–b–c plus an isolated node, asserting that
the normalized rows do **not** sum to one (conservation is a
combinatorial-only invariant, and the same graph still conserves
under the default), that the isolated node's heat is exactly 1 on
itself and 0 elsewhere, and that the seed form is the kernel's
column; and the Playwright parity spec running `heatKernel`
normalized at t = 2 on the ring fixture (1e-4, symmetric, and the
row drift asserted *above* 1e-3).  Two controls, because the first
one taught something: `ws /= d_s` (one factor instead of the root of
the product) turned only the path spec red — on a regular graph
d_s = √(d_s·d_t), so the pair and the triangle cannot see it — and
`ws /= d_s·d_t` (no root) turned the closed forms red.  Both
restored.  No new bench row (same cost shape; the existing row's
comment notes it prices combinatorial, batched with 72.6's bench
edits), and the CHANGELOG carries the round's public rows.
