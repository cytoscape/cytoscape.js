## Ledger item 30, tier 1: what no golden sees, enumerated

Ledger item 30, taken as a round.  There was no plan file: the spec is
the item's text in `PLAN.md` and its line in the eleventh sitting's
note
(`2026-09-28-01-rnd0000-note-the-eleventh-design-sitting-the-open-calls-one-by-one.md`).

The item (raised 2026-08-19): the visual suite is ~50 goldens plus the
parity scenes, and a golden only measures what is not painted over.
Nothing enumerated the inverse — which style properties have *no pixels
riding on them at all*.  Tier 1 instruments the style engine while the
golden scenes render, records which (property, non-default value) pairs
are exercised, and diffs that against the full property list.  Tier 2,
the scripted degrade control (reset one property to its default,
re-render, count moved pixels), is for the exercised-but-occluded class.
**First measurement**: the count of style properties for which no
golden scene sets a non-default value.

**Call taken (2026-09-28, the eleventh sitting): before the SVG and
WebGL parity work, tier 1 first** — the unexercised-property count,
ahead of rounds 77 and 73; the degrade control later.

### The round, as carried out (2026-09-29)

Landed the day after the sitting, on its call.  Captured on the i9-9900K
(Fedora 43, Linux 7.1), Node 24.18, Playwright 1.61.1, the `visual`
project's pinned SwiftShader adapter.

