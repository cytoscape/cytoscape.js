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

**Decided at the eleventh design sitting (2026-09-28):** decluttering is
**off by default** (opt-in); **`label-priority` also drives the zoom
fade order**.  Edge labels and the property names are settled in the
round.

### The round, as carried out (2026-09-29)

Landed on the sitting's calls — off by default, `label-priority` driving
the fade order too — with the property names and edge labels settled in
the round (below).  Measured on the i9-9900K (16 threads, 63 GiB), Node
24.18 through tsx for the headless pass (the pass is renderer-internal,
so no bundle exports it); in the browser on the RX 580 through Chromium
with the harness's flags (`npm run gpu`: HARDWARE), the dev UMD bundle.

| # | Commit | What landed |
| --- | --- | --- |
| 104.1 | `19b2381d` | `src/render/label-declutter.mts` (the pass, pure and GPU-free), `benchmark/label-declutter.mjs` (the census, the price, the cell size, the flicker probe), `test/modules/label-declutter.mjs` |
| 104.2 | `efc59fd5` | `label-priority` (node prop, on the label entry) and the core `label-declutter` (a store scalar, carried to a worker renderer), `test/label-declutter.mjs`, the schema, types, inventory |
| 104.3 | `47dcb045` | the renderer: the label layer records each node run's rect, LOD height and priority; the gate buffer (`src/render/renderer/declutter.mts`) read by the glyph cull and the node label shader; exports declutter their own view; four browser specs; `src/README.md` "Label decluttering (round 104)" |
| 104.4 | `b468faa8` | the debug page's two knobs (Declutter; Label priority: degree), the page driven on both fixtures |
| 104.5 | this commit | the close: CHANGELOG, this record, PLAN.md, the summary |

**The plan's references, re-checked.**  `labelFadePx` / `labelMinPx`
are at `src/public-types.mts:895-899` now (the plan's 537-545 predates
eight rounds of growth); "nothing in `src/render/` knows whether two
labels overlap" held.  The sequencing note's "38 (CJK)" is ledger item
38, still open, and round 94 (label fidelity under zoom) landed on
2026-08-18; the pass reads the laid block whatever shaping produced it,
so neither interleaves.

