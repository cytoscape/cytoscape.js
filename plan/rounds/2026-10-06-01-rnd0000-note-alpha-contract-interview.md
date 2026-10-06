## Alpha contract interview

Maintainer decisions from the ongoing interview on 6 October. These are
specification decisions, not implemented capabilities. Explicit decisions
here supersede earlier alternatives in the round plans and PLAN.md ledger.
Unanswered questions remain open; recommendations are not approvals.

### Benchmarks before public decisions

- **Edge-press targeting (item 89): undecided pending benchmarks.** Compare
  synchronous CPU hit testing with deferred GPU picking on sparse, dense,
  parallel-edge and routed-edge fixtures. Measure press-to-event latency,
  main-thread work and correct targets, including right presses. Do not
  choose a target contract merely for v3 parity.
- **Table access (round 84, item 91): internal filter improvements first.**
  No full table-view API. Consider a minimal data-column API only if it
  improves Cytoscape Web's spreadsheet scrolling: a fixed visible rectangle,
  one screen of rows and columns, with only that window rendered. Benchmark
  rectangular reads, scrolling, updates, snapshot construction and allocations;
  whole-table throughput alone does not justify the API.

### State ownership and execution

- **Undo (items 41 and 84): app-owned history.** A single app transaction can
  include state outside the network/cy. Keep core transaction hooks and the
  documented recipe. Separate test/benchmark modules may simulate inverse-log
  and snapshot history from an app's perspective; neither is core API.
- **Nested computation workers (item 82): dedicated browser workers first.**
  Reuse capability detection and existing algorithm/force-worker machinery;
  verify bootstrap, correct results, lane use, cancellation, errors and cleanup.
  Shared and service worker support requires separate verification, not an
  automatic claim. This does not require moving Cytoscape Web's model into a
  worker; that is a separate app architecture choice.
- **Firefox CI (item 83): add model and rendering coverage together when
  WebGL2 lands**, rather than adding a model-only project now.
- **Layouts as capabilities (item 77): defer until after alpha.** All built-in
  layouts remain available in alpha entries.
- **Force tidyComponents (item 79): declare and document**, default true;
  include it in public types, the schema and debug controls.

### Style readbacks and label geometry

- **Keep opacity properties.** Removing one-color multipliers is declined.
- **No public folded style getter or folded option.** Folding is internal
  rendering representation, not a consumer-facing property contract.
- **style() reads separate property values**, after mappings and bypasses:
  color alpha is the color's own alpha; an opacity getter reads its independent
  multiplier. Renderer encodings must not multiply them a second time on a
  read/set round trip. Zero opacity must not destroy the readable color alpha.
- **During transitions, return current interpolated property values**, not
  destination values. Color and opacity remain independently readable.
  Implementation must retain/evaluate their inputs, not divide packed alpha.
- **numericStyle() stays for alpha** as the numeric convenience/assertion over
  style(); possible removal is a post-alpha simplification review, not a
  commitment to remove it. renderedStyle() continues zoom-scaled length reads.
- **chart-colors returns the configured palette**, after mappings/bypasses,
  not repeated or scale-resolved per-slot drawing colors.
- **Gradient-stop-position reads return configured/default values**, after
  mappings/bypasses; even spacing derived from the color count stays internal.
- **Label borders draw independently of background opacity** (item 87).
- **Expose a numeric label-box corner-radius property**, default 4 model px,
  no auto keyword; nonnegative, capped at half the smaller box dimension.
  The public property name and mapping/transition support remain to specify.
- **Keep fractional label widths**, including rendering and bounds; do not
  round to whole model pixels to match v3. This changes no transfer format.
- **Data-driven gradient stop lists (item 74): defer.** Constant lists for
  alpha; reconsider when an app needs mapped gradients.
- **Translucent line/casing folds (item 81): fix before SVG/WebGL2 ports**,
  with visual regression controls and performance measurements.

### Pointer and gesture contracts

- **Keep release-before-tap ordering** (item 88). Normal completion targets
  pointerup/tapend at the captured source, then releases the grab, then runs
  tap/selection only if the gesture qualifies as a tap. Completed drags have
  no tap. The exact order within the free/freeon pairs remains to specify.
- **Compound drop refinement:** resolve/validate the drop and commit accepted
  hierarchy changes before free/dragfree. Release listeners observe the final
  hierarchy. Pointerup/tapend precede that commit. Compound drag-and-drop
  remains a core feature scheduled after alpha (item 40).
