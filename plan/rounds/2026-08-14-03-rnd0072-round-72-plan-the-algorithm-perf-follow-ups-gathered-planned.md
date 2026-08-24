## Round 72 plan — the algorithm perf follow-ups, gathered (planned 2026-08-14)

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
