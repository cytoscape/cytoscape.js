/*
Round 55: known routing divergences between v3 and v4.

An entry here is a **contract, not a mute button**.  `compareRoutes`
fails when a divergence leaves its band in *either* direction, and
`routing.spec.js` fails when an entry names a scene, edge or field the
matrix no longer produces.  Both rules exist because
`scripts/throw-coverage.mjs` learned the same lesson the hard way: an
exemption list keyed by position, that nothing re-validates, quietly
hands its exemption to whatever moves into the slot.

Three entry kinds:

  - `expect: <model px>` — a numeric band.  The divergence is real,
    understood and bounded; the band is `[expect/2, expect*1.05 + tol]`.
    Shrinking fails too: a divergence that got fixed means this entry is
    now lying about the code.
  - `kind: 'v3-bug'` — v3 is non-finite here and v4 is not.  There is no
    v3 number to match, so what gets pinned is that **v4 stays finite**.
  - `kind: 'shared-bug'` — *both* sides are non-finite, with `fixIn`
    naming the round that will change that.  The entry fails the moment
    either side is fixed, which is precisely the failing test the fix has
    to satisfy.

Keys are `<scene>/<edgeId>/<field>`, the same string the diff prints.
*/

/*
A note on what is NOT here, because it is the more interesting half of
the round's first measurement.

The obvious first entries were the axis-aligned `round-taxi` NaNs, keyed
on `mid.x`/`mid.y`.  They were wrong, and the staleness check caught them
on the first run: on that configuration v4's *midpoint* is finite and
only `boundingBox()` collapses, so the entries named fields that never
diverged.  The finiteness spec in `routing.spec.js` owns that defect now,
with its own allowlist, because a bounding box is not comparable between
the libraries in the first place.

That is the staleness rule earning its place before the ledger had a
single real entry in it.
*/

export const DIVERGENCES = [
  // -- the boundary-approximation tier (decided design, measured here) ------
  //
  // `src/curve-geometry.mts` resolves a node boundary as: circles and
  // ellipses exact, rectangles exact (their box), round-rectangles as
  // their box, and every polygon as its *inscribed ellipse*.  That has
  // been recorded as a deviation in prose since the tier was written; the
  // three entries below are the first time it carries a number, measured
  // end-to-end on a real unbundled-bezier endpoint rather than at the
  // leaf.
  //
  // `test/curve-geometry.mjs`'s twin measures the same tier directly
  // against v3's `polygonIntersectLine` and reports 8.453 model px worst
  // case for a 40x24 triangle; this scene reads 8.462 at the end of an
  // edge.  Two independent tiers agreeing to a hundredth of a pixel is
  // the reason to trust either.
  //
  // `ellipse` and `rectangle` are deliberately absent: they match v3
  // exactly and must keep doing so.
  {
    key: 'shapes/triangle/*',
    expect: 8.462,
    reason: 'polygon boundary approximated by its inscribed ellipse — the worst case of the tier'
  },
  {
    key: 'shapes/diamond/*',
    expect: 3.293,
    reason: 'polygon boundary approximated by its inscribed ellipse'
  },
  {
    key: 'shapes/round-rectangle/*',
    expect: 0.008,
    reason: 'round-rectangle boundary approximated by its box; 2.25 px at a corner, 0.008 on this chord'
  }
];

/** Entries that apply to a scene, for the staleness check. */
export const ledgerFor = ( scene ) => DIVERGENCES.filter( e => e.key.startsWith( `${scene}/` ) );
