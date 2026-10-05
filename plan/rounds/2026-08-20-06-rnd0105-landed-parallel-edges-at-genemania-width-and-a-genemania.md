## Parallel edges at GeneMANIA width, and a GeneMANIA fixture

GeneMANIA's signature look is tens of parallel edges per gene
pair, one per interaction network, coloured by network type.
Verified: v4's bundling is v3's verbatim (`src/store/curve-index.mts`
— pair-keyed membership, lazily built, per-member offsets) with
no cap on bundle width, and haystack ships
(`haystack-radius`, `CURVE_HAYSTACK`).  So the premise is not "a
feature is missing" — it is that **nothing has ever measured or
even rendered the width-30 shape** in this repo, and the pair map,
derivation, pick and draw all have width-dependent costs nothing
prices.

The work:

- **The fixture first.**  A real GeneMANIA result network with a
  hand-authored v4 sheet joins `debug/styles.js` and the
  networks list — the em-web pattern, where a real flagship
  sheet became the anchor for the style benchmarks and the
  harness's most-opened page.  If the export needs slimming, the
  derivation is recorded the `debug/slim-ndex.mjs` way — a
  re-runnable script, not a mystery blob.  The fixture is also
  the visual acceptance test: opened beside genemania.org.
- **The width sweep**: `benchmark/bundles.mjs` — ingest, curve
  derivation, a render frame, and pick, at bundle widths 2 / 8 /
  32, v3 beside, **each row asserting the width it is named
  for** (the 39.1 rule: a fixture can be styled into a mode it
  never enters, and `bezier` bundles multi-edges only).
- **Pick on dense bundles**: with 30 edges in one corridor the
  hit halos (57.9) mean many candidates within threshold — what
  v3 resolves, what we resolve, and whether the answer is stable
  frame to frame.  A spec per outcome, not a shrug.
- **The look**: a parity scene with wide bundles at both tiers —
  zoom 1 and the round-56 close-up — built by the count-the-ends
  rule (more members, not fatter ones), plus a golden.  The
  offsets formula is v3's, so parity should be tight; if it is
  not, the diff names the field via the routing harness, which
  already speaks `controlPoints()`.
- **A priced question, not a feature**: whether wide bundles
  deserve LOD aggregation (draw one representative edge per
  bundle below a zoom threshold).  If the sweep shows width
  dominating frame cost at GeneMANIA scale, that finding is
  logged toward round 82's proxy tier with the number attached;
  building it here is out of scope.

First measurement: the sweep, and the fixture on screen beside
the real app — in that order, so the numbers exist before
opinions do.

