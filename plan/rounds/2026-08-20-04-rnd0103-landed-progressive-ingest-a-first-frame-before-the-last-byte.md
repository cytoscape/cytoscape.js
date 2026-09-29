## Progressive ingest: a first frame before the last byte

Rounds 66/67 took monolithic init from 2899 ms to 1756 ms and
then to 622 ms headless (1.92× in one A/B), but the pipeline
shape is unchanged: fetch → parse → init → first frame, strictly
serial, first pixel after the last byte.  For app-scale loads —
GeneMANIA results over a slow link, Cytoscape Web sessions — the
next factor of perceived speed is not another 2× on init, it is
showing a correct partial graph early.  The verified constraints
that shape the design:

- **A wire/columnar payload is self-contained by construction**:
  edge endpoints are u32 indices *into that payload's nodes*
  (`src/public-types.mts:90-97`; the wire sections mirror it),
  so a later chunk's edges cannot name an earlier chunk's nodes
  at all today.  Chunking therefore means one of: vertex-closed
  subgraph chunks with **cut edges carried in definition form**
  (id-keyed, the slow path, but it works today); or an id-keyed
  endpoint mode in the columnar/wire ingest — a format evolution
  that belongs with item 43's version-header work, not alone.
- The round-67 browser decomposition (fetch 105 / parse 175 /
  convert 105 / init 1150 / ready 100 / first frame 85–400 ms)
  is the baseline instrument and stays the harness for this
  round; the wire path already removes the parse row.

The plan, measure-first:

1. **The zero-format-change baseline**: split ndex-x-large into
   k = 10 chunks, `cytoscape()` on chunk one, `cy.add()` per
   subsequent chunk, cut edges as definitions.  Measure
   time-to-first-frame, total time versus monolithic (the churn
   factor), and *where* the churn lands — per-add style apply,
   curve re-derivation (`CurveIndex` re-derives a pair when a
   member arrives), renderer reallocation cadence under 10×
   growth.  This number decides whether the round is an API
   round or first a churn-fixing round.
2. **The API sketch**, refined after (1): a chunk-accepting load
   — `cytoscape( { elements: asyncIterable, ... } )` or an
   explicit `cy.load( stream )` — with a **viewport policy**
   stated up front (fit once on the first chunk, then hold;
   never re-fit per chunk — the screen must not jump), progress
   events per chunk, and `cy.ready` meaning "first chunk
   rendered" with a second signal for "complete" (naming open).
3. **Positions**: the streamed case that matters ships
   server-computed positions (preset), which is both flagship
   apps' shape.  Running a generated layout per chunk is
   explicitly out of scope; one open question below covers the
   layout-after-complete convention.
4. **The wire evolution decision**, taken jointly with item 43:
   if (1) shows cut-edge definitions dominating, the id-keyed
   endpoint mode (or a row-group segmented format) becomes the
   payload of promoting the format, and the two rounds should
   merge rather than evolve the header twice.

Controls: the chunked load's end state must be **columns-equal**
to the monolithic load of the same fixture (the round-42 method
applied to store state, not files); the first-frame spec asserts
a frame rendered while a later chunk is knowably absent (assert
the precondition, the 48.5 rule).

Risks: event semantics are public API (what does `add` batching
look like per chunk; does a layout started mid-stream see a
moving target — recommended: refuse or queue); a progressive
render shows an incorrect *partial* graph by design, and the
docs must say what is guaranteed (every rendered element is
correct; completeness arrives).

**Open (maintainer):** API spelling (options-form async iterable
versus explicit `load()`); the ready/complete event names;
whether chunking joins item 43's public format now (one header
evolution) or stays app-side (the app slices its own subgraphs);
minimum chunk granularity worth supporting before overhead eats
the win.

**Decided at the eleventh design sitting (2026-09-28):** the spelling is
**`cy.load(asyncIterable)`**, returning a promise for completion;
**`cy.ready` means the first chunk drawn**, with a separate signal for
completion.  Chunking in the wire format rides item 43's experimental
rule; granularity is measured in the round.

### The round, as carried out (2026-09-28)

Landed the same day as the eleventh sitting, on its calls: the explicit
`cy.load( asyncIterable )`, `cy.ready` as the first chunk drawn,
completion signalled separately, and chunking in the wire format under
item 43's experimental rule.  Measured on the i9-9900K (16 threads,
63 GiB), Node 24.18, and — in the browser — Chromium on the AMD RX 580
over Vulkan (`npm run gpu`: HARDWARE); fixture ndex-x-large (19,607
nodes / 464,657 edges, preset positions) with the harness's production
sheet.

