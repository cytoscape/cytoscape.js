## Round 85 plan — the layouts round: radial, force constraints, edge length, per-side padding (planned 2026-08-14)

Four demands with issue numbers attached, gathered.  What the code
does today, verified:

1. **Built-ins**: grid/preset/circle/concentric/breadthfirst/random/
   force, dispatched by name with an unknown name throwing
   (`core.mts:703-735`).  Concentric is *metric*-driven — a
   `concentric` score (default degree) bins nodes into rings by
   `levelWidth` (`concentric.mts:14-36`); breadthfirst's
   `circle: true` rings each BFS depth with uniform per-index angles
   (`breadthfirst.mts:384-394`).  Neither allocates a subtree an
   angular wedge, so a node's children scatter around the ring far
   from its sector — the hierarchy-aware allocation is exactly
   #2493's ask (issue text to-verify; cited from the round brief).
2. **Two layout shapes exist**: handle-level discrete layouts through
   the `layoutPositions` finisher (`breadthfirst.mts:422`; circle/
   concentric/random likewise) and the columnar round-17
   LayoutContext (`layout/contract.mts` — `nodeSlots`/`endpoints`/
   `positions`/`setPositions` plus the same finisher), with force as
   the contract's production consumer.
3. **`edgeLength` already exists and is per-edge**: a number or plain
   fn resolved once into a Float32Array (`force.mts:33-36`,
   `239-249`) consumed by both executors (`force-sim.mts:107-108`;
   `gpu-force.mts:417`, uploaded at `584-586`), nesting multiplier
   applied after (`:243-245`).  #1514's per-edge control is therefore
   *built*; what is missing is a serializable spelling — a fn cannot
   ride `cy.json()` or the wire.
4. **Fixed nodes exist**: locked nodes pin (`force.mts:173-182`),
   ride bit 31 of the slot map into the GPU kernel
   (`gpu-force.mts:34-35`), and suppress the settle re-pack.  No
   alignment or relative-placement machinery exists anywhere.
5. **The GPU iteration** is eight dispatches encoded k-per-submit
   (`gpu-force.mts:822-837`) with a 4-byte convergence staging read
   as the sole readback (`:44-48`) — a CPU-side projection per tick
   would need the per-tick readback the architecture forbids, so
   constraints run on-device or the run demotes to the CPU executor
   (the 14.11 compound precedent, `force.mts:7-11`).
6. **The compound clamp is centered by decided design**
   (`hierarchy.mts:11-25`): the flush materializes the children-bb
   center with symmetric padding and `coreW = max( bbW, minWidth )`
   (`hierarchy.mts:385-391`); compound props enter via
   `style.mts:4861-4871` and read back at `5686-5687`; the per-side
   hook is logged (`src/README.md:2415-2416`, `:4943`).

### 85.1 — the radial tree layout (#2493)

