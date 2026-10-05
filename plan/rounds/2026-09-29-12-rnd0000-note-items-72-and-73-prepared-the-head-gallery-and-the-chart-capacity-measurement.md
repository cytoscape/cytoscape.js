## Items 72 and 73 prepared — the head gallery and the chart capacity measurement

**Decisions taken 2026-10-03:** the alpha interview and plans 146/80
supersede the alternatives and recommendations below. This file remains the
measurement record, not an unresolved sitting agenda. Triangle-cross is
removed without an alias; charts use a 255-value cap, address-only references
and 8-byte records. Nothing in this note establishes implementation.

The gallery observations below describe the pre-round code and retain the
evidence that led to the decisions. Round 146's landed behavior and its
before/after renderer measurements are recorded at the end of this item.

The eleventh sitting scheduled two short sittings: the arrow-shape review
(item 72) before round 77's SVG export, and chart kinds and their data
capacity (item 73) before round 80's charts.  Each was to be held "on a head
gallery and a capacity measurement prepared for them".  This note is that
preparation.  It takes no calls.  Each item ends with the sitting's questions
as numbered options with their consequences and a recommendation.  `src/` is
unchanged.

Machine: i9-9900K, Radeon RX 580 (Polaris, GCN 4), Chromium via ANGLE/Vulkan.
`npm run gpu` reports HARDWARE (adapter `amd · gcn-4`) and timestamp-query is
available.

### Item 72 — the arrow-shape review

**The gallery.** `debug/arrow-gallery.html` is linked from the harness header
(commit 8d7847a9).  One model is drawn twice: v3's canvas renderer on the
left, v4's WebGPU renderer on the right, with pan and zoom synced.

- **Rows:** one per head.  All eleven v3 shapes, ordered so the
  near-duplicates sit together: triangle, triangle-backcurve, vee, chevron,
  triangle-tee, triangle-cross, tee, square, diamond, circle, circle-triangle.
- **Columns:** edge width 1, 4 and 12, each at `arrow-scale` 1 and 2.
- **Heads per edge:** source, mid-target and target, all of the row's shape.
- **Controls:** filled or hollow ends (mid stays filled, per item 21); line
  opacity 1 or 0.5; head colour contrasting or same as the line; side-by-side
  or stacked; a focus menu.
- **Guide bar:** a translucent red bar exactly the edge's width stands beside
  each tee-like target head.

Screenshots are in `plan/pictures/item-72-arrow-gallery/`:

- `filled-all.png` and `hollow-all.png`: every cell.
- `filled-w{1,4,12}-s{1,2}.png`: one column each.
- `filled-teelike-thin.png`: the three tee-like rows at widths 1 and 4.
- `hollow-w4-s1.png` and `hollow-w12-s2.png`: hollow close-ups.
- `translucent-w12-s2.png`: line opacity 0.5, heads the line's colour.

**What the pictures show:**

1. **Filled parity holds for every head in every cell.** At widths 1/4/12 and
   scales 1/2, v4's heads are v3's to the eye: same size law
   (`max((13.37·w)^0.9, 29) · scale`), same tables, same gaps.  Consolidation
   is a vocabulary question, not a repair.
