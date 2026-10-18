## Manual feature demos and golden coverage audit

**Depends on:** 43, 57, 80, 82, 104, 107, 125, 135, 143, 146, 147, 148

### Scope and decision

Requested audit, before implementation. Inventory the implemented library
surface, its easy manual test paths, and the visual goldens; propose the
missing networks and widgets. The audit tables below are the pre-implementation
baseline; implementation and verification are recorded at the end of this
file. No release-readiness claim follows from the baseline inventory.

**Finding:** existing manual coverage is broad but uneven. Shapes, routes,
arrows, layouts and basic interaction have useful entry points. Many paint
properties only appear incidentally, and several substantial implemented
features require console code. The goldens are internally consistent but
leave 58 paintable group-properties and 66 non-default keywords unexercised.
Use small deterministic comparison scenes and focused controls, extending
existing demos rather than building another general-purpose playground.

### Sources, method and limits

- Feature spreadsheet: [`docs/features.csv`](../../docs/features.csv), parsed
  with Python's CSV reader, not line splitting. It has **961 rows**:
  679 Implemented, 26 Partial, 178 Replaced, 37 Excluded, 18 Planned,
  14 Proposed and 9 Undecided. The 705 Implemented/Partial rows include
  **432 API rows and 181 Style rows**, leaving 92 in other categories.
  Rows overlap in meaning, aliases are separate rows, and old v3 properties
  remain as migration records: 961 is not a count of independent v4 features.
- Scope checked against [`src/README.md`](../../src/README.md), the source
  algorithm directory, schemas, debug code and browser specs. Partial rows
  remain constrained by their comments. Planned/proposed/undecided/excluded
  features do not create implementation obligations for this round.
- Manual inventory: [`debug/networks.js`](../../debug/networks.js),
  [`fixtures.js`](../../debug/fixtures.js), [`styles.js`](../../debug/styles.js),
  [`index.html`](../../debug/index.html) and its control scripts;
  [`compound-hulls.html`](../../debug/compound-hulls.html) and
  [`arrow-gallery.html`](../../debug/arrow-gallery.html).
- Golden inventory: all 53 PNGs in `playwright-tests/goldens/`, their
  `golden-coverage/` and `golden-degrade/` records, the actual scene setup in
  [`visual.spec.js`](../../playwright-tests/visual.spec.js), the comparison
  helper, and neighbouring browser tests. Counts below were recomputed with
  `node --import tsx scripts/golden-coverage.mjs --verbose` on 18 October.
- This is a source and stored-artifact audit, not a fresh visual acceptance
  sitting. Browser connection returned **No browser is available**. The local
  `npm run watch` attempt first hit sandbox EPERM, and the permitted retry
  found ports 3333 and 35729 already in use; existing servers were not killed.
  Live appearance, usability, touch devices and hardware behaviour remain
  acceptance work. A source-wired control is called present, not proven usable.

### Existing manual networks

The registry has **23 entries: 12 URL-loaded entries and 11 generated**.
URL-loaded entries include three variants of one EM source and the generated
record's committed dependency graph; this is not twelve independent real
network exports. The rendering note's historical count of 21 is stale.
All main-page links below are relative to a running `/debug/` page.

| Entry or group | Intended manual use | Coverage qualification |
| --- | --- | --- |
| `?network=node-types` | 26 labelled shape cells, including custom polygon | Good vocabulary baseline; excludes the three compound hull shapes; does not compare border/outline/opacity options. |
| `?network=edge-types` | Curve families and parallel fans | Good route baseline; not a complete route-parameter/endpoints matrix. |
| `?network=edge-arrows` | Filled and hollow end heads | Good end-head baseline; not every head at every source/mid/target position. |
| `?network=labels` | Alignment grid, wrap, ellipsis, outline, box, rotation and edge label | Good baseline; not a full node/edge/end-label property matrix. |
| `?network=v3-default` | Mixed routes, self-loops, fans, outline/border examples and parent | Useful integration smoke test, not an exhaustive paint gallery. |
| `?network=compound-fixture` | Nested parents, parent loop, descendant edge and long label | Good hierarchy stress scene; no collapse/expand controls. |
| `?network=em-web`, `em-desktop` | Real enrichment mappers, wrapped/outlined labels, haystack | Real application acceptance, not isolated mapper or paint controls. |
| `?network=em-web-chart` | Radial-heat values, shared scale, local override, application legend; add extreme button | Strong live-domain example; pie, donut, stripe, heat-strip and signed bars lack comparable manual scenes. |
| `?network=em-web-clustered` | Real MCODE compound clusters | Complements the artificial compound fixture. |
| `?network=white-matter` | Case mapper from classification | An example, not all query/mapper operators. |
| `?network=ndex-large`, `ndex-x-large` | Ordinal/diverging mappers and scale | Label, LOD, hover and ingestion stress; random mutation controls lack reproducible expected outcomes. |
| `?network=genemania-default`, `genemania-tp53` | Real multi-channel parallel bundles and SVG node imagery | Strong application fixture, but no dedicated image option gallery. |
| `?network=npm-deps`, `reactome` | Real DAGs; scopes as parents on npm data | Flow/layout acceptance. |
| `?network=workflow-dag`, `workflow-dag-clustered` | Deterministic staged DAG, long edges and compound corridors | Strong flow parameter fixture. |
| `?network=greek-gods` | Taxi family tracks and casing | Useful automatic track example; no isolated target/source/family comparison controls. |
| `?network=plan-deps` | Development record dependency DAG | An additional real-shaped flow/layout exercise. |
| `?network=gen`, `compound` | Size-configurable synthetic graphs, nested compound scale | Useful performance smoke tests; random positions/edges are unsuitable golden inputs. |
| `/debug/compound-hulls.html` | Three hull choices, include-labels checkbox, bounds/pick/endpoint readout; drag children | Existing focused widget; not linked from the main page, small single-parent scene. |
| `/debug/arrow-gallery.html` | v3/v4 gallery, head focus, fills, line opacity, contrast and side/overlay view | Linked from the main page; maintainer reports it broken (18 October). Needs diagnosis and repair, and the v3 bundle as well. |

