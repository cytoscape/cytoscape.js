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
