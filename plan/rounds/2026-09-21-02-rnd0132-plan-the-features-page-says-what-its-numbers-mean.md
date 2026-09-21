## The Features page says what its numbers mean

The maintainer's ask (2026-09-21): the status site's Features page is
not clear about its numbers.  "925 of 925 features" — done?  total?
And the headline total is not meaningful anyway: most rows are single
API functions or single style properties, a trivial amount of work
beside an abstract feature.  So list the totals per status; stop hiding
the status legend; put the full definition beside each status in the
dropdown; give the status cell a tooltip; put counts in the category
dropdown; make the CSV download a big, prominent button; when a category
is selected with all statuses, show that category's statuses and counts;
and give the feature-direction review a big button at the top too.

Everything lives in one generator, `scripts/status/features-page.mjs`,
its two gates, and this record.  Nothing under `src/` changes.

### What the page does today, measured (2026-09-21)

- `docs/features.csv` holds **929 rows** (the ask's 925 is an earlier
  snapshot) across 21 categories.  Per status: Implemented 616, Replaced
  183, Planned 42, Excluded 31, Partial 24, Undecided 16, Proposed 15,
  Not implemented 2.  Per kind: API 495, Style 303, and 131 rows in the
  capability categories (Performance, Developer experience, Cytoscape
  Web v2, Application workflows, Core capabilities, Rendering, Layout,
  and the rest).
- The counter reads `929 of 929 features`
  (`scripts/status/features-page.mjs:89`) and the filter script rewrites
  it as `<shown> of <total> features`.
- The status definitions (`STATUSES`,
  `scripts/status/feature-inventory.mjs:11-24`) render inside a
  `<details>` that is collapsed by default.
- The category dropdown lists bare names; the status dropdown lists bare
  names; a status cell is bare text.
- "Download CSV" is an inline link in the fourth paragraph; the
  feature-direction review is an inline link in the second.
- The gates: `test/modules/status-features.mjs` (escaping, byte-identical
  CSV, row count, the download attribute) and
  `playwright-tests/status-features.spec.mjs` (filters compose, the
  counter text `3 of N features`, the download bytes, no-JS
  completeness, 390px in both themes).

### The design calls

**Rows, not features.**  The counter says `Showing all 929 rows` or
`Showing 3 of 929 rows`.  A composition line under the buttons says what
the rows are — `929 rows: 495 API members, 303 style properties, 131
capabilities` — and one sentence says a member row is one function or
property while a capability row is a whole feature, so the total counts
rows, not work.  The split is computed from the categories at build
time (`summarise(rows)`), never typed.

**One mechanism for legend, totals and breakdown.**  The legend becomes
a visible table — Status, Rows, Meaning — one row per `STATUSES` entry
in definition order.  Its count cells are server-rendered with the
inventory totals, so the no-JS page already lists totals per status.
The filter script re-tallies those same cells for the current selection:
pick a category with all statuses and the table is that category's
statuses and counts; pick a status and the other cells read 0, muted.
The table's caption says which — `Statuses — all 929 rows`, `Statuses —
Style, 303 rows`, `Statuses — 3 matching rows`.

**Counts and definitions in the pickers.**  `API (495)`; `Implemented
(616) — Available in the current v4 prototype; not a release-readiness
claim.`  Option *values* are unchanged, so the Playwright spec's
`selectOption('Style')` still matches by value.

**A basic tooltip.**  Every status cell carries `title="<definition>"`,
as asked; so do the legend's status names.

**Two buttons under the lede.**  Download CSV, and Feature-direction
review.  The site has no button style; this page gets one, local to it
(`--accent` on `--page`, both themes).  The link text `Download CSV` and
the `download="cytoscape-v4-features.csv"` attribute are unchanged
because the gates find the link by them.

### The plan

| # | What |
| --- | --- |
| 132.1 | The two buttons; the composition line and `summarise(rows)` |
| 132.2 | The legend as a visible totals table; the counter says `Showing … rows` |
| 132.3 | Counts in the category picker; counts and definitions in the status picker; the title tooltip on status cells |
| 132.4 | The legend tallies the current selection; the gates for all of 132 |

Verification, every sub-round: `npm run -s verify:quiet`; before handing
back, `npm run -s test:modules:quiet` and
`npm run -s test:playwright:quiet`; `npm run status` and open
http://localhost:3335/features.html at desktop and 390px width.

### Risks named at planning

- **Option labels grow long.**  A status option now carries its
  definition; native `<select>` renders long labels fine on desktop and
  truncates on narrow mobile pickers.  The legend table carries the same
  text visibly, so nothing is lost.
- **Two numbers that must agree.**  The counter and the legend's tally
  are computed by the same pass in the filter script, and the Playwright
  spec asserts both against counts derived from the inventory.
