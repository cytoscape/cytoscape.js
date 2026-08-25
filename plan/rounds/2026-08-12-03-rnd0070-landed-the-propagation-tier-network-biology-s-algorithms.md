## The propagation tier: network biology's algorithms

Round 69 asked "which algorithms could take MCL's lead"; the follow-up
question was which of the candidates matter for *scientific* use, and
the answer reordered the queue: network biology has converged on
propagation methods, so the round builds the five families the
maintainer picked from that assessment — random walk with restart,
heat-kernel diffusion, effective resistance / commute time, SimRank,
and the triad census.  Seven public methods, each with a CPU reference
(the spec), executor routing, hand-computed Node specs, and — for the
five dense forms — GPU kernels, live parity specs with verified
controls, and benchmark rows.

### 70.1 — the seed/dense split, decided once for the tier

RWR and heat diffusion each have two natural forms.  The *seed* form —
propagate from a seed collection, answer a score per node — is the
everyday bio call, and it is an O(E)-per-step sparse walk: the pageRank
verdict applies, no kernel can win, so `randomWalkWithRestart` and
`heatDiffusion` are CPU-only and an explicit `executor: 'gpu'` rejects
with a message pointing at the dense sibling (the weighted-betweenness
no-path precedent).  The *all-pairs* form — the full proximity/kernel
matrix — is iterated dense products, the MCL shape, and that is where
the GPU tier lives: `randomWalkWithRestartProximity` (Neumann
iteration S′ = (1−c)W·S + cI, one matmul per step),
`heatKernel` (exp(−tL) by scaling-and-squaring: the scaled Taylor
series as a matmul chain, then s squarings), `simRank`
(S′ = C·Q·S·Qᵀ, two matmuls per step) and the census's trace products.
The CPU references for the all-pairs forms are deliberately *sparse*
(one seed-vector solve per column; per-column Taylor applications;
per-row/column neighbor averages), so the density gates are honest:
the m ≥ n²/16–n²/32 gates of round 69, same reasoning, and 'auto'
stays on the CPU for sparse graphs however large.

`effectiveResistance` is the exception and the headline: the Laplacian
pseudo-inverse has no sparse shortcut, so the CPU reference is dense
f64 Gauss–Jordan at O(n³) and the GPU runs Newton–Schulz —
X ← X(2I − BX), nothing but matmuls, quadratically convergent for the
positive-definite B = L + J-blocks this family builds (the per-
component 1/n_c shift makes B invertible while cancelling out of every
resistance difference).  Like MCL it wins at every density.  f32
bounds the achievable accuracy on ill-conditioned systems, documented;
the parity bound is relative 5e-3 against the f64 elimination.

### 70.2 — semantics worth recording

- RWR: W column-normalized by out-weight; the undirected default walks
  both ways; a directed sink *absorbs* (its column leaks, scores can
  sum under 1) rather than redistributing — documented, simpler on
  both executors, irrelevant on undirected bio graphs.  `seeds` is
  required for the seed form and uniform over its nodes; the fixed
  point is c(I − (1−c)W)⁻¹p₀, pinned in specs by the two-node closed
  form c/(1−(1−c)²).
- Heat: the combinatorial weighted Laplacian, undirected, positive
  weights enforced (a negative conductance is not a heat problem —
  TypeError).  Both executors share the same approximation constants
  (‖tL/2^s‖∞ ≤ ½, ten Taylor terms); the CPU applies the scaled
  operator 2^s times per column, the GPU squares s times — the same
  power.  Specs pin the pair and triangle matrix exponentials in
  closed form and heat conservation through the scaling path at t=10.
- SimRank: Jeh–Widom with in-neighborhoods under `directed: true`,
  all neighbors otherwise (the library's undirected default; bio
  graphs are undirected).  Diagonal pinned to 1 per iteration; empty
  neighborhoods answer 0.  The 4-cycle fixed point x = C(1+x)/2 →
  x = 2/3 at C = 0.8 pins the maths in specs.
- Census: sixteen closed forms over seven trace primitives
  (S₁ = ΣC²∘C … S₇ = ΣCCᵀ∘M over the asymmetric and mutual masks),
  the dyad totals and six degree-pair sums, shared verbatim by both
  executors (`censusFromPrimitives`) — the executors can only
  disagree if a matmul disagrees with a wedge walk.  **The formulas
  themselves are the risk**, so the load-bearing spec is a
  brute-force differential: an independent classifier written from
  the class definitions, run over every triple of six random digraphs
  sweeping sparse to dense, exact equality demanded per class (plus
  Σ = C(n,3)).  It passed on the first complete run of the closed
  forms, and it is the spec that would catch a sign or orientation
  error nothing else can see.  `directed: false` files every edge as
  mutual, so the undirected census (empty / one-edge / path /
  triangle) is the same code path reading 003/102/201/300.