| # | Commit | What landed |
| --- | --- | --- |
| 103.1 | `3df8d06e` | `benchmark/progressive.mjs`: the zero-format-change baseline, before any load code |
| 103.2 | `e774fad4` | node references (`refs`) in the columnar and wire forms; `toColumnarElements( defs, { refs: true } )`; `test/refs.mjs` |
| 103.3 | `8855aad4` | `cy.load()`, `Event.progress`, the first-frame hook, the subset bulk window, the layout refusal, `test/load.mjs`, `playwright-tests/load.spec.js`, the docs |
| 103.4 | `036b017d` | the load rows headless, and `benchmark/progressive-browser.mjs` |
| 103.5 | `78e73766` | the debug page's "Progressive load, chunks" control |
| 103.6 | this commit | the close |

**103.1 — measure first.**  Chunk one through the factory, `cy.add()`
per later chunk, cut edges as definitions (built headless bundle,
median of 3, ms):

| strategy | k | first chunk | total | churn |
|---|---:|---:|---:|---:|
| monolithic, definitions / wire | 1 | 575 / 428 | 575 / 428 | 1 / 0.74 |
| vertex-closed, all definitions | 10 | 13 | 1,849 | 3.22× |
| vertex-closed, columnar + cut definitions | 10 | 13 | 1,734 | 3.02× |
| nodes first, edge definitions | 10 | 56 | 1,860 | 3.24× |

The churn was 2.5–3.3× at every k from 2 to 100, and it landed in one
place: the later chunks' ingest (0.9–1.5 s) — the cut edges, 87–97% of
all edges at k ≥ 5 on this fixture's node order, travelling as
definitions through the per-element path with a handle each.  The
style apply of the later chunks was 0.3–0.45 s (the monolithic load's
whole apply is ~0.28 s), the curve flush a frame runs 7–13 ms.  So this
was not a style- or curve-churn round, and the plan's item 4 applied:
cut-edge definitions dominate, so the id-keyed endpoint mode is the
format evolution.

