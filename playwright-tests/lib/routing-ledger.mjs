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
    reason:
      'polygon boundary approximated by its inscribed ellipse — the worst case of the tier',
  },
  {
    key: 'shapes/diamond/*',
    expect: 3.293,
    reason: 'polygon boundary approximated by its inscribed ellipse',
  },
  {
    key: 'shapes/round-rectangle/*',
    expect: 0.008,
    reason:
      'round-rectangle boundary approximated by its box; 2.25 px at a corner, 0.008 on this chord',
  },

  // -- the arrow-scale quantization (round 56, measured here) --------------
  //
  // `edge.arrowShapes` stores `arrow-scale` as an integer x16 in its top
  // byte (round 13 B7), so a scale is rounded to the nearest 1/16 before
  // anything reads it.  Every arrow quantity derives from that value —
  // the head's size, v3's `gap` and v3's `spacing` — so all three carry
  // the rounding.
  //
  // These scenes ask for `arrow-scale: 1.4`, which is not representable:
  // round(1.4 x 16) = 22, so v4 draws and measures at **1.375**, 1.8%
  // small.  Both numbers below are reproduced *exactly* by recomputing
  // v3's formula at 1.375 rather than 1.4, which is what identifies the
  // cause rather than merely bounding it:
  //
  //     triangle gap   2 x 7 x 1.400 = 19.600   ->  mid.x 120.100000  (v3)
  //                    2 x 7 x 1.375 = 19.250   ->  mid.x 120.187500  (v4)
  //     circle spacing getArrowWidth(7, 1.400) x 0.15 = 12.483196     (v3)
  //                    getArrowWidth(7, 1.375) x 0.15 = 12.260282     (v4)
  //
  // Deliberately pinned rather than dodged by picking a representable
  // scale: the deviation is real and visible in the *drawn head*, not
  // only in an accessor, and it is logged for the maintainer as an open
  // call.  The bands are two-sided, so re-quantizing the field — the
  // contract already names that as the escape hatch — fails these
  // entries and forces them to be re-measured.
  {
    key: 'asym-arrows/none-triangle/mid.x',
    expect: 0.0875,
    reason:
      'arrow-scale 1.4 quantizes to 22/16 = 1.375, shrinking the target gap by 0.35 px',
  },
  {
    key: 'asym-arrows/triangle-none/mid.x',
    expect: 0.0875,
    reason: 'arrow-scale quantization, source end',
  },
  {
    key: 'asym-arrows/tee-triangle-tee/mid.x',
    expect: 0.0875,
    reason:
      'arrow-scale quantization on the triangle-tee end (tee is a constant gap, unaffected)',
  },
  {
    key: 'asym-arrows/diamond-chevron/mid.x',
    expect: 0.0022,
    reason:
      'arrow-scale quantization, mostly cancelling between two heads of similar gap',
  },
  {
    key: 'asym-arrows/vee-circle/tgt.x',
    expect: 0.2229,
    reason:
      'arrow-scale quantization inside circle spacing = getArrowWidth x 0.15',
  },
  {
    key: 'asym-arrows/vee-circle/mid.x',
    expect: 0.0973,
    reason:
      'arrow-scale quantization, the circle end contributing its spacing to the mid average',
  },
  {
    key: 'curved-arrows/unbundled-bezier/mid.y',
    expect: 0.0269,
    reason: 'arrow-scale quantization moving the gap-shortened bezier endpoint',
  },
];

/** Entries that apply to a scene, for the staleness check. */
export const ledgerFor = (scene) =>
  DIVERGENCES.filter((e) => e.key.startsWith(`${scene}/`));
