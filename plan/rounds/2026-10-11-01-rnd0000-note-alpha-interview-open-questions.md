## Alpha interview follow-up questions and review gates

**Depends on:** 2026-10-06-01, 2026-10-08-01

Consolidated on 11 October from the ongoing
[contract interview](2026-10-06-01-rnd0000-note-alpha-contract-interview.md) and
[annotation/membership research](2026-10-08-01-rnd0000-note-annotation-use-cases-and-overlapping-membership.md).
Explicit interview answers take precedence over older round alternatives.
This register records unanswered questions; it does not approve proposed APIs,
mark planned work implemented, close a round or change release timing.

Ask the maintainer one decision at a time. Keep settled choices settled. A
benchmark gate requires evidence before choosing; a manual review requires the
maintainer to inspect the result. Ordinary implementation detail can be resolved
consistently with the approved contract and documented without another interview.
Update this register when an answer or review closes an item.

### Membership model: provisional direction, further review required

**Settled:** preserve compound containment; a node may have one compound parent
and belong to multiple overlapping groups. **Provisional:** enumerate nonzero
members, preserve numeric sign/magnitude, keep participation separately where
net cancellation loses it, and distinguish member count from signed and absolute
totals. Names, numerical constraints and exact API remain open.

- **M1 — Public terminology.** Group-node, set-node, bag or multiset? What are
  the kind predicate and membership traversal names without colliding with
  existing group() and collection terminology?
- **M2 — Declaration ownership.** Which of parent, parents, children and members
  are supported, and for which relation? If multiple forms are accepted, what
  canonical relation and conflict rule prevent contradictory sources of truth?
  Existing parents() must retain its compound-ancestor meaning.
- **M3 — Inference and conversion.** Infer the kind from presence of members,
  including [], require an explicit kind, or support both? Can a membership
  object also be a compound parent, nest inside one, or convert between kinds?
  Preserve ordinary node/compound-parent transitions already supported.
- **M4 — Numeric domain.** Integers only or finite fractional values too? What
  precision, validation and normalization apply, including NaN, infinities,
  negative zero and floating cancellation? Negative values are part of the
  provisional model, not a completed numerical contract.
- **M5 — Zero and identity.** Are explicit zero entries discarded, retained for
  metadata, or represented separately? Does setting zero remove membership?
  Preserve the provisional rule that zero is outside enumerated support.
- **M6 — Reads and mutations.** What is the value getter/setter, default for an
  unweighted member, repeated-entry rule (sum, replace or reject), reverse lookup
  and bulk mutation surface? Does members() return a distinct element collection?
- **M7 — Aggregation and algebra.** Which separately named counts/totals and
  add/subtract/union/intersection operations belong in core, if any? Literature
  uses different cardinality and operation conventions; do not infer a full
  algebra merely from choosing the word multiset.
- **M8 — Membership metadata.** Whole-object data only, an app-managed ID-keyed
  map of member roles, or dedicated per-membership data? How are reactant/product
  participation and zero-net catalysts preserved? App metadata needs reference
  cleanup rules; numeric values alone cannot recover cancelled participation.
- **M9 — Valid members and lifecycle.** Nodes only, edges too, nested membership
  objects or annotations? Are self-membership/cycles valid? What happens on
  removal, same-ID replacement, unresolved imports and batched forward references?
- **M10 — Drawing and topology.** Is a membership object an ordinary graph node,
  an annotation/enclosure, or a separate object with optional visual instances?
  Can one set have multiple drawings? Does it represent a hyperedge, affect
  graph algorithms, or remain independent of pairwise topology?
- **M11 — Movement, collapse and layout.** Does moving a membership enclosure
  move its members, and how are multiply shared nodes treated? What can collapse
  mean for overlaps? Which layouts may use memberships without altering compound
  ancestry or graph connectivity?
- **M12 — Persistence and staging.** What JSON/wire/patch/clone/follow form is
  required, which values are authored versus derived, and when is this built?
  Overlapping membership's existing deferral is not changed by provisional review.

