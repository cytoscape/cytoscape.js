## GPU force layout

The last queue pillar: the round-9 "GPU layouts: logged for later"
design, built.  Signed off 2026-08-01.

**Signed-off design calls:**

1. **A new GPU-native layout, `force`** — not a cose port (v3's
   cose stays in v3: its option surface and per-iteration structure
   are CPU-shaped, and ports arrive later via the round-17
   contract).  The model: spring attraction along edges toward
   `edgeLength`, short-range repulsion via a **uniform-grid cutoff**
   (grid rebuilt per iteration by counting sort — the
   stream-compaction discipline — repulsion gathered over the 3×3
   cell neighborhood), a weak centering gravity that keeps
   disconnected components in frame, velocity integration with
   alpha cooling, and seeded deterministic initial scatter (id-hash,
   the haystack precedent).

   Force accumulation is **gather-only —
   no atomics** — so a run is deterministic on a given executor
   (fixed reduction order).
2. **Ownership: GPU-authoritative with readback on settle** — the
   round-9 logged design.  During a run the position column is
   GPU-owned under the existing lease machinery (mirror skips
   uploads; CPU reads stale per the motion-staleness rule); the sim
   integrates in its own pre-cull pass so cull/edges/labels read
   live positions and the graph **renders live every frame** — the
   watchable-layout-at-100k showpiece.  On convergence (max
   displacement < ε for K consecutive iterations) or `stop()`, one
   readback settles the CPU columns — the sole readback exception
   in the architecture, per the round-9 call — then derived
   geometry flushes and `layoutstop` fires.
3. **The CPU reference is the spec.**  A complete CPU implementation
   (same options, same grid/cutoff math) runs headless instances
   and is what the Node specs pin (seeded runs to fixed coordinates
   on small graphs, energy decay under cooling, convergence,
   locked-node pinning).  CPU and GPU trajectories are **not
   bit-agreed** (recorded — parallel FP reduction order differs):
   GPU correctness pins invariants instead — no NaN/exploded
   positions, displacement decay, seeded summary statistics (edge
   length distribution, bb extents) within tolerance of the CPU
   run.
4. **Demotions and scoping** (the 14.11 pattern): compound graphs
   run the CPU executor (a GPU lease would leave the auto-bounds
   derivation reading stale positions; leaves simulate, parents
   derive per flush).  Locked nodes pin (skip integration).
   Subset layouts (`eles.layout`) simulate the subset only;
   non-members are inert (recorded).  Flat graphs at scale — the
   perf case — take the GPU path.
5. **Options surface** (minimal, consumed identically by both
   executors): `edgeLength` (number, or a plain function evaluated
   once into a per-edge column at start — the algorithms-round
   rule), `repulsion`, `gravity`, `decay`, `iterations` (cap),
   `threshold` (ε), `seed`, `randomize` (fresh seeded scatter vs
   current positions), `animate` (`true` live | `false`
   settle-then-draw), `fit`/`padding`.

**Pass split** (tests-first per item; docs in-commit):

- [x] **18.0 Docs-first** — landed with the design-sitting commit
  (`0f0ee859`), before any round-18 implementation.
- [x] **18.1 CPU reference** (2026-08-01) —
  `layout/force-sim.mts`, pure and slot-indexed: uniform-grid
  cutoff repulsion (counting-sort rebuild per iteration; stable
  ascending order inside cells — the deterministic gather order
  both executors share), springs off CSR-style incident lists,
  centering gravity, and **pure damped gradient integration**
  (`F · alpha` per step, no velocity state — no ringing, one less
  GPU buffer, and displacement tracks force so the threshold
  settle is robust; velocity integration was tried and dropped for
  exactly the ringing-trips-the-settle failure).  Forces gather
  into a scratch and apply in a second pass (the kernel's
  two-dispatch structure).

  **Model calls made empirically**, both
  recorded: the repulsion cutoff is the *mean ideal edge length* —
  repulsion vanishes exactly where a spring rests, so a connected
  pair's equilibrium is L itself (cutoff 2L left it at 1.7L); and
  a cutoff model does **not** promise global untangling — a curled
  chain is a legitimate local minimum (sfdp-style multilevel is
  future work).  Coincident points separate along a deterministic
  index-hash direction (no NaNs on degenerate input).

  Tests-first:
  8 specs in `test/force-sim.mjs` — seeded determinism,
  identical-run reproducibility, spring rest length, repulsion
  separation, gravity containment, cooling/convergence, pinning,
  and the path-relaxation invariants.  2135 Node tests, typecheck +
  lint clean.
