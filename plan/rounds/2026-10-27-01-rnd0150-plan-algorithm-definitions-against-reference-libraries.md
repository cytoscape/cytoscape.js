## Algorithm definitions against the reference libraries

**Depends on:** 65, 69, 70, 2026-10-12-02

### Why

[#3543](https://github.com/cytoscape/cytoscape.js/issues/3543) reports that
undirected `betweenness()` is twice the standard value.  v4 has the same
accumulation (measured 27 October: path `a-b-c` gives 2 for `b`, the
#1032 graph gives 7 / 2 / 1 / 2 where NetworkX gives 3.5 / 1 / 0.5 / 1, on
both `cpu` and `workers`).  The NetworkX reference spec did not catch it
because `scripts/algorithm-references.py` doubles NetworkX's undirected
scores to fit v4.

A review of that script found eight more places where the reference is
adjusted to v4 (or v3) rather than compared one to one.  Each was decided
on 27 October, against the literature and the other libraries' defaults.

### Decisions

| # | Algorithm | Today | Decision |
| --- | --- | --- | --- |
| 1 | `betweennessCentrality` | undirected scores not halved | **Halve them** (Brandes 2001; Freeman's definition; NetworkX, igraph).  CPU, workers and GPU lanes. |
| 2 | `pageRank` | always walks source → target, even on an undirected graph | **Add `directed`, default `false`**, like the other centralities. |
| 3 | `closenessCentrality` | directed runs use distances *from* the node | **Add a direction option, `'out'` (default) \| `'in'`.**  The field splits: NetworkX, Neo4j GDS and Boldi–Vigna use incoming; R igraph (`mode = "out"`), graph-tool and classic SNA use outgoing.  v4 cannot cheaply reverse a graph, so without the option a caller cannot reach NetworkX's numbers. |
| 4 | `closenessCentrality` | classic form is `1/Σd`, 0 once any node is unreachable | **`(n−1)/Σd`, with the Wasserman–Faust correction on disconnected graphs** (NetworkX's definition). |
| 5 | degree, closeness, betweenness, Katz `*Normalized` | divide by the maximum | **Keep `'max'` as the default; add `normalization: 'max' \| 'size' \| 'l2'`**, each method accepting only its applicable values.  `'size'`: degree ÷ `(n−1)`; betweenness ÷ `(n−1)(n−2)/2` undirected, ÷ `(n−1)(n−2)` directed; harmonic closeness ÷ `(n−1)`, classic closeness unchanged (already in the formula).  `'l2'`: Katz ÷ its L2 norm. |
| 6 | `effectiveResistance` | weight is conductance; `Infinity` across components | **Keep both** (Ghosh–Boyd–Saberi 2006; Spielman–Srivastava 2008; v4's own Laplacians).  **Add `weightAs: 'conductance' \| 'resistance'`** for NetworkX's default; under `'resistance'`, `commuteTime`'s volume is the sum of `1/w`. |
| 7 | `hierarchicalClustering` | threshold mode merges while `dist < threshold`; the JSDoc says "farther apart than" | **Merge while `dist <= threshold`** (SciPy `fcluster`, R `cutree`); fix the JSDoc. |
| 8 | `randomWalkWithRestart` | a directed node with no out-edges absorbs the walk | **Restart at the seeds by default** (NetworkX's personalised PageRank; Langville–Meyer's strongly preferential form); **add `dangling: 'restart' \| 'absorb'`**. |
| 9 | `markovClustering` | `maxIterations` 20, no pruning | **`maxIterations` default 100** (Python `markov_clustering`, R `MCL`); **add `pruneThreshold`, default 0**. |

Items 1, 2, 4, 7, 8 and 9 change default results.  Each goes in
`src/README.md`'s deviations, `docs/features.csv` and the release notes.

### References: every library that has the algorithm

The reference specs compare against cached JSON; no spec runs Python or R.

- **Python** (`scripts/algorithm-references.py`, existing): NetworkX,
  SciPy and NumPy, now also scikit-learn (`AffinityPropagation`, `KMeans`,
  `AgglomerativeClustering`), scikit-fuzzy (`cmeans`) and
  `markov_clustering`.  NetworkX gains A\*, Hierholzer (`eulerian_path`),
  BFS/DFS and degree centrality.  The adjustments above come out of the
  script: each new option is checked at both settings, against the
  library's default where one matches.
- **R** (`scripts/algorithm-references.R`, new): igraph, `stats`
  (`hclust`, `kmeans`), `cluster` (`pam`), `e1071` (`cmeans`) and `MCL`.
  It reads the graphs from `test/fixtures/algorithm-references.json`, so
  both references see the same graphs, and writes
  `test/fixtures/algorithm-references-r.json`.  igraph mapping:
  `distances` (Dijkstra, A\* distance, Floyd–Warshall, Bellman–Ford), `mst`,
  `components(mode = "strong")`, `biconnected_components` /
  `articulation_points`, `min_cut`, `page_rank`, `closeness` /
  `harmonic_centrality` (both modes), `betweenness`, `degree` / `strength`,
  `alpha_centrality` (Katz), `count_triangles` / `transitivity`,
  `similarity(method = "jaccard")`, `triad_census`, `eulerian_path`,
  `bfs` / `dfs` (reach and depth, not visit order), and
  `page_rank(personalized =)` for item 8.
- No library equivalent: SimRank, the heat kernel (SciPy `expm` only) and
  affinity propagation's message schedule outside scikit-learn stay on
  their NumPy transcriptions.
- **Environment** (landed first, since every item regenerates the
  fixture): `scripts/references/pixi.toml` and its `pixi.lock`, one
  conda-forge environment for both references — Python 3.13 with
  NetworkX 3.7, SciPy 1.18.1 and NumPy 2.5.4 (the versions the first
  fixture was recorded with), scikit-learn, scikit-fuzzy and
  `markov_clustering` (PyPI); R 4.5 with igraph, cluster, e1071, MCL and
  jsonlite, all on conda-forge.  It replaces the unlocked venv and
  the pip requirements file beside the script.  Pixi itself is
  installed standalone or through mise (it is in mise's registry).
  Regenerating the existing fixture in it moved the 14th significant
  digit of 333 values (max relative change 3.0e-14, the heat kernel's
  `expm`): the BLAS build differs from the pip wheels'.  The fixture is
  re-recorded from the locked environment, and the spec passes unchanged.

### Order

1. Items 1–9, one commit each, with the NetworkX fixture regenerated to
   match and the docs in the same commit.
2. The Python reference widened (new algorithms, scikit-learn,
   scikit-fuzzy, `markov_clustering`, both settings of every new option).
3. The R reference script and fixture, and its spec.

### Verification

`npm run -s verify` per commit; `npm run -s test:node:quiet`,
`npm run -s test:throws:quiet` and `npm run build:types` for the new
options; `npm run -s test:playwright:quiet` for the GPU betweenness lane.

### Progress

- **Item 1 landed (27 October).**  `bcResultFrom` takes the run's
  `directed` flag and halves the raw score of an undirected run, so the
  CPU, workers and GPU lanes change together; `betweennessNormalized`
  is a ratio and is unchanged.  The NetworkX reference compares
  directly (the `scale = 2` is gone, 50 values halved), the hand
  fixtures in `test/algorithms-centralities.test.mjs` are halved, and a
  new spec pins #3543's path and the #1032 graph (3.5 / 1 / 0.5 / 1) on
  `cpu` and `workers`.  Control: with the halving disabled that spec
  fails, with it restored it passes.
- **Item 2 landed (27 October).**  `buildPageRankSparse`, which every
  lane shares, emits an undirected edge as both arcs with the edge's
  weight; `directed: true` keeps the single stored arc.  The NetworkX
  reference now passes karate and `wu` undirected and keeps karate read
  as a digraph as the `-dir` cases, so both settings are compared.  A
  new spec pins a path's undirected ranks (r_b = (1 + 2α)/(3 + 3α)) on
  `cpu` and `workers`; the dangling-node spec, the headless smoke test,
  the cross-runtime smoke's directed chain and the benchmark rows pass
  `directed: true`, since each was written
  for or measured on one arc per edge.  Control: forcing `directed`
  fails the new spec and both undirected karate cases.  One `test:node` run failed `force-worker.test.mjs`'s bit-identical
  check; it passed alone three times and in the next full run, and
  touches no PageRank code.
- **Items 3 and 4 landed (27 October).**  `direction: 'out' | 'in'`
  (validated synchronously) reaches every lane through one switch:
  `eachIncident`, `buildBrandesNeighbors` and `brandesCsr` take a
  `reverse` flag that walks in-edges, which the single-root Dijkstra
  (`dijkstraDense`, now shared with `dijkstra`), the CPU and worker BFS
  and the GPU BFS use; Floyd–Warshall's CPU and GPU folds read the
  column instead.  The classic form is one shared `closenessOfRow(sum,
  reached, n, harmonic)`, so each lane now reports how many nodes it
  reached: the worker range interleaves (sum, reached), and both WGSL
  folds write a second `reached` buffer (a sum reduction in plain mode;
  harmonic keeps its zero-distance mark).  The NetworkX reference calls
  `closeness_centrality(wf_improved=True)` and `harmonic_centrality`
  directly — reversed for `'out'`, as-is for `'in'` on the directed
  graph — instead of the hand-written 1/Σd.  Specs: a hand-checked
  directed path for both directions and modes on `cpu`, `workers`, BFS
  and Floyd–Warshall, plus `direction` validation; the BFS-vs-FW and
  disconnection specs now expect positive plain scores.  Browser: the
  GPU parity specs gained both directions on both folds and pass on the
  RX 580 (Chromium; WebKit skips WebGPU); the disconnection fixture
  gained chords, because a bare directed ring sums distances to and
  from a node alike, and with chords disabling the column fold fails
  it.  Controls: forcing `reverse` off fails the hand spec and the
  `wd` reference; restoring 1/Σd fails five.
- **Item 5 landed (27 October).**  One `resolveNormalization(value,
  allowed, method)` in `algo-shared.mts` validates every method's
  `normalization` synchronously and rejects a value that does not
  apply (Katz's `'size'`, the others' `'l2'`).  Degree divides by
  n − 1 (a lone node scores 1, NetworkX's convention); betweenness's
  `bcResultFrom` takes a plain `BcScale` (direction and normalization,
  safe across the worker await) and divides by (n − 1)(n − 2), halved
  undirected, leaving n ≤ 2 unscaled as NetworkX does; closeness
  divides harmonic scores by n − 1 and passes classic ones through;
  Katz divides by the L2 norm.  The NetworkX reference gained
  `betweenness_centrality(normalized=True)`,
  `katz_centrality(normalized=True)` and, for the first time, degree
  centrality (`degree_centrality` and the in/out forms, on karate,
  `wd` and the multigraph, plus the raw degrees `'max'` divides).
  Closeness `'size'` has no NetworkX counterpart; a hand spec pins it,
  and igraph's `harmonic_centrality(normalized = TRUE)` will check it
  in the R reference.  Controls: perturbing each divisor fails eight
  of the nine affected cases (the ninth is directed betweenness, which
  the undirected-halving perturbation does not touch).
- **Item 6 landed (27 October).**  `weightAs: 'conductance' |
  'resistance'`, validated synchronously, is read in
  `buildResistanceSystem`, which every lane shares: a resistance w
  enters the Laplacian as the conductance 1/w, so the component volumes
  `commuteTime` multiplies by sum conductances in both modes.  The
  NetworkX reference records `resistance_distance` both ways
  (`invert_weight=False` and its default `True`) and the spec runs
  both settings; a hand spec pins a weighted path's resistance and
  commute time on `cpu` and `workers` — the commute time is 32/3 both
  ways, and summing raw weights as the volume would give 32.  Control:
  ignoring `weightAs` fails all three cases.  The GPU parity spec is
  unweighted, so it cannot see the option; the GPU lane builds its
  system through the same function.
- **Item 7 landed (27 October).**  Both merge loops — the
  named-linkage kernel (`algo-kernels-cluster.mts`) and the per-pair
  closure path (`hierarchicalRun`) — stop at `min > threshold`, or when
  no pair is left (an Infinity minimum, which the default threshold of
  Infinity would otherwise never stop on).  The SciPy reference drops
  its `t − 1e-12` shim, and since the real-valued blobs never land on
  a threshold, it gained `GRID_POINTS`: integer points whose merges
  sit exactly on t = 1, 2, 3, for all three linkages (nine cases,
  shipped in the fixture as `gridPoints`).  A hand spec pins a tie at
  threshold 1 through both loops (a named linkage and an unnamed
  per-pair one; a custom *distance* still runs the kernel).  Controls:
  restoring `>=` in either loop fails that loop's case, and in the
  kernel six of the nine grid cases.
- **Item 8 landed (27 October).**  `dangling: 'restart' | 'absorb'`,
  default `'restart'`, validated synchronously by both entries.  No
  solver changed: restarting at the dead ends adds the rank-one
  p₀·1_Dᵀ to W, which by Sherman–Morrison scales the absorbing solution
  by a scalar, and since the restarting walk is stochastic that scalar
  is 1/Σ p_a — so the seed form divides its vector by its sum and
  `rwrProximityResultFrom`, which every proximity lane (CPU, workers,
  GPU) returns through, divides each column by its own.  The NetworkX
  reference adds `pagerank(alpha = 1 − c, personalization = {seed: 1})`
  per column (its default dangling rule is the personalization) beside
  the exact NumPy absorbing solve, and both rules match to 1e-10.  The
  round 70 spec that pinned the leak now pins both rules on a two-node
  sink by hand (2/3, 1/3 against 1/2, 1/4) on `cpu` and `workers`; a
  new GPU spec runs a chain into three sinks under both rules and
  checks restart's columns sum to 1 and absorb's leak.  Control:
  forcing absorb fails the hand spec and the `wd` reference (`wu` is
  connected and undirected, so its two rules agree).
- **Item 9 landed (27 October).**  `MARKOV_MAX_ITERATIONS = 100`
  replaces the 20 in the offload lane and the GPU path.
  `pruneThreshold` (validated synchronously, in [0, 1)) runs after each
  inflation in `markovKernel` and, on the GPU, as `PRUNE_COLUMNS`, one
  invocation per column, dispatched only when the threshold is
  positive; neither renormalizes after pruning, as `markov_clustering`
  does not.  The NumPy transcription runs up to 100 passes (karate
  converges well within 20, so its clusters did not move), and the
  reference now runs Python `markov_clustering` itself on karate and
  `wu` at thresholds 0, 0.001 (its default, which moves nothing here),
  0.05 and 0.1 (which do).  Its `get_clusters` counts every nonzero
  entry — unpruned that leaves tiny values, which read as overlapping
  clusters — so its converged matrix is read with v4's 3-decimal rule;
  all eight cases match v4 despite the two stopping criteria differing
  (successive-pass `allclose` there, expanded-vs-inflated here).  The
  GPU parity spec runs thresholds 0.05, 0.1 and 0.2 on both executors
  and requires one to move the partition.  Controls: disabling the CPU
  prune fails four of the eight cases; skipping the GPU pass fails the
  browser spec.  No fixture needs more than 20 passes, so the cap's
  change is untested by a reference; it is a default, documented.
  Also renamed the pixi tasks to `refs-py` and `refs-r`: a task named
  `python` shadowed the interpreter, so `pixi run python -c …` ran the
  generator instead.