Review with ordinary overlapping pathways, stoichiometric complexes, signed
reaction participation and update/cancellation examples. Check consistency of
removal, reverse lookups and serialization; benchmark population, membership
count, overlap and allocations before fixing storage. A signed total of zero
must not be confused with an empty support.

### Annotation objects, placement and shared APIs

- **A1 — Object/collection model.** Keep annotations wholly separate from graph
  collections, introduce a shared visual-object collection, or expose another
  generic lookup? Which shared methods are reused internally through adapters
  or composition? Measure overlap rather than assuming 90% similarity.
- **A2 — Annotation data.** Does the research justify annotation.data() for
  semantic categories, provenance, generated summaries, placement priority or
  legend metadata? If so, which data-driven style mappings/scale domains follow?
  The earlier no-data decision is reopened, not automatically reversed.
- **A3 — Enclosures and membership.** Which containment use cases use compounds,
  membership objects or standalone annotations? Share bounds/member tracking
  where suitable, but specify topology and movement independently.
- **A4 — Anchoring scope.** Extend anchoring from line/arrow ends to all kinds?
  Can targets be a node, annotation, edge path, member-set bounding box or
  viewport? How are fixed versus dynamically maintained target sets represented?
- **A5 — Anchor rules.** Specify offsets/units, label inclusion, padding,
  empty/deleted target sets, dependency-cycle prevention and dragging a follower.
  Avoid a bounds feedback loop where an enclosure includes itself.
- **A6 — Placement/layout integration.** Resolve anchors after graph layout,
  run a separate annotation placement pass, support annotation-aware graph
  layouts, or some combination? Distinguish derived compartment separators from
  boundaries that constrain placement. What is designed/built for alpha?
- **A7 — Geometry detail.** Define accepted bounding-box forms and geometry
  versus stroke/text bounds for each kind, including text wrapping, images and
  lines with bends/heads. Resolve fixed-center width/height behavior when an
  endpoint attachment would otherwise require asymmetric resizing, especially
  under a lock; do not silently violate the approved lock contract.
- **A8 — Native grouping.** How should later annotation grouping and analogous
  node grouping relate to compounds and overlapping membership? Alpha imported
  GroupAnnotation stays independent members plus preserved metadata.
- **A9 — Ordering and defaults.** Specify foreground/background order, z-order,
  creation defaults (including selectable), collection filtering and bulk method
  behavior. Do not infer these from the globally unique ID rule.
- **A10 — Supported style surface.** List applicable properties per kind,
  interpolation and bounds invalidation, plus import/export translations.
  Constants/state conditionals, shared property names, block structure,
  bypass precedence, validation and transition support are already decided.
- **A11 — Persistence/clone audit.** Specify authored geometry/content,
  attachments/group metadata and foreign import fields in JSON/wire/patch/follow;
  verify export participation and retained UUID identity. Selection, handles and
  label-edit toggles remain transient; terminal removal does not gain restore().
- **A12 — Implementation staging.** Reconcile default grabbability/body dragging
  with round 81's first implementation versus later handle editing and live
  attachments. A settled behavior does not establish its release milestone.

### Editing, label sessions and gestures

- **E1 — Payload schema.** Exact transaction fields for initiating target,
  affected objects, starting/proposed/final state, veto and cancellation reasons;
  label-session result spelling and event payloads. Event families and dispatch
  are already decided, including ownership-aware rollback and label veto behavior.
- **E2 — Handle option spelling.** Define node/annotation handle configurations,
  edge route-kind/reconnection options and per-kind supported handles. Visibility
  stays controlled by handles(true/false, options), independent of selection.
- **E3 — Route editing detail.** Specify supported automatic route conversions,
  bend/control-point insertion/removal, reconnection target validation and invalid
  drops. Preserve independent bypasses, existing route semantics and cancellation.
- **E4 — Hit metadata.** Exact hitPart enum, labelRole applicability and priority
  when label/body/handle regions overlap; editor positioning and wrapping behavior.
  Role arrays, owner targets, trigger control and selection precedence are settled.
