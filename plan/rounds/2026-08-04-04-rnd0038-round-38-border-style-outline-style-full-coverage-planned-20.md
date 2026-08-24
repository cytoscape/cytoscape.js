## Round 38 — `border-style` / `outline-style`, full coverage (planned 2026-08-04; landed 2026-08-08)

The last unported v3 style pair, at the scope the sitting chose:
**every shape**.  The technique has been settled since 27.8; this
round builds all three tiers.

- **The perimeter coordinate**, per tier: closed-form for
  circle/rectangle/round-rectangle (walk the sides + corner arcs);
  angle-parameterized ellipse — arc length is elliptic, so dashes
  space unevenly on eccentric ellipses (recorded deviation);
  the polygon family (sharp polygons, the round-* family, `barrel`,
  `cut-rectangle`, the custom `polygon`) via the SDF loop also
  tracking the argmin edge and its clamped projection against a
  per-fragment cumulative perimeter — roughly 2× polygon fragment
  cost *where a dash is enabled*, accepted; solid borders pay a
  branch only (the `u`-computed-only-when-dashed gate).
- **`double`** — described here as a second inner band, which
  **2026-08-04's scoping found is not what v3 does**: v3 re-strokes at
  `borderWidth / 3` under `destination-out`, erasing a middle stripe
  from the fill and everything under the node rather than filling it.
  See the three sub-calls added to open-call 1 — **all three taken at
  the sixth sitting (2026-08-06)**: the erase ports (with
  double-bordered nodes excluded from the opaque depth prepass, the
  gradient-fill precedent), `border-dash-pattern`/`-offset` port, and
  `border-cap`/`-join` drop with the deviation recorded.  What remains
  for docs-first is `text-border-style` and the write-up.

  **`outline-style`** reuses the
  perimeter at the ring radius (offset perimeter, different arc
  length) and needs no props — v3 hardcodes `[4, 2]` and `[1, 1]`
  there.  `text-border-style` stays out unless the same machinery
  makes it free (call at docs-first).
- Both props enum channels with the standard parse/mapper/
  stored-truth-readback plumbing; ghost bodies carry their border
  style like everything else.
- **Verification is the round-27 discipline**: goldens per tier plus
  **live v3 parity diffs per tier**, each run once with the feature
  disabled to prove it can fail; dash-phase parity checked explicitly
  (v3 launches patterns at a defined origin per shape — read v3
  source before asserting).  A `benchmark/` row prices the
  dashed-polygon fragment premium on the renderer bench (device
  time, dashed vs solid on the same scene).

### Landed (2026-08-08)

The full-coverage scope, delivered, with the plan's own deviation
budget mostly unspent — measurement kept killing the approximations it
had authorized.  Every tier, all three sitting sub-calls, and the
docs-first call the plan reserved (`text-border-style` stays out; the
label-box border is a different pipeline and nothing here makes it
free).

- [x] **38.1 The style plumbing.**  Four props on the nodes group:
  `border-style` / `outline-style` (enums, case-mappable),
  `border-dash-pattern` (normalized to two on/off pairs exactly like
  the edge twin; v3's default [4, 2]; constants-only) and
  `border-dash-offset` (mappable).  The enums ride borderGeom.y bits
  8..11 — a word the FS already binds — because the node pipeline sits
  at **exactly 8 fragment-visible storage buffers** in both layouts;
  the pattern/offset are two new contract columns
  (`node.borderDash`/`node.borderDashMeta`) bound **vertex-only** and
  handed to the FS as flat varyings, 57.1b's slot trick in reverse.
  The ghost pipeline's vertex stage lands at exactly 8 with them.
  Stored-truth readback, validation (the negative-entry throw shared
  with the edge twin, its message generalized), and 9 Node specs.
- [x] **38.2 The perimeter coordinate.**  `perimeterCoord` per shape
  tier, with u = 0 and direction matching v3's canvas path per shape
  (read from v3's drawing-shapes source, not assumed): the rectangle
  4-gon from the top-left corner down the left side; round-rectangle /
  bottom-round-rectangle arcTo paths from the top middle, clockwise;
  the cut-rectangle octagon; generated per-polygon walks in the same
  vertex tables as the SDFs; the custom-polygon blob walk; barrel's
  sampled corner curves in v3's order (which differs from the SD
  function's own).  **The plan's angle-parameterized ellipse died by
  measurement**: its 5.0% parity mismatch exceeded the 3.6% a SOLID
  border scores, so the recorded-deviation scene could not discriminate
  — round 27's measuring-nothing case, caught by running the control.
  What shipped is exact elliptic arc length (composite Simpson, 48
  intervals, dash-gated) plus a **two-step Newton refinement to the
  nearest-point parameter**, because the radial estimate shears ±2 px
  of phase across a ±2.5 px band — found when v3's 2-px-period dots
  rendered anti-aligned, quantified in Python, worst case after the fix
  0.003 px.  Round-* shapes walk their source polygon (recorded
  approximation, measured inside the 0.54% polygon tier).
- [x] **38.3 The three styles.**  `dashed` = pattern + offset;
  `dotted` = v3's hardcoded [1, 1], pattern ignored (a parity scene
  declares a wild [15, 15] pattern on every dotted node to prove the
  ignoring); `double` = v3's erase as alpha-0 stripe fragments (the
  sitting's call), with double-bordered nodes excluded from the opaque
  depth prepass on the gradient-fill precedent.  Outline dashes
  evaluate at the ring's own radius, reproduce v3's anisotropic
  expandPolygon pad for the polygon family and the padded corner
  radius for round-rectangles.  Two recorded deviations: outline dash
  phase on polygon-family shapes (v3 miters outline corners where
  v4's ring rounds them — geometrically different paths; the parity
  scene pins the ellipse family, the golden covers the rest), and
  `outline-style: double` draws solid (v3's own double-outline erase
  strokes at *border* width / 3 — a v3 bug, lineWidth 0 when
  borderless — so there is no sane behaviour to match).  The stripe
  difference under edges is in the migration guide's re-check table.
- [x] **38.4 Verification.**  Five live parity scenes, all at zoom 2
  after the first cut at zoom 1 could not discriminate (the AA fringe
  smears 2 px gaps — round 56's close-up lesson arriving for borders):
  closed-form 0.178% / polygons 0.538% / exact-arc ellipses 0.793% /
  dotted + double 1.190% / ellipse-family outlines 0.791%, bounds
  0.8–2%, and the five feature-off controls at 4.17 / 4.03 / 3.61 /
  10.86 / 3.61% — every scene fails with its feature turned off.  A
  40-cell golden spans every tier × style plus the outline rows parity
  excludes, with one **ghosted dashed cell** as fsGhost's only pixel
  coverage — two shader controls run, and the ghost-only one proves
  that cell is load-bearing.  The renderer bench gained a solid/dashed
  border scene pair: the accepted ~2× dashed-fragment premium is
  **unmeasurable at scene level** (3.41 vs 3.41 ms device fit-all,
  4.48 vs 4.52 ms zoomed-in, RX 580, 25k hexagons).  Full suite:
  2087 + 283 + 24 Node specs, throw gate 183/10/5/0 (it fired twice
  during the round — both allowlist keys moved by edits above them,
  the 37.1 failure mode caught both times), 226 browser specs with
  every pre-existing golden **byte-stable** — the solid border path is
  instruction-identical by construction, and the exact goldens are
  what proves it.  MIGRATING.md (rows + a re-check entry),
  CHANGELOG.md and the docs updated in-commit.