**Open (maintainer):** which GeneMANIA export (organism, query
size) makes the canonical fixture; whether the fixture's sheet
uses per-network colour via dictionary data column (the natural
v4 spelling) — worth deciding deliberately since it becomes the
reference sheet for the multi-edge idiom; whether haystack at
width belongs in the sweep (v3's answer for this shape at scale)
so the docs can recommend a mode by number.

**Decided at the eleventh design sitting (2026-09-28):** **two canonical
fixtures**: the human default/example query from the GeneMANIA website,
and a human one-gene query for p53.  The dictionary-column sheet and the
haystack sweep are settled in the round.

**Carried in from round 73 (2026-09-29), the WebGL2 constraints.**  The
WebGL2 renderer (round 137) is full parity at alpha and is built after
this round, so what this round draws must port without a redesign: (1)
nothing drawn depends on a compute pass without a CPU path — what the
renderer reads is CPU-canonical or CPU-derivable; (2) a new pipeline's
cull predicate is a pure function of the pulled columns and the frame
uniform, so it can move into the vertex stage, and no draw count exists
only on the GPU; (3) no storage writes from a draw, no atomics in the
draw path, no dual-source blending, subgroups or f16 in a drawn shader;
(4) per-instance data stays within 16 vertex-stage bindings; (5) the
feature lands with a golden that sets its properties, or the parity
project cannot see it.  The reasons and the measurements are in round
73's record.

### The round, as carried out

Landed 2026-09-29 in five commits (105.0–105.3), autonomously, on the
sitting's calls: two fixtures, per-type colour through a dictionary
column, haystack in the sweep.

**105.0 — the fixtures, fetched rather than committed.**  Real data was
obtained: `debug/genemania.mjs` runs both canonical queries against
genemania.org exactly as its search box does (`POST
json/search_results`, read-only — automatic weighting, 20 genes, 10
attributes, the organism's `defaultSelected` networks from
`json/resources`, no attribute groups), pinned to GeneMANIA's
**13 August 2021** database (webapp 3.6.0), and converts them the way the
app's own `loadGraph` does.  The default query is the human "e.g." list
(RAD51 MLH1 MSH2 DMC1 RAD51AP1 RAD50 MSH6 XRCC3 PCNA XRCC2 RAD54B
MRE11A); the second is TP53 alone.  Fetched 2026-09-29:

| fixture | genes | interactions | gene pairs | widest bundle |
| --- | --: | --: | --: | --- |
| `genemania-default` | 32 | 712 | 203 | 21 (MSH2–MSH6) |
| `genemania-tp53` | 21 | 266 | 65 | 28 (MDM2–TP53, 19 physical-interaction studies) |

The same queries on genemania.org load the same counts (read off the
site's own `window.cy`: 32/712 and 21/266).

**Licence.**  GeneMANIA publishes no licence for its data.  Its terms
(https://pages.genemania.org/privacy/, read 2026-09-29) call it "a free
public resource" whose data "is based on other public resources", and
say "Some of the original data used by the service may be subject to
patent, copyright or other intellectual property rights that place
restrictions on the use or redistribution of these data.  It is the
responsibility of the users of this service to ensure that their use of
the service does not infringe on such rights."  The data-archive page
states none either.  Redistribution is not granted, so the repo carries
the **query definitions and the converter**, and each checkout fetches:
the JSON is gitignored; the `networks.js` entries carry `fetch: 'node
debug/genemania.mjs'` and a 404 on one makes the page name the command;
`test/modules/debug-harness.mjs` checks the command and the ignore rule
instead of the file, and compiles the sheet against the converter's
output over the payload's *shape* (`test/modules/fixtures/
genemania-shape.mjs`, made-up genes) or the real file where fetched; the
status site omits any `fetch` network even from a checkout that has
fetched it.  The maintainer, as a GeneMANIA author, can revisit this.

**Revisited 2026-10-05: the fixtures are committed.**  The maintainer, a
GeneMANIA coauthor, approved including the data.  The two JSON files are
checked in (their `genemania.terms` stamp says so), and the
fetch-per-checkout machinery is gone: the ignore rule, the `fetch`
field and its 404 hint, the debug-harness fallback and ignore check,
and the status site's omission — both networks are now encoded and
hosted like any other real export.  `node debug/genemania.mjs` remains
how they are regenerated, and `test/modules/genemania-fixture.mjs` pins
each committed file to its query, the pinned database and the
dropdown's counts.  The reversal followed CI run 36719642526, red in
`ci-node` and both renderer projects because `scripts/schemas.mjs` read
the files a CI checkout never had (commit 1d671072 had first patched
that by skipping them).

**The sheet** is the web app's `cyStylesheet` ported: haystack at radius
0.5, 40% line opacity, width over `absoluteWeightPercent` 1.5–16, size
over `normScore` 20–60, the query genes hatched, and the app's twelve
`edge[group = "…"]` blocks as **one `ordinal` mapper over the `group`
column** — a string column the store dictionary-encodes (a spec pins the
wire form: a dictionary of the seven codes) — the reference sheet for
the multi-edge idiom.  Layout: force with the app's cose edge length
(100/weight, capped at 150) as a score mapping.

**Beside the real app** (headless Chromium, both queries): the same
genes, edges, network-type colours, haystack sheaves, widths and hatched
query genes; the one visible difference is the layout — v4's force packs
tighter than GeneMANIA's cose (the fitted zoom reads 2.6 against the
site's 1.55 on TP53), so nodes read larger.  That is the layout's, not
the round's.

**105.1 — the width sweep** (`benchmark/bundles.mjs`), in a browser on
the benchmark machine (RX 580 via Vulkan — `npm run -s gpu`: HARDWARE —
i9-9900K, built UMD bundles, 1280×800 at dpr 1, median of 3), because
v3's routing and pick live only in its canvas renderer: a headless v3 in
Node throws on `controlPoints()`.  Width is the only variable at each
scale; each scene asserts on the live instance that sampled pairs have
exactly W members and W distinct curves (bezier) or haystack lines.

| large: 4,096 nodes, 32,768 edges | w2 | w8 | w32 |
| --- | --: | --: | --: |
| v4 bezier: ingest / derive ms | 188 / 23.7 | 148 / 24.9 | 151 / 23.8 |
| v4 bezier: device ms per frame | 8.36 | 8.35 | 8.31 |
| v4 haystack: derive / device ms | 13.1 / 1.04 | 13.8 / 0.90 | 13.4 / 0.82 |
| v3 bezier: ingest / derive ms | 1584 / 632 | 1548 / 483 | 2255 / 497 |
| v3 haystack: ingest / derive ms | 931 / 229 | 878 / 212 | 924 / 207 |
| pick: v3 sync scan / v4 async | 129 / 16.6 | 124 / 16.6 | 125 / 16.6 |

At GeneMANIA's scale (32 nodes, 768 edges) every v4 row is flat in
width: device 0.47 ms bezier, 0.22–0.25 ms haystack, derive ≤ 1.8 ms.
Wall frame time is vsync-bound (16.7 ms) on every row of both
libraries.  Re-run after 105.2's pick change: the same to the
measurement's resolution.

**105.2 — pick on dense bundles, one spec per outcome.**  Measured
first, on a 30-wide bezier bundle with the gesture's 8 px halo: **v3**
keeps the edge whose centreline is nearest (a tie to the topmost);
**v4** kept whichever grown stroke the pick pass drew last — 55 of 182
transect points disagreed with v3, all near the bundle's ends, one
0.49 px from the centreline of the edge it did not pick; **both were
stable** (0 of 182 changed across re-picks).  So the pick pass gained a
tile-sized depth target: each pick fragment writes its distance from
its own centreline (an arrowhead its SDF distance) and the test is
less-equal — nearest-wins, as v3.  It ports to WebGL2 as `gl_FragDepth`
and a depth test (round 73's constraint 3); scene frames are untouched.
`playwright-tests/bundles.spec.js` pins agreement with v3 (bezier),
with each library's own geometry (haystack, whose angles differ), and
stability; the control (compare `'always'`) fails the first two with
122 and 8 probes.

**105.3 — the look.**  Two parity scenes on the same 30-wide
alternating-direction fan, zoom 1 and the round-56 close-up, both
**0 px differ** against v3; a v4 step size 10% off moves them to 6.815%
and 2.447%, so the bounds (0.1%) are a margin over zero.  The golden
`bundles-wide` sets the idiom (bezier over haystack, ordinal colour over
a string column, a mapped width).  Its degrade control found two
library defects, both fixed with specs: **a channel-opacity bypass over
a kernel-owned colour never reached the screen** (the GeneMANIA
highlight: `line-opacity: 1` on one edge under an ordinal `line-color`
kept drawing and reading the sheet's folded alpha — now `OPACITY_FOLDS`
demotes the colour, as a mapped opacity always did), and **the edge
layer pads read back off-grid** (a mapped width of 1.85 read
`overlay-padding` as 10.00039 and an unset `line-outline-width` as
0.00078, which had counted two phantom properties as covered).  Pins:
golden coverage unchanged (140 of 216), degrade 530/520 → 539/529.

**105.4 — the priced question: LOD aggregation for wide bundles.  Not
warranted by width.**  Width moved no v4 row at either scale; what moves
the device is the curve style — bezier costs ~9× haystack at 32k edges
(8.3 against 0.8–1.0 ms), whatever the width — and at GeneMANIA's scale
the whole frame is under half a millisecond of device time.  So the
docs recommendation by number: **haystack for bundles at scale** (it is
also what GeneMANIA's own sheet uses, and v3's answer), bezier where the
fan itself is the message.  Logged toward round 82's proxy tier with the
numbers attached (its plan file).  Nothing was built.

**Calls taken in-round**: fetch-not-commit (no licence); per-type colour
through the dictionary column (the plan's recommendation; GeneMANIA
colours by network type, so the key is the group code, with the network
name kept as a second dictionary column); haystack in the sweep (the
plan's recommendation); a sweep in the browser rather than Node (v3
beside is otherwise impossible); fixing v4's pick to v3's nearest-wins
rather than documenting a deviation (the measured answer was the wrong
edge under the pointer, in the one interaction GeneMANIA is built on).

**Deferred / not done**: the fixtures' positions are v4's own layout,
not the site's; the benchmark's pick row prices latency, not which edge
(the spec covers that); no ledger item raised.

**Gates at the close**: `npm run -s test:node:quiet` green (zero bytes);
plan-record, agent-docs, feature-inventory, status-features and
migration-guide green (plan-record had used round 105 as its example of
a planned round — it now names round 137); the renderer and visual
Playwright projects green together (400 passed, 1 skipped) with every
golden exact (one renderer spec, round 124.4's casing crossing, had
failed once in an earlier full run and passed alone and in the final
run — load-timing, unrelated to this round);
`git worktree list` shows the main tree only.
