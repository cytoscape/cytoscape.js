## Edge layer strokes: the caps, the corners and the arrow reach

The maintainer, driving the page: v4's edge overlays are visibly not
v3's in three ways.  The stroke ends **square** where v3's are round;
a **segments** edge can double its translucent stroke over itself at
a corner (curved edges look right); and the stroke **stops short of
the arrowhead**, where v3's overlay covers the head.  All three
reproduce in the code, and each has a distinct mechanism, verified:

1. **The butt caps are a recorded deviation, not an accident.**
   `vsEdgeLayer`'s header says so outright ("v3 strokes overlays
   solid with round caps — v4 keeps butt caps, a recorded
   deviation", `src/render/shaders.mts:2928-2931`), and
   `src/README.md`'s layer paragraph records the same.  v3:
   `drawEdgeOverlayUnderlay` sets `context.lineCap = 'round'` for
   every edge type except a self edge on the no-paths fallback
   (`v3/src/extensions/renderer/canvas/drawing-edges.mts:183-187`),
   and `drawEdge` sets `lineJoin = 'round'` before any layer draws
   (:129).  Round 13 A2 took the cheap quad and logged it; the
   maintainer has now seen the difference on screen, which is the
   review the deviation was waiting for.
2. **The doubling is per-quad compositing at a clamped miter.**  v3
   strokes each layer as **one path stroked once** — Canvas
   composites a stroke atomically, so a path crossing itself can
   never darken itself, whatever the opacity.  v4's route-family
   layer strip (`vsCurvedLayer`, `src/render/shaders.mts:3270-3360`)
   emits a quad per polyline step, joined by a miter whose scale is
   clamped (`1.0 / clamp(dot(n, nIn), 0.1666, 1.0)`, :3346) —
   past the clamp the strip folds over itself, adjacent quads
   overlap, and premultiplied alpha blending composites the overlap
   **twice**.  A hairpin (the `length(m) < 1e-4` fallback, :3339)
   overlaps by construction.  The bezier families are immune because
   their strip extrudes along the *shared* normal at each t
   ("watertight without miter joints", the curved shader's header) —
   which is exactly the "curved seems to work" observation.  Taxi
   rides the same route walk as segments and shares the defect.
3. **The band never reaches the head.**  Since round 58 both layer
   VSes span the **draw trim** — the same shortened span the line
   itself draws (`shaders.mts:2969-2975`, :3292-3298) — with butt
   ends, so the arrowhead sits wholly outside the stroke.  v3 spans
   its shortened path too, but its round cap extends **half the
   stroke width past each end** (Canvas cap semantics), which is
   what paints over the head; and its z-order draws overlay after
   arrows.  v4's z-order already matches (underlay, casing, edges,
   arrows, then overlay — `renderer.mts:1773-1889`), so the whole
   difference is geometric reach, and most or all of it should fall
   out of the round caps.  Measure before adding machinery.
4. **Ledger item 27 is the same surface and still open**: v4 strokes
   the band at `width + 2 × padding`, v3 at `2 × padding` alone.
   Any cap/reach fix retunes the same scenes and goldens, so the
   call belongs to this round rather than a later one.

### 88.1 — round caps on every layer stroke

The straight quad extends by half the stroke width at each end and
the fragment stage gains capsule coverage about the span — the
dash-cap machinery already computes exactly this shape
(`capsule distance about the segment`, `shaders.mts:317-322`), so
the SDF is reuse, not invention.  The curved and route strips extend
their end steps the same way.  The self-edge exception (v3 butt-caps
a self edge only on its no-paths fallback, which path caching makes
the rare case) is **not** copied: v4 rounds self edges too, matching
v3's common path.  The README deviation sentence and the shader
comment are rewritten in the same commit — after this item they
would be recording a deviation that no longer exists.

**Verified by** a close-up parity scene (round 56 rules: short
edges, zoom 3-4) with a **translucent** overlay and underlay — the
round-55 lesson applies squarely, an opaque stroke at zoom 1 painted
most of this difference over — plus the control run with the cap
coverage disabled once, which must jump; the existing `edge-layers`
golden regenerates (exact goldens, so it *will* move; look at the
diff before committing it).