- **tapend targets the pressed/captured object**, not the release-point hit.
- **dbltap requires the same target** for both taps.
- **Modifier+press prepares box selection without a provisional grab.**
  Modifier+tap must still support adding/toggling individual elements,
  including Shift+tap; regression coverage must distinguish tap and box drag.
- **Locked nodes pan only when pannable**, gated by core panning toggles.
  Locking alone does not imply panning.
- **Keep v4 box-event ordering.** boxend marks rectangle completion; box is
  a containment notification before selection changes; boxselect identifies
  newly selected elements. In replacement mode, outsiders are deselected
  after box. No final-selection promise for boxend or box.
- **Add tapcancel** when pinch/context takeover abandons a started tap, and
  when pointercancel cancels one. Once per outstanding tap interaction, on
  the original target; no subsequent tapend or tap for that interaction.
- **Adopt device-adaptive wheel zoom**, starting from v3's approach. Verify
  mouse-wheel and trackpad/browser combinations where fixed sensitivity fails.

### Annotation and editing foundation

Round 81 and item 75 must incorporate these decisions. Editing contracts are
settled before alpha; interactive editing controls remain scheduled after alpha.
The exact staging of annotation-body dragging still needs reconciliation with
round 81's first implementation.

- **Annotation handles are event targets**, with events bubbling once to cy;
  not core-only events with handles merely in payloads. They remain outside
  cy.elements(), node/edge selectors, adjacency, layouts and algorithms.
- **Element-like geometry API:** position() is the center of the geometry
  box, excluding border/text overflow. width()/height() have getters/setters;
  resizing preserves the center. Text-box resizing changes wrapping, not font
  size. resize(bb) sets position and dimensions from a bounding box. Exact
  box formats and per-kind geometry semantics remain to specify.
- **Apps toggle handle visibility per element or annotation.** No required
  edit mode, selection dependency or one-object limit: the app may enable all
  handles, one object's handles, or use pointerover to control them.
- **Visible handles enable their editing gestures; hiding them disables
  handle gestures.** Body dragging is controlled separately.
- **Annotations support grabbable()/grabify()/ungrabify(), default grabbable.**
  This supersedes the old imported-annotation default-inert plan.
- **Annotations support locked()/lock()/unlock().** Locking blocks interactive
  movement and resizing; handles may remain visible. Programmatic lock behavior
  and lock effects on other edit operations remain to specify.
- **Annotations support selected()/select()/unselect(), selectable(),
  selectify()/unselectify(), and tap/box selection.** Selection defaults and
  serialization still need specification.
- **cy.annotations() returns an annotation collection**, with iteration,
  filtering and bulk state/handle operations, separate from element collections.
  Exact filtering and method surface remain to specify.
- **Shared selection domain** across elements and annotations. Single-selection
  plain taps replace selection across both; modifier taps and box selection
  can select both. Handle visibility remains independent.
- **Shared drag group:** dragging a selected object moves selected, unlocked,
  grabbable nodes and annotations by the same displacement. Selected edges
  do not move independently. Ancestor/descendant deduplication and per-kind
  annotation translation must be specified before implementation.

### Geometry, attachment and editing refinements

These later answers refine or supersede earlier alternatives above.

- **Line/arrow resize:** scale endpoints and bends into the requested box,
  preserve relative shape, stroke thickness and arrowhead size. Public line
  bounds include stroke thickness: a horizontal visible line does not have a
  zero-height public box just because its centerline does.
- **Minimum dimensions:** clamp requests as far as possible rather than throw
  or accidentally hide the object. Initially at least 1 model px in each
  dimension, with a larger minimum where unchanged strokes/arrowheads require
  it. A requested 0-by-100 box can resolve to 1-by-100 for a 1px stroke.
  This supersedes the brief rejection alternative. Configurable/style minima
  are future considerations. Interactive node resizing also has a minimum.
- **Clamping resize(bb) preserves the requested center**, expanding symmetrically
  to meet minimum bounds; interactive handle anchoring remains to specify.
- **Node resize:** write width/height bypasses; leaf nodes only. Compound
  parents stay sized from children/padding. Free resizing is the default;
  Shift preserves the starting aspect ratio. Image annotations use the same
  free-resize default and Shift behavior.
