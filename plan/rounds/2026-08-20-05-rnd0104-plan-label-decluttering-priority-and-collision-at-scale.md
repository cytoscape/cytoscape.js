## Label decluttering: priority and collision at scale

Verified: label LOD is zoom-fade only — `labelFadePx` /
`labelMinPx` (`src/public-types.mts:537-545`) — and nothing in
`src/render/` knows whether two labels overlap.  At fit zoom on
a large graph the label layer is soup, which is why apps hide
labels wholesale; GeneMANIA's actual requirement is sharper and
better: *the top-ranked genes are always labelled*.  v3 has
nothing here either, so this is a v4 deviation-by-addition,
documented as such.

Three pieces:

- **Priority, data-driven.**  A style property
  (`label-priority`, mapper-able — `data( score )`, degree, or a
  constant per group), so importance comes from the graph, not
  from insertion order.  Ties break by slot for determinism.
- **The cull.**  A screen-space occupancy pass over the drawn
  labels, highest priority first — greedy grid, not exact
  geometry: a label claims its screen rect's cells, a
  lower-priority label that would land on claimed cells is
  culled (hidden, not faded — a half-faded loser reads as a
  rendering bug).  Runs on viewport settle and on label
  dirtiness, CPU-side first: the drawn-label count at fit is
  what the census below measures, and a GPU variant is a logged
  follow-up only if the CPU pass misses budget.
- **Stability.**  Hysteresis — a shown label keeps its claim
  until the challenger beats it by a margin — so slow pans do
  not strobe winners; winners deterministic across frames at
  fixed viewport.  This state is renderer-local by contract
  (never stored truth, never serialized, never readback).

Measure first:

1. The census: drawn labels at fit on em-web and ndex-x-large,
   and what fraction overlap another label's rect — the number
   that says how bad the soup actually is.
2. The greedy pass's cost at those counts (it is a sort plus a
   linear claim walk; the sort is the suspect).
3. A scripted-pan flicker probe: winners across 60 frames of a
   slow pan, count of flips without hysteresis and with.

Sequencing note: rounds 38 (CJK) and 94 (label fidelity under
zoom) touch the same pipeline; this round is orthogonal to both
(it decides *whether* a label draws, they decide *how*), but the
three should not interleave mid-flight.

Controls: the cull spec renders a dense scene with the cull
disabled and asserts the overlap count jumps (the control *is*
the census re-run); the priority spec swaps two elements'
priorities and asserts the winner swaps; the fade interaction is
pinned by a spec at the fade boundary — cull decides membership,
fade decides alpha, and the order (cull sees the pre-fade set)
is asserted, not assumed.

Named file: `src/render/label-declutter.mts`.

**Open (maintainer):** default off (recommended for 4.0 —
opt-in via `label-declutter: cull`, default `none`) or on;
whether edge labels join in the same round (they overlap worst,
but their rects move with routing); the property names; whether
the priority property should also drive the *fade* order at the
LOD boundary (probably yes, and cheap, but it changes an
existing behaviour).

