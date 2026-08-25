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