### 88.2 — the route joins stop double-blending

The observable to pin: **uniform alpha along a translucent stroke**,
corners included, at any corner angle.  Candidate mechanisms, to be
chosen by measurement in-round:

- **Equal-depth self-rejection** (recommended first look): draw the
  layer pass with depth write on at a per-edge depth so a second
  fragment of the *same* edge fails the depth test — self-overlap
  rejected, cross-edge blending (which v3 also double-blends,
  correctly) preserved.  The trap to check: the pass currently
  writes no depth (`edge-pipeline.mts:154-159`) *because* it must
  stay under nodes and not occlude later draws — the arrows and
  labels that follow must be shown unharmed.
- **Watertight join geometry**: bevel or round joins built from the
  cap discs 88.1 adds, replacing the clamped miter — no fold-over,
  but corner discs overlap their own quads, so this only closes the
  defect if the coverage math excludes the overlap.
- **Offscreen coverage compositing** (last resort — a texture and a
  pass per layer per frame).

**Verified by** a close-up parity scene: a segments edge with an
acute corner and a translucent overlay, diffed live against v3; a
second scene at a near-hairpin angle; controls prove both scenes
fail against HEAD before the fix.  Count the corners, not the
edges — the difference scales with joins, so several bends per edge.

### 88.3 — the arrow reach, measured then matched

After 88.1 lands, re-diff the arrow scenes live against v3: a round
cap reaching `(width + 2 × padding) / 2` past the trim may already
cover what v3's cap covers.  If a residue remains, extend the layer
span toward the arrow tip to whatever distance the parity probe
says v3 actually paints — measured through
`playwright-page/parity.html`, not inferred from v3's source — and
only then consider an arrow-quad layer pass, which nothing verified
so far suggests v3 has.  The scene that decides it uses **large
heads and a small padding**, the configuration where the cap cannot
reach the tip.

**Verified by** the live parity diff on an arrows + overlay scene
(hollow heads, per round 56 — filled heads paint the difference
over), with the numbers recorded in this round's record.

### 88.4 — ledger item 27 decided

The call on the band width: **keep v4's `width + 2 × padding`**
(recommended — the halo is always visible, and the formula matches
the node overlay's own semantics; v3's `2 × padding` renders an
*invisible* halo whenever padding is under half the line width,
which reads as a bug, not a look), recorded as a deliberate
deviation in `src/README.md` and `MIGRATING.md`, and the item
closed.  The alternative — match v3 for pixel parity — stays one
line in the record; flipping it later is a constant.  Whichever way,
the parity scenes above must tolerate the band-width difference
explicitly (mask or match the padding), so a bound failure means
caps/joins/reach and never the recorded formula.

### Risks named at planning

- Every item changes rendered output: the `edge-layers` golden and
  any layer-adjacent goldens regenerate (exact since 57.1e — read
  the diffs, then commit the PNGs), and the affected parity bounds
  retune downward, never up.
- Shader edits follow the WGSL rules: tagged literals, no
  interpolation inside comments; the minify transform runs in dev,
  so Playwright exercises what ships.
- 88.2's depth-write candidate touches the frame graph's occlusion
  assumptions — drive `debug/` before and after
  (`?network=edge-types` and `edge-arrows`, selecting edges to light
  the overlay machinery), per code standard 5.
- Every new parity scene runs its control once (round 27); each item
  lists its control with the scene.
- The straight, curved and route families each have their own layer
  VS — a cap fixed in one and not the others is exactly the kind of
  partial fix a zoom-1 scene would pass; the close-up scenes cover
  all three families.

**Open:** whether 88.2 lands equal-depth or geometry (decide by
measurement, not preference); whether v3's overlay reach needs any
machinery beyond the round caps (88.3 measures before building);
whether the self-edge cap exception is worth a recorded note
(recommended: one sentence in the README, no code).

**Decided at the eleventh design sitting (2026-09-28):** **as planned,
landing before the WebGL implementation** so the port copies the final
strokes: 88.2's and 88.3's mechanisms chosen by measurement, self-loops
rounded too with a one-sentence README note; 88.4 is already decided
(PLAN.md item 27: keep `width + 2 × padding`).

