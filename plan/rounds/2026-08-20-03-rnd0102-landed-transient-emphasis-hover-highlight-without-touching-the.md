## Transient emphasis: hover highlight without touching the sheet

The gesture every flagship app implements: hover or select a
node, emphasize its neighbourhood, dim everything else, restore
on leave — re-evaluated on every mousemove.  What v4 gives them
today, verified:

- The interact tier already runs a throttled hover pick and
  drives `FLAG_HOVERED` (`src/interact/pointer.mts` `hoverPick`,
  ~:1563; `::hovered` in `src/contract.mts:137`), so the hovered
  element *itself* is sheet-addressable state.
- The other half — membership of "the hovered neighbourhood" and
  "everything else" — is not expressible as a state condition:
  v4 has no classes by decided design (`src/README.md:1303`), so
  an app must write per-element state on every hover change —
  round-63 bypasses over the neighbourhood plus a dim over the
  rest, or a data field every element's mapper reads.  Both are
  whole-graph writes per mousemove: the exact shape round 60.4
  had to rescue for select (banded select+unselect 53.7 µs on
  the diff path against 392 µs when a lone id clause nulled the
  partition).

Two candidate designs, both carried to the measurement because
they trade different things:

- **(a) Emphasis as store state.**  New flag bits
  (`FLAG_EMPHASISED`, `FLAG_DIMMED` — or one bit with "dimmed is
  everyone else" as a sheet-side reading), a bulk setter
  (`cy.emphasize( eles )` / `eles.emphasize()`) that writes the
  flag delta as one diff pass, and the sheet conditions on the
  new pseudo-states like any other.  Reuses the 60.4/61 diff
  machinery, keeps stored truth and `style()` readback honest,
  and the app decides what dimming *looks like* in its own
  sheet.  Cost: a banded style reapply per hover change, and two
  contract bits (a `src/contract.mts`-first change, its own
  rule).
- **(b) Emphasis as a renderer overlay.**  A per-element u8
  column consumed by the shaders as a compositing factor (dim
  multiplies toward a configured colour/alpha; emphasized draws
  unchanged or brightened — the shader hover-brighten precedent
  exists), written straight from a collection and never entering
  the style engine.  Cheapest per-event cost by construction,
  but it is a second styling mechanism beside the sheet — the
  thing rounds 8/29.3 spent removing — and `style()` readback
  would not see it, which demands an explicit "transient view
  state, never truth" contract if it is chosen.

The measurements decide, through the built bundle at
ndex-x-large scale (19,607 nodes / 464,657 edges):

1. **The app spelling today**: bypass-based neighbourhood
   emphasize + rest-dim per hover change — µs per mousemove, and
   whether it holds a moving pointer at 60 fps.  If this already
   fits the frame budget, the round collapses to a documented
   recipe plus at most the bulk-setter sugar.
2. **Design (a)**: flag delta + banded reapply for a typical
   neighbourhood (degree ~10) and for a hub, since the hub is
   what an app actually hovers.
3. **Design (b)**: column write + upload cost, and the full-frame
   shader cost of the multiply.
4. **The query itself**: `neighborhood()` per mousemove at that
   scale — if the query dominates, the fast path needs a
   slot-native neighbourhood walk, not a style mechanism.

Controls named at planning: the perf spec asserts the *shape* —
per-event cost O(neighbourhood), not O(V), pinned by measuring
two graph sizes and asserting the ratio; if (b) is chosen, the
dim look gets a golden built the round-56 way (a scene where the
dim is what the pixels measure, degrade control proving it).

**Open (maintainer):** whether dimming is a style concern
(design a, sheet-visible) or a view concern (design b, overlay)
— the same instinct as the CX2 line, applied inward; whether the
setter is core API or the first `cyext` gesture example (round
71 wants a non-layout validation case); naming — emphasize /
highlight / spotlight — and whether `::dimmed` is derived or
set; whether select gets the same treatment ("dim unselected")
in the same round.

**Decided at the eleventh design sitting (2026-09-28):** emphasis is
**core API**; design (a) store state versus (b) renderer overlay is
**decided on this round's measurements**.  Naming, a derived `::dimmed`
and "dim unselected" are settled in the round.

### The round, as carried out (2026-09-29)

Landed on the sitting's calls — core API, the design decided by this
round's measurement — with naming, a derived `dimmed` and "dim
unselected" settled in the round (below).  Measured on the i9-9900K (16
threads, 63 GiB), Node 24.18, through the built ESM bundle; the GPU
figures on the RX 580 through Chromium with the harness's flags (`npm
run gpu`: HARDWARE).

| # | Commit | What landed |
| --- | --- | --- |
| 102.1 | `35063209` | `benchmark/emphasis.mjs`: the app spelling, both designs and the query, priced before any API existed |
| 102.2 | `0d3745b9` | `FLAG_EMPHASIZED` + `'::emphasized'` (contract first), `cy.emphasize()` / `cy.unemphasize()` / `eles.emphasized()` (`src/core/emphasis.mts`), the `emphasized` state and query key, the core `dim-opacity`, `store.emphasisDim()`, `test/emphasis.mjs`, the schema, types, inventory |
| 102.3 | `453162df` | the two-tier renderer: `emphasisKeeps` in every cull kernel, the veil (`src/render/emphasis-veil.mts`), the tier (`src/render/renderer/emphasis.mts`) on screen, in exports and through the worker; the browser specs and the `emphasis-tiers` golden |
| 102.4 | `2a88205c` | the debug page's Emphasize mode, the benchmark's (a)-row fix and API rows, `src/README.md` "Transient emphasis", MIGRATING, CHANGELOG, the harness note |
| — | `997adf07` | drive-by: `test/types-surface.mjs` lists round 75's two exports (red since round 75; confirmed pre-existing with this round stashed) |
| 102.5 | this commit | the close |

**The plan's references, re-checked against a tree ten rounds newer.**
The hover pick is `hoverPick` in `src/interact/pointer-hover.mts` since
round 130's split (the plan's `pointer.mts:1563`); `'::hovered'` is at
`src/contract.mts:180`; "no classes" is `src/README.md:2618`.  The claims
held: `FLAG_HOVERED` is sheet-addressable, and an app's only spelling of
"the rest" was a whole-graph write.  Item 55's note — the debug page's
hover panel is the app spelling, "belongs in 102's first measurement" —
is that measurement's first two rows.

**Measure first** (`node benchmark/emphasis.mjs`, ndex-x-large: 19,607
nodes / 464,657 edges from the wire form; seven hover changes per row,
medians; a typical node — degree 11, closed neighbourhood 23 — and the
hub — degree 733, 1,422 — since the hub is what an app hovers; each row
asserts its end state and reports the dirty bytes a renderer would
upload):

| row | typical | hub | dirty per change |
| --- | --: | --: | --: |
| query `closedNeighborhood()` | 0.025 ms | 0.64 ms | — |
| query the rest, `elements().not()` | 46 ms | 52 ms | — |
| app: opacity bypass over the rest (today) | 2,922 ms | 2,888 ms | 3.9 MB |
| app: `hide()` the rest (today) | 171 ms | 164 ms | 3.9 MB |
| (a) dim as a state bit over the rest | 1,125 ms | 1,142 ms | 7.7 MB |
| (a) the neighbourhood's records only | 0.054 ms | 2.7 ms | 4.7 / 7.2 MB |
| (b) `cy.emphasize` + `unemphasize` | **0.015 ms** | **0.42 ms** | 2.3 / 3.6 MB |
| (b) + a sheet styling `emphasized` | 0.14 ms | 4.3 ms | 5.4 / 8.2 MB |

The plan's rule: if the app spelling fit the frame the round would
collapse to a recipe — it is 2.9 s (and `hide()` 164 ms), so it does
not.  Design (a)'s neighbourhood delta is cheap, but a dim that is a
style — set on every non-emphasized element, *or derived* from "an
emphasis is on" — rewrites every element's record on the frame the
emphasis turns on or off: 1.1 s here (the edge `opacity` has no narrow
writer, so each edge takes the full `write()`), and no writer makes an
O(V) toggle fit a frame at 484k elements.  The query does not dominate
(0.64 ms at the hub), so no slot-native neighbourhood walk was needed.
**The call: (b) for the dim, (a)'s O(set) half for the emphasized
set.**  The set is a styleable, queryable state bit; everything else is
dimmed by the renderer as one composite, and the second tier's GPU cost
is the plan's third measurement: on the debug page on ndex-x-large,
fitted, the hub's neighbourhood emphasized, median `gpuFrameMs` over 40
frames went **6.54 → 7.18 ms** (+0.64 ms) and back to 6.54 on
`unemphasize()`.  The page's console timed a hover change at 0.08–0.21
ms apply and 0.01 ms restore.

**How (b) was built.**  Not a per-element compositing column: every
cull kernel already reads its owner's flags word, so the Frame uniform
gained one field (`emphasisPass`) and the WGSL prelude one predicate
(`emphasisKeeps`); while an emphasis is set the scene culls twice — the
dimmed tier (elements without the bit) and the emphasized tier (only
those with it) — and a fullscreen veil between the two passes
composites the first at `dim-opacity`.  The veil is `dst·k + under·(1 −
k)`: a plain scale on screen (the canvas clears transparent, so the
page shows through a dimmed region as through any translucent element)
and, with `under` the export's premultiplied `bg`, the exact
`k·S + (1 − k·Sa)·B` in a `png()`/`jpg()`.  The second tier's pass
clears depth, so the emphasized set draws above the rest — the single
boolean elevated tier `src/README.md`'s no-z-index record logged, used
for this alone.  One WGSL lesson: the first draft named the predicate's
parameter `pass`, a WGSL reserved word, and every cull shader failed to
compile — the renderer spec's validation-error gate caught it on its
first run.

**Calls taken in the round** (the sitting left these to it):

- *Naming* — the plan's own spelling: `emphasize` / `unemphasize` /
  `emphasized` (American, as `neighborhood()`), and the core prop
  `dim-opacity` (default 0.15, the debug page's figure).
- *`dimmed` is derived, never stored* — "an emphasis is set and this
  element is not in it" — and has no state or query key: a sheet rule
  on it would be the O(V) toggle the measurement ruled out.
- *Replace, not add*: `cy.emphasize( eles )` replaces the set (only
  what enters or leaves is written; an element in both is not flipped),
  and there is no additive `eles.emphasize()` — a second write path
  into one view state would make "what is emphasized" depend on call
  order.  An empty collection is an emphasis (everything dims); the
  emphasis survives removals and adds until `unemphasize()`.
- *"Dim unselected"* gets the same API, not a mode:
  `cy.emphasize(cy.elements({ selected: true }))` on `select` /
  `unselect` is O(selection) per change.
- *Emphasis is view state* (round 106's "a clone owns its view
  state"): not serialized, not carried by `clone()`, kept by `patch()`
  on survivors and never read from a payload; a worker renderer
  receives `emphasisDim` as one more batch scalar.  *Exports draw it*
  (a figure is what the screen shows), which is what made the veil
  take `under`.
- *Picking ignores it*: a dimmed node still picks and hovers, and where
  a raised edge crosses a dimmed node the node wins, by `pick()`'s
  documented structural order.  `viewportCounts()` sums both tiers; the
  GPU frame timer's reading spans both passes.

**Controls.**  `test/emphasis.mjs` counts the per-element work of a
hover change (refs visited by the store's bulk flag writer) at two
graph sizes ten times apart and asserts it equal — 54 both ways — a
counted probe rather than a timing, since `node:test` runs files
concurrently; the control, the dim-bit spelling under the same probe,
grows 11.1×, and a probe-sees-the-write control guards the probe.
Mutations run against it: clearing the whole previous set fails the
"in both sets" spec; an O(V) write inside `emphasize` fails the shape
spec; dropping the `dim-opacity` push fails the core-prop spec.  In the
browser: with the veil removed the rest reads (0, 0, 255) where the
spec wants ≈ (217, 217, 255); without the second tier the set is gone;
with the export's `bg` ignored the dimmed body reads (0, 0, 38); the
`emphasis-tiers` golden — built so the dim is what the pixels measure:
a large saturated labelled rest, a compound in the dim, a translucent
node and a raised spoke in the set — moves **11.409%** at
`dim-opacity` 0.25 and **8.069%** without the second tier; the worker
host's export equals the same-thread one exactly, and with the scalar
kept from crossing it fails its "differs from the plain scene" check.
The renderer and visual projects are green with every existing golden
exact (an emphasis-free frame culls with `emphasisPass` 0).

**Deferred, logged as follow-up hooks in `src/README.md`**: a dim
colour (the veil composites toward the background; a tint needs a
second constant), an `emphasize` event, a transition on the dim (it
switches in one frame), and round 104's label priority for the
emphasized set.  Nothing was blocked.

**Gates at the close**: `npm run -s test:node:quiet` green (zero
bytes); `test:types:run` and `test:types:surface:run` green (the
latter after the drive-by); plan-record, agent-docs,
feature-inventory, status-features and migration-guide green; `git
worktree list` shows the main tree only.
