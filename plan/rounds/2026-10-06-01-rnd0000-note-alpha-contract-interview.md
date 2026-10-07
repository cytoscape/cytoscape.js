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

### Further layout, CJK and alpha acceptance decisions

- **Compact layout placement is the default**, using node dimensions and
  nodeSpacing rather than expanding to fill the box. Use the common condense
  option where applicable. Component packing targets the bounding-box or
  viewport aspect ratio, with a square fallback when dimensions are unavailable.
- **CJK wrapping defaults to punctuation-aware legal breaks**, without requiring
  spaces. An anywhere mode may relax that rule. Glyph atlases grow within a
  budget, then reclaim and re-rasterize on demand; benchmark pan/zoom churn and
  make exhaustion explicit. These answers do not change the recorded timing:
  design before alpha, implementation during alpha.
- **Fonts are supplied by the app**, with a configurable instance fallback chain
  and registration for page, worker and export contexts. Tests use pinned local
  copies of Noto Sans Japanese, Noto Sans Korean and Noto Sans Simplified Chinese
  so they do not depend on system fonts or network availability.
- **Platform gates before alpha:** recorded macOS/Metal, Windows/D3D12 and real
  Android touch checks, plus browser CI and WebGL2 parity. A skipped check is
  recorded explicitly and does not count as a pass.
- **Representative app integration tests gate alpha and live in this repo.**
  Use public contracts, independent fixtures and a repository-owned harness.
  Scenarios may be informed by Cytoscape Web without depending on its
  implementation: loading, virtual tables, styling, selection, layouts and
  export. This is a bounded integration suite, not a full app migration gate.

### Further editing and annotation interaction decisions

- **Handle API:** handles() reads visibility; handles(true, options) enables
  handles; handles(false) disables them. Setters return the receiver.
- **Hiding handles or locking during a handle edit cancels it**, restoring the
  starting state before the lock takes effect.
- **Figure exports exclude editing handles**, even when visible in the view.
- **Interactive resize anchors the opposite corner or side**, including when
  enforcing the minimum dimensions. Programmatic resize(bb) retains its
  previously specified requested-center clamping rule.
- **Core autolock, autoungrabify and autounselectify also apply to annotations.**
- **Group dragging moves each object once.** Account for movement inherited
  from compound parents or endpoint attachments so selected descendants and
  attached annotations do not receive the drag delta twice.
- **Annotations support pannable(), panify() and unpanify()**, defaulting to
  non-pannable. Apps can enable panning from an annotation when it cannot be
  dragged, subject to the core panning toggles.

### Annotation removal and editing event decisions

- **Annotation removal is terminal**, matching v4 elements: remove()/removed()
  do not imply restore(). Re-adding saved definitions creates new objects with
  new listeners. This supersedes the interview answer about retaining listeners
  across restoration, which was based on an incorrect claim about v4 elements.
  Clones do not copy listeners.
- **One gesture has one edit transaction**, with all affected objects and their
  starting and proposed final states. Before-commit events carry both states for
  app validation and undo. Cancellation rolls back only changes still owned by
  the gesture, preserving subsequent app changes.
- **The lifecycle applies to ordinary node/annotation dragging, resizing,
  edge-route editing, reconnection and label editing**, while retaining existing
  gesture events. Notify before start, on start, during updates, before commit,
  after commit or on cancellation. A veto before commit cancels and rolls back;
  it does not leave a preview waiting for explicit app completion.
- **Use separate event families with plain names**, such as drag and resize;
  no shared edit event with a kind field and no appended '-edit' naming.
- **Resize events:** beforeresize, resizestart, resize, beforeresizeend,
  resizeend and resizecancel. The two before events are cancellable; resizeend
  means committed. Resize handles emit resize events only, not ordinary drag.
- **Dispatch each stage on the initiating object, bubbling once to cy**, with
  all affected objects in the payload. Apply this dispatch rule consistently to
  drag as well. Current v4 grab/drag/free dispatch iterates the drag set, while
  grabon/freeon target the directly pressed object; implementing this decision
  requires reconciling that behavior and testing multi-object dispatch. Exact
  remaining drag-family names and compatibility treatment remain to specify.

### Drag dispatch and label editing refinements

- **grab, free and dragfree use initiating-object dispatch**, bubbling once to
  cy with all affected objects in the payload. Remove grabon, freeon and
  dragfreeon for alpha; do not retain aliases.
- **Drag lifecycle:** beforedrag, dragstart, drag, beforedragfree, dragfree and
  dragcancel. grab/free retain acquisition/release roles. Start only after the
  drag threshold is crossed; beforedrag may veto movement then. A tap has no
  drag lifecycle, and vetoing beforedrag leaves tap eligibility governed by
  the normal tap thresholds.