### The round, as carried out (2026-09-29)

All four sub-rounds landed the same day, one commit each: 88.1
`4a0c5f4a`, 88.2 `73818005`, 88.3 `418b3e5d`, 88.4 `87552aa6`; the
close is the commit that renames this file.  The plan's file
references were checked first against a tree seven rounds newer: the
shaders had moved from `src/render/shaders.mts` into
`src/render/shaders/edge.mts` (the round-130 split), the draw order
into `src/render/renderer/scene.mts`, and the casing had become a
paired per-edge draw (124.4) sharing the line's vertex functions — so
every change here is confined to the layer entry points, and the
casing and the line are untouched.  Measurements are SwiftShader (the
visual project's pinned adapter) in Chromium; `npm run -s gpu` said
HARDWARE (RX 580 reachable), which governs no number here.

**The fixture rule, for all five new scenes** (`layerSheets` in
`visual.spec.js`): v4's padding is v3's minus half the line width, so
the two bands are the same width and item 27's formula is cancelled
rather than absorbed (88.4's requirement).  Nodes are invisible where
the band's ends are the scene.

**88.1 — round caps.**  The straight quad reaches half the stroke
width (+1 px margin) past each end and `fsEdgeLayer` shades the
capsule about the span from `u` (device px along it) and `v`; the
curved/route strip first did the same by pushing its end vertices out
(replaced in 88.2).  Self edges round too — v3's butt exception for a
self edge on its no-paths fallback is one README sentence, no code, as
the sitting said.  A straight-triangle layer keeps its taper and flat
base.  `parity-closeup-layer-caps` (straight, bezier, segments; a
translucent overlay *and* underlay; zoom 3): **6.526%** before,
**0.000%** after, **1.918%** with the capped quads kept and the capsule
coverage switched off, and **4.980%** for the same control under
88.2's geometry — bound 0.2%.  The straight layer pipeline split into
an underlay and an overlay pipeline for 88.3.

**88.2 — the joins, decided by measurement.**  The first join scenes
were built in the purple the plan's scenes had used, and measured the
candidates wrong: pixelmatch's 0.2 threshold cannot see a translucent
stroke blended twice in most colours (0.5 -> 0.75 alpha of `#8e44ad`
over white is a YIQ delta of 768 against 1409; `#2c3e50` 1222; black
2054), so the geometry-only candidate *passed* (0.004%).  Rebuilt with
a black 0.5 overlay:

| candidate | joins | hairpins |
| --- | --: | --: |
| pre-88 (butt caps, mitred strip) | 2.566% | 3.101% |
| 88.1 (round caps, mitred strip) | 1.223% | 2.596% |
| equal-depth on the mitred strip | 0.392% | 0.894% |
| capsule steps, no depth write | 3.459% | 2.149% |
| capsule steps + equal-depth — **landed** | **0.010%** | **0.061%** |

Equal-depth alone leaves the miter spikes where v3 rounds; the
geometry alone doubles every joint it overlaps; the call went to both.
The layer strip is now *capsule steps* (`curvedLayerAt`): each quad
bounds its step widened by the half-width and reaching past each end
only as far as that joint's round join needs (half-width ×
sin(turn / 2)), with three distinct subdivision points either side as
flat varyings, and `fsCurvedLayer` shades the distance to that
neighbourhood.  The two layer pipelines write depth: each instance at
its own depth, strictly decreasing in draw order, so a same-edge
fragment fails `'less'` where an earlier quad drew while a later edge
still blends over an earlier one — v3's per-stroke atomic compositing
exactly.  The bands: underlay (0.9513, 0.999] above `EDGE_Z`, overlay
(0.8923, 0.94] under it, both above `NODE_Z`, 200,000 instances each at
four depth24 units apiece — `test/modules/edge-layer-depth.mjs` pins
the four orderings (control: the underlay base moved under `EDGE_Z`
fails two of five).  The depth rides a flat varying into
`frag_depth`, so it is bit-identical per instance whatever the
rasterizer interpolates.

Three drafts failed a scene and are why the landed shape is what it
is: quads reaching their full capsule at every joint shaded the fringe
of short steps too light and, drawing first, kept it (the caps scene
0.000% -> 0.239%, visible hatching); a neighbourhood of plain indices
ended at a collapsed taxi leg (a dy = 0 taxi spends ~11 quads on its
zero-length turn) and drew an arc seam in the `edge-layers` golden —
the walk now skips zero-length steps and a zero-length quad draws
nothing; and two points either side left seams where a tight
self-loop's ends overlap — three points plus a *fringe* depth (a
partially covered fragment writes half a step deeper, so it never
blocks its own edge's body, which then blends over it once) reduced
them to a couple of pixels.  Bounds: joins 0.1% (fails 88.1 12x,
equal-depth-only 3.9x), hairpins 0.2% (equal-depth-only 4.5x).

**88.3 — the reach, measured before building.**  A probe on
`parity.html` (one straight edge at zoom 4, the centreline scanned for
overlay ink; six head shapes × hollow/filled × three width/scale/
padding configs) found v3's overlay reaching its `rs.allpts` end plus
the padding at every hollow head — 3.88 model px past the path end at
padding 4, 1.88 at padding 2 — and no further; at filled heads both
libraries agree.  So no arrow-quad pass: the overlay spans the gap
(`gapSpanW`, `arrowGapTrimOf`) with its cap.  The same probe on the
underlay showed v3's head erase cutting it where the head begins — and
88.1's round cap poking into the hollow head where v3 had erased it.
So the underlay keeps the draw trim and a flat end at a head that
shows the line (`LAYER_BUTT_WGSL`).  The two arrow scenes share one
fixture (arrow-scale 2 hollow triangles, width 3, padding 4, one edge
per family), over a no-layer floor of 0.124% (lines and curved hollow
heads alone):

| scene | pre-88 | 88.2 | landed |
| --- | --: | --: | --: |
| overlay | 5.060% | 3.126% | **0.124%** (the floor) |
| underlay | 0.362% | 1.794% | **0.329%** |

The underlay's residual is the trim approximating the erase (a cut
square to the path; v3's follows the head's back edge).  Bounds 0.2%
and 0.4%.

