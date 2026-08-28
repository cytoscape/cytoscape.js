## The v3-default `eh`, restored by bypasses

The maintainer: on `?network=v3-default`, edge `eh` "seems not quite
right".  Investigated, and the renderer is exonerated:

1. **Given v3's exact parameters, v4 routes `eh` identically** —
   measured through the parity page: `segmentPoints()`, endpoints
   and midpoint agree to the last float
   ((140,150)/(200,150)/(260,150); endpoints ±76.96/323.04), and the
   side-by-side render matches.  The defect is not in
   round-segments.
2. **The debug sheet cannot give `eh` its own arrays, and says so.**
   v3 styles `#eh` as round-segments with `segment-distances:
   [-50,-50,-50]`, weights `[0.25,0.5,0.75]`, radii `[50,50,50]`
   (`v3/debug/init.js:141-147`).  v4's list-valued curve props take
   constants only (the recorded 12b scope note,
   `src/style.mts:3486-3489`), so the whole edges section shares one
   parameterisation — `[20,-80]`/`[0.25,0.5]`/`[20,20]`
   (`debug/styles.js:672-676`), chosen to demo the family, not to
   match `eh`.  On screen that is a different curve entirely (a
   two-segment S against v3's three-segment flat-top), and the
   sheet's own header records the deviation
   (`debug/styles.js:564-572`).
3. **Round 63's `bypasses` section closes it, verified**: a bypass
   entry carrying v3's arrays for `eh` produces v3's exact
   `segmentPoints` — bypasses are per-element constants, which is
   precisely what per-edge list props are.  The sheet's header even
   names bypasses as "the other spelling" without noticing that for
   the *list* props it is the **only** spelling (no mapper form
   exists).
4. What remains visually after the arrays match is arc faceting at
   the radius-50 corners — round 93's defect, deliberately not this
   round's.
5. **The segment families have zero numeric parity coverage**:
   `routing.spec.js` probes bezier/taxi-era scenes and nothing with
   `segmentPoints()` (grep) — which is why nothing was watching this
   configuration.

### 96.1 — the sheet carries v3's per-edge arrays

`debug/styles.js`'s v3Default sheet gains a `bypasses` section with
v3's arrays for the four edges v3 parameterises individually: `ab`
(control-point-distances/-weights), `bc`, `ed`, `eh` (their three
different segment arrays).  The shared constants remain as the
family defaults for every other edge.  The header's deviation
paragraph is rewritten in the same commit — after this it records a
*closed* limitation with the bypass spelling shown, and the "what is
genuinely lost" sentence dies, because nothing is.

**Verified by** `test/modules/debug-harness.mjs` growing an
assertion that the v3-default fixture's `eh`/`ed`/`bc`/`ab` route
points match v3's values (hard-coded from the v3 probe — the fixture
is the spec's fixture, so the numbers are stable), and by driving
the page against v3's own debug page side by side, per the standing
rule.  Control: drop the bypass section once — the spec must go red
on all four edges.

### 96.2 — segment-family routing parity scenes

`routing.spec.js` gains segments / round-segments / round-taxi
scenes (v3's `eh` and `ed` parameterisations verbatim, plus a
negative-distance and an extrapolated-weight case), comparing
`segmentPoints()`, endpoints and midpoint through the existing
symmetric probe.  No adapter, no pixels — the suite's whole point —
so no `hasAdapter` skip (the standing note).  Control per round 27:
perturb one array in one side's options and watch the probe name the
field.

### Risks named at planning

- Bypasses interact with selection styling in the harness (the
  sheet re-states selection affordances); a bypass on curve params
  touches no colour channel, so nothing should move — the
  debug-harness selection spec is the existing gate.
- The v3 probe values encode v3's current build; if v3's fixture
  ever changes (it must not — it is a parity baseline), the spec
  says so loudly.
- None of this touches `src/`; if 96.2's probe surfaces a *real*
  routing divergence in the negative/extrapolated cases, that is a
  finding for its own fix, not something to absorb into this round.

**Open:** whether the other demo sheets (edge-types ports) want the
same bypass treatment for their per-edge arrays (check while in
there; same mechanism); whether `MIGRATING.md`'s list-props note
should name bypasses as the porting path for v3 sheets that mapped
them (recommended: yes, one sentence).


### Landed (2026-08-28)

Both items shipped as planned, the opens were both taken as
recommended, and the negative/extrapolated risk did not materialise —
the new scene measured those cases clean, so there was no finding to
absorb or to ledger.

**96.1 — the sheet.**  The v3Default sheet's `bypasses` section carries
v3's four arrays verbatim; the header paragraph now records a closed
limitation, and the "what is genuinely lost" sentence is gone, because
nothing is.  One thing the plan did not have right: the four-edge
control was **impossible as specified**, because the sheet's shared
family constants *were* `ab`'s and `bc`'s arrays — the port had used
those two edges' parameterisations as the family defaults, so half the
recorded deviation had never been visible and dropping those two bypass
entries would have changed nothing.  The family defaults are re-chosen
distinct from every bypass entry (they now parameterise only an edge
*toggled* into a family, since every edge that starts in one is
bypassed), and with that the control means what it says: deleting the
section moves all four edges.

**96.1 — the numbers.**  The spec pins the four edges' route points at
the page's own layout (grid, cols 3) with the viewport-derived bounding
box made explicit, so the values are deterministic headless.  Their
provenance is a probe run through `playwright-page/parity.html` with
both libraries at those exact positions and parameters: `ed` and `eh`
agreed v3-vs-v4 **to the last float** — the plan's fact 1, re-verified
at the fixture's own geometry — so their pinned segment points,
endpoints and midpoints are v3's own values.  `ab` and `bc` route
through node `b`, a round-hexagon, whose boundary v4 resolves as its
inscribed ellipse (the ledgered tier), and sat within 0.9 model px of
v3; their pinned values are v4's, endpoints left to the parity suite.
One measurement worth keeping: the border widths feed the intersection
frame identically in both libraries (border 0 vs 1 moved both sides'
numbers by the same amount), so the probe had to carry the real sheet's
borders before its numbers matched the headless run.

**96.2 — the scene.**  `segment-arrays` joins the matrix: v3's `eh` and
`ed` parameterisations verbatim at the fixture's own orientations,
v3-default's round-taxi, a mixed-sign-distance case and an
extrapolated-weight case — with the v4 side carrying the per-edge
arrays as `bypasses`, so the scene also measures the bypass path
against v3's id selectors.  Landed clean: 50 fields, 0 diverged, max
delta 2.55e-6 model px (39x headroom).  The round-27 control needed one
correction en route: the first perturbation edited the scene's shared
`rows` table, which feeds *both* sides, and read clean — the
perturbation has to land on one side's built style, which the scene's
comment now says.  Done properly (`-50.5` in the bypass copy only), the
probe named `eh/interior[1].x by 0.5000` and `eh/mid.x by 0.4965`.

**The opens.**  The edge-types sheet's single unbundled-bezier row got
v3's `120`/`0.1` back through a bypass on its edge (`s1-0`), so it and
the multi row draw different curves again — the demo's point; its
segments and round-segments rows share one array in v3 too, so nothing
else there was collapsed.  `MIGRATING.md`'s bypass section gained the
sentence naming bypasses as the porting path for per-edge list-prop
arrays.

Verified by `npm run -s verify`, the debug-harness spec (control run:
section deleted, spec red), the routing suite (28 passed, control run:
one-sided perturbation named the field), and both debug pages driven
side by side — v4's `?network=v3-default` against v3's own page on
:3334, where `eh`, `ed`, `bc` and `ab` now draw the same four curves.
