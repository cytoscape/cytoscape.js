## The matmul-first families

The round-65 benchmark's own headline said where the next wins were: MCL
leads at up to 647× because its inner loop is a dense matrix product —
compute-bound, the one regime where the GPU's advantage is ~100× rather
than the ~10× bandwidth ratio — while every memory-bound family sits an
order of magnitude lower.  The maintainer's goal for this round: build
the four families that assessment named.  All four landed, each with a
CPU reference (the spec), a GPU path, executor routing, Node specs,
live parity specs with verified controls, and benchmark rows.

### 69.1 — closeness centrality joins the executor tier

`eles.closenessCentralityNormalized()` is the O(n³) all-pairs
computation — it always ran full Floyd–Warshall — so it moved onto the
async tier exactly as `floydWarshall` did in round 65.  **This is a
public API semantics change**: the method returns a promise now, and
the options gained `executor`.  The single-root `closenessCentrality`
stays synchronous (a Dijkstra walk; nothing to win).

Two refactors made the family cheap: the CPU relaxation left
`floydWarshall` as an exported `relaxFloydWarshall` (the closeness CPU
reference reads the matrix directly now, instead of paying an
accessor-with-handles call per pair), and the GPU side exports
`fwRelaxPlan` — upload + the blocked dispatch chain — which closeness
reuses unchanged, appending one row-fold kernel (`CLOSENESS_ROWS`,
workgroup-per-row, two tree reductions) in the same pass.  The readback
is n floats instead of the 2n² the public FW must return.  Unreachable
pairs ride the FW sentinel band; a row the CPU would sum to Infinity
(plain mode with an unreachable peer, harmonic with a zero distance) is
*marked* via the second reduction and written as one sentinel, because
summing sentinels can overflow f32 and WGSL implementations may assume
floats are finite.

### 69.2 — triangle counting: the first family designed matmul-first

`eles.triangleCount()` — per-node triangle counts, local clustering
coefficients, `totalTriangles`, `transitivity`; no v3 counterpart.  The
collection reads as a simple undirected graph (direction ignored,
parallel edges collapsed, loops excluded).  CPU reference: sorted
neighbor lists, each triangle found exactly once at its sorted (u, v)
edge by two-pointer intersection — O(Σ deg²).  GPU: one tiled `MATMUL`
(A², the shared kernel MCL leads with) plus a Hadamard row fold
(`TRI_ROWS`); row i's fold is twice its triangle count, so the readback
is n floats and the counts are exact integers in f32 until a row's sum
passes 2²⁴.

**The 'auto' gate is a density gate, not a size gate.**  The CPU walk
is O(Σ deg²) where the matmul is O(n³) regardless, so the GPU can only
win where Σ deg² approaches n³ — dense graphs.  Under 'auto' the GPU
routes only at n ≥ GPU_MIN_N *and* m ≥ n²/32; sparse graphs stay on
the CPU however large they are.  A starting figure in the GPU_MIN_N
tradition, to be re-measured by the sweep on the benchmark machine.

### 69.3 — neighborhood similarity

`eles.neighborhoodSimilarity({ metric, directed })` — pairwise Jaccard
/ cosine / overlap coefficients over deduped neighbor sets; no v3
counterpart.  The shared-neighbor counts for every pair are C = A·Aᵀ:
undirected A is symmetric so the same buffer binds as both matmul
factors; `directed: true` compares out-neighborhoods and uploads the
transpose.  CPU reference: wedge counting over witness lists — every
shared neighbor w of (u, v) is one wedge u–w–v — O(n² + Σ deg²) with
no per-pair set intersection.  The metric normalizes lazily per query
in the shared accessor, so the counts stay exact integers on both
executors and the executors agree *exactly* (the parity spec asserts
zero delta, not an epsilon).  The result is inherently all-pairs —
O(n²) memory, like `floydWarshall`'s distances — and the same density
gate as triangles governs 'auto' (m ≥ n²/16 here: the CPU walk is the
same shape but the GPU pays a full n² readback).

