## Round 56 — the arrow gap, landed (2026-08-07)

Round 55 designed this fix, measured it, and did not land it.  This round
landed it, and the useful half of the record is the four places where
measurement contradicted the design note it was working from.

### What was wrong

v3 keeps **two** shortened points per edge end and they are not the same
point: the drawn line stops `arrowShapes[shape].gap(edge)` behind the
node boundary, and the arrow *tip* sits `spacing(edge)` behind it.  v4
had neither.  Its line ran to the node **centre**, so it showed through
every hollow head, composited twice under every translucent one, and
leaked a wedge past every filled tip.

A second defect, which no plan had predicted, came out of rendering the
scenes rather than reasoning about them: a hollow head **strokes its
outline**, so its ink reaches half a stroke width *outside* the polygon —
furthest out at the back corners, where two edges meet acutely.  The
arrow quad's margin was 1 px, so v3's corner tabs were cut off flat.
That is the "clipping around the back corners" the maintainer reported,
and it is the same defect shape round 27.6 fixed longitudinally (a
hardcoded `0.3` clipping the compound heads) arriving in the lateral
direction.

### The carrier, and why the shape word travels rather than a trim

`edge.width` widened from one component to two: lane 0 the width, lane 1
a bit-exact copy of `edge.arrowShapes`.  All four edge vertex stages
already bind that column and **none has a spare storage-buffer slot**, so
this is the only way the shape word reaches the stage that has to shorten
the line without a new binding anywhere.  `GraphStore.setArrowShapes` is
the single writer and copies through a `Uint32Array` view of the column's
own buffer — exact for any word, rather than exact only while the packing
happens to leave bit 23 clear.

Round 55 logged **CPU-computed trims** as the alternative.  The reason to
prefer the word is not the 8 bytes: the head is drawn at the
*quantized* arrow-scale, so a gap derived from the same quantized value
meets the head exactly, where one computed from the unquantized scale
would leave a sub-pixel seam.

### Where the gap applies — routing, not paint

The lesson the new `curved-arrows` routing scene bought: v3's
`storeAllpts` builds the **drawn path** from `rs.startX/Y` and
`rs.endX/Y`, the gap-shortened points.  So a head shortens the *curve
itself*, and its midpoint and its flattened bound follow.  A trim written
as "stop drawing early" would have passed every pixel scene and diverged
here — it did, by 2.585 px on `mid.y`, before the fix.

And v3's straight midpoint is not the chord's:

    rs.midX = ( rs.startX + rs.endX + rs.arrowStartX + rs.arrowEndX ) / 4

which lands back on the chord midpoint only when both ends carry the same
head.  That is why the symmetric `arrows` scene reported `mid` clean for
a whole round while getting the endpoints wrong.  Four rows of the new
`asym-arrows` scene reproduce a hand-derived v3 formula **exactly** —
`none->triangle` 120.100000, `triangle->none` 129.900000,
`diamond->chevron` 125.122500, `tee->triangle-tee` 120.600000 — which is
the third independent confirmation of the gap constants, after round 55's
probe of v3's own `registerArrowShapes` and the harness measuring v3's
rendered endpoint from the other direction.

### Four predictions measurement corrected

1. **Round 55's design note is half right, and the half that is wrong is
   its scope rather than its idea.**  It says trimming to "the head's
   back extent" reproduces v3's erase.  Two corrections, and the second
   was the maintainer's, not the round's:
   - *Back extent* is the wrong depth for a **concave** head.  v3 shows
     the line through a `vee`'s notch, so the trim has to stop at the
     head's **contiguous axial depth** — 0.15 for `vee` against a 0.3
     back extent.  `ARROW_AXIAL_DEPTH` is computed by walking the axis
     rather than declared, for the reason 27.6's bound is computed.
   - The round's *first* answer extended that trim only for **hollow**
     ends, chosen from an A/B rather than from a principle, and the
     maintainer pushed back: if round 55's approach works for most head
     types, why not use it for most?  Re-derived, the principle is
     **"does the head hide the line?"** — an opaque filled head does, so
     v3's plain `gap` is exact and shortening further would cut the
     slivers v3 leaves where the head is narrower than the line; a
     hollow *or translucent* head does not, so v3's `destination-out`
     erase is what hides the line and the trim must reach the head's own
     depth.

   Measured three ways on the corrected suite, and the generalisation is
   strictly better than either blanket rule:

   | scene | hollow only | always | never | **hollow or translucent** |
   |---|---|---|---|---|
   | `arrow-alpha` | 0.853% | 0.000% | 0.853% | **0.000%** |
   | `closeup-gap` | 0.020% | 0.263% | 0.020% | **0.020%** |
   | `closeup-heads` | 0.000% | 0.047% | 0.000% | **0.000%** |
   | `closeup-curves` | 0.005% | 0.092% | 0.005% | **0.005%** |

   A translucent edge with arrowheads is now **pixel-identical to v3** —
   0 differing pixels — which closes the last of the five things the
   maintainer reported at the head of round 55.
   The flag rides in `edge.width`'s mirror lane, not in
   `edge.arrowShapes`: the mirror is v4's own private channel to the
   vertex stages, so spending its copy of the reserved span costs the
   real column's reserve nothing (which item 23 is about).  That makes
   the mirror a **derived** word rather than a bit-exact copy, and the
   store re-derives it from *both* inputs — the shape word and the two
   stored arrow colours.