### Feature-to-manual-test coverage

This groups the 705 implemented/partial rows by observable behaviour. It does
not claim one widget per API alias. “Gap” means no focused, discoverable manual
path was found in debug code, not absence of automated tests.

| Feature families / spreadsheet categories | Present path | Gap and proposed manual result |
| --- | --- | --- |
| Node geometry, custom polygons, borders/outlines, fill, gradients, ghosts, overlays/underlays (Style/Rendering) | Shape gallery, mixed v3-default, production sheets | **P1 paint gallery:** labelled paired cells for fill/opacity, borders inside/centre/outside, dashes and offsets, solid/dotted/dashed/double outlines, radius, gradient directions/stops, ghost and layers. Controls show authored/resolved value; restore baseline. |
| Edge geometry, caps/casing, dashes, loops, arrows and endpoints (Style/Rendering/Application workflows) | Edge galleries, Greek gods, GeneMANIA, arrow gallery | **P1 edge detail panel:** route/parameter examples, source/mid-source/mid-target/target shape selectors, end fill and hollow width, cap/dash/outline, arrow scale/gaps and endpoint markers. Drag/resize endpoints; markers and pixels must follow. Respect always-filled mid heads and partial translucent overlap semantics. |
| Labels and text geometry (Style/Rendering) | Labels scene; labels on/off, minimum size, degree priority, declutter; BB overlay | **P1 label comparisons:** node, edge, source and target samples; margins, offsets, line height, wrap-anywhere, transform, justification, opacity, outline and box borders. Add overlapping-label priority scene and zoom stops to make winners/fade boundaries evident. Edge labels remain unpickable. Global font settings require rebuilding the instance, not unsupported per-element font mappers. |
| Images, raster/SVG, layers and SDF icon mode (Style/Rendering) | GeneMANIA SVG image in production sheet | **P1 image gallery:** fit, size, offsets/position, clip, repeat, smoothing, containment, per-layer opacity/order, SVG zoom and icon tint; loading/error indicator. Use same-origin committed assets; add separate CORS failure fixture only for fetch-policy testing. |
| Charts and scale/legend contracts (Cytoscape Web v2/Styling) | EM radial-heat/domain/legend widget | **P0 chart network:** pie/donut/stripe/heat/radial-heat/signed bars side by side; 1, 16, >16 and 255 values, negatives, zero and missing data. Kind, hole, angle/direction, opacity and size controls; edit values/domain and show `legend()` output. Fixed-scale and partial-auto comparisons; update extreme, remove extreme, reset. Application owns displayed legend. |
| Compound hierarchy, hulls and miniature scaling (Model/Rendering/Application workflows) | Nested fixtures and separate hull page | **P0 compound widget:** link existing hull page and extend/port its controls; nested parents, anisotropic/image/chart/label children and crossing edges. Collapse/expand/reset, factor and animation controls; inspect authored sizes versus effective geometry, parent/child pick and endpoints. Drag/layout collapsed groups and expand again. Include label sizing, min dimensions and asymmetric padding. No aggregate-edge or automatic semantic-zoom promise. |
| Declarative styles, data/case/ordinal/continuous mappers, bypass and sheet replacement (Styling/API) | Several real sheets, production/default selector, selection-state mapping | **P1 mapper widget:** edit one data value; show resolved fill/size and legend/domain changes. Toggle local override, remove it, replace/reset sheet and compare surviving values. Demonstrate structural/state conditionals and domain modes from actual supported forms. |
| Layout portfolio, options, constraints and packing (Layout/DX) | All ten built-ins plus spiral extension; option panel, call readout, seed, overlap, labels, pack/tidy, spacing, airiness; force Live/Infinite/Stop/Reheat; EM grouping combo | Strongest widget coverage. **P1 targeted recipes:** pin small disconnected/locked/compound/variable-size inputs and expected bounds/ordering for each relevant option. Make function-typed exclusions explicit; provide predefined callback recipes where valuable. Add Cancel versus Stop demonstration. Manual quality sign-off remains round 125's separate acceptance gate. |
| Selection, states, structured queries, sets and topology (API/Query/Interaction) | Query text plus nodes/parents/selected recipes; counts; select/invert and selected-state toggles; hover emphasis | **P1 inspector:** IDs, data, states, parent chain, neighbours, query matches/errors and geometry; recipes for supported boolean/data/degree/structural query forms. **P2** highlight set/traversal results from selected roots. Avoid making every collection alias a separate button. |
| Pointer/wheel/touch gestures, picking and events (Interaction/API) | Drag/pan, box mode/labels, wheel mode/sensitivity, cursor toggle, selection mode, lock/grab/pan state and filtered event log | **P1 gesture fixture:** overlapping leaf/edge/parent, node labels, transparent/hidden bodies, locked/ungrabbable/pannable states; `events` and node `text-events` controls. Show target plus sync node and async GPU pick. Add tap-distance/taphold tuning, propagation recipe and touch instructions. Check active-background and selection-box styles during a held gesture. `preventDefault()` does not disable library gesture defaults. Real touch acceptance remains required. |
| Animation and transitions (Animation/API) | Viewport animate fit/center/panBy; animated/live layouts | **P0 animation widget:** selected node position/size/paint and transition presets; play/pause/resume/reverse/stop, read-only progress, competing channels and promise sequence. Display current geometry/style during tween; mid-flight pick and stop result must agree. No progress setter or old queue API. |
| Add/remove, move/reparent, data, batch, patch, persistence, dirty consumers and compaction (Model/API) | Random add/remove/time, compact; binary/columnar/progressive loading | **P1 deterministic update fixture:** fixed add/remove/edit/reparent/patch steps, before/after IDs/counts/data/state; serialise/reload snapshot and compare; abort/cancel progressive load and show progress. Demonstrate batch equivalence and compact visual invariance. Do not implement an undo manager: undo is undecided, snapshot cost is evidence only. |
| Multiple views, mount/unmount and worker rendering (Runtime/Model/Performance) | Minimap following clone with independent sheet/viewport; mount/unmount | **P1 lifecycle controls:** pause/resume following, detach/destroy/recreate, mutate source and display applied diff; renderer host selector at construction, readiness/error and host indication. Worker algorithm execution is separate from worker-hosted rendering. Device-loss/degradation belongs in an explicit diagnostic fixture with existing test hooks, not ordinary controls. |
| Algorithms: search, paths, trees/cuts, components, centrality, clustering, similarity/diffusion, triangles/motifs (Algorithms/API/Performance) | No algorithm result widget found; layout executor dropdown is not algorithm coverage | **P1 algorithm explorer:** tiny deterministic weighted/directed/disconnected/cyclic examples, selected roots/goals, named operation, result highlight and numerical table. Cover BFS/DFS; Dijkstra/A*/Bellman-Ford/Floyd-Warshall; Kruskal/min-cut/Euler; connected/biconnected/SCC; degree/closeness/betweenness/PageRank/Katz; k/hierarchical/affinity/Markov clustering; similarity/SimRank/random-walk/heat/resistance; triangles/motifs. Only offer executor choices supported by that method; show cancellation/timing/errors and compare CPU/offload results within the method's numerical contract. |
| PNG/JPEG export and rendered geometry (Export/API) | Bounding-box overlay; no image-export widget found | **P1 export controls:** format, background, scale/full viewport options supported by API; preview dimensions and download. Compare screen/export for labels, images, hulls and miniatures. SVG/PDF/headless image generation are not implemented obligations. |
| Headless runtimes, builds, schemas, declarations, typed data, documentation and benchmark claims (Runtime/Distribution/DX/Documentation/Performance) | Build/module/runtime/type/schema tests, docs generator, benchmark reports; stats and large fixtures for browser smoke | Automated contracts and published measurements are the primary acceptance here, not static goldens. Add clear manual recipes/status links, host/readiness/stats indication where useful. A debug graph does not prove bundle isolation, type inference, schema correctness or a performance ratio. |