### 70.3 — verification

Node tier: `test/algorithms-propagation.mjs` (24 specs) and
`test/algorithms-motifs.mjs` (15 assertions per seed across six
seeds), all closed-form or brute-force; the executor sweep extended by
seven entries; throw gate at zero unrun (six new guards: seeds,
restartProbability, time, two positive-weight conductance guards,
dampingFactor); JSDoc gates 100%; types and full `test:js` green.

Parity tier: five new live specs — simRank (1e-4 plus an exact-1
diagonal, both directions), rwrProximity (1e-4 plus column
conservation ≥ 0.999), heatKernel (1e-4, symmetry, row conservation,
at t = 2 so several squarings run), effectiveResistance (relative
5e-3, the unit-resistor identity, and exact Infinity agreement across
components on a fixture that has both), motifCensus (all sixteen
counts exactly equal on a 64-node random digraph, with a
populated-classes discrimination check).  **Every spec was run once
with its kernel deliberately degraded and failed**: simRank with C
skewed 1%, rwrProximity with the restart diagonal skewed, heatKernel
with the k=2 Taylor term dropped, resistance with the Newton–Schulz
2I skewed to 2.01I, the census with S₆ folded against the wrong mask.
All five controls failed; all 20 specs green restored.

### 70.4 — benchmark rows, and a sizing lesson

Five families joined `algorithms-gpu-bench.mjs`: resistance on the
plain fixture (both sides O(n³) — the MCL-class row), the four
iterated-product families on the dense fixture.  The first draft
priced the dense families at n = 2048 and had to be walked back: a
*bench cell* pays REPS×(cpu+gpu) calls, and the dense CPU references
are MCL-cost already at n = 1024 (rwrProximity is one sparse solve per
column; heatKernel's scaling exponent grows with t·degree, so its
bench row pins time = 0.02).  Sizes stop at 1024 for those three
(census stays to 2048 — its CPU walk is O(Σ deg²), far cheaper), and
the iteration knobs are pinned in the rows per the round-33.2 rule.
The suite edit moves the harness fingerprint again; the round-69 note
about `EQUIVALENT_HARNESSES` applies to the new hash the same way,
and only one entry is needed once a run under the final hash is
published.

**Open**: the crossover sweep on the benchmark machine (density-gate
constants re-tuned from it, and the resistance family's parity bound
revisited on the RX 580's f32); a `normalized` Laplacian option for
the heat family; motif significance tooling (the census exists so it
can be run per randomized network — the ensemble driver itself is
app-level and stays out of scope).

### 70.5 — measured on the M2 (Metal, one-off; the archive run stays the RX 580's)

| family | n=256 | n=512 | n=1024 |
|---|---:|---:|---:|
| effectiveResistance | 3.3× | 7.8× | 9.0× |
| simRank (10 iters, dense) | 14× | 33× | 45× |
| rwrProximity (dense) | 21× | 68× | **119×** |
| heatKernel (dense) | 82× | 291× | **932×** |
| motifCensus (dense, to n=2048) | — | 3.9× | 8.7× / 12.3× @2048 |

heatKernel's 932× is the largest ratio any family has measured — its
CPU reference pays 2^s operator applications per column while the GPU
pays s squarings total, so the scaling exponent multiplies the CPU
side only.  Two findings from the measurement worth their notes:

- **A converge tolerance below f32's noise floor buys nothing and
  costs everything.**  Newton–Schulz at an absolute 1e-5 ran 96 of 96
  encoded iterations at n=1024 (642 ms): the inverse's entries grow as
  1/λ₂, so on any weakly-connected graph the iterate's float noise
  exceeds an absolute bound forever and the no-diff converge never
  fires.  The compare is *relative* now (`NS_COMPARE`,
  |Δ| > tol·max(1, |x|)) — 642 → 200 ms at n=1024, 9× over the f64
  elimination, and the parity spec still passes at 5e-3 relative.
- **A bench cell's budget is REPS × the slow side.**  The first row
  draft priced the dense families at n = 2048 and a single
  rwrProximity CPU call there runs minutes; sizes stopped at 1024 and
  the heat row pinned time = 0.02 (its CPU cost scales with 2^s).
