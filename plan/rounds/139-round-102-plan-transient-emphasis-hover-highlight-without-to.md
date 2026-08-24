## Round 102 plan — transient emphasis: hover highlight without touching the sheet (proposed 2026-08-20)

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