P0 is the first proposed implementation batch, P1 follows by family, P2 is
optional expansion. These are audit priorities, not an approved release plan.

### Pre-implementation golden inventory

The names below are the baseline PNG basenames under
`playwright-tests/goldens/`, before this round's refresh.
A golden pins a particular scene, not every value of its named feature.

| Family | Count | Golden names |
| --- | ---: | --- |
| General rendering / LOD | 3 | `nodes-edges-arrows`, `straight-triangle`, `far-zoom-lod` |
| Node shapes | 4 | `shapes-27`, `shapes-27-round`, `shape-polygon`, `polygon-shapes` |
| Routes / endpoints / bundles | 8 | `bezier-bundles`, `bundles-wide`, `self-loops`, `haystack`, `segments-families`, `taxi-families`, `unbundled-bezier`, `manual-endpoints` |
| Arrows | 5 | `arrow-gap`, `arrow-scalars`, `arrow-shapes`, `curved-arrows`, `mid-arrows` |
| Paint / layers / selection | 10 | `line-styles`, `border-styles`, `node-layers`, `edge-layers`, `ghost`, `emphasis-tiers`, `selection-accent`, `selection-overridden`, `gradients`, `mapped-colors` |
| Labels | 15 | `edge-label-autorotate`, `edge-labels`, `curved-edge-labels`, `end-labels`, `label-align`, `label-border-styles`, `label-boxes`, `label-outline-closeup`, `label-outline-words`, `label-visuals`, `labels-bold-italic`, `labels-open-sans`, `labels-wrap-edge`, `labels-wrap`, `labels-zoom-closeup` |
| Images | 4 | `images-basic`, `images-cover-clip`, `images-multi`, `images-sdf-icons` |
| Compounds | 2 | `compounds`, `compound-loops` |
| Charts | 2 | `charts-pie-stripes`, `charts-heat-bars` |

At the baseline, the 53 references each had a coverage record and a degrade record. Existing
`golden-current/` contains 53 PNGs and 53 timestamp records. Comparing all
saved current images with their references using the recorded thresholds
finds **53 exact matches**, with capture timestamps from
`2026-10-18T00:51:48.717Z` through `2026-10-18T01:35:33.268Z`.
These are saved captures from earlier runs, not images rendered by this audit,
and their metadata does not bind them to a commit.

The visual project's SwiftShader pin, fixed font and `checkGolden` fit check
are useful protections. Comparison defaults are exact (`threshold: 0`,
`maxDiffRatio: 0`). Some introductory comments still describe old tolerances;
read the actual helper/calls, not that historical prose. Existing status
`goldens.html` already offers Gold/Now/Diff: reuse it for acceptance review.

### Measured golden gaps

The enumerator counts **group-properties**, not distinct names across groups.
Its parent group contains the compound-specific property block; inherited
parent paints and the hull keyword gap are therefore not a complete parent
rendering assessment.

| Group | Non-default exercised | Universe | Never exercised |
| --- | ---: | ---: | ---: |
| Nodes | 75 | 103 | 28 |
| Parent-specific | 5 | 10 | 5 |
| Edges | 63 | 98 | 35 |
| Core | 0 | 9 | 9 |
| Total | 143 | 220 | 77 |