New `src/layout/radial.mts`, `cy.layout({ name: 'radial' })` joining
the dispatch and its throw message.  Discrete, breadthfirst's shape:
roots as a collection or id array (a selector string throws — the
`breadthfirst.mts:113-117` precedent), a BFS tree per root (round-10
slot-native bfs; non-tree edges just draw, recorded — breadthfirst's
stance), then **hierarchy-aware angular allocation**: each node's
wedge is a share of its parent's proportional to its subtree's weight
(`weight: 'leaves' | 'subtree'`, default `'leaves'` — no functions),
placed at its wedge bisector at radius depth × `levelSpacing`
(derived from the bounding box when unset).  Multiple roots partition
the sweep proportionally to their trees.  Options: `roots`,
`startAngle`, `sweep`, `clockwise`, `levelSpacing`, `weight`, plus
the shared plumbing (fit/padding/boundingBox/spacingFactor/animate/
transform) through the finisher.  Leaves only; parents derive (the
standing compound rule).  **Verified by** `test/layout-radial.mjs`
with `headlessWidth`/`headlessHeight` set (the AGENTS.md rule):
a child's angle inside its parent's wedge, monotone radius by depth,
sibling wedges disjoint, and the unbalanced fixture's heavy subtree
measurably wider — with the control swapping the allocation for
breadthfirst-circle's uniform index spacing, which must go red.
Bench row in `layouts.mjs` (batched with 85.3's edit): an unbalanced
2000-node tree, the row asserting in-row the property it is named for
(distinct radii == depth count; the heavy subtree's angular span
exceeds the light's).  No v3 twin exists (v3 has no radial); the
comparison partner is v4's own breadthfirst-circle, pricing what the
hierarchy-awareness costs.

### 85.2 — constraints on the force layout (fcose #54/#53 absorbed)

v1 kinds: **fixed** — already spelled `lock()`; document the
equivalence rather than add a second spelling; **alignment** —
`alignment: { horizontal?: string[][], vertical?: string[][] }`
(fcose's shape; id arrays, serializable), groups sharing a node merge
transitively; **relative placement** —
`relativePlacement: [{ left, right, gap? } | { top, bottom, gap? }]`.
Validation fails loudly at start: unknown ids throw, a constraint
cycle in the placement DAG throws, two locked members of one
alignment group at different coordinates throw.

Method: **constraint projection after each integration step** — the
IPSep/CoLa-lineage standard, and what fcose itself runs.  CPU
executor first and as spec: per tick, alignment groups snap the
constrained coordinate to the group mean (a locked member pins the
group to its coordinate), violated relative pairs split the
correction Jacobi-style, pinned nodes never move.  Projection order
vs the displacement fold is load-bearing: fold-then-project reads as
never settling, project-then-fold can settle while violated — a spec
pins that constrained runs both converge and satisfy.  The spectral
seed is constraint-blind, so the run projects once before the first
tick to shorten the transient.  The settle re-pack translates whole
components and is already skipped for locked nodes; the skip extends
to any constrained run.

GPU: **measure-first gate**.  The candidate shape is one `constrain`
dispatch appended after `apply` per iteration — alignment groups as a
[starts][members] buffer, one workgroup per group tree-reducing the
mean (v1 caps a group at one workgroup's reduction width), relative
pairs as a Jacobi pair list.  But constraints are user-authored
(tens, not 100k), so first *measure the demotion*: the renderer bench
runs the constrained scene on the CPU executor against the
unconstrained GPU run.  If the demotion is acceptable at target
sizes, v1's contract is "constrained runs take the CPU executor"
(the compound precedent, documented) and the kernel is logged with
the number attached; if not, the kernel is built.  Either way the
losing configuration stays measured.  **Verified by** seeded CPU
specs (spread < eps at settle per aligned group; gaps satisfied;
every throw message-asserted), the control deleting the projection
step (every geometry spec red, the convergence spec not hanging), and
a bench row that **verifies constraints were active**: the timed row
asserts alignment spread < eps at end while its unconstrained twin on
the same fixture shows a large spread — the delta prices projection.

### 85.3 — `edgeLength` gets its serializable form (#1514)

`edgeLength?: number | { data: string, default?: number }` — the
`{ data }` form reads the per-edge numeric column once at start
through the hoisted `store.data.reader`; a missing value takes
`default` (else `DEFAULT_EDGE_LENGTH`, `force.mts:68`); a key whose
column is string/mixed **throws**, naming key and kind (silent
defaulting is how a typo'd key would lay out plausibly wrong).  The
nesting multiplier applies after, unchanged; both executors consume
the same Float32Array, zero sim changes.  The fn form stays for now
(removal is a breaking call — see Open).  **Verified by** a seeded
CPU run on a path graph with data lengths 50/200 asserting the
settled neighbor-distance ratio, against the constant-`edgeLength`
control reading ~1:1 — the pair discriminates; plus the throw spec.
No new bench row: same cost shape as the fn form; the force row's
comment notes the option.  d.ts + `public-types.mts:486-488`.

### 85.4 — per-side compound padding (the logged hook)

Four parents-group props — `padding-left` / `padding-right` /
`padding-top` / `padding-bottom` — each px or `'N%'` like `padding`
(same pfValue convention, same `relativeTo` basis), defaulting to
`padding` when unset.  Plumbing: `CompoundStyle` grows four optional
fields (`hierarchy.mts:19-25`); the flush resolves each side and
materializes `w = coreW + padL + padR`,
`cx' = cx + ( padR − padL ) / 2` (same for y) — the centered
*min-size* clamp itself is untouched, per the round-14 decision the
hook records (`src/README.md:2415`).  Readback via the existing
compound plans (`style.mts:5686-5687` pattern); `padding()` keeps
answering the uniform prop, documented.  Compound props outside the
parents group throw (existing rule).  The round-25 padding tween
writes `{ padding }` alone through the partial-update path whose own
comment warns about resets (`hierarchy.mts:279-281`) — a spec pins a
padding tween leaving `padding-left` standing, because that path is
exactly where the defect would hide.  **Verified by**
compound-bounds specs with headless dims (asymmetric padding shifts
the parent box the computed amount; children bb unchanged; the
zero-one-side control goes red) and one open of the debug compound
fixture (the "something has to open the page" rule).

### Sizing, and whether the round splits

Recommend **splitting**: 85.1/85.3/85.4 are each single-subsystem
and discrete-spec'd — together one normal round.  85.2 touches both
executors, possibly a new WGSL kernel, the renderer bench, and
carries a measure-first gate that can change its own shape mid-round
— round-59-shaped, a round on its own.  So: round 85 = radial +
edge length + per-side padding; the constraints pass becomes its own
follow-on round with its design recorded here once.  If the
maintainer keeps it whole, 85.2 lands last so its gate cannot stall
the other three.

### Risks named at planning

- The projection/fold ordering (85.2) has a wrong answer in each
  direction; only the paired convergence-plus-satisfaction spec
  catches both.
- The radial control must actually fail — run it once (the
  round-27 "check that a new spec can fail" rule); a wedge assertion
  loose enough to pass uniform spacing measures nothing.
- All `layouts.mjs` edits batch into one commit so the benchmark
  fingerprint moves once (round 68).
- Every geometry spec sets `headlessWidth`/`headlessHeight` or it
  tests a different graph than the one that ships (the AGENTS.md
  rule).
- 85.3's kind-mismatch throw should share round 84's column-kind
  vocabulary so the two rounds' messages agree.
- The stranded-doc-block hazard applies to the dispatch-table and
  options-type edits — run the JSDoc gate before each commit.

**Open:** the split call (recommended: the constraints pass runs as
its own follow-on round); keep or deprecate the fn form of
`edgeLength` — and whether the answer is a *policy* covering
concentric's fn defaults (`concentric.mts:27-28`), the standing
serializability exception, or one option's call; radial's default
weight (`'leaves'` recommended) and whether multi-root sector
partitioning matches desktop's radial expectations; the constraint
v1 surface — the alignment-group reduction cap, whether
cross-component relative placement is in, and whether CPU-executor
demotion is an acceptable v1 contract for the fcose #54/#53
consumers; per-side padding percent support vs px-only.
