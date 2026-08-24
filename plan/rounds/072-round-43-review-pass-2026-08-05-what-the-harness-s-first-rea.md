## Round 43 review pass (2026-08-05) — what the harness's first real user found

The maintainer opened the page round 43 rebuilt and reported three things.  All
three were real, none was reachable from any suite, and the last of them turned
up a **library** defect underneath it.  Recorded here rather than as a new round
because it is round 43's own subject; the risk note above — "a property that
changes meaning rather than disappearing will not be caught by anything but
opening the page" — is exactly what happened, one day later.

*Process note, on the record rather than as silent drift*: the four items below
landed as four isolated commits (code plus its specs), with **one closing docs
commit** carrying this record, `src/README.md` and `AGENTS.md`, instead of a
docs slice per commit.  The standing rule is docs-in-commit; the exception is
taken here because the four share a single narrative — the third item is what
found the fourth — and splitting it four ways would have made each piece read
as less than it is.  The fifth design sitting's PLAN-only edit is the
precedent.

- [x] **43.10 LiveReload had never connected.**  Reported as
  `livereload-setup.js:13 GET http://127.0.0.1:35729/livereload.js net::ERR_CONNECTION_REFUSED`.
  Measured rather than guessed at: `livereload`'s CLI defaults `--bind` to
  **`localhost`**, Node resolves that to `::1` on this box, and `ss` confirms it
  listens on `[::1]:35729` and nothing else — while `http-server -o` opens the
  page at **`127.0.0.1:3333`** (its own rule for a `0.0.0.0` bind), so
  `location.hostname` is a literal IPv4 address and no DNS fallback can save it.
  The two halves have never met, on either project.

  `watch:sync` now passes `-b 0.0.0.0`, which is what `http-server` already
  does and what the client's `location.hostname` construction assumes.  The
  client also gained an `onerror` that names the command to start, because the
  only symptom until now was a browser console line that does not say what is
  missing — the round-43 rule (a fetch with no `.catch` renders nothing and says
  nothing) applied to a `<script>`.
  Verified end to end in a real browser: `window.LiveReload` is defined with the
  flag and undefined without it, and the control reproduces the maintainer's
  exact error text.

  **v3's `watch:sync` has the identical defect** and is fixed
  with it — the same one word, and v3's page is still the thing you compare
  against (this pass used it).
- [x] **43.11 Box selection's "[Violation] Forced reflow ... took 40ms" was the
  event log, not the library.**  `debug/events.js` appended a row and then read
  `el.scrollHeight` to keep the view at the bottom; a DOM write followed by a
  layout read is a *forced* layout, once per event.  Box selection emits
  `box` + `boxselect` + `select` **per element**, so the numbers are large:
  measured on `em-web`, a box over the whole graph selects 7468 elements and the
  single `pointerup` task ran **22,406 forced layouts totalling 5,659 ms inside
  a 6,055 ms handler**.  The same gesture with this section's `selection` filter
  unchecked: **40 ms, one layout read**.

  So the library's 22k emits and the
  selection itself are the 40 ms; everything else was the log.
  Rows are now buffered and written once per animation frame, and the buffer
  drops all but the last `MAX_ROWS` before any DOM node is built for them.
  After: **41 ms and one read** — indistinguishable from not logging at all,
  and the log still shows its 400 rows in order.
  Pinned by a Node spec with a DOM stub, because the property is a *ratio*
  (reads per frame, not per event) and a ratio does not need a browser: 5000
  events must force one layout, and 10 events over 7 frames must force seven —
  the second half being the control for the first.  Reverting `append` to
  write-then-read fails it.
- [x] **43.12 The compound fixture was not the verbatim port its record
  claimed.**  Round 43.4 says it "ports v3's hand-built graph
  (`v3/debug/compound.js`) verbatim"; comparing the two files line by line, the
  node list had been **sorted** (`n1, n2, n3, …` where v3 interleaves
  `n8, n9, n4, n5, n1, …`), **four of the eleven edges differed**, the three
  `shape` data values were dropped, and v3's `cy.layout({ name: 'grid', cols: 3 })`
  was not carried over at all.

  Both omissions matter for the same reason and neither is cosmetic: grid places
  **leaves in declaration order** and parents derive their boxes from where
  their children land, so the node order and the column count together decide
  whether each parent's children come out adjacent.  v3's order over three
  columns puts `n8, n9, n5` on one row and `long-name-6, n7, n3` on the next, so
  the four parent boxes are disjoint; the sorted order over grid's
  aspect-derived two columns interleaves the families, and `n1`'s auto-box ends
  up containing `n2`'s and `non-auto`'s.  That is the graph the maintainer could
  not read.

  Now a real verbatim port (order, edges and `shape` data), with a `layout`
  field on the `networks.js` entry carrying v3's `cols: 3` — `init.js` reads
  `def.layout` for any network that ships no positions.  Two things went with
  it: the sheet maps the fixture's `shape` data through a `case` mapper (v3
  carries the data and its page never reads it, so all three draw as discs
  there), and the `parents` block says `shape: 'rectangle'` — the parents group
  *overlays* the nodes group (14.6), so the new nodes-group mapper reached
  parents, which carry no `shape` data, and rounded every parent box.

  Pinned by the readable property rather than the transcription: two parents
  that are not ancestor and descendant must not overlap.  **The first version of
  that spec did not discriminate**, and the control is what said so — dropping
  `cols: 3` left it green, because grid takes its column count from the
  container's aspect ratio and a *headless* instance is 800 × 600, which picks 3
  anyway.  The spec now constructs at the debug page's real 930 × 900, where the
  default is 2; both causes fail it independently.