Of the 77, **58 are paintable** and **19 require another test mode** under
the enumerator's static-scene classification. The 47 accepted-but-unread
cross-group schema names are excluded from this universe; do not add scenes
for inert node arrow props or edge node-fill props merely to raise a count.

Complete paintable gap list, grouped exactly as measured:

- **nodes (21):** `background-clip`, `background-image-containment`, `background-image-smoothing`, `background-offset-x`, `background-opacity`, `background-repeat`, `border-dash-offset`, `border-opacity`, `border-position`, `chart-opacity`, `label-priority`, `min-zoomed-font-size`, `overlay-corner-radius`, `text-justification`, `text-opacity`, `text-outline-opacity`, `text-overflow-wrap`, `text-transform`, `underlay-corner-radius`, `underlay-shape`, `visibility`.
- **parents (5):** `collapse-scale`, `compound-sizing-wrt-labels`, `min-height`, `min-width`, `padding-relative-to`.
- **edges (30):** `control-point-weight`, `line-cap`, `line-dash-offset`, `line-dash-pattern`, `line-height`, `line-outline-color`, `line-outline-width`, `min-zoomed-font-size`, `opacity`, `radius-type`, `source-arrow-width`, `source-text-margin-x`, `target-arrow-width`, `target-distance-from-node`, `target-text-margin-x`, `target-text-margin-y`, `taxi-track`, `taxi-track-spacing`, `taxi-turn-min-distance`, `text-justification`, `text-margin-x`, `text-max-width`, `text-opacity`, `text-outline-color`, `text-outline-opacity`, `text-outline-width`, `text-overflow-wrap`, `text-transform`, `underlay-padding`, `visibility`.
- **core (2):** `dim-opacity`, `label-declutter`.

**Missing keyword values (66 total):** aliases are already normalised out;
“shape is covered” does not imply every shape has a golden.

| Group | Property | Missing non-default keywords |
| --- | --- | --- |
| nodes | `background-gradient-direction` | `to-left`, `to-bottom-left`, `to-top-right`, `to-top-left` |
| nodes | `border-position` | `inside`, `outside` |
| nodes | `font-style` | `oblique` |
| nodes | `outline-style` | `double` |
| nodes | `shape` | `convex-hull`, `round-convex-hull`, `concave-hull` |
| nodes | `text-justification` | `left`, `center`, `right` |
| nodes | `text-overflow-wrap` | `anywhere` |
| nodes | `text-transform` | `uppercase`, `lowercase` |
| nodes | `underlay-shape` | `ellipse` |
| nodes | `visibility` | `hidden` |
| parents | `padding-relative-to` | `height`, `average`, `min`, `max` |
| edges | `edge-distances` | `node-position` |
| edges | `line-cap` | `round`, `square` |
| edges | `line-fill` | `radial-gradient` |
| edges | `mid-source-arrow-shape` | `triangle`, `vee`, `chevron`, `square`, `diamond`, `triangle-tee`, `circle-triangle`, `triangle-backcurve` |
| edges | `mid-target-arrow-shape` | `vee`, `chevron`, `circle`, `square`, `diamond`, `tee`, `triangle-tee`, `circle-triangle`, `triangle-backcurve` |
| edges | `source-arrow-shape` | `vee`, `square`, `diamond`, `tee`, `triangle-tee`, `circle-triangle`, `triangle-backcurve` |
| edges | `taxi-direction` | `horizontal`, `upward`, `downward`, `leftward` |
| edges | `taxi-track` | `target`, `family` |
| edges | `text-border-style` | `dotted` |
| edges | `text-justification` | `left`, `center`, `right` |
| edges | `text-overflow-wrap` | `anywhere` |
| edges | `text-transform` | `uppercase`, `lowercase` |
| edges | `text-wrap` | `ellipsis` |
| edges | `visibility` | `hidden` |

The 19 other group-properties are node/edge event transparency, node image
crossorigin, four transition settings on nodes and edges, and the core's
three active-background/four selection-box properties. Pointer routing,
fetch policy and animation need behavioural assertions. Held-gesture
screenshots can still pin active/selection chrome, and controlled tween
checkpoints can pin animation appearance: “no static pixels” is not a reason
to omit these features from testing altogether.

**Tier 2 is already implemented.** Of 554 recorded (golden, property) reset
pairs, **541 move pixels, 3 move none and 10 cannot be reset by the present
control**. Only **132 of the 143 exercised group-properties** move pixels in
at least one scene. Thus 143/220 is assignment coverage, not a visual-proof
percentage. The 11 without such evidence are:

- nodes: `background-gradient-stop-positions`, `chart-colors`, `chart-domain`,
  `chart-scale`;
- edges: `line-gradient-stop-positions`, `mid-source-arrow-width`,
  `mid-target-arrow-width`;
- parents: `padding-top`, `padding-right`, `padding-bottom`, `padding-left`.

Required chart domain/scale cannot simply be deleted from bar/heat sheets;
use an alternate valid configuration. Test uneven gradient positions and a
palette different from its implied default. Test parent padding with direct
sides rather than a surviving shorthand. Mid-arrow widths have no hollow
stroke to alter under the implemented always-filled contract; keep that
explicit exclusion rather than manufacturing a pixel target. The self-loop
scene intentionally ignores `curve-style: straight`, so its no-move result
is expected. The stored degrade report also has an **images-multi background
image reset residue of 624 px**; investigate state restoration/readiness
before trusting a new image degrade measurement. It is not by itself proof
of a library regression.

### Automated evidence outside the golden set

Avoid calling a feature “untested” merely because it lacks a golden:

- [`compound-hulls.spec.js`](../../playwright-tests/compound-hulls.spec.js)
  drives all three hull shapes and checks CPU/GPU picking and endpoint
  geometry; it does not compare a checked-in full-frame reference.