2. **`parity-arrow-alpha` was measuring the wrong thing** — round 55's own
   cautionary case, one level up.  At `arrow-scale: 4` its heads are
   longer than the chord, so they overlap *each other*, and v3 erases
   before painting each one; the scene read a head-over-head difference
   under a name that says line-over-head, and sat at 18.6% after the fix
   for that reason alone.  Retuned to scale 1.5: **0.853%**, with an
   opaque-line control of **0.000%**.
3. **The goldens could not have caught any of this, so one was built that
   can.**  Measured on one machine, pre- and post-change: 11 of 43
   goldens moved, the largest by **0.178%**, against a 0.5% bound.  That
   is not a tuning accident — it is what the trim *is*: v3 sizes its gap
   so the line stops under the head, so on an opaque filled head the
   whole difference is covered, and every arrow golden in the suite used
   opaque filled heads.
   The new `arrow-gap` golden is built from the heads that do **not**
   cover it — hollow and translucent, four rows, at zoom 4.

   Its two
   controls: with the trim degraded to v3's plain `gap` it moves
   **1.394%**, and with the trim removed entirely (v4 before this round)
   **5.253%** — 2.8x and 10.5x its bound, against the 0.178% the other 42
   managed between them.
4. **`arrow-shape` is not a property in either library.**  v3 registers
   only the four prefixed spellings, so the bare name the routing sheets
   carried was a no-op v3 warned about on every scene — invisible because
   `routing.spec.js` does not watch the console, and harmless only
   because it named the value already in force.  Found when a close-up
   *pixel* scene copied the idiom into a suite that does watch.

### Measured

| scene | before | after |
|---|---|---|
| `parity-arrow-gap` | 3.537% | **0.000%** |
| `parity-arrow-hollow` | 11.775% | **0.442%** |
| `parity-arrow-alpha` | 26.707% | **0.853%** (retuned) |
| `closeup-gap` | 5.610% | **0.020%** |
| `closeup-heads` | 0.149% | **0.000%** |
| `closeup-hollow` | 2.555% | **0.898%** |
| `closeup-edges` | 0.093% | **0.004%** |
| `closeup-curves` | 0.972% | **0.005%** |

Four scenes with nothing to do with arrows went to *exactly* zero —
`basic`, `transform`, `opacity-split`, `compound-arrows` — because the
line no longer runs under a translucent node.  Routing: `arrows` is 0
diverged of 42; `asym-arrows` and `curved-arrows` diverge only by the
arrow-scale quantization, pinned entry by entry in the ledger.  **No
`test.fail` marker is left anywhere in the suite** — every one was
earned off.  109 visual + routing, 104 renderer, 2046 Node, 250 module,
24 soak specs green, and the debug harness driven at
`?network=v3-default` shows heads on their boundaries with no line
through the hollow interiors and no cut corners.

### The close-up tier

The maintainer asked for parity tests that zoom in closely enough to
judge fidelity.  Five scenes (`parity-closeup-*`) render **short edges at
zoom 3-5**, on the property that anti-aliasing is a boundary effect and
does not scale: zooming grows the ink while the fringe stays a pixel
wide, so AA's share of the mismatch falls and the bounds can be 4-20x
tighter than the zoom-1 tier's 2-3%.  Each bound is set from that scene's
own measured control.

`closeup-curves` with its heads off reads **0.002%** — three curve
families magnified 3x, two pixels from v3.  That is the strongest
statement in the suite that v4's routing is exact.

### Goldens: six were cropping the graph

Measured every scene's rendered bounding box against its exported
viewport: **six of 43 spill**, worst `arrow-shapes` at **109 px** below a
300 px canvas — over a third of the scene, and an arrow golden at that.
The six get a canvas that fits, and `expectGraphFits` now runs before
every golden diff so a scene that outgrows its canvas fails loudly.

Uncropping `arrow-shapes` found the better defect underneath: round 27.6
added v3's four compound heads to the scene's `shapes` list and **never
added their mapper clauses**, so all four fell through to `triangle` —
and their rows are exactly the ones the crop removed.  Two defects hiding
each other: the crop hid the missing mapper, and the missing mapper meant
the crop appeared to remove nothing that looked wrong.  The golden had
been showing seven heads while naming eleven since 27.6.

### Recorded deviations

- ~~**Edge labels and the overlay/underlay/casing strokes ride the
  untrimmed path.**~~  *Closed by round 58 (2026-08-09).*  A binding, not
  a decision: both vertex stages sat at
  the 8-storage-buffer budget with no slot for `edge.width`, and a layout
  entry counts even for a binding the shader never reads.  An edge label
  on an arrowed bezier anchored ~2.6 model px from what `midpoint()`
  answers.  The fix was to free a binding, which round 58's fused
  `node.outerGeom` column did; logged rather than guessed at, and then
  taken as its own round.
- **Two translucent heads that overlap composite** where v3's erase
  flattens them.  v4 has no erase pass by design (decision 1 of round 55).
- **A hollow head's back corners are radiused** where v3 miters them —
  offsetting a distance field rounds a join by construction.  That is
  *all* of `closeup-hollow`'s 0.898% residual: its `filled` control reads
  0.000%.

### Open call raised — `arrow-scale` is quantized to 1/16

`edge.arrowShapes` stores the scale as an integer x16 (round 13 B7), so
`arrow-scale: 1.4` is drawn and measured at **1.375**, 1.8% small — and
it is not only readback, as the ledger line said: the head's *size*, v3's
`gap` and v3's `spacing` all derive from it.  Every residual in
`asym-arrows` and `curved-arrows` is this and nothing else.  See open
call 23.