- **Edge editing:** editing an automatic route creates an independent per-edge
  route through style bypasses, without changing its neighbors. The handle-toggle
  function accepts a route-kind option: segments or Bezier; for a straight edge,
  segments is the default. Existing editable routes retain appropriate semantics.
  Endpoint reconnection handles are optional, independently enabled.
- **Cancelled handle edits restore starting state**, including geometry,
  endpoint identity, bypasses and attachments. Escape, pointercancel and invalid
  endpoint drops cancel. Apps can veto before an edit starts or commits through
  cancellable lifecycle events; exact event names/payloads remain to specify.
- **Lock consistency:** existing node locking prevents movement, not all
  mutation. Annotation locks block interactive geometry edits and programmatic
  position changes; allow programmatic width/height changes about the fixed
  center, data and appearance. A locked annotation's resize(bb) or shift cannot
  apply; this supersedes the earlier partial size application for resize(bb).
  Programmatic width/height setters are the explicit way to change its size.
- **Handle visibility is transient view state:** not serialized; clones begin
  with handles hidden. No app/view editing mode is imposed.
- **Following clones follow authored annotations**: additions/removals, geometry,
  content and appearance; selection and handle visibility stay independent.
- **In-place node/edge label edits create label bypasses by default**; apps may
  update their own data and remove the bypass through edit events. Annotation
  label edits directly change annotation text.
- **Imported GroupAnnotation for alpha:** render independent members and retain
  group metadata for export. Revisit native grouping later, jointly with node
  grouping because the concepts are analogous.
- **Live endpoint attachments:** design before alpha, implement later. Default
  anchor is the target geometry boundary, toward the next bend/opposite endpoint,
  excluding label overflow. Target removal detaches at the last resolved point;
  replacement with the same id does not automatically reattach.
- **Moving a free endpoint keeps its other attachment.** With one attached
  endpoint, width/height resizing keeps that anchor and adjusts the free side.
  With both attached, detach both and resize about the center. A position()
  translation detaches attachments.
- **Explicit resize(bb) honors the requested box subject to minima and locks.**
  Retain an existing attachment only when compatible with the resulting endpoint,
  using a reasonable screen-space threshold comparable to tap thresholds. Add
  a maintainer manual review of that threshold; the value is not settled here.
  Locks take precedence; the width/height setter rule preserves the fixed center.

### Bundling decisions

- **Explicit async cy.bundleEdges(options)**, not automatically maintained
  bundled style. The existing promise-plus-stats decision stands.
- **Routes deform with endpoint movement**; apps rerun to tighten the bundle.
- **A style enum controls bundle arrowheads**, normal per-edge or suppressed;
  **suppressed is the default**. A more elaborate simplification mode is not
  committed. Public property name and enum spelling remain to specify.
- **Routing-style writes do not discard bundled routes**: bundle ownership stays
  until explicit unbundleEdges(), revisitable later. This supersedes round 83's
  style-wins rule. Explicit handle editing still clears the edited edge's bundle,
  as the independent-route decision requires; unrelated edges stay bundled.
- Persistence still follows the earlier measurement gate: compare app-held
  presets and a wire-format section before choosing; no answer here selects one.

### Layout constraint and option decisions

- **constrainWithinBounds: true** makes boundingBox binding; its default role
  remains a hint. Contradictory constraints produce the best effort plus
  a violation report, not an all-or-nothing refusal.
- **await layout.promise() returns the completion report** with constraint
  satisfaction/violations. run() continues returning the layout handle. The
  suggested result() accessor and layoutstop payload were not separately
  approved; their need and exact shapes remain to specify.
- **nodeSpacing** is the canonical common minimum node-box gap; componentSpacing
  and overall spacingFactor stay distinct. Alpha uses one spelling with no
  deprecated gap aliases. Map old options by actual semantics, not a blanket
  textual rename; preserve distinct rank/edge concepts.

### Interview still open

Finish annotation/editing method names, per-kind geometry, bounds, grouping,
attachment, ordering, event/default/persistence/clone contracts and cancellation;
edge-handle semantics; layout option consolidation and review; CJK design;
bundling API/freshness/persistence; exporter/headless contracts; portable-style
and persistence closure audits; platform/release acceptance specifications.
The original recorded deferrals remain unless explicitly changed above.