- [`miniature-compounds.spec.js`](../../playwright-tests/miniature-compounds.spec.js)
  checks effective geometry, image scale, pick, and screenshot/export pixel
  probes. No miniature golden or dedicated manual collapse widget exists.
- [`renderer.spec.js`](../../playwright-tests/renderer.spec.js) includes
  behaviour/pixel probes, including declutter/emphasis; `dim-opacity`,
  `label-declutter` and `label-priority` remain golden gaps despite that.
- Worker rendering, algorithms, gestures, routing, limits, progressive load
  and soak have dedicated browser specs. `npx playwright test
  worker-renderer --list` discovers 46 tests across renderer/renderer-webkit;
  the renderer filename regex matches the worker spec too. Discovery is not
  evidence they ran or passed; adapter/platform soft-skips must be reviewed.
- Headless public/module/soak/runtime/type suites remain the right primary
  evidence for nonvisual API behaviour. No static frame can prove a shortest
  path value, cancellation contract, dirty-stream correctness or type API.
- v3 parity scenes are useful complementary evidence but are not included in
  these 53 coverage records; v4-only charts/hulls/miniatures need v4 acceptance
  criteria, not forced parity with a feature v3 does not have.

### Proposed implementation slices and acceptance

1. **Discoverability and repeatability.** Repair the existing linked arrow
   comparison and integrate the arrow and hull demos into the main harness. Group feature scenes separately from scale
   fixtures. Each scene needs a purpose, expected visible result, reset and
   shareable URL carrying its meaningful settings. Fixed seed/positions/data
   for feature checks; retain random stress fixtures for their existing use.
   Add a small source-controlled mapping from implemented feature families
   to scene, widget, golden/behavioural spec, or explicit nonvisual reason.
   Do not auto-classify 961 CSV rows using name matches or change reviewed
   statuses merely because a demo was added.
2. **P0 missing workflows.** Add chart, miniature/hull and animation scenes
   with the concrete controls/readouts in the table. Reuse the EM legend and
   hull logic. Keep the round's scope on implemented contracts, including
   Partial limitations; reconcile contradictory inventory prose with source
   evidence in the same future change, rather than silently expanding scope.
3. **P1 visual families.** Extend node/edge/label scenes and add image/paint
   comparisons. Target the full 58-property and 66-keyword lists above.
   Add declutter/priority and custom dim-opacity golden scenes, explicit
   compound hull/miniature reference states, and the Tier-2 valid alternate
   chart/gradient/padding controls. Do not count an invisible/offscreen value
   as success. Keep unchanged comparison cells next to the changing ones.
4. **P1 stateful and numeric workflows.** Add algorithm, patch/load/clone,
   lifecycle, gesture and export widgets. Result tables/progress/state/event
   readouts are required where pixels alone cannot establish correctness.
   Include deliberate errors and cancel/stop paths with deterministic reset.
5. **Acceptance sitting and record.** Open each new/extended scene, exercise
   its controls and verify its expected result; run existing harness module
   checks plus the appropriate browser/public tests. A new golden must pass
   viewport-fit, coverage pairing and a meaningful degrade control (or an
   explicit behavioural substitute); review full images and diffs before
   updating references. Run `DEGRADE_CONTROL=1 npx playwright test
   --project=visual --grep '^WebGPU visual goldens'` for fresh degrade evidence
   as appropriate; commit the intended references/captures/records together
   and consciously update coverage pins. Broad golden regeneration is not a
   substitute for inspecting why pixels changed.

**Done means:** every implemented feature family has a documented runnable
manual recipe or an explicit reason it is best checked automatically; the
visual gap lists have been addressed or individually justified; stateful
features have outcome readouts; manual acceptance and adapter/platform skips
are recorded. A claim of “all node shapes” must include separately routed
compound shapes, and a claim of “all properties” must distinguish assignment,
pixel sensitivity, enum variants and behaviour. This audit does not set a
cartesian-product target for every property combination.

### Verification of this audit

This section records the **pre-implementation audit baseline** taken on 18
October. Its 53 golden pairs and gap counts are inputs to the round, not
completion evidence; final counts and gates are recorded in the implementation
record below.

- `node --import tsx scripts/golden-coverage.mjs --verbose`: counts and full
  gap/degrade inventories reproduced; no reference or capture regenerated.
- Existing `test/modules/golden-coverage.mjs`, `debug-harness.mjs` and
  `layout-options-panel.mjs`: all three files passed through `test:js:one`.
  No spec was written or changed, so no new mutation control is required.
- All 53 stored current/reference pairs compared: exact matches, as qualified
  above. Every golden basename is listed exactly once in this document's
  generated inventory table.
- `npm run plan:index`, the plan-record and status-markdown module checks,
  `git diff --check`, and `npm run status`: passed. The status build emitted
  255 files, including the new round in `plan.html`.
- `npm run status:serve`: sandbox interface lookup failed; the permitted
  retry found port 3335 already in use. No existing server was stopped.
  Fresh browser acceptance remains outstanding because no connected browser
  is available in this session.

### Implementation interview decisions (18 October)

- **Scope:** full audit coverage, implemented in isolated slices. Address every
  identified manual demo/widget gap and golden gap, rather than limiting the
  round to the P0 batch or visual features.
- **Organisation:** all feature demos live in the main debug page. Selecting a
  feature network shows its relevant widgets; integrate the existing hull and
  arrow galleries rather than choosing separate feature pages.
- **Reported defect:** the v3–v4 arrow comparison linked from the debug page
  is currently broken. Its link is present at `debug/index.html:38`; the
  audit's original claim that it was unlinked was incorrect. Diagnose and
  repair it within this round; the cause has not yet been established.

- **Library defects:** record library bugs separately for later fixes; do not
  fix them within this round. The broken arrow comparison remains an in-scope
  harness repair. If diagnosis identifies a library defect, record that cause
  and its limitation rather than expanding into a library fix.