2. **triangle-tee and triangle-cross are one picture at ordinary widths.**
   - Both are v3's identical triangle plus a bar behind it.  triangle-tee's
     bar sits 0.4–0.5 behind the tip and is `0.1 × size` thick.
     triangle-cross's bar sits at 0.4 and is exactly the edge width thick.
   - At width 4 the bars are 3.6 px vs 4 px, and at width 12 they are 9.7 px
     vs 12 px.  Neither the gallery nor a reader can tell them apart.
   - At width 1 they do differ: 2.9 px vs a 1 px hairline, which nearly
     vanishes (v3 #1921, "the crossline disappears").
   - triangle-cross is also the one head whose geometry depends on the edge
     width.  It is a special case in both renderers: v3 bypasses its path
     cache, and v4's `crossBarSD` needs the width varying.
3. **The tee's bar is never the edge width, except by accident near w = 3.**
   The bar is `0.1 × size`.

   | edge width | 1 | 2 | 3 | 4 | 8 | 12 | 16 | 24 |
   | --- | --: | --: | --: | --: | --: | --: | --: | --: |
   | tee bar, px | 2.9 | 2.9 | 2.9 | 3.6 | 6.7 | 9.7 | 12.5 | 18.0 |
   | bar ÷ edge width | 2.90 | 1.45 | 0.97 | 0.90 | 0.84 | 0.80 | 0.78 | 0.75 |

   Thin edges get a bar thicker than the line.  Edges thicker than about 3 px
   get a bar thinner than the line, which the red guide bars show in every
   width-12 cell.  This is v3's #1183 ("tee and triangle-tee should be as
   thick as the edge") and #1656 (Pathway Commons' notes on edge-width tees).
4. **Hollow compound heads differ, as recorded.**
   - v3 strokes hollow triangle-tee, triangle-cross and circle-triangle.
   - v4 fills them: `COMPOUND_ARROWS` falls back to filled, because
     `abs(sd)` of a union is wrong at a seam.
   - Every other hollow head matches, triangle-backcurve included.
   - The compounds' parts are disjoint (triangle-tee, triangle-cross) or touch
     at one point (circle-triangle), so there is no seam to get wrong: each
     part can be stroked on its own.
   - A flagship app hits this: Cytoscape Web maps desktop's
     `CROSS_OPEN_DELTA` to a hollow triangle-cross.
5. **Translucent lines composite under some heads where v3 erases them.**
   - Seen at line opacity 0.5 with heads in the line's colour.
   - v4 shows the line through every mid head, into the circle and
     circle-triangle end discs, and through circle-triangle's triangle.
   - v3's `destination-out` removes the line under the head.
   - This is round 56's recorded deviation.  An SVG serializer inherits v4's
     behaviour, since SVG has no erase short of a mask or clip per head.
   - No vocabulary call rests on it.  It is listed so the sitting sees it.

**Usage census** (read-only; GitHub issues and code, 2026-09-29; code search
hit a rate limit before iVis and PathwayCommons were checked):

| Emitter | Heads it can emit | Hollow |
| --- | --- | --- |
| Cytoscape Web (`EdgeArrowShapeType.ts`, `cyjsRenderUtil.ts`) | triangle (`arrow` rewritten), circle, diamond, square, tee, triangle-cross, none | yes (`open_*`; `cross_open_delta` → hollow triangle-cross) |
| cytoscape-explore (`shapes.js`) | none, triangle, circle, square, diamond, tee, triangle-cross | no |
| desktop cyjs export (`ArrowShapeSerializer.java`) | tee, triangle, circle, diamond, none; everything else → triangle | no |
| cx2js (NDEx) | triangle, circle, diamond, square, tee, **triangle-tee** (for CROSS_DELTA), none | yes |
| iRegulon web | triangle | no |
| EnrichmentMap web, GeneMANIA | no arrows | — |

- **Used everywhere:** triangle, none, tee, circle, diamond.
- **Used through desktop parity:** square, triangle-cross.
- **Rare:** triangle-tee, used only by cx2js as its stand-in for cross-delta.
  Cytoscape Web and explore map the same desktop shape to triangle-cross, so
  the two compounds already stand in for each other in the wild.
- **Emitted by no flagship app or converter:** vee, chevron,
  triangle-backcurve, circle-triangle, and `arrow-scale`.
- **The tracker's recurring complaint:** geometry that does not track the edge
  width (#1183, #1656, #1056, #2066, #2067, #3191).
- **Requests never merged:** pointy (#619), hooked (#622), open-arrowhead
  (#1020), crow's-foot (#2781), custom shapes (#2889).

**What each head costs downstream.**

- *SVG export (round 77).* A head is a path per part, placed at the CPU arrow
  point with the end-tangent angle.
  - SVG `<marker>` cannot carry v3's non-linear size law, so the serializer
    emits explicit paths regardless.
  - A head is therefore one table entry plus its hollow rule.
  - A width-dependent head needs per-edge geometry, which explicit paths give
    at no extra cost.
- *WebGL2 (rounds 73/137).* Heads are generated SDF cases from the same
  tables, so each head is one `switch` case and a compound is a `min`.
  - Width-dependent heads read the width varying that already exists.
  - Hollow compounds need a per-part stroke in both backends.
- *The id field.* 12 of 16 four-bit ids are used.  A merge frees one.

**The sitting's questions.**

1. **triangle-tee and triangle-cross.**
   - (a) Keep both, as v3 has them.  Two compounds and a width special case
     in every backend.  No migration.
   - (b) Merge into one head whose bar is `max(0.1 × size, edge width)`, and
     keep the other name as an alias.  Consequences:
     - Below 3 px the bar is triangle-tee's, so it stays visible (fixes
       #1921's vanishing crossline).
     - Above 3 px the bar is the edge width, up to 25% thicker than today's
       triangle-tee.
     - Readback of the alias answers the merged name, a MIGRATING row.
     - One fewer compound in SVG and WebGL.
   - (c) Merge on triangle-tee's `0.1 × size` bar.  Cytoscape Web's and
     explore's triangle-cross users get a 2.9 px bar where they had 1 px, and
     the tee still does not track the edge.
   - **Recommend (b).** It is the maintainer's "one head" and "tee matching
     the edge width" read together.
2. **The tee's bar.**
   - (a) v3's `0.1 × size`, keeping the mismatch in the table above.
   - (b) Exactly the edge width.  At width 1 the bar becomes a hairline.
   - (c) `max(0.1 × size, edge width)`, the same rule as 1(b).  Unchanged up
     to 3 px edges, the edge width beyond, and never thinner than the line.
   - Consequence of (b) or (c): tee joins the width-dependent heads.  Its v3
     `gap`/`spacing` constants (1 px each) are unaffected.  But `ARROW_BACK`
     (where the line stops under a hollow or translucent head) becomes
     width-dependent for tee, which is a new case: triangle-cross's per-shape
     back is its triangle alone, because its bar lies over the line.
     Visible change only on edges wider than 3 px, and only thicker.
   - **Recommend (c).**
3. **The rarely used heads: vee, chevron, triangle-backcurve,
   circle-triangle.**
   - (a) Keep all.  They are table entries, parity-verified in the gallery,
     and cost one path or one SDF case per backend.
   - (b) Alias them to their nearest common head.  This changes the picture
     for anyone who chose them.
   - (c) Drop them.  Every sheet naming them then throws on load, v4's rule
     for unknown values.
   - **Recommend (a).** Also keep the `arrow` alias for triangle.
4. **Hollow compound heads.**
   - (a) Keep the recorded fill-fallback.  Cytoscape Web's hollow
     triangle-cross stays filled in v4, a flagship-visible difference.
   - (b) Stroke each part separately: exact, because the parts are disjoint
     or touch at a point.
     - Same rule in WebGPU, WebGL2 and SVG.
     - The recorded deviation closes.
     - Cost: a per-part `abs(sd)` in the arrow FS and a golden that sets it.
   - (c) Make hollow compounds a sheet error.
   - **Recommend (b),** decided before round 77 so SVG does not serialize a
     fill it will later have to change.
5. **New heads** (pointy, hooked, open-arrowhead, crow's-foot, custom — all
   asked in v3, none merged).
   - (a) None before alpha.  The four free ids plus one from a merge stay in
     reserve.
   - (b) Add one now.  It would have to land in SVG and WebGL2 at the same
     time.
   - **Recommend (a).** Additive later.

### Item 73 — chart kinds and their data capacity

**The measurement.** `benchmark/chart-capacity.mjs` (commit fc377664) is a
prototype outside `src/`: the shipped renderer truncates at 16 slices, and its
ref stops at 255.

- **The shader.** It imports the shipped chart shader and derives each variant
  by exact text substitution.  Each substitution asserts that it matched once.
- **The layout.** `chart-capacity.html` binds exactly round 23's chart-pass
  layout and times the one render pass with timestamp-query.  Each figure is
  the median of 25 timed passes after 5 warm-ups.
- **Scenes** (2560 × 1600 target, i.e. 1280 × 800 at dpr 2):
  - `fit-25k`: 25,000 charted nodes at 12 device px, the whole graph just
    above the 8 px chart floor.
  - `close-1k`: the 1,000 nodes a zoomed-in view of the same graph shows, at
    60 px.
  - Both cover about 65% of the target with charts.
- **Assertions.** Every row reads the target back and must report the coverage
  it claims.
  - `pie-bsearch` must hash to exactly `pie-walk`'s pixels.
  - Its control, the bisection off by one, was run once and fails the run.

GPU ms per frame for the chart pass alone, RX 580:

| scene | variant | n=1 | 16 | 64 | 255 | 1024 | 4096 |
| --- | --- | --: | --: | --: | --: | --: | --: |
| fit-25k | pie-packed (shipped, verbatim) | 1.12 | 1.87 | 4.18 | — | — | — |
| fit-25k | pie-walk (n from header) | 1.13 | 1.92 | 4.35 | 14.45 | 55.38 | 218.72 |
| fit-25k | stripes-walk | 1.10 | 1.88 | 4.28 | 14.41 | 55.20 | 218.41 |
| fit-25k | **pie-bsearch** (cumulative stops) | 1.17 | 1.47 | 1.58 | 1.76 | 2.24 | 4.66 |
| fit-25k | heat-index (round 80, O(1)) | 1.10 | 1.27 | 1.24 | 1.23 | 1.34 | 1.72 |
| fit-25k | bar-index (round 80.2, O(1)) | 1.11 | 1.29 | 1.22 | 1.24 | 1.24 | 1.24 |
| fit-25k | scatter-walk (points in the chart FS) | 1.01 | 1.81 | 4.61 | 16.15 | 62.70 | 248.96 |
| fit-25k | line-walk (polyline in the chart FS) | — | 2.36 | 6.80 | 24.76 | 97.32 | 390.54 |
| fit-25k | scatter-inst (one quad per point) | 0.05 | 0.74 | 2.94 | 11.70 | 80.14 | 523.90 |
| close-1k | pie-packed (shipped, verbatim) | 0.62 | 0.97 | 2.06 | 6.61 | — | — |
| close-1k | pie-walk | 0.62 | 0.98 | 2.14 | 6.92 | 26.31 | 111.11 |
| close-1k | stripes-walk | 0.61 | 0.98 | 2.12 | 6.90 | 26.28 | 111.05 |
| close-1k | **pie-bsearch** | 0.64 | 0.77 | 0.84 | 0.86 | 0.94 | 1.12 |
| close-1k | heat-index | 0.61 | 0.66 | 0.70 | 0.67 | 0.67 | 0.72 |
| close-1k | bar-index | 0.62 | 0.69 | 0.70 | 0.68 | 0.68 | 0.68 |
| close-1k | scatter-walk | 0.56 | 0.98 | 2.32 | 8.00 | 31.11 | 128.21 |
| close-1k | line-walk | — | 1.31 | 3.73 | 13.45 | 53.16 | 213.52 |
| close-1k | scatter-inst | 0.02 | 0.06 | 0.13 | 0.49 | 2.08 | 10.38 |

"—" in pie-packed means the record cannot be expressed in `offset | n << 24`
(n > 255, or a pool past 2^24 floats).  line-walk needs two points, so it has
no n = 1 row.

**What the numbers say:**

1. **The walk is the whole cost of the ordered kinds.** Pie and stripes walk n
   stops per fragment: about 0.053 ms per value on `fit-25k`, 0.026 on
   `close-1k`.
   - At 16 values the pass costs 1.9 ms.
   - At 64 values it costs 4.3 ms, round 80's proposed cap: a quarter of a
     60 Hz frame for one decoration.
   - At 255 values it costs 14.5 ms, the whole frame.
2. **Storing cumulative stops and bisecting removes that cost.**
   - Bisection makes the pie O(log n): 1.47 ms at 16 (already below today's
     1.87), 1.76 at 255, 4.66 at 4096.
   - It draws the same pixels, verified by hash.
   - Readback differences adjacent stops.  `chartAt` already snaps to 1e-6,
     which hides the f32 residue.
   - With bisection, cost stops deciding the cap for pies and stripes.
3. **Heat and bar are flat, as planned.** Their region index is O(1): 1.2–1.3
   ms at every n up to 1024.
4. **A point series in the chart fragment shader is the pie walk again, only
   worse.**
   - scatter-walk costs about the same as the pie walk.
   - line-walk costs 1.5×: a segment distance per value.
   - Neither can be bisected, since the nearest point is not ordered by t.
5. **A point series as its own instanced draw scales with total points, not
   fragments.**
   - About 2–3 ns per point: 1k nodes × 1,024 points = 2.1 ms, but
     25k × 1,024 = 80 ms.
   - It wins wherever few nodes are on screen.  The pass it needs is
     CPU-countable, as round 73's rule 2 asks: an instance list of
     (slot, point) built on the CPU.
6. **The extra read of n-from-header is small.** pie-walk vs pie-packed:
   - +2–4% on `fit-25k` (1.92 vs 1.87, 4.35 vs 4.18).
   - +1–5% on `close-1k`.
   - On the O(1) and bisecting paths it is one read among a handful.

**Storage.** A record today is 7 header floats plus 3 floats per value: the
value, `r + g·256` and `b + a·256`.  That is **12 B per value**, plus 28 B of
header and the 4 B ref.

- 25k nodes × 64 values = 19.0 MiB of blob; × 255 = 73.6 MiB.
- The ref's 24-bit offset addresses 2^24 floats (64 MiB).
- The pool compacts only when waste passes half the live floats.

That caps the **charted-node count** before any per-kind cap:

| values per chart | 16 | 26 (desktop's pie) | 64 | 255 |
| --- | --: | --: | --: | --: |
| floats per record | 55 | 85 | 199 | 772 |
| charted nodes at 2^24 floats | 305,040 | 197,379 | 84,307 | 21,732 |
| … with maximal pre-compaction waste (÷1.5) | 203,360 | 131,586 | 56,205 | 14,488 |

At 255 values the shipped packing cannot hold the 25k-node scene at all:
19.3M floats.

**A latent defect the measurement found.** Nothing checks the offset.
`setChart` writes `(offset | n << 24) >>> 0`, and `CurveBlob.write` has no
bound.  So a pool past 2^24 floats ORs offset bits into the count field and
mis-draws silently.

- Reachable today: about 305k nodes charted at the 16-slice cap.
- `node.imageRef` uses the same `offset | count << 24` packing and shares the
  hazard.
- This is a task whatever the sitting decides: a guard that throws, or the
  packing change below.  It is recorded here and left unfixed, since this
  note changes no `src/`.
- **Guarded by round 145 (2026-09-29)**, for both refs, the packing
  unchanged: the store saturates an unaddressable offset and keeps the
  count exact, readback reads the pool's own offset table, and a pool
  past 2^24 floats degrades charts or images (round 138's order, one
  `gpuerror`) rather than drawing a wrong record.  The custom-polygon
  ref (`node.borderGeom[0]`) has the same exposure (the 1,048,577th
  8-point polygon node) and is logged there as a follow-up.

**Packing alternatives**, priced:

- **(P1) Keep `offset | n << 24`.** Cap 255.  The pool and node ceiling above
  apply.  Needs the overflow guard (landed in round 145).
- **(P2) The ref carries `offset + 1`, and n comes from the header.** The
  header's float 6 already holds n.
  - No count limit.
  - The pool is bounded only by the device's storage binding: 4 GiB on this
    RX 580 since round 138 requests the adapter's limits.
  - Costs one dependent read per fragment, measured above at +1–5%.
  - `node.imageRef` could take the same change.
- **(P3) 20-bit offset | 12-bit count.** 4,095 values, but a 4 MiB pool:
  about 19k nodes at 16 slices.  Rejected on arithmetic.
- **(P4) A second u32 column for n.** Unbounded, but +4 B per node slot,
  charted or not.  P2 gives the same result for free.
- **(S1) 8 B per value**: the f32 value plus the rgba8 colour as u32 bits,
  bit-cast.
  - The prototype's point kinds use it.
  - A third less blob: 25k × 255 → 49 MiB.
  - Writes must go through a `Uint32Array` view, so JS never canonicalises a
    NaN-patterned colour.
  - The WebGL2 port must hold the blob in an integer texture (`R32UI` +
    `uintBitsToFloat`), not a float texture, to stay bit-exact.

**Round 73's WebGL2 constraints**, checked against each option:

- The walk, the bisection and the O(1) index are fragment-only reads of a
  CPU-built blob: a data texture plus a GLSL ES 3.0 dynamic loop, with no
  compute and no storage writes.
- The instanced point draw needs a CPU-known instance count: rule 2.  A
  CPU-built (slot, point) list satisfies it.
- None of these is a problem.

**The sitting's questions.**

1. **The pie/stripes record and cap.**
   - (a) Keep the O(n) walk and cap at 64, as planned.  +2.4 ms over 16 at
     worst-case coverage; desktop's 26-slice pies fit.
   - (b) Keep the walk and cap at 32.  +1.1 ms.
   - (c) **Cumulative stops with bisection, cap 255.**
     - Cheaper than today's 16-slice walk at every n.
     - One record change (store running totals) and one FS change.
     - Readback differences the stops.
     - Round 80's pie cap then becomes a legibility and memory call, not a
       frame-time one.
   - **Recommend (c)**, in round 80.3 where the cap was to be set anyway.
2. **The cap for the O(1) kinds (heat-strip, radial-heat, bar).**
   - (a) The same cap as pies: one documented number for every region kind.
   - (b) Uncapped past the packing: with P2, 1,024+ bands cost nothing per
     fragment, but a band narrower than a pixel is not a chart.
   - **Recommend (a) at 255**, warn-once truncation as decided at the
     eleventh sitting.  Legibility, not cost, is the reason: a 12 px node has
     at most about 38 px of pie arc.
3. **Scatter and line in 4.0.**
   - (a) Not in 4.0, logged.  The record and packing must not foreclose them
     (P2 does not; P1's 255 would).
   - (b) In 4.0 inside the chart FS, capped around 64 points.  Costs 4.6 ms
     (scatter) or 6.8 ms (line) at `fit-25k`, and a cap a scatter plot
     outgrows (the maintainer's own objection).
   - (c) In 4.0 as their own instanced pass.
     - The scalable design: 2 ms for 1k nodes × 1,024 points.
     - But a new pipeline, a WebGL2 port, an SVG half and a golden before
       alpha.
     - No named consumer: round 80 declined line charts for want of one;
       only enhancedGraphics draws them.
   - **Recommend (a)**, with (c) named as the design when a consumer asks.
4. **The ref packing.**
   - (P1) with a guard, or (P2), from the list above.
   - **Recommend P2** for charts in round 80 (the header grows 7 → 9 there
     anyway).
     - The same change to `node.imageRef` is an optional task.
     - The overflow guard lands either way, as a task before round 80.
   - **(S1) 8 B values: recommend yes**, in the same record change.  It is
     free while the format is open, and closed once the WebGL2 port copies
     it.
