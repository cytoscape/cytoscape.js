## Layout mechanics: packing made reusable, the handoff decoupled from animate, and the animate gaps

Three maintainer ideas — reusable packing, the debug page's animate
toggle reaching the discrete layouts, and the force layout handing off
to the GPU regardless of `animate` — investigated before planning.
Round 85 owns the layout *feature* surface (radial, constraints,
edgeLength, per-side padding); this round is the mechanics
counterpart.  What the code does today, verified:

1. **Packing is force-private.**  All of it sits in
   `src/layout/force-init.mts`: `computeComponents` (:36-88),
   `estimateComponentRadius` (:100-105), `packAnchors` (:160-203) and
   `packComponentsExact` (:261-336 — "exactly v3's
   `separateComponents`, translation-only", per its own header), while
   the actual bin-packer `shelfPack` (:119-148) and its `PackBox`
   shape (:107-114) are module-private — unexported and therefore
   untestable directly.  Sole consumer: `force.mts:21-27`; the settle
   re-pack closure (`force.mts:346-351`) is skipped whenever the scope
   holds a pinned node.  Everything works in sim-index space, keyed
   off the run's mean edge length.  No discrete layout packs: grid is
   ordinal cells, circle one ring, concentric degree rings; the only
   one that reads components at all is breadthfirst — for root
   selection (`breadthfirst.mts:127-139`) — and it interleaves
   components in shared depth rows, orphans prepended as a synthetic
   depth-0 row (`breadthfirst.mts:329-330`).
2. **The GPU handoff is gated on `animate === true`**
   (`force.mts:423`), so `animate: false` runs the CPU sim
   *synchronously on the main thread* to convergence (:480-491) even
   on a flat rendered graph with a device present.  And the lease
   presents inherently: the runtime integrates directly into the
   mirror's own position buffer (`renderer.mts:1407-1413` passes
   `mirror.buffer('node.position')` to `encode`), the column is
   tween-owned for the run (:1278-1287), and redraw is held while the
   runtime lives (:1289-1292) — today "hand off" and "show it" are one
   mechanism, which is exactly the coupling the maintainer's ask
   dissolves.
3. **Discrete `animate` support is split down the middle.**
   circle/concentric/breadthfirst/random finish through
   `eles.layoutPositions` (`collection.mts:5280-5443`), whose animate
   branch tweens per node with the fit-at-final-positions viewport
   animation (:5377-5433).  **grid and preset ignore `animate`,
   `animateFilter` and `transform`, and never call `options.ready` /
   `options.stop`** (`grid.mts:71-105`, `preset.mts:59-126`) — while
   both doc comments *claim* tween support (`grid.mts:65-67`,
   `preset.mts:53-55`), and those comments ship as d.ts hover text.
   The animate branch's test coverage never touches grid or preset
   (`test/layouts.mjs:421-475` exercises circle and random).