| # | Commit | What landed |
| --- | --- | --- |
| 135.1 | `cb2fe234` | the capture: every golden records its exercised properties, held to the record like the PNG |
| 135.2 | `d3b21db7` | the enumerator, the gated count, the docs |
| 135.1 fix | `1d484f6b` | the status site's goldens gallery reads the page-first `checkGolden` call |
| 135.3 | this commit | the close (with round 136's) |

**The first measurement.**  Over the 50 goldens, **137 of 212 style
properties are exercised; 75 are never set to a non-default value by
any golden** — 56 of them paintable, 19 that no static frame can show.

| group | exercised / universe |
| --- | --: |
| nodes | 76 / 99 |
| parents (the compound props) | 5 / 9 |
| edges | 56 / 95 |
| core | 0 / 9 |

The 56 paintable gaps — the list rounds 77 (SVG export) and 73 (WebGL)
are held to:

- *nodes (16)*: `background-opacity`, `border-dash-offset`,
  `border-opacity`, `border-position`, `chart-opacity`,
  `label-priority`, `min-zoomed-font-size`, `overlay-corner-radius`,
  `text-justification`, `text-opacity`, `text-outline-opacity`,
  `text-overflow-wrap`, `text-transform`, `underlay-corner-radius`,
  `underlay-shape`, `visibility`.
- *parents (4)*: `compound-sizing-wrt-labels`, `min-height`,
  `min-width`, `padding-relative-to`.
- *edges (34)*: `control-point-weight`, `line-cap`, `line-dash-offset`,
  `line-dash-pattern`, `line-height`, `line-outline-color`,
  `line-outline-width`, `min-zoomed-font-size`, `opacity`,
  `radius-type`, `source-arrow-width`, `source-text-margin-x`,
  `target-arrow-width`, `target-distance-from-node`,
  `target-text-margin-x`, `target-text-margin-y`, `taxi-track`,
  `taxi-track-spacing`, `taxi-turn-min-distance`,
  `text-background-shape`, `text-border-opacity`, `text-border-width`,
  `text-justification`, `text-margin-x`, `text-margin-y`,
  `text-max-width`, `text-opacity`, `text-outline-color`,
  `text-outline-opacity`, `text-outline-width`, `text-overflow-wrap`,
  `text-transform`, `underlay-padding`, `visibility`.
- *core (2)*: `dim-opacity`, `label-declutter`.

The 19 no static golden can show: `events` and `text-events` (pointer
behaviour), the four `transition-*` on each group (a golden is one
settled frame), `active-bg-*` and `selection-box-*` (press and
box-select chrome), `background-image-crossorigin` (a fetch mode, moot
for same-origin images).

One level further, **67 non-default keywords no golden shows** — the
largest runs are the mid arrows (ten missing on each of
`mid-source-arrow-shape` — `triangle` included — and
`mid-target-arrow-shape`), `source-arrow-shape` (eight: every head but
`triangle`, `chevron` and `circle`, the `arrow` alias aside), and four each of
`padding-relative-to`, the gradient directions and `taxi-direction`.  The whole list prints with
`node --import tsx scripts/golden-coverage.mjs --verbose`.

The item expected the number to be embarrassing.  It is a third of the
surface, and two things in it are this month's work: **rounds 102 and
104 landed with no golden** — the emphasis golden draws the default
`dim-opacity`, and nothing golden sets `label-declutter` or
`label-priority` (both rounds' pixel specs live in `renderer.spec.js`,
which pins probes, not frames).  And whole families the WebGL port
will re-implement — end-label margins, text outlines and borders on
edges, dash patterns and caps on lines, the taxi track options — have
never had a golden pixel.

**The design, as built.**

- **Capture at export, in the page.**  `checkGolden` now takes the page
  and, after the PNG diff, runs `collectStyleCoverage`
  (`playwright-tests/lib/style-coverage.mjs`) against `window.cy`: every
  element's resolved `style()` — mappers, bypasses and the parents
  overlay already applied — and the core record, each value compared
  with a default-sheet leaf, compound parent (v3's `:parent` defaults)
  or edge built from the same bundle.  The result is held to
  `playwright-tests/golden-coverage/<name>.json` the way the PNG is held
  to its golden (structurally, so the file's layout is free);
  `UPDATE_GOLDENS=1` rewrites both, `UPDATE_GOLDEN_COVERAGE=1` only the
  records.
- **The count runs in Node, from the records.**
  `scripts/golden-coverage.mjs` diffs them against the universe;
  `test/modules/golden-coverage.mjs` pins the counts exactly
  (`bundle-size.mjs`'s ratchet shape: a round that moves a count edits
  the pin in the same commit, with the capture that moved it).

**Calls taken in-round.**

- **The universe is the schema's per-group list, cut to what the group
  reads back.**  Round 79's schema lists 45 cross-group names the
  compiler accepts and stores and nothing ever reads — `line-color`,
  the arrow props and `arrow-scale` on a node; `shape`, the border and
  outline props, `background-*` and `height` on an edge (measured: a
  node sheet's `line-color` leaves every edge at the default).  No
  scene could exercise them, so they are reported as inert, not
  counted.  Whether the compiler should refuse them is not this round's
  question (v3 sheets set shared props on both groups).
- **Resolved values, not sheet text.**  A mapper that resolves every
  element to the default counts as unexercised, which is what a pixel
  would say; so does a property set on a group with no elements in the
  scene.
- **Keyword aliases are not gaps.**  `circle` and `square` read back as
  `ellipse` and `rectangle`, and `arrow` as `triangle`, on every arrow
  prop — one drawing, two spellings — so a capture can never record
  them.  The table is audited by the gate against what a sheet reads
  back.
- **Values are kept, cut at 32 per property** with a `'…+N'` count: the
  enumerator needs the distinct keywords, and no keyword vocabulary in
  the schema is longer than 28.  The largest record is 2.0 KB; the 50
  come to ~200 KB on disk.
- **The goldens only, not the parity scenes.**  The parity scenes
  compare v4 with v3 under a tolerance and answer a different question;
  the parity work of rounds 77 and 73 diffs against the exact goldens.
  Extending the capture to them is one call in their diff helper, left
  to the round that wants it.

**Controls run.**

- A hand-edited record (`nodes-edges-arrows` with `shape` removed)
  fails its golden: "exercises different style properties than its
  record says (nodes moved)".
- Judging a parent against the leaf defaults fails two capture specs
  (the untouched parent reads as exercising shape, fill and border).
- In the gate: dropping the one golden that exercises a property opens
  the gap; a planted out-of-universe property is reported; a golden
  without a record and a record without a golden both fail the pairing.

**Deferred.**  Tier 2, the degrade control, is later by the sitting's
call — this round's "exercised" is an upper bound on what the goldens
see.  No golden was added: closing the gaps is the parity rounds' work,
and each golden that closes one lowers the pin.

**Verification.**  The full golden pass is green against the records
(50 passed); `npm run -s test:node:quiet` green (zero output) — after
one fix: the first full run failed the status site's gallery spec,
whose caption parser looked for `checkGolden( '<name>'` and found none
of the 50 page-first calls.  The parser takes both spellings now, with
a spec for the new one.