- [x] **18.2 Layout plumbing** (2026-08-01) — `layout/force.mts`:
  `cy.layout({ name: 'force' })` wraps `ForceLayoutImpl` in the
  **round-17 CustomLayout plumbing — the contract's first
  production consumer** (an external layout would ship identical
  code).

  Options: `edgeLength` (number or a plain fn of the edge
  handle, resolved once — the algorithms rule), the sim params
  (repulsion/stiffness/gravity/decay/iterations/threshold),
  `seed`/`randomize` (fresh deterministic scatter vs relaxing
  current positions; pinned nodes keep real coordinates either
  way), `animate` (live streaming per frame through the bulk slot
  path — which, as recorded, emits no per-node position events —
  vs settle-then-draw), `stepsPerFrame`, `fit`/`padding`.  Scoping:
  leaves only (parents derive); **locked nodes pin** — they join
  every force pair but never move; subset scopes simulate the
  subset only (recorded).  `stop()` settles early through the
  wrapper.

  Tests-first: 7 specs in `test/force-layout.mjs` red
  then green — lifecycle + ring relaxation + fit, seeded
  determinism end-to-end, fn edge lengths, locked pinning, compound
  leaves-only, subset scoping, live streaming + stop.  2142 Node
  tests, typecheck + lint clean.
- [x] **18.3 GPU kernels** (2026-08-01) — `render/gpu-force.mts`:
  six dispatches per iteration (clear grid → bin count → serial
  exclusive scan → scatter → force gather → apply), sim-indexed
  with `apply` publishing movable nodes into the slot-indexed
  mirror position buffer — encoded ahead of the cull pass, so
  edges/labels follow live; node.position rides the tween-lease
  ownership (mirror skips its uploads; the frame loop keeps its
  clock while a run is live).

  **Binding-budget lesson re-hit on
  compute**: three shared bind groups totalled 16 storage buffers
  (the console guard caught it) — each kernel now carries its own
  group with exactly its buffers, the hot gather packing inputs
  (CSR as one [starts][entries] buffer; edges at stride 3 with
  bitcast lengths; the pin flag on bit 31 of the slot map; the
  alpha window + tick + displacement max sharing one atomic meta
  buffer) to land the force kernel at exactly 8.  WGSL lesson #3:
  `meta` is reserved too.

  Alpha annealing pre-computes a
  64-iteration window per frame indexed by a device tick (any k
  iterations per submit, no per-iteration uniform writes);
  convergence rides an atomicMax over monotonic f32 bits with a
  4-byte latest-wins staging poll; `readPositions()` is the one
  settle readback (round 9), after which the layout writes the CPU
  columns through the normal dirty-span path.  **Recorded
  narrowing**: the scatter's atomic in-cell order means GPU
  trajectories aren't bit-stable run-to-run — seeded
  reproducibility is the CPU executor's guarantee.

  Pinned on a
  real adapter: a provably-long run holds the lease (CPU
  `position()` stale mid-run while pixels advance), `stop()`
  settles real simulated coordinates, and the ring spreads.  2142
  Node tests, 138/138 Playwright, typecheck + lint clean.
- [x] **18.4 Convergence + readback** (2026-08-01) — the batched
  displacement reduction, latest-wins staging poll, settle readback
  and lease-release-before-CPU-write ordering all landed with 18.3;
  this item adds the **invariant parity suite**: on a seeded
  ring-with-chords graph, the CPU executor (animate: false) and the
  GPU executor (animate: true) run the same options and must agree
  on invariants — zero NaN, every node in frame, mean link length
  within [0.6×, 1.7×] of each other, bb width within [0.4×, 2.5×] —
  while trajectories stay deliberately not bit-agreed (recorded).

  The settled bb also pins flushDerived + layoutstop ordering (the
  box reflects the readback coordinates).  2142 Node tests, 138/138
  Playwright, typecheck + lint clean.
- [x] **18.5 Benchmarks + harness + true-up** (2026-08-01) —
  `debug/?layout=force` (+ `&seed=N`) runs the live layout
  in the harness (smoke-verified twice in scripted Chromium: zero
  page errors, identical settled extents run-to-run; an earlier
  error burst traced to racing a mid-write bundle on the static
  server, not the code).  The renderer benchmark gained
  **`-- --layout`**: instead of the pan scenarios, each scene runs
  a live force to convergence on the gpu side (wall time + fps
  from renderer stats) with v3's cose as the classic baseline —
  layout quality differs by design; the numbers compare the
  interactive experience.

  Numbers recorded 2026-08-01 on real
  hardware — see "Landed (hardware validation pass)" at the end of
  this file, which also corrects this item's original
  "software adapter on this box" assumption.  README
  gained the round-18 section and the round-9 "GPU layouts:
  logged" design bullet is trued up (since built).  **Round 18 is
  complete.**  2142 Node tests, 138/138 Playwright, typecheck +
  lint clean.

**Risks tracked**: pathological densities collapsing the grid (all
nodes in one cell → O(n²) gather; cell-capacity clamp + jittered
seeds, recorded); convergence-check cost (batched reduction);
readback vs in-flight frames (reuse the pick-ring discipline);
executor parameter drift (all constants resolved once, shared by
both executors); interaction mid-run (grab during a layout follows
the animation rule — grabbing is forbidden while an element's
position is leased).