- **E5 — Integration validation.** Review transaction ownership when app changes
  occur during dragging/resizing/editing, disappearance of companions, inherited
  movement deduplication and outside-click pass-through. Implement within the
  agreed cancellation/removal rules rather than inventing new veto semantics.
- **E6 — Manual attachment threshold.** Pick and try the screen-space compatibility
  threshold for retaining attachments after explicit resize(bb), comparable to
  tap thresholds. Maintainer manual review is explicitly required.
- **E7 — Device wheel review.** Validate the v3-derived adaptive wheel behavior on
  the mouse/browser and trackpad combinations motivating it. Modifier+tap,
  tapcancel, source capture and release/drag event order already have decisions.

### Benchmarks, styles and bundling

- **B1 — Edge-press targeting (item 89).** Benchmark CPU synchronous targeting
  against deferred GPU picking: latency, main-thread work, correct edge/right
  press targets on sparse, dense, parallel and routed fixtures. Choose afterward.
- **B2 — Table access (round 84/item 91).** Internal filter/reader improvements
  first. Does a minimal column API improve one-screen rectangular reads and
  scrolling enough to justify it? Measure snapshots, dirty updates and allocation.
  Round 84's range/degree/adjacency query additions also require measured scope.
- **B3 — Bundling persistence (round 83).** Compare app-held presets with a wire
  section before choosing persistence. Include serialized size and reconstruction
  cost rather than assuming a format is required.
- **B4 — Bundle geometry review.** Maintainer reviews simple polylines before
  deciding whether/how to smooth. Endpoint-relative deformation after movement
  and rewiring needs correctness/fidelity checks, not a new implicit locking rule.
- **B5 — Bundling schema.** Exact arrowhead style-property/enum spelling, report
  and reason fields, option validation and algorithm defaults from round 83.
  API names, one-run ownership, cancellation, event order and getter semantics
  are settled. Benchmark skipped-handle retention and route adaptation costs.
- **B6 — Label corner radius.** Public property spelling and mapping/transition
  support for the approved numeric 4-model-px default and half-dimension clamp.
- **B7 — Readback/fold regression audit.** Confirm independent alpha/opacity,
  current transition reads, end-label-only streams and mapped/bypassed readers;
  review translucent sharp bends/casing before SVG and WebGL2 ports. These are
  fixes/verification work, not an unanswered public folded API proposal.
- **B8 — Undo benchmark modules.** Decide the minimal test-only inverse/snapshot
  simulations that exercise app-owned transactions including state outside cy;
  no core history stack. Compare cost/completeness without expanding core scope.

### Layouts, fonts and exports

- **L1 — Layout report schema and assessment.** Field names for violations,
  unsupported/unassessed constraints, skipped and externally changed collections;
  thresholds and per-layout assessment coverage. Reuse valid assessments and
  reassess only when needed. promise()/layoutstop and completed/stopped are settled.
- **L2 — Layout option migration/review (round 125).** Map nodeSpacing by actual
  semantics; retain separate component/rank/edge spacing and spacingFactor.
  Audit condense/packing/default bounds behavior per layout, including AVSDF,
  and obtain the remaining maintainer visual sign-offs. No alias decision remains.
- **L3 — CJK contract detail.** Exact legal-break/anywhere option, font registration
  and fallback API, atlas budget/reclamation/exhaustion limits, and stress fixtures.
  Pinned local Noto test families, shared font face and implementation timing
  (design pre-alpha, build during alpha) are already decided.
- **L4 — Export option/report schema.** The 12 October interview settles
  imageMode, resourceTimeout, the warning envelope, SVG output modes/default,
  viewport default, non-rejecting empty full exports and a model-pixel
  advanceOf callback. Exact warning codes/resource type, output overloads,
  zero-sized dimension handling and mounted callback behavior remain open.
  Define a good default estimate; ASCII metrics/reference font, font stack,
  kerning or richer metrics and approximation warnings remain considerations.
  Application-owned Fontkit/opentype.js adapters add no core dependency.
