## Round 105 plan — parallel edges at GeneMANIA width, and a GeneMANIA fixture (proposed 2026-08-20)

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