4. **The debug page forwards `animate` only for force**
   (`debug/layout.js:47-52`; the `?layout=` load path hardcodes
   `animate: true` for force and passes nothing to the rest,
   `debug/init.js:235`, :243).  Worse, its timing chain
   `.run().promise()` (:55-59) throws for all six built-ins —
   `promise()` exists on `CustomLayout` alone (`contract.mts`, "the
   builtins' shape plus promise()") — and the throw lands *after* the
   synchronous run has applied and emitted, so the page looks right
   while every non-force Apply click errors uncaught and its
   `console.timeEnd` never fires.
5. **`ForceLayoutOptions` is missing four options the layout accepts**
   (`public-types.mts:484-504` vs `force.mts:33-66`):
   `componentSpacing`, `init`, `nestingFactor`, `gravityCompound` —
   absent from the shipped declaration.

### 87.1 — packing extracted: `src/layout/pack.mts`, and the contract learns it

Move `computeComponents`, `estimateComponentRadius`, `packAnchors` and
`packComponentsExact` into a new `src/layout/pack.mts`, and **export**
`shelfPack`/`PackBox`; `force-init.mts` keeps the seeding and the
spectral embedding (force-private, recommended below) and imports the
packing.  The move is behaviour-neutral and checked the round-42 way:
diff the moved function bodies, then run the seeded force suite, which
is bit-reproducible on the CPU executor.  The extraction finally makes
`shelfPack` testable — unit specs against hand-computed fixtures
(area-descending order with the id tie-break, the row wrap at
`max( widest, sqrt( totalArea ) * 1.25 )`).

Then the reusable surface: **`LayoutContext.packComponents( spacing )`**
— a translation-only post-pass over the scope: compact the scoped
leaves to sim indices the way force does, union-find over the scoped
edges, per-component bboxes at current positions, `shelfPack`,
translate members with the largest component's centre as the fixed
point (`packComponentsExact`'s contract).  Any extension layout gets
v3's `separateComponents` — the layout-utilities packing both flagship
apps ship as a bolt-on (the tenth sitting's ecosystem-demand shape) —
in one call.  The debug harness's `SpiralLayout` example calls it, so
the extension-contract demo demonstrates the helper too.  JSDoc with
all three gated tags; d.ts regenerated.

**Verified by** the `shelfPack`/`packAnchors`/`packComponentsExact`
unit specs; a contract spec — two disjoint K3s laid out overlapping,
`ctx.packComponents()` separates them (zero bbox overlap, gap >=
spacing), with the control skipping the call staying overlapped; the
import-graph spec; and the seeded force suite unchanged.

### 87.2 — the handoff decoupled from animate: always hand off

Executor choice becomes availability-driven; `animate` becomes what
its own doc line already says — "live display" — presentation only.
The decision at `force.mts:423` drops the animate conjunct: flat +
rendered + `startForce` available → the GPU integrator for **both**
animate values; compounds, headless and no-device keep today's paths,
and the CPU sim remains the correctness spec (the `force.mts:96-101`
stance, unchanged).

The mechanism for a *silent* run, verified against the code: `encode`
already takes its target buffer as a parameter
(`renderer.mts:1407-1413`), so a non-presenting run integrates into a
runtime-owned buffer while draws keep reading the untouched mirror
column — the screen holds the pre-run frame, no tween-owned fold, and
no per-tick readback (the architecture rule stands).  The existing
settle path (`runGpu`, `force.mts:522-561`) is unchanged in shape: one
readback, `finishForce`, one `setPositions` through the normal
dirty-span upload.  Redraw stays held while the runtime lives, since
frames drive the dispatches.

The named semantics change: `animate: false` on a flat rendered graph
goes synchronous → **async** (settle at `layoutstop` / `promise()`).
A caller reading positions on the next line breaks; the events and the
promise are the contract, as they already are for every other force
mode.  MIGRATING.md, CHANGELOG.md and the option's JSDoc all say so;
no sync opt-out spelling (headless *is* the sync spelling — recorded
as Open in case consumers surface).

**Verified by** an executor-parity spec in the round-65 shape — same
seeded graph, CPU settle vs silent-GPU settle agreeing on invariants
(component separation, edge-length distribution), not trajectories;
a Playwright spec that a silent run shows no intermediate motion —
poll-based, never sleep-to-offset: while the runtime is live a
screenshot equals the pre-run frame, then positions land at settle —
with the control forcing present-mode, which must show motion, and
allowance for the first-animate pipeline-compile stall; and a bench
row pricing what the round buys — sync-CPU settle wall clock (all of
it main-thread) against silent-GPU settle at N — batched with 87.3's
`layouts.mjs` edit so the fingerprint moves once.

### 87.3 — grid and preset stop lying about animate

Both take the finisher when a handle-demanding option is present:
grid's run already branches to its handle path on
`sort`/`position`/`eles` (`grid.mts:87-94`) — `animate`,
`animateFilter`, `transform` and the `ready`/`stop` callbacks join the
condition, and the handle path finishes through `eles.layoutPositions`
(the circle shape) instead of hand-emitting; the slot bulk path stays
for the bare call, which is the benchmarked one.  Preset likewise —
both its forms already produce a position per node, so the finisher
can own the animated case (and brings the `transform`/callback support
the hand-rolled path never had).  The two doc comments are corrected
to the truth in the same commit — they ship as hover text, so today
they are shipped defects regardless of which way the code goes.

**Verified by** grid and preset animate specs extending
`test/layouts.mjs`: animate settles at the same final positions as the
discrete write, `animateFilter` exempts, `transform` applies,
`ready`/`stop` fire — with the round-27 control (finisher branch
disabled once → red), `headlessWidth`/`headlessHeight` set throughout;
and the `layouts.mjs` grid rows unmoved on the compare page rather
than eyeballed.

### 87.4 — the harness forwards animate everywhere, and the promise chain stops throwing

`debug/layout.js`: the animate checkbox forwards for **every** named
layout (`seed` stays force-only); the timing chain guards
`typeof layout.promise === 'function'` so the six built-ins stop
throwing uncaught on every Apply; the `?layout=` load path forwards
the toggle instead of hardcoding force's; the checkbox joins
`paramDefs` beside `layout`/`seed` so an animate state is linkable;
and the label's "(force: hands the integrator to the GPU)" is reworded
— after 87.2 it is wrong twice over.  The option-assembly moves into
`debug/fixtures.js`-style extractable form only if it stays trivial;
either way `test/modules/debug-harness.mjs` pins what it can, and the
page gets opened once per discrete layout with animate on (the
"something has to open the page" rule — this item exists because
nothing ever had).

### 87.5 — the force option surface catches up

`ForceLayoutOptions` gains `componentSpacing`, `init`,
`nestingFactor`, `gravityCompound` with `force.mts`'s doc lines;
`npm run build:types`; the surface audit.  One small commit.

### Suggested further directions (recorded, not scheduled)

- **Per-component discrete layouts**: `packComponents: true` on
  circle/concentric/grid — run per component, shelf-pack the boxes.
  87.1's module makes it a small round; breadthfirst's interleaved
  depth rows are the strongest case.
- **Lifecycle unification**: one shape for whatever `cy.layout()`
  returns — the six built-ins lack `promise()`/`stop()` and are not
  emitters; 87.4 guards around the gap, a round should erase it.
- **Bulk tween for discrete animate**: the finisher's animate branch
  creates one Animation per node (`collection.mts:5377-5396`) — the
  wrong shape at 100k; a column-level position tween on the gpu-tween
  machinery could carry layout transitions.  Measure-first.

### Risks named at planning

- 87.2 touches the frame graph — drive `debug/` before and after, and
  the no-motion spec polls a state rather than sleeping to an offset
  (the frame-driver and compile-stall notes).
- The extraction is behaviour-neutral only if checked per function
  (the round-42 rule) — diff the moved bodies, then the seeded suite.
- grid's bare-call slot path is a benchmark headline: the finisher
  engages only on demand, and all `layouts.mjs` edits batch into one
  commit so the harness fingerprint moves once.
- The doc-comment corrections and option-type edits sit in
  stranded-doc-block territory — run the JSDoc gates per commit.
- Every new parity/no-motion/animate spec runs its control once
  (round 27); the ones planned are listed with their items.

**Open:** whether silent-GPU async needs a sync opt-out spelling
(recommended: no — headless is the sync spelling); `packComponents`
v1 scope — contract helper only (recommended) vs also an option on
the discrete layouts; whether the seeding (`seedAroundAnchors`,
`spectralSeed`) moves with the packing (recommended: stays
force-private); whether the built-ins gain `promise()`/`stop()` now
or in the unification round (recommended: the 87.4 guard now, the
round later).