- **Coverage depth:** every supported property and keyword needs a visible
  manual example and golden coverage wherever meaningful. Use behavioural
  checks or explicit reasons for exceptions; representative family coverage
  alone is insufficient. This does not require every combination of values.
- **Fixture count and clarity:** keep the number of debug fixtures/networks to
  a minimum. Group related variations into each fixture, balancing breadth
  with clarity. Scenes must remain quick to visually scan; avoid overloaded
  galleries. The audit's suggested networks are capabilities to accommodate,
  not a requirement to create a separate network for each table row.
- **Widgets:** show labelled comparisons for key variants immediately, with
  focused controls to explore additional values. Do not hide all variation
  behind controls or make static galleries the only way to exercise features.
- **Review point:** implement and verify the full round before requesting the
  maintainer's review; provide a concise review guide. Do not pause for a
  sign-off after each feature family. Isolated implementation commits remain
  required. Report genuine new scope/design decisions if they arise.

These decisions supersede the audit's tentative scope and organisation
alternatives. P0/P1/P2 are sequencing suggestions, not exclusions from the
agreed full scope. The interview is complete; implementation progress follows.

### Implementation progress (18 October)

The requested work is implemented in isolated code commits. These commits add
the golden coverage and core controls (`6fc4a818`), repair the hosted arrow
comparison with an explicit copy-or-unavailable fallback (`d160fe10`), resolve
published plan links safely (`9b022e49`), add the visual scene registry and
builders (`a25f854f`, `b5d73245`), integrate both registries into the main
debug page and schema consumers (`bf6018d5`, `671a9078`), add API workflow
panels (`7e6e92ae`), complete reciprocal workflow routes and controls
(`865f0d3e`, `85b30418`, `c39194a0`, `da11e13e`), and fill label property and
keyword coverage (`cd90fe2a`, `90488d68`). The result is compact: 31 visual
views plus eight selectable workflow contexts share two registry entries and
one deterministic workflow fixture. Commit `11b8be80` aligns the workflow
query label and progress selector with the browser checks, and skips
renderer-dependent WebKit assertions before bootstrap when WebGPU is absent.
Commit `0d986054` records source-derived explanations for zero-pixel and
unmovable golden resets; the final artifact, pin and manifest slice is
`54e74b29`. Commit `772c8a7bd` reuses immutable status-plan fixtures in the
status module tests, and `266699be6` corrects the hull gallery fit and adds
shape-preserving label-sizing regression coverage.

### Manual review guide

Open `debug/index.html?network=features&scene=paint&view=nodes` to start with
the curated style comparisons. The family/view map is in
`debug/feature-scenes.js`; useful focused routes include
`scene=labels&view=nodes`, `scene=labels&view=edges`,
`scene=labels&view=font-keywords`, `scene=charts&view=bars`, and
`scene=compounds&view=miniature`. Open
`debug/index.html?network=workflows&scene=algorithms` for API/state workflows;
the visible Workflow selector reaches algorithms, layouts, inspector,
mutation, animation, gestures, export and runtime. The arrow and hull galleries
also open as overlays on the main page, and standalone routes remain usable.
Feature settings persist in the URL; Reset reconstructs the selected view.
The node-label comparison starts at numeric `text-rotation: 0.35` radians;
`autorotate` is valid on edges only.

The fixed workflow fixture has explicit algorithm scopes. Kruskal,
Hopcroft–Tarjan biconnected components and Karger–Stein use the connected
A–E induced subgraph (five nodes and six edges); Hierholzer uses the A/B/C
directed cycle (three nodes and three edges). Other applicable full-graph
recipes use all seven leaves, including X/Y. Root and goal selectors affect
only algorithms that accept those inputs.

### Coverage and verification

The following crosswalk reconciles the sixteen audit families at family level;
it does not create a one-control-per-row promise. The 961 CSV rows remain the
feature-status source of truth, and a demo does not upgrade a row marked
Partial or remove its recorded restriction.