- **Cancelled drag:** roll back gesture-owned changes, emit dragcancel, then
  free to balance grab; no dragfree. Successful release validates and commits
  before free, followed by dragfree; both observe final state. Keep the earlier
  pointer-release ordering and compound-drop commit requirements.
- **Programmatic changes do not emit the interaction lifecycle.** position()
  and resize(bb) emit their normal change events.
- **Reconnect lifecycle:** beforereconnect, reconnectstart, reconnect,
  beforereconnectend, reconnectend and reconnectcancel.
- **Route lifecycle:** beforeroute, routestart, route, beforerouteend, routeend
  and routecancel for bend/control-point edits. As with resize, the two before
  stages are cancellable.
- **Label lifecycle:** beforelabel, labelstart, labelinput, beforelabelend,
  labelend and labelcancel. labelinput reports text updates. The user accepted
  the full lifecycle after the proposed clearer labelinput update name.
- **Label editing is enabled per element or annotation, default disabled.**
  Enabling permits editing without automatically starting it on tap. Apps
  choose the trigger and call editLabel(). Enter or clicking outside attempts
  to commit; Escape cancels.
- **Pointer and tap events expose hitPart and labelRole**, enabling apps to
  distinguish a label hit and main/source/target label roles. Preserve the
  owning element/annotation as the event target. Exact hit-part enum and
  editLabel() arguments remain to specify.

### Label editor session decisions

- **One active label editor per cy instance.** Opening another first attempts
  to commit the current session. A validation veto keeps the current editor
  and draft active. For labels this supersedes the generic rollback-on-veto
  rule: default to keeping the draft open and restoring focus, while allowing
  the app to cancel explicitly, including from its validation handler.
- **Keyboard/completion:** Enter attempts commit; Shift+Enter inserts a newline;
  Escape cancels. Clicking outside attempts commit. Veto leaves the session
  open unless the app explicitly cancels.
- **editLabel() returns a session** with commit(), cancel() and promise(). The
  promise resolves for committed and cancelled outcomes with status, original
  text, final text and cancellation reason where applicable. Veto keeps it
  pending. Exact result field spelling remains to specify.
- **editLabel({ labelRole })** accepts main/source/target, defaulting to main.
  Removing the edited node, edge or annotation cancels the session and closes
  the editor; editing does not block removal.
- **App changes to the edited label synchronize into the visible draft and
  eventual commit value**, supporting automatic cleanup such as stripping
  disallowed characters. Other label roles do not change the draft. Preserve
  the previously specified ownership-aware cancellation behavior.
- **Built-in editor only for now**; revisit an app-supplied editor hook later.
- **Locked objects may still have labels edited** when enabled, because locks
  restrict geometry. Disabling label editing during a session cancels it,
  closes the editor and rolls back only session-owned changes.
- **editLabel() respects the per-object editing toggle.** Disabled editing
  returns null without opening a session, rather than throwing.
- **labelEditable(true/false) without a role applies to all applicable roles.**
  Passing { labelRole } changes only that role. labelEditable() without a role
  reports whether all applicable roles are enabled; a role-specific query
  reports that role. editLabel() still defaults to the main label.

### Label interaction style decisions

- **labelEditable settings are transient per-view state**, excluded from
  serialization. editLabel() on a collection operates on its first element.
- **Outside click commit passes through on success**, allowing the clicked
  selection/action; on veto keep the editor active and consume the click.
- **Label taps use normal owner selection rules**, with hitPart metadata for
  apps. Add independent label-selection style control rather than treating
  text-events as a selection-only property.
- **text-events, text-selection and text-grabbable use role arrays only**:
  main/source/target, with [] disabling all roles. Do not add all/none values.
  Defaults enable all applicable roles. This supersedes the earlier proposed
  yes/no forms and v4's current text-events default no. Extend text-events to
  edge labels as well as node labels. Ignore inapplicable roles so the same
  array can be reused across nodes and edges. Support data mappings and
  per-element bypasses for all three properties.
- **Box label participation requires all three permissions:** the role is
  present in text-events and text-selection, and boxSelectionIncludesLabels
  is true. boxSelectionMode determines containment/overlap. Node-body/edge-path
  eligibility is independent of label-role inclusion; selectable() and core
  autounselectify still take precedence for automatic selection.
- **Document precedence with examples**, including a label extending outside
  the selection box and label-only overlap. With global label inclusion true
  but a role excluded locally, that label's geometry is ignored and the body
  or path can still qualify. Verify both contain and overlap modes.
- **Label dragging is independent of text-selection.** A role must be present
  in text-events and text-grabbable, and its owner must be unlocked/grabbable.
  When it cannot initiate object dragging, follow the owner's pannable()
  setting and the core panning controls.
- **Edge labels do not drag endpoint nodes for alpha**, even with the role
  enabled in text-grabbable. Keep existing edge drag behavior; route and
  endpoint editing use handles. A pannable edge can still initiate viewport
  panning from its label under the preceding rule.