- [x] **43.13 The `fit()` over-estimate underneath it** — the library defect,
  and the reason the graph still drew at a third of its size after the layout
  was right.  `cy.fit()` with no argument reads `GraphStore.boundingBox()`, the
  conservative columnar scan.  On the fixed fixture that scan read
  **1718 × 1572** where the exact `cy.elements().boundingBox()` is **802 × 637**
  — and removing the three compound-loop edges made the two **identical**, which
  localizes it exactly.
  The cause: box-bounded edges (`FLAG_CURVED_BOX`) add `curveBoxMargin()` and
  then, for everything except taxi, **the chord length**.

  The chord is there
  for *weight-extrapolated* blob routes, where a `control-point-weight` outside
  [0, 1] genuinely puts a control a chord past an endpoint; round 14.10 added
  `CURVE_CMPD` to the same flag and it inherited a term that describes a
  different geometry.  A compound loop's controls hang off the **union of the
  two node boxes** (v3's `findCompoundLoopPoints`), at most half the excursion
  bound past its top-left corner — and the scan visits *both* endpoints, so
  whichever node owns that corner covers it.  Dropped for `CURVE_CMPD` in
  `GraphStore.boundingBox` and in `Collection.boundingBoxAt`, which carries the
  same formula for animated-layout fit targets.

  **Soundness was measured before the change and pinned after it.**  A sweep of
  512 compound-loop edges over 60 randomly-shaped compound graphs (varying node
  sizes, padding, step size and nesting) confirmed the proposed bound contains
  every exact edge bb, and halves the box area (20.0× exact against 36.5×).  Its
  own controls behave: `margin` alone violates by 338 px, and `p2/2 + margin` is
  contained by only 4.4 px — which is the analysis showing through, since the
  true requirement is the endpoint's own half plus half the excursion, and
  keeping the full `p2` is what preserves round 14.10's deliberate 2× staleness
  cushion.

  Two specs in `test/compound-loop-edges.mjs`: the box is the endpoint
  AABB grown by header + node-half and no more, and the conservative box still
  contains the exact one across three arrangements.  Controls run: restoring the
  chord fails the first, and zeroing the header deviation fails both.
  The **cull** kernel keeps its chord term deliberately (`render/cull.mts`):
  over-inclusion there costs efficiency, never correctness, and changing WGSL
  would put goldens and parity scenes in scope for a pure efficiency gain.
  Effect on the page: fit zoom 0.506 → 0.607 on the compound fixture.

  **Logged, not fixed**: the residual is still ~1.8× the exact box, and it is
  the *formulation* rather than the constant.  The scan grows a disc of
  `p2 + nodeHalfMax` around each endpoint **centre**, where a compound loop's
  geometry is directional — its controls only ever go up and left of the union
  of the two node boxes — so a box-based, one-directional term would be far
  tighter, and `nodeHalfMax` is a *global* maximum that one big parent inflates
  for every box-bounded edge in the graph.  That is a bounds round with its own
  goldens and benchmarks, not a review-pass edit.

**Verification (2026-08-05)**: typecheck, lint, **2013 Node tests** (two new)
and **126 module tests** (three new — every one of the five run against the
mutation it exists to catch), 24 soak tests, the
throw gate at **182 run / 10 browser-only / 5 unreachable / 0 Node-reachable
dead** over 197 sites, JSDoc 100%/100% with `@throws` 18/18, `@param` 232/232
and `@returns` 279/279, `test:types:all` clean at 45 type exports / 3 statics /
1164 doc blocks (the declaration is byte-unchanged — the source edits are
comments and one condition), and **179 browser specs** (104 `renderer` + 75
`visual`) against a hand-rebuilt bundle with **goldens byte-stable** and every
parity scene at its recorded value, `parity-compounds` at 2.092% and
`parity-compound-loops` unmoved.

The nine networks were driven in a real
browser again, and the compound fixture screenshotted against v3's page.

**Risks tracked**: 43.13 changes a number a consumer can see — a no-argument
`cy.fit()` on a compound graph with related edges now frames tighter — which is
the intended direction but is a behaviour change, logged as open call 16.  The
event-log batching means a row is now written a frame after its event, so
reading the log while stepping a debugger shows one frame less than the model
knows; that is the trade for the gesture being usable at all.  And the compound
fixture is now pinned by a spec that constructs at the page's dimensions, so a
change to the page's layout column widths would make the spec and the page
disagree without either being wrong.