- **L5 — Export coverage/review.** Specify golden/fidelity tolerances for drawn
  features, CJK fonts, annotations and active bundles; verify recoverable omissions
  and cancellation/resource cleanup. Decide SVG kerning/ligature spacing policy
  relative to current per-code-point labels. SVG implementation is parked while
  WebGL2 is considered. Headless SVG and external resvg/PDF recipes do not imply
  headless core PNG or an added runtime dependency.
- **L6 — Dawn go/no-go (round 78).** Execute the approved pre-alpha investigation
  against its existing criteria; record the result before any adoption decision.

### Alpha work still requiring concrete acceptance plans

The unfinished inventory discussed includes rounds 49–51 (platform/release),
71 (extension toolchain), 77–78 (exports/headless), 81 (annotations), 83
(bundling), 84 (tables), 99 (native Bun/Deno runners), 125 (layout quality) and
137 (WebGL2). Some have implementation already recorded; read their own records
and do not treat the entire inventory as absent code. The initial audit was an
inventory of known work, not a claim that nothing else is needed for 4.0.

- **R1 — Platform evidence (49).** Name reproducible macOS/Metal,
  Windows/D3D12 and real Android touch runs, evidence artifacts and manual
  owners. Record skips explicitly; exercise WebKit/Firefox and actual adapter
  reach rather than declaring a platform passed from Node tests.
- **R2 — WebGL2/Firefox gate (137).** Complete the backend and live parity matrix,
  fallbacks/substitutes and capability selection before adding the agreed
  combined Firefox model/rendering coverage. Define acceptance for remaining
  drawn features; full parity at alpha remains the requirement. The 12 October
  sequencing review considers starting 137.1/137.2 ahead of SVG; reconcile
  the old blanket prerequisites without making font investigations a port gate.
- **R3 — Repository-owned app scenarios.** Specify representative loading,
  virtual table, style, selection, layout and export fixtures/assertions, including
  cancellation/disposal. CyWeb informs workloads but is not an implementation
  dependency. Decide the bounded performance/fidelity acceptance criteria.
- **R4 — Release engineering/bake (50–51).** Turn workflow adaptation, artifact
  checks, provenance, alpha cut, external-consumer smoke, issue triage and final
  benchmarks into concrete owners/gates. Publishing still requires the authorized
  release action; this planning task does not publish a prerelease.
- **R5 — Extensions/runtimes (71/99).** Finish measured native-runner/install
  contracts and the toolchain/example package acceptance plan; preserve recorded
  during-alpha extension-port timing. Do not imply every optional extension must
  block the first alpha.
- **R6 — Portable style/persistence closure.** Audit all newly specified property,
  event, identity and geometry contracts against public types, schemas, JSON/wire,
  patch, clone/follow, docs and migration. Record explicit exclusions and status;
  wire stability remains experimental until its existing milestone.

### Deliberately deferred reviews

These are follow-ups rather than missing alpha decisions: possible removal of
numericStyle(), layout capability registration, data-driven gradient lists,
native annotation/node grouping, configurable minimum resize dimensions,
app-supplied label editors, post-review bundle smoothing, automatic viewport
snapping, aggregate-edge persistence/direction, hull obstacle avoidance and
public concavity control. Keep their recorded timing unless the maintainer
explicitly changes it; the membership review does not implicitly reschedule them.

### Record coverage

The contract interview records undo/workers/tables, style reads, gestures,
annotations and editing, attachments/locks/minima, label roles/sessions,
bundling, layout reports/options, CJK/fonts/platform gates and exports/headless.
The research note records the supplied scientific annotation use cases,
compound/overlap distinctions, declaration/name/data alternatives, signed/zero
literature and provisional multiset direction. This register records remaining
questions and review gates. Earlier alternatives remain as history with later
answers identified; a bare numeric response is not interpreted without its
original question.