### Bundling precedence and operation lifecycle refinements

- **Endpoint-style updates continue during bundling.** Bundled rendering takes
  precedence without overwriting the underlying style values. Unbundling reveals
  the latest styles. This reinforces the earlier operation-owned route decision;
  it does not settle node-position changes during computation or source/target
  identity changes, which must be distinguished from endpoint style properties.
- **No implicit node locking** during computation or while bundled. Explicit
  app locks remain independent.
- **bundling() and bundled() report status on edges and nodes.** Edges report
  their own status; a node reports whether any incident edge has that status.
  These statuses do not imply locked().
- **Keep existing bundles visible during recomputation**, allowing both statuses
  to be true. A successful result replaces the route. Failure or cancellation
  clears the running status while preserving the previous bundled route.
- **One active bundling run per cy instance.** A new call cancels and replaces
  the running operation, even for disjoint scopes; preserve existing rendered
  bundles until successful replacement. This supersedes the earlier overlapping
  run precedence discussion. All graph edges are the default scope; subset
  operations can be run sequentially for independently bundled groups.
- **unbundleEdges() also cancels a running operation affecting its requested
  edges**, preventing a late result from rebundling them. Cancel the whole run
  even when its scope includes other edges. Clear existing bundles only within
  the unbundle request; bundles outside it remain intact.

### Bundling API and mutation decisions (2026-10-07)

- **Node movement during computation does not interrupt bundling.** Apply
  completed endpoint-relative routes at the latest positions; rerun to tighten
  if needed. Source/target identity changes through edge.move() likewise let
  computation continue and adapt results to the new endpoints. Preserve the
  rewiring. This differs from cy.patch(), which currently replaces rewired
  edges by removal/addition.
- **Removed edges do not cancel the run.** Skip them at application; a new
  edge with the same id does not inherit the old result. Capture the edge set
  at call start; added edges participate only in later calls.
- **Apply surviving completed routes in one batch**, preserving current routes
  during computation rather than showing intermediate iterations.
- **Accept an AbortSignal** for explicit cancellation. Preserve previous routes,
  clear running status and prevent late result application.
- **Cancellation rejects with CancelledError**, matching current layouts.
  Successful completion resolves with the report. The earlier layout completion
  report decision does not change its current cancellation rejection rule.
- **Return bundled and skipped collections**, alongside iterations and elapsed
  time. Counts come from length. skipped retains the original removed handles
  and their cached ids, not replacements. Include retained-reference costs in
  large-graph benchmarks.
- **Public names:** cy.bundle(options) for the whole graph and
  edges.bundle(options) for a subset, both returning the result promise.
  cy.unbundle() clears all bundles; edges.unbundle() clears a subset. These
  supersede bundleEdges/unbundleEdges names used earlier in this note.
- **collection.bundle() ignores nodes and operates only on its edges**;
  do not implicitly expand to nodes' incident edges.

### Bundling events and geometry refinements

- **Route-handle editing does not cancel a running bundling operation.** It
  clears the existing bundle and updates the underlying route; the pending
  result may later take rendering precedence without overwriting that edit.
- **Emit lifecycle events on cy:** bundlestart, bundleend, bundlecancel and
  bundleerror, carrying the operation's scope and result/reason as applicable.
  Install completed routes and clear running state before bundleend; resolve
  the promise afterward. Clear the operation's running state before cancellation
  or error events, then reject the promise; preserve existing routes.
- **Replacement closes the old lifecycle before starting the new one:** emit
  the previous run's bundlecancel before the replacement's bundlestart.
- **No progress callback/events for alpha.** Apps may show an indeterminate
  indicator until completion.
- **unbundle event on cy:** emit once after clearing routes, with the affected
  edge collection. Also emit when route-handle editing clears an existing
  bundle, identifying the route-edit cause. Exact reason spelling remains to
  specify.
- **Begin with simple polylines**, followed by maintainer manual visual review
  to determine whether smoothing is needed and to what degree. Do not commit
  to smooth interpolation before that review.
- **Dedicated bundlePoints() getter**, not bundled points through
  segmentPoints(). Return interior points only in model coordinates, excluding
  endpoints, consistent with current segmentPoints()/controlPoints() conventions.
  Add renderedBundlePoints() for rendered coordinates. The remaining getter
  behavior while a bundle is active remains to specify.

### Interview still open

Finish annotation/editing method names, per-kind geometry, bounds, grouping,
attachment, ordering, event/default/persistence/clone contracts and cancellation;
edge-handle semantics; layout option consolidation and review; CJK design;
bundling API/freshness/persistence; exporter/headless contracts; portable-style
and persistence closure audits; platform/release acceptance specifications.
The original recorded deferrals remain unless explicitly changed above.