**Measure first** (`node --import tsx benchmark/label-declutter.mjs`;
the debug page's 930 × 900 canvas, dpr 1, each fixture under its own
page sheet and fitted; label rects from the same helper the label layer
uses, over the store's canvas-free dims; degree as the priority):

1. *The census.*  Under the page sheets nothing draws at fit — em-web's
   8 px font is past the fade, ndex-x-large's `min-zoomed-font-size` 9
   hides every label — but the soup is one zoom step away: ndex-x-large
   at 2× fit draws 14,092 labels and **100%** overlap another.  With its
   floor removed — what an app does once decluttering exists — it draws
   all **19,607 at fit, 99.4% overlapping**.  em-web at 2× fit (floor
   off) draws 79, 54.4% overlapping.  The cull keeps 1,545 at fit and
   819 at 2× on ndex-x-large, 50 on em-web — zero overlap among them.
2. *The price.*  A pass is **1.66 ms at 19,607 labels** (0.05–0.2 ms on
   em-web).  The sort the plan suspected is paid only when a priority or
   the labelled set changes (3.8 ms at 19.6k): each pass walks the
   prebuilt order and merges incumbents and challengers linearly.  In
   the page, through a 40-frame pan: 1.6 ms median (p90 2.1) at fit with
   the floor off, 2.0 ms (p90 2.7) at 2.2× fit.  Inside the frame, so
   **CPU-only; no GPU variant is logged** (the plan's rule: only if the
   CPU pass missed budget).
3. *The flicker probe*, 60 frames on ndex-x-large (em-web in brackets):

   | variant | slow pan, strobes | slow zoom, strobes |
   | --- | --: | --: |
   | screen-anchored grid, no hysteresis | 27,349 (116) | 36,926 (267) |
   | model-anchored grid, no hysteresis | **0** (0) | 36,703 (227) |
   | + rank margin 0.1 (the plan's hysteresis) | 0 | 21,095 (217) |
   | + rank margin 1 | 0 | 12,315 (217) |
   | + one-cell inset for incumbents | 0 | 439 (0) |
   | both (the defaults) | 0 | **142** (0) |

   (a strobe: a label that flips back within the window; a label that
   appears once as the zoom grows is not one.)

**The calls taken in the round, and why.**

- *The grid is anchored in model space*, not the screen: the plan's
  "screen-space occupancy" kept for the cell size (4 CSS px), but the
  cell edges sit at multiples of it in model px.  Labels are
  model-space, so overlap is pan-invariant and the anchored grid makes
  the whole decision so — the pan column above.  Not in the plan; the
  probe made it the first fix.
- *Hysteresis in two halves.*  The plan's margin ("a shown label keeps
  its claim until the challenger beats it by a margin") is kept, in rank
  units (0.1), but alone it left a zoom strobing; what re-quantization
  needs is spatial — an incumbent tests its rect inset by one cell and
  stamps all of it.  The band it buys: an incumbent may keep up to one
  cell of overlap before it yields.
- *Cell size 4 CSS px*, the knee: 8 px tripled the false culls (a culled
  label touching no shown one) on ndex-x-large at fit, 992 → 2,853; 2 px
  halved them for 14% more time.
- *The property names: the plan's* — `label-priority` (node prop,
  mapper-able, default 0) and `label-declutter` (`none` | `cull`), the
  latter a **core** prop: the pass is scene-level, like round 102's
  `dim-opacity`, and travels the same way (one store scalar, one worker
  batch field).
- *Edge labels do not join this round*: the plan's lean ("their rects
  move with routing"), and the edge glyph cull is at the 8-storage-buffer
  budget with no slot for the gate.  `label-priority` is node-only (the
  edges group rejects it); node labels ignore edge labels when they
  claim.
- *The fade order*: a label's fade band is `labelFadePx × k`, k = 1 +
  (1 − rank), rank = 1 − (labels strictly above) / (n − 1) — so ties
  share a rank, an unprioritized graph ranks every label top (k = 1:
  today's band, bit for bit — every golden stayed exact), and the
  lowest rank fades over [F, 2F].  The lowest ranks fade *earlier*
  rather than the top ones later, so no label is kept below today's
  readable floor.
- *The emphasized set* (round 102's follow-up, taken — small and
  natural): it claims before every priority and fades on the top band.
- *The sheet diff* (round 133): `label-priority` has no narrow writer,
  like every label prop, so a sheet that changes it takes the full pass
  for its def.  Recorded, not built: a priority-only sheet change is not
  a hot path, and a narrow writer would rebuild the label entry anyway.
- *Membership*: the pre-fade set, as the plan asked — shown, above the
  floors, fade > 0 on the label's own band, inside the viewport plus a
  128 CSS px margin; a label outside the region is undecided and
  undecided never draws.
- *Exports* declutter their own view (the figure's region and LOD scale,
  the screen's grid, seeded with the screen's winners), so a `png()` of
  the viewport shows what the screen shows; the screen's state is not
  disturbed.
- *Renderer-local by contract*: the winners are never stored, serialized
  or readable through the public API.  A culled label's box stays in
  `boundingBox()` and in a `text-events` pick.

**Controls.**  The module spec (`test/modules/label-declutter.mjs`):
swapping two priorities swaps the winner; a label faded to nothing stops
claiming while a half-faded one claims; the pile's overlap with the cull
off is the census re-run; a screen-anchored grid re-decides under a
sub-cell pan and the model grid does not; without the inset a zoom
strobes.  Mutations: screen-anchoring the grid, dropping the inset and
skipping the fade in membership each fail their spec.  The props spec
(`test/label-declutter.mjs`): dropping `priority` from the entry's
equality fails the re-queue spec; dropping the store push fails the core
and worker specs.  In the browser (`renderer.spec.js`, four specs): a
cull that ignores the gate draws the loser (625 px of it) and fails the
pile's ink bound; a shader that fades on the unscaled band draws both
fade-order labels whole (85 / 85 px); a pass that skips the fade in
membership leaves both labels hidden past the band; an export that
reuses the screen's gate draws nothing off screen.  The renderer and
visual projects are green (339), every golden exact.

**On the page** (104.4): ndex-x-large at 2.2× fit goes from a solid field
of 108,849 glyphs to 987 legible labels, the hubs among them; em-web's
stacked "antigen processing and presentation" labels resolve to the two
highest-degree ones.

**Deferred, logged as follow-up hooks in `src/README.md`**: edge labels
in the pass (a gate slot for the edge glyph cull, rects that follow
routing); a per-element opt-out; padding between labels as a prop; and
the census's other reading — at fit the page sheets draw no labels at
all, so what an app wants there is the top-ranked few, which the fade
order gives only as far as its band reaches.  Nothing was blocked, and
no ledger item was raised.

**Gates at the close**: `npm run -s test:node:quiet` green (zero bytes);
`test:types:run` and `test:types:surface:run` green; plan-record,
agent-docs, feature-inventory, status-features and migration-guide
green (plan-record had used round 104 as its example of a planned
round — it now names round 105 for that, and 104 as landed); the
renderer and visual Playwright projects green with every golden exact;
`git worktree list` shows the main tree only.
