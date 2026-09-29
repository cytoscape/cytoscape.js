## Ledger item 30, tier 2: the degrade control — what the goldens set and do not see

Ledger item 30's second tier, taken as a round.  There was no plan file:
the spec is the item's text in `PLAN.md`, its line in the eleventh
sitting's note
(`2026-09-28-01-rnd0000-note-the-eleventh-design-sitting-the-open-calls-one-by-one.md`)
and round 135's record, which built tier 1.

The item (raised 2026-08-19): tier 1 enumerates which style properties
the goldens set to a non-default value.  Tier 2, for the
exercised-but-occluded class: "a scripted degrade control — reset one
property to its default, re-render, count pixels moved — run over a
chosen subset, since a property that moves zero pixels when deleted is
decoration in that scene."  Round 137 (the WebGL2 renderer) wants it
before its first commit, so both backends are held to the same
inventories.  Round 76 had just added the `label-border-styles` golden:
tier 1 read 145 of 216 properties set, 71 not.

**Call taken (2026-09-28, the eleventh sitting): tier 1 before the SVG
and WebGL parity work; the degrade control later** — now, ahead of round
137.

### The round, as carried out (2026-09-29)

Measured on the i9-9900K (Fedora 43, Linux 7.1), Node 24.18, Playwright
1.61.1, the `visual` project's pinned SwiftShader adapter, 8 workers.