| Audit family | Manual route or recipe | Automated evidence / boundary |
| --- | --- | --- |
| Node geometry, shapes, borders, fill, gradients, ghosts and layers | `features/paint/{nodes,fills,borders,ghosts,layers,outlines}`; `features/shapes/underlays` | `test/modules/feature-scenes.mjs`; canonical visual captures. Only node-supported values are authored. |
| Edge geometry, caps, routes, loops, arrows and endpoints | `features/edges/{routes,endpoints,radius-arc,radius-influence,loops,taxi}`; `features/arrows/{shapes,scalars}`; main-page arrow overlay | `test/modules/feature-scenes.mjs`; arrow/renderer browser checks and visual captures. Partial overlap/fill semantics remain documented. |
| Labels and text geometry | `features/labels/{nodes,edges,font-keywords}` | `test/modules/feature-scenes.mjs` and label captures; mapped transform/justification getter limitations are explicit. Generic system font families are manual-only. |
| Images, raster/SVG, layers and SDF icons | `features/images/layers`; image fixtures in the legacy real-network scenes | Image goldens and renderer checks cover image rendering. CORS modes are authored/read back against local data URLs, which do not prove cross-origin fetch policy; no remote-policy claim is made. The `images-multi` restore residue remains unlocalized. |
| Charts and scale/legend contracts | `features/charts/{palette,heat,bars}`; chart controls and readout | Scene/schema tests and chart captures; numeric `chart-domain` bypass getter/legend mismatch is recorded for a later fix. |
| Compound hierarchy, hulls and miniature scaling | `features/compounds/{hulls,hulls-exclude,minimums,padding-width,padding-sides,miniature}`; main-page hull overlay | `test/modules/feature-scenes.mjs`, `playwright-tests/compound-hulls.spec.js`, and `miniature-compounds.spec.js`. Original children/edges stay live; aggregate edges and semantic zoom are not promised. |
| Declarative styles, mappers, bypass and sheet replacement | `features/mappers/scales`; Reset and contextual controls | `test/modules/demo-coverage.mjs`, `schemas.mjs`, `feature-scenes.mjs`, plus existing style/mapping tests. The ledger records authored-vs-resolved and behavioral cases separately. |
| Layout portfolio, options, constraints and packing | Existing layout panel plus `workflows/layouts` | `test/modules/layout-options-panel.mjs`, layout module suites and existing browser layout checks. Function-valued options remain recipes/exclusions where they cannot be serialized into URL state. |
| Selection, states, queries, sets and topology | `workflows/inspector` and `workflows/algorithms` | `test/modules/feature-workflows.mjs` and existing collection/query tests; no button is added for every API alias. |
| Pointer, wheel, touch, picking and events | Existing gesture controls plus `workflows/gestures` | `playwright-tests/gestures.spec.js` and gesture trace suites; browser-synthetic touch does not prove physical touchscreen/pinch acceptance. |
| Animation and transitions | `workflows/animation` | `test/modules/feature-workflows.mjs` and `playwright-tests/feature-workflows-renderer.spec.js`; state is inspected at supported transitions, not with an unsupported progress setter. |
| Add/remove, reparent, data, batch, patch, persistence and compaction | `workflows/mutation` | `test/modules/feature-workflows.mjs` and existing model/patch/wire tests; undo is app-owned and is not introduced by this demo. |
| Multiple views, mount/unmount and worker rendering | Existing minimap plus `workflows/runtime` | `test/modules/runtime-smoke.mjs`, workflow tests and worker browser suites. UI reports requested renderer worker and readiness; actual host identity is not exposed publicly. |
| Algorithms: paths, cuts, components, centrality and clustering | `workflows/algorithms` with operation, root/goal and executor controls | `test/modules/feature-workflows.mjs`, `playwright-tests/algorithms-gpu.spec.js`, and `algorithms-workers.spec.js`. Kruskal/biconnected/Karger–Stein use A–E; Hierholzer uses A/B/C; other applicable recipes use all seven leaves. |
| PNG/JPEG export and rendered geometry | `workflows/export` plus contextual canvas/export examples | `playwright-tests/feature-workflows-renderer.spec.js`, visual export probes, and renderer tests. SVG/PDF export and headless figures remain outside the implemented surface. |
| Headless runtimes, builds, schemas, declarations, typed data, documentation and benchmarks | Nonvisual command recipes and status links; no static graph can establish these contracts | Schema, type/build, module/runtime and benchmark suites are primary evidence. Run their relevant commands from the `AGENTS.md` routing table; benchmark numbers remain attached to their dated reports. |

The generated `docs/demo-coverage.json` ledger accounts for all 220
stylesheet properties and 326 recursive schema property/value combinations:
325 are covered by supported examples and the remaining schema-permitted pair,
node `text-rotation=autorotate`, is runtime-rejected because autorotate is
edge-only, with a direct rejection check. It reports 31 visual views, 55 canonical
feature states, 83 source records and 68 runnable URLs. The 961 status-feature
rows are reconciled by family to a scene/widget, an exact automatic test or a
documented nonvisual reason; Partial rows retain their source restrictions.
The audit's initial table remains a historical gap analysis. The delivered
mapping is generated by `scripts/demo-coverage.mjs` and checked by
`test/modules/demo-coverage.mjs`.

Scene, workflow and harness behavior is covered by
`test/modules/feature-scenes.mjs`,
`test/modules/feature-workflows.mjs`, `test/modules/debug-harness.mjs`, and
`test/modules/schemas.mjs`. Focused Node checks passed on these modules after
the final route and canonical-state integration. The bounded browser walk
reached all 31 feature routes through visible selectors; rendered-bounds and
horizontal-overflow checks passed. Chart controls retained state on reload,
and Reset kept the selected route. The reciprocal x/y workflow arcs have
separate routes and legible weights. The final workflow browser acceptance ran
after font readiness on a 1280×800 viewport. Its parent `p` rendered bounds
were x=44.00–343.57 and y=112.30–265.07; the visible graph was x=44–886 in a
930px canvas, with no horizontal overflow. Bounds stayed identical before
and after a PageRank CPU versus GPU comparison. Seven values were within the
tolerance `abs 0.0001 + rel 0.0001 × max(|CPU|, 0)`; maximum absolute
difference was `7.1633e-9` at `rank.x`, and maximum relative difference was
`6.2046e-8`. `navigator.gpu.requestAdapter().info` reported vendor `amd`,
architecture `gcn-4`, and `isFallbackAdapter: false` (device and description
were empty). The only HTTP/console 404 was the unreferenced `/favicon.ico`
request on the local debug server. Captures include
`/tmp/r149-workflow-acceptance.json` and
`/tmp/r149-workflow-executor-comparison-page.png`. Earlier review screenshots:
`/tmp/r149-feature-acceptance-compound-after-font.png`,
`/tmp/r149-final-workflow-algorithms.png`, and
`/tmp/r149-workflow-reciprocal-curves.png`.

The published status debug page loaded the four vendored Open Sans WOFF2
faces (400/700, normal/italic) from HTTP 200 responses;
`document.fonts.load()` and `font.check()` confirmed all four loaded. The
files match `@fontsource/open-sans` 5.3.0 Latin assets and are accompanied by
the OFL license. The status planner copies the nested fonts into the published
debug mirror. The final `npm run status` build emitted 435 files (64.5 MiB).
The published status index, 107-card golden page, debug feature route and
main-page overlays were opened at port 3335. All four font files returned HTTP
200 and loaded; the arrow comparison rendered both v3 and v4 panes, and the
hull overlay's worst-case rounded/include-labels state fit below its controls.
Status-site modules passed 56/56 under both Node and Bun.