**88.4 — item 27 closed** on the sitting's call: `width + 2 ×
padding` kept, recorded in `src/README.md`, `MIGRATING.md` (with the
v3-matching padding recipe) and `features.csv`.  The alternative —
match v3's `2 × padding` for pixel parity — would be the `width +`
term in `engine-write.mts`'s layer width derivation.

**The page, opened** (a scripted Chromium on `debug/index.html`,
`?network=edge-types` and `edge-arrows`, 1400×900, translucent
overlay and underlay bypassed onto every edge, six selected), after
88.1 and again after 88.2: the taxi corners' dark fold triangles are
gone, every family ends round, and the lines, heads, nodes and labels
draw over the layers as before — the depth write harmed nothing drawn
after it; no console errors.

**Goldens**: `edge-layers` regenerated twice (88.1: 160 px at the
stroke ends; 88.2: 83 px — its self-loop's folded inner corners and
seams gone), each looked at magnified before committing.  No other
golden moved.

**Browser runs**: the `visual` and `renderer` projects together, 332
passed and 1 skipped (the renderer project's standing skip) at 88.3.
The routing spec's compound scene is an `expectFail` marker, not a
failure.

**Recorded residuals** (README): a path coming back near itself from
outside a step's neighbourhood can blend a fringe pixel under its body
once more; more than 200,000 visible curved edges wrap a layer's depth
band; the layer vertex stage now evaluates at least eight subdivision
points per vertex for a *layer-enabled* curved edge (three before),
disabled instances still collapsing on the first read — not
benchmarked, since layers are a selection-sized population.

**Logged**: **PLAN.md item 81** — the line's and casing's own strips
keep the mitred quad-per-step shape, so a translucent *line* on a sharp
route still folds and spikes (0.660% on a black 0.5 width-8 zigzag at
zoom 3, spikes and folds together); the layer mechanism would carry
over, at the price of re-deriving the early-z bands and dashes'
longitudinal coordinate.

**Deferred**: nothing of the plan.  The alternative for item 27 stays
one line (above).