| # | Commit | What landed |
| --- | --- | --- |
| 143.1 | `581b60b3` | three library bugs the control exposed, each with a regression that fails without its fix |
| 143.1 fix | `5ba645a5` | the throw audit's line anchor, which 143.1's mirror change moved (found by the close's `test:node:quiet`) |
| 143.2 | `d8401d58` | the control, its records and gate; the capture corrected; one scene and the test page fixed; item 90 logged |
| 143.3 | this commit | the close (and round 137's plan told its prerequisites landed) |

**The control, as built** (`playwright-tests/lib/degrade-control.mjs`).
It runs inside the golden pass — `DEGRADE_CONTROL=1 npx playwright test
visual.spec.js --project=visual -g golden` — from `checkGolden`, after
the golden's PNG and its coverage record have both matched, on the same
live scene:

- **The reset.**  For each (group, property) pair the coverage record
  lists, every element whose value differs from the default is bypassed
  to the value a default-sheet leaf, compound parent or edge reads (the
  references tier 1 judged against).  Where a bypass is refused — the
  label font is global, and a default that reads `''` (no gradient
  stops, no colour scheme) is no value a bypass takes — the sheet is
  re-set with the property deleted from the group's block, conditions
  included (29 of the pairs).  A reset that leaves the value unchanged
  is recorded, so a pair can never read "zero pixels" because nothing
  was changed.
- **The count.**  The scene is re-exported with the golden's own export
  options until two consecutive exports agree (a label change
  re-rasters the atlas a frame later), and the pixels whose RGBA bytes
  differ from the baseline are counted — raw bytes, since pixelmatch's
  anti-aliasing detection drops exactly the one-pixel fringes a thin
  stroke moves.
- **The restore.**  The bypass is removed (a scene bypass the removal
  took is given back) or the sheet re-set, every value is read back, and
  the frame is re-exported.  A value that does not return stops the
  scene; a frame that does not quite return with every value back is a
  `residue`, and the pairs after it are measured against the restored
  frame (one: `images-multi`'s `background-image`, 624 px — item 90).
- **The records** land in `playwright-tests/golden-degrade/<name>.json`.
  `scripts/golden-coverage.mjs` reads them (`degradeReport`, printed
  under `--verbose`), and `test/modules/golden-coverage.mjs` holds each
  current against its coverage record — a golden that gains a property
  fails until the pass is rerun — pins the counts, and requires every
  zero-pixel pair to be argued for: `INTENDED_DECORATION` (moved a value
  that draws nothing, on purpose) or `UNMOVABLE` (no reset moves the
  value).  Controls: a planted zero classifies as decoration, a planted
  unmoved reset as unmovable, a dropped pair reads stale.

**The subset, and how it was chosen.**  The item said "a chosen subset"
because the cost was unknown.  Measured first on one golden
(`nodes-edges-arrows`, 10 pairs, 10 s including the golden), then on
all: **every exercised pair of all 51 goldens runs in 2.2 min** at 8
workers.  So the chosen subset is all of it — the 530 pairs tier 1
records (after the corrections below), none sampled out, the
no-static-pixel properties included (they are expected to move nothing,
and none of them is set by any golden).

**What the first passes found.**  The first pass reported 40 zero-pixel
pairs of 545.  Half were resets that never landed, and reading why was
most of the round:

- **Three library bugs**, fixed in 143.1 with regressions that fail
  without their fix:
  - *A bypass over a kernel-mapped colour never reached the screen.*
    `mapped-colors`' viridis fill: 0 px, and `style()` read the mapped
    value back.  The first bypass demotes the channel and re-derives
    every slot on the CPU at once, but the column mirror skipped those
    spans as kernel-owned, and when the runtime's repack cleared the
    ownership on the next frame nothing re-uploaded the column — the
    node drew its mapped colour for good.  `ColumnMirror.setGpuOwned`
    re-uploads a column leaving ownership whole; a bypassed channel reads
    its stored bytes, never the mapper's lazy evaluation.  A renderer
    spec polls the pixel red and back (without the fix: `0,0,255`).
  - *A rotation-only label change was dropped* — a bypass, a data write
    under a mapper, a sheet swap: the label record's no-op check compared
    every field but the angle (`label-outline-words`' rotated word: 0 px,
    read back 0.663).
  - *A custom polygon's `corner-radius` read its point-record ref* as a
    radius (`196608.0234375`); it reads the sheet's value now.
- **Three capture over-counts**, fixed in the capture
  (`style-coverage.mjs`), each with a spec the old capture fails:
  - a labelled element's `text-background-color` and
    `text-border-color` read back with their opacity folded in
    (`rgba(0,0,0,0)` by default) where the unlabelled reference reads
    `rgb(0,0,0)`, so both counted as set in every labelled golden —
    labelled elements are judged against a labelled reference now;
  - a parent's `width` and `height` read back its auto-sized box;
  - a per-image list of defaults (`node node node node`) did not read
    as the default.
  **Tier 1 moves from 145 to 140 of 216**: `background-clip`,
  `background-image-containment`, `background-image-smoothing`,
  `background-offset-x` and `background-repeat` were never set by any
  golden.  The paintable gaps rounds 77 and 137 are held to are 57, not
  52.
- **The worst scenes**, fixed:
  - `label-outline-closeup` inherited the words scene's label box, which
    its one element never draws (background opacity 0): both box
    properties moved 0 px.  The close-up no longer sets them, and its PNG
    is byte-identical, as the 0 px said.
  - `labels-bold-italic`'s `font-weight` moved 0 px because the test page
    declared only the bold italic face, which an italic of normal weight
    matched.  The page declares the regular italic too; the reset now
    moves pixels.

**The measurement, after them.**

| | |
| --- | --: |
| (golden, property) pairs reset | 530 |
| moved pixels | 520 — median 2.6% of the frame, least 0.03%, most 33% |
| decoration (moved a value, no pixel) | 3, all by design |
| unmovable (no reset moves the value) | 7 |
| exercised group-properties that move pixels in some golden | 131 of 140 |

The three decoration pairs are argued for: `label-border-styles`' two
`mid-*-arrow-width` (mid heads are always filled and the width strokes a
hollow head only — item 21, v3 too; the scene sets them so the record
counts them), and `self-loops`' `curve-style`, whose scene claims that a
straight-styled loop still draws as a loop — resetting it must move
nothing.  The seven unmovable: the four `padding-*` sides, set through
the `padding` shorthand a sheet reset leaves (compound props are
parents-group constants, so no bypass can name one), the two gradient
stop positions and `chart-colors`, which read back the values their
neighbours imply.  So the lower bound tier 2 adds to tier 1's upper one:
**131 of 216 properties have a golden pixel riding on them**; 140 are
set.

**Calls taken in-round.**

- **Default = what a default-sheet element reads**, not the schema's
  default, so the reset is what the element would resolve with the
  property absent from the sheet — and per element kind, since a parent's
  defaults are v3's `:parent` ones.
- **Bypass first, sheet second.**  A bypass isolates one property on
  exactly the elements that set it; the sheet path is the fallback and
  says so in the record (`via: 'sheet'`).
- **The capture was corrected rather than the counts excused.**  Each
  over-count had a mechanism and a spec; `UNMOVABLE` is kept for the
  read-backs that are resolved values by design (item 90 asks whether
  they should be).
- **Records per golden, not one report**, so a golden's record is
  regenerated with it and the gate can name the stale one.

**Deferred.**  Item 90: the read-backs the control saw disagree with the
screen — the folded label-box colours, an end-label-only edge whose text
channels read the sheet not the element (the render is right), the
`images-multi` restore residue — and whether the derived read-backs
should report the declared value.  The core group is not degraded (no
golden sets a core property; tier 1 counts 0 of 9).

**Verification.**  The golden pass green in normal mode (every PNG
unchanged, the close-up's included) and under `DEGRADE_CONTROL=1`;
`test/modules/golden-coverage.mjs` 19/19; the `renderer` and `visual`
Playwright projects whole after both rounds (391 passed, 1 skipped, in
3.7 min); `npm run -s test:node:quiet` green (zero output) — after one
fix: its first run failed the throw audit's line anchor for the
mirror's unreachable throw, which 143.1's re-upload had moved.
