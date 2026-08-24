## Round 23 plan — node charts: pie + stripes (planned 2026-08-01)

v3's 51 + 50 numbered props (`pie-1-background-color` ...
`stripe-16-background-size`) return as a **lean, list-valued chart
family** designed to grow more kinds later — the user's call
(2026-08-01): definitely port, and shape the surface for future
chart types.

**Signed-off design calls:**

1. **The `chart` family** (node-only): `chart`
   (`none | pie | stripes` — the open enum future kinds extend),
   `chart-values` (a number list — a constant array, or the
   `{ data: key }` passthrough reading a **per-element array** from
   the data sidecar, the headline capability: data-driven pies),
   `chart-colors` (a constant color list *or* a named scheme string
   from the mapper DSL's palette table — `'category10'` is the
   default), `chart-size` (fraction or `'N%'` of the node box,
   default 100%), `chart-hole` (0–1 inner cutout — donuts from the
   same surface, v3's `pie-hole` analogue), `chart-start-angle`
   (pie; v3's `pie-start-angle`, default 12 o'clock),
   `chart-direction` (stripes: `horizontal | vertical`) and
   `chart-opacity` (folds into slice alphas, the B1 pattern).

   Values are **absolute fractions of the whole** (v3's percent
   semantics: a sum under 1 leaves unpainted remainder, over 1
   clamps at 1) — no normalize option for now, apps can normalize
   (recorded).  Slice count caps at 16 (v3's N; recorded).
2. **Storage: a chart blob record per element** ([kind, config,
   n, then n × (value, packed rgba)]) in a round-11-compacting blob
   pool behind a packed `node.chartRef` column — colors resolve at
   style-write (constants-only props bake per record).
   `chart-values` via `{ data }` refreshes on writes of the mapped
   key like any mapped channel; every other chart prop is
   constants-only except `chart` itself and `chart-opacity`
   (mapper-capable enums/numbers).
3. **Rendering: in the node FS, SDF-native.**  A `chartRef == 0`
   early-out keeps unused cost ~zero; pie tests the fragment's
   local angle against cumulative stops (start at 12 o'clock,
   clockwise — v3), stripes test the local coordinate; both clip to
   the node's shape SDF and the `chart-size`d box, draw **over**
   fill/gradient/background-images and **under** border/outline
   (v3's order), and AA at slice boundaries analytically.  Charts
   are paint-only: never in bb, never pickable, no cull impact.
4. **Verification**: Node specs (parse/readback/blob/refresh),
   goldens (pie fractions incl. remainder gap + hole + start angle;
   stripes both directions), and a **live v3 parity scene** mapping
   `chart` pies onto v3's `pie-i-*` props (and stripes onto
   `stripe-i-*`) at matching geometry.

**Pass split** (tests-first; docs in-commit):

- [x] **23.1 Props + model** (2026-08-01) — the 8-prop surface
  parses/validates/reads back (chart + chart-opacity mapper-capable;
  values as arrays or space-separated strings, or the
  `{ data: key }` passthrough reading per-element arrays with a new
  'chart' dep kind + narrow refresh path beside the label one;
  colors as lists or named schemes with category10 the default,
  cycling past their length; size/hole as [0,1] fractions or 'N%';
  start-angle via the shared angle parser; direction
  vertical | horizontal; every list/config prop constants-only).

  Records live in a chart blob (round-11-compacting CurveBlob pool,
  compaction-remapped) behind the packed `node.chartRef` column —
  header kind/size/hole/startAngle/direction/opacity/n then
  n × (value, r+g·256, b+a·256): colors split across small-integer
  floats (packed u32 bits would risk NaN canonicalization through
  the f32 pool), alpha-folded with the exact opacity kept in the
  header for readback.  Slices cap at 16 (v3's N) and the running
  total clamps at 1 (v3's percents; the remainder stays unpainted);
  invalid sidecar entries skip; a chartless write frees the record
  (as does removal).

  Tests-first: 10 Node specs
  (`test/charts.mjs`, red then green).  2214 Node tests,
  typecheck + lint clean.
- [x] **23.2 Render** (2026-08-01) — a dedicated ChartPipeline (the
  node FS sits at its 8-buffer cap, so charts get their own pass —
  the image pipeline's shape: one quad per charted node off the
  culled visible lists, leaves after the image pass and parents
  after theirs, chartless instances collapsing in the VS, the whole
  pass skipped at chartCount 0).

  The FS clips to the node shape at
  the border's inner edge (poly blob bound for custom polygons),
  resolves the fraction coordinate (clockwise from 12 o'clock for
  pies — v3; the advancing axis for stripes) and walks the record's
  stops with px-space AA into the neighboring region (wrapping
  across the start angle on full pies), radial AA at rim + hole,
  sub-box edge AA for stripes; element opacity multiplies;
  derivatives hoist above every branch (WGSL uniformity, caught by
  the device-error guard).  The chart blob mirrors beside the image
  blob.

  Two fixes shaken out by the golden: the chart-refresh fast
  path re-routes through the full mapped write when the def has
  mappers (the narrow path wrote the constants record — wrong when
  `chart` itself is case-mapped), and the scalar/enum chart props
  joined the mapper-capable set (the 12b constants-only rule covers
  lists, not scalars).  Pinned by the `charts-pie-stripes` golden:
  full pie on the default palette, remainder gap, donut with start
  angle on a bordered ellipse, both stripe directions,
  chart-size < 1.
- [x] **23.3 Parity + close** (2026-08-01) — two live v3 parity
  scenes: pies against the numbered `pie-i-*` props at **0.000%**
  (pixel-exact — fractions, remainder, hole, start angle) and
  stripes against `stripe-i-*` at 0.005%.  **Two upstream v3
  stripe bugs found and recorded** (they constrain the parity
  scene to vertical square-node stripes; the golden pins v4's
  horizontal + non-square behavior): v3's
  `stripe-direction: horizontal` is inert — the canvas draw switch
  tests a typo'd 'righward' keyword its own style type rejects —
  and `drawStripe` swaps W/H in its centering offsets, visible on
  non-square nodes.

  The planned `debug` toggle was dropped
  (the golden + parity scenes cover the visual surface; recorded).
  2214 Node tests, 151/151 Playwright, typecheck + lint clean.
  **Round 23 is complete.**