### 69.4 — Katz centrality

`eles.katzCentrality({ alpha, beta, maxIterations, tolerance,
directed, weight })` — attenuated walk counting, x = α·Aᵀ·x + β from
x = 0, L1 stopping rule Σ|Δ| < n·tolerance; no v3 counterpart.
Directed runs count incoming walks; parallel edges each contribute;
loops are excluded (the pageRank family conventions).  `alpha`/`beta`
are validated synchronously (`resolveKatzParams` — two new guards,
both pinned in `test/algorithms-matrix.mjs`, so the throw gate stays
at zero).  CPU reference: sparse O(E)-per-step edge gather, pageRank's
shape.  GPU: pageRank's `MATVEC` (now exported — it was always a
generic flags-guarded tmp = m×v) plus a `KATZ_EPILOGUE` (add β, L1
reduce, converge bit), all iterations encoded up front, one readback.
**'auto' never routes Katz to the GPU** — the 65.10 pageRank verdict
applies to the identical iteration shape, and the entry carries the
same comment; the GPU path serves an explicit 'gpu' and the parity
suite, and a sparse SpMV kernel remains the revisit that could change
the verdict for both families.

### 69.5 — verification, and the controls

Node tier: `test/algorithms-matrix.mjs` (18 specs, every expected
value hand-computed — K4-minus-an-edge for triangles/similarity, the
closed-form star and chain for Katz), the executor-contract sweep
extended to the four new entries, throw coverage at zero unrun, JSDoc
gates at 100% (453 public members), types surface and consumer tests
green, full `test:js` 2223 green (the two specs that called the old
sync `closenessCentralityNormalized` moved to await).

Parity tier: five new live CPU-vs-GPU specs in
`algorithms-gpu.spec.js` — closeness at multi-block n=100 in both
modes plus a two-component disconnection spec (the sentinel path),
triangles at n=96 (three matmul tiles, exact integer equality — a
discrete invariant, like MCL's memberships), similarity across all
six metric×direction combinations (exact equality), Katz in both
directions (1e-4 plus the pageRank spec's tie-tolerant ordering
invariant).  **Every spec was run once with its kernel deliberately
degraded and failed**: closeness with 1/d skewed and separately with
the unreachable mark dropped, triangles with the Hadamard mask
dropped, similarity with the directed transpose dropped, Katz with β
skewed 1%.  All five controls failed; all 15 specs green restored.

### 69.6 — benchmark rows, and a harness note

Four families joined `algorithms-gpu-bench.mjs`: closeness at FW's
sizes (what the on-device row fold saves over the n² readback),
triangles and similarity on the dense fixture (where their 'auto'
gate routes to the GPU at all — the row comment says why), Katz on
the sparse fixture (documenting the 'auto' verdict, as the pageRank
rows do).  Rows validated end-to-end on SwiftShader locally
(`--allow-swiftshader`, results deleted, not published — a software
rasterizer lies about the crossover); **real crossover numbers await
a run on the benchmark machine**, after which the density-gate
constants (n²/32, n²/16) and the closeness GPU_MIN_N should be
re-tuned from measurements.

Editing the suite file moves the `algorithms-gpu` harness fingerprint
`e97610c5` → `c965d9b8`.  The existing families' fixtures and op
strings are byte-identical, so once the first run under the new hash
is published, the pair belongs in `EQUIVALENT_HARNESSES` with that
reason — it cannot be added earlier because `auditEquivalences`
refuses a hash no published run carries (correctly: unknown is not
unchanged).

**Open**: the crossover sweep on the benchmark machine (gates re-tuned
from it); the sparse SpMV revisit for pageRank + Katz; whether
closeness should also gain a Brandes-style batched-BFS unweighted path
(the FW route was chosen because the CPU reference is FW-shaped, so
parity is structural — a BFS path would be faster still on sparse
graphs but needs its own reference).