**103.2 — the wire evolution, decided by 103.1.**  Of the two forms
the plan named, the id-keyed one, as **node references**: a payload's
`refs` lists the ids of nodes it indexes past its own, each resolved
once against the id index (packed bytes on the wire, no string
decoded).  Rather than id-keyed endpoints per edge, which would repeat
an id per edge, the endpoint columns stay u32 indices and only the index
space grows.  In the wire it is a trailing section under a new flag bit
(2048), the header unchanged and the version still 4 — the sitting's
rule, so no second header evolution was needed and nothing merged with
item 43 beyond adding the section.  A prototype in-bench (refs through
the store's internals) put the later chunks' ingest at ~0.4 s against
the definitions' 1.1–1.4 s before the API existed.

**103.3 — the API, measured again** (`--section load`, median of 3):

| k | definition chunks | wire chunks + refs | nodes first, wire + refs |
|---:|---:|---:|---:|
| 1 | 556 | 413 | — |
| 2 | 626 | 444 | 407 |
| 5 | 660 | 497 | 475 |
| 10 | 671 | 523 | 506 |
| 20 | 707 | 548 | 540 |
| 50 | 752 | 575 | 584 |
| 100 | 836 | 665 | 643 |

A 10-chunk load is 1.2–1.3× a monolithic one, down from 3×; the first
chunk lands in 12–54 ms.  ~100 ms of what remained was the curve
index's per-edge pair marks outside the round-67 bulk window; a later
chunk now closes the window over its own edges and marks nothing where
no pair map exists (where a mark derives nothing) — measured 656 → 514
ms for the wire k = 10 row.

**In the browser** (`benchmark/progressive-browser.mjs`, fresh Chromium
per scene, wire payloads cut in the page before t0; no link median of
5, link rows median of 3; "first" = first frame carrying elements,
"whole" = first frame of the whole graph):

| link | scene | first | whole | frames | mirror (re)allocs |
|---|---|---:|---:|---:|---:|
| none | monolithic | 902 | 902 | 1 | 38 |
| none | nodes first, k = 10 | 515 | 1,122 | 10 | 114 |
| none | vertex-closed, k = 10 | 374 | 1,107 | 10 | 209 |
| 100 Mbit/s | monolithic | 1,960 | 1,960 | 1 | 38 |
| 100 Mbit/s | nodes first, k = 10 | 406 | 1,214 | 11 | 133 |
| 100 Mbit/s | vertex-closed, k = 10 | 110 | 1,210 | 7 | 171 |
| 20 Mbit/s | monolithic | 6,176 | 6,176 | 1 | 38 |
| 20 Mbit/s | nodes first, k = 10 | 470 | 5,928 | 11 | 133 |
| 20 Mbit/s | vertex-closed, k = 10 | 350 | 5,667 | 11 | 247 |

With the payload in hand the first frame is 1.8–2.4× sooner and the
whole graph ~23% later (the ingest churn plus the partial frames); over
a link the load wins both — at 100 Mbit/s the first frame 4.8–18×
sooner and the whole graph 38% sooner, since ingest and device
acquisition overlap the transfer.  The nodes-first final frame is
pixel-identical to the monolithic one (0 of 1,024,000).  References
cost bytes: +6% vertex-closed and +12% nodes first at k = 10 (each chunk
repeats the ids its cut edges name).

**Calls taken in-round** (none reopens a sitting decision):

- *The completion signal* is the promise (the sitting's "returning a
  promise for completion"); the plan recommended no event name, so the
  lifecycle follows the layout's: `loadstart`, `loadchunk`, `loadready`
  (first chunk drawn), `loadstop` (completed, failed or cancelled,
  `event.cancelled`), each with `event.progress`.
- *Which `cy.ready`*: a load that starts on an instance with no elements
  — the streamed `options.elements` — holds `cy.ready` and `isReady()`
  to its first chunk drawn (headless: ingested), fits once to that chunk
  and applies wire graph data; a load into a populated graph is a
  streamed `cy.add()` and touches none of the three.  "Drawn" is the
  first frame after the ingest, through a core hook the render host
  wakes before `render` (so `cy.off( 'render' )` cannot strand it), and
  woken at unmount/destroy.  A renderer that never becomes usable
  counts as drawn for the load's sequencing; `cy.ready` still rejects.
- *The viewport policy*: the plan's — fit once on the first chunk, then
  hold.  `fit` defaults on for an initial load only.
- *Pacing*: one macrotask between chunks, and the second chunk is not
  pulled until the first is drawn.  Measured: the greedy pull put the
  first frame at 279–638 ms depending on k (behind whichever chunk was
  ingesting when the device arrived); the hold made it steady (nodes
  first 501–518 ms at k = 5, 10, 20) for −1% to +7% on the total.
- *No size hint*: pre-sizing the store (the `--reserve` probe) took the
  mirror's reallocations from 95 to 38 and moved the total by nothing,
  while slowing the first frame (654 against 289 ms) — it uploads
  full-capacity buffers.  The reallocation cadence is not the cost.
- *Layouts*: refused while a load runs (the plan's recommendation),
  thrown from `openLayoutRun`; one load per instance at a time.
- *Events per element*: `add` fires per element only while listened
  for, as the factory's bulk path does; `loadchunk` is the summary.
- *`cy.patch()` refuses refs*, merge mode included (a follow-up hook).
- *Granularity*: every k works; ~1.5 ms fixed per chunk headless plus a
  frame in a page, so 5–20 chunks is the documented range.

**Controls.**  Columns-equal to the monolithic load, every
`COLUMN_SPECS` column id by id plus data, from definition, columnar and
wire chunks in both shapes, with two controls that must be rejected (a
moved value; a missing chunk).  The first chunk drawn asserted with its
precondition in both tiers: headless, a gated source (`cy.ready`
resolved, chunk two not handed over); in the browser, the first chunk's
pixels on the canvas while chunk two is knowably absent, then the
second's, the viewport held — and its control (drawn = ingested) fails
on `frames > 0`.  Eight implementation mutations run against
`test/load.mjs` (the subset window marking nothing; no ready hold; no
yield; a re-fit per chunk; endpoint refs unchecked; cancel without
closing the source; graph data always applied; layouts not refused):
seven failed at once, and **one stayed green** — cancel without closing
the source passed because the pump's own error path closed it a
macrotask later — which gained the spec that now fails (cancel between
chunks, the source closed within microtasks).  One spec defect found by
the browser run: the first spec read `cy.ready` before calling
`load()`, and got the renderer's promise — the load re-points it, which
the JSDoc now says.  Checked by hand on the debug page
(`?network=ndex-x-large&progressive=10&binary=true`): every node placed
in the first frame, the edges filling in, 465k at the end.

**Deferred, with reasons.**  A queued layout (the plan's other option)
— refusing is loud and the promise gives the convention.  Node
references in `cy.patch()`'s merge mode — the definition form already
serves it.  A per-chunk style apply and adjacency overlay cheaper than
a populated graph's (the remaining 1.2–1.3×).  A server-side chunker
helper — the app slices (nodes first is one line); `toColumnarElements(
…, { refs: true } )` and `serializeElements` are the tools.

`npm run -s test:node:quiet` green at close: 2,962 unit tests (+38: 27
in `test/load.mjs`, 11 in `test/refs.mjs`), 816 module; the type tests
and the declaration surface audit (65 type exports) green; the renderer
Playwright project 183 passed, 1 skipped.  Bundles +5.9 KB minified on
each build (full 914,031 → 919,953; headless 545,849 → 551,749).