The baseline visual inventory contained 53 golden pairs. The final inventory
has 107 reference PNGs, 107 current PNGs, 107 coverage records and 107 degrade
records. The `visual` Playwright project reported 229 passes and one expected
failure from the pre-existing Round 55 compound-routing parity gap
(`playwright-tests/lib/routing-scenes.mjs:441`);
`playwright-tests/routing.spec.js:66`
checks finite geometry separately. This gap was not introduced or changed by
Round 149. There were no skips, unexpected results or flaky results. The full `renderer` and
`renderer-webkit` projects completed with 262 passes, 232 skips, zero
unexpected results and zero flaky results (494 total). Chromium had 246
passes and one platform skip; WebKit had 16 passes and 231 skips, including 8
workflow skips for unavailable WebGPU. Across the 724 visual/renderer results,
491 passed, 232 were skipped, and one was the expected pre-existing Round 55
compound-routing parity gap; there were no unexpected or flaky results. The focused workflow module
suite passed 9/9 in Node and Bun, and its focused browser suite passed 8/8 in
Chromium with the 8 WebKit cases skipped for the same adapter limitation. The
focused golden suite passed 32/32 and the demo-coverage suite passed 7/7 under
both Node and Bun. The focused compound-hull spec passed in Chromium and
skipped in WebKit for the unavailable adapter. The final public Bun suite and
full Node/Bun module gates passed.

The final golden audit covers 207/220 properties with a non-default static
value. Its 13 remaining property gaps are distinguished explicitly: four
paintable properties (`nodes/text-transform`, `edges/min-zoomed-font-size`,
`edges/text-justification`, `edges/text-transform`) still have no static
golden assignment; nine properties have no meaningful single-frame golden
(the four transition configuration properties on each group and pointer-only
`edges/events`). The feature controls and generated manual ledger remain
separate from this static assignment count. The reset pass checked 1,701
(golden, property) pairs: 1,600 moved pixels, 46 had value changes without
pixel movement, and 55 had unchanged readbacks. In 199 of the 207 properties with a
non-default assignment, at least one golden changed pixels. The keyword
control pass checked 233 cases with 11 explicit semantic exceptions, one
scoped font-style restoration limitation, and zero unclassified failures.
All zero-pixel and unmovable pairs have source-backed map entries. The
paint-edges/layers restore check passed 2/2 with no exception. The three
generic font-family states (`sans-serif`, `serif`, `monospace`) are
intentionally manual-only because they resolve to platform-specific system
fonts; each carries an explicit golden omission reason. The pinned Open Sans
states are captured. The full Node/Bun module gates and final status build,
page open and record checks passed.

### Findings held for separate library fixes

No runtime source changes are part of Round 149. The chart-domain bypass
getter is stale: create the bars scene with stylesheet domain `[-5,6]` and
values `[-4,0,5]`, then run
`cy.$id('chart-bar-horizontal').style('chart-domain', [0,100])`. The bypass
JSON and element chart record hold `[0,100]`, but `style('chart-domain')` and
legend geometry remain `'-5 6'` and `[-5,6]`. The getter follows
`src/style/engine-read.mts:181` and
`src/style/readers-nodes.mts:347-349`, while writes update the chart record at
`src/style/engine-write.mts:341,800`; this conflicts with the public bypass
readback statement at `src/collection.mts:1695`. Automatic endpoints are a
separate supported behavior and are not part of this defect.

Mapped label `text-transform` and `text-justification` visibly use the
authored per-element values in `scene=labels&view=nodes` and `view=edges`,
while getters report stylesheet fallbacks (`none` and `auto`). Scene metadata
records the authored and observed values, and
`test/modules/feature-scenes.mjs` checks them. The reader paths are
`src/style/readers-labels.mts:44,85`; the discrepancy conflicts with the
documented bypass readback contract at `src/collection.mts:1695`.

Compound hull parents also return their packed polygon-pool reference as
`corner-radius`. With the `compounds/hulls` fixture, the public getter for
`hull-round` reports `7864320.7890625` while its shape is
`round-convex-hull`. Setting its public `shape` style to `rectangle` returns
`auto`; setting it back to `round-convex-hull` returns `0`, even though the
parent bounding box returns to its original dimensions. The stylesheet has
no corner-radius override and the default is `auto`. The reader special-cases
only `SHAPE_POLYGON_CUSTOM` before interpreting `NODE_BORDER_GEOM[slot * 4]`
as a radius (`src/style/readers-nodes.mts:40-54`); compound hull derivation
stores the polygon record reference in that word
(`src/store/graph-store/compound.mts:255-262`). This is a third confirmed
getter defect, separate from normal automatic corner-radius behavior and the
custom-polygon reader case. No source fix is part of Round 149.

The final visual scan has three pixel observations that need no runtime-source
change. In `labels/nodes`, resetting `font-weight` through the sheet moved
24,909 pixels but left a 180-pixel ordinary property-reset residue. The
separately scoped `font-style=normal` restoration left 169 pixels
(bounded at 256) after the four pinned Open Sans faces loaded,
`document.fonts.ready` settled and the getter returned to `normal`; this is
the single scoped font restoration limitation. The causes of the font-weight,
font-style and image residues remain unlocalized. The `images-multi` restore retains
a repeatable 624-pixel residue inside the image body after exact style/readback
restoration and `pendingImages=0`. These are unresolved visual observations,
not additional confirmed getter defects.
Physical
touchscreen/pinch acceptance remains a device check because the browser suite
uses mouse or synthetic touch. The runtime panel reports requested
`rendererWorker` configuration and readiness; the public API does not expose
actual renderer-worker host identity. The status build copies the v3 UMD only
if it is already available locally and otherwise publishes the explicit
fallback; it does not install or build v3.
