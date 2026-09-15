# V4 feature direction

The first categories in [the feature inventory](features.csv) express the
maintainer's priorities, in descending order: performance, simpler development
for library consumers, Cytoscape Web v2, workflows in apps such as EnrichmentMap
and GeneMANIA, and lessons from v3 worth incorporating into core. These rows
complement the member-by-member API and style comparison; they are not additional
independent features to sum into a completion percentage.

**Proposed** means an analytical extrapolation in this review, not an approved
roadmap commitment. **Planned** requires an existing scoped development record.
**Undecided** preserves ideas or unresolved decisions already in that record.
Implemented remains a prototype status. Row order expresses areas of priority,
not an implementation schedule or a promise to deliver every proposal.

## Performance is the first acceptance criterion

The September 2, 2026 published archives provide a reproducible comparison:
269 core-operation p50 pairs have a geometric-mean v3/v4 ratio of 10.70;
104 rendering pairs have a ratio of 31.21. The 57 GPU-algorithm pairs instead
compare **v4 CPU with v4 GPU**, averaging 7.73, with individual GPU regressions.
These figures were recomputed from matching baseline and `gpu` benches in
the published results under `benchmark/published/` (the inventory cites each
archive). They are historical
same-machine measurements, not current-build certification or application SLAs.
First-call and device-only timings are separate series, and the rendering mean
combines operations rather than describing a universal frame rate.

The next useful evidence is application-shaped: time to first useful frame,
p95 interaction latency during work, peak CPU/GPU memory, and long-session
behaviour. Chart and hull cost must be measured as data dimensions, memberships
and overlaps grow. Set budgets from those measurements; do not invent a target
graph size or allow an aggregate speedup to hide a critical regression.

## Simplification should remove application work

The layout portfolio audit already covers the major families needed by the
reviewed Cytoscape Web and EnrichmentMap versions. Builtin force, flow, tree and
radial views, circle/concentric, grid, preset and random plus component packing
are a substantial v4 capability. “All major use cases” is bounded by that audit;
tidy trees, specialized circular optimization and another force solver still
need demonstrated demand. A task-oriented guide is a better next proposal than
adding algorithms merely to lengthen the list.

Layout quality audit and iteration remain **Partial / WIP**, as clarified by
the maintainer. Existing quality tests and targeted improvements provide a
starting point; completing the portfolio audit does not complete this work.
Review representative application graphs for overlaps, crossings, spacing,
hierarchy readability, component packing and stability. Iterate on algorithms
and defaults using visual review and repeatable fixtures, measuring runtime
alongside quality so improvements respect the performance priority. Round 125
plans this as one sub-round per layout plus one for packing, each landed only
once a maintainer review sitting is recorded on the round file.

Measure simplification by porting real tasks: dependencies removed, custom glue
eliminated, setup and diagnostics improved, and migration effort incurred.
Declarative styles and queries can simplify a running app while still requiring
a significant v3 migration. Planned reconciliation and worker execution should
be evaluated on that same basis.

## Portable visual meaning and useful biological workflows

Round 80 scopes heat strips, radial heat and signed bars, colour scales and a
measured larger slice ceiling. Donuts already exist; a heat grid is not that
plan. A proposed desktop/web style subset should specify supported semantics and
report losses explicitly. CX2 translation remains outside core under the
recorded decision; adapter fixtures can test portability without reversing it.

Round 82's planned convex cluster hulls address part of EnrichmentMap's emulated
regions. Organic blobs are a separate unresolved GPU geometry direction, and
overlapping membership is a further proposal. Neither should be advertised as
delivered bubble-set parity. Collapse proxies also have distinct membership,
aggregation and session-persistence limits. GeneMANIA's many parallel evidence
edges need their own scale fixtures, not just a check that parallel edges draw.

Prefer shared rendering, layout, selection and aggregation primitives in core;
use examples and adapters for domain formats and application UI. Promote more
extension behaviour only when representative apps demonstrate shared value and
the performance budget holds. The inventory also preserves accessibility,
international labels and lifecycle reliability as cross-cutting gaps: the five
priorities do not make these disappear.

## Semantic zoom

Proposed semantic zoom changes the information shown as the viewer zooms:
summaries at overview scale, individual nodes and edges at intermediate scales,
and labels, charts and evidence details up close. Declarative detail thresholds
should reduce application-owned zoom handlers while keeping transition cost and
interaction latency within measured budgets.

Compound semantic zoom is an explicit sub-feature: zoom in to reveal children,
progressively through nested compounds, and zoom out to return to parent
summaries. Coordinate it with the planned collapse proxies, specifying edge
aggregation and selection preservation. Use stable reveal/hide thresholds to
avoid flicker near a boundary, and preserve positions so exploring a hierarchy
does not unexpectedly rearrange it. Existing compound support and minimum label
size do not establish this capability; both rows remain Proposed pending scope
and implementation design.

## Unmet features for alpha

The first alpha should be a best effort to settle foreseen public API and
architectural decisions. The following high-level gaps need defined contracts
and scope decisions before that release, with working implementations or
representative prototypes wherever feasibility could materially change the
design. A deliberate exclusion or deferral must explain how later work can fit
without an expected breaking redesign. Alpha may still uncover unforeseen
changes; this is a readiness gate, not a guarantee of API immutability or a
requirement to finish every feature in the inventory.

- **Performance architecture and execution model:** settle CPU/GPU/worker
  ownership, synchronization, asynchronous completion, cancellation and error
  semantics across algorithms, layouts and worker-hosted rendering. Use the
  copy census and representative application workloads to validate transfer
  costs, memory limits and graceful failure before these contracts become
  consumer dependencies.
- **Graph updates, table access and state ownership:** define progressive
  ingestion, ID-keyed reconciliation, column views and filters, including
  batching, event ordering and visibility of partial results. Settle how viewer
  cloning isolates or shares graph and view state, and whether undo requires
  transaction hooks in the core before those boundaries solidify.
- **Public API, types and data contracts:** resolve remaining compatibility and
  replacement decisions; define application-data typing and element, style and
  layout schemas. Bring declarations, reference documentation and migration
  guidance into agreement, including errors and asynchronous return values.
  Existing generated declarations alone do not settle the outstanding design.
- **Persistence and exchange boundaries:** define serialization versioning,
  ownership on load, round-trip guarantees and transient-state omissions for
  graphs, styles, positions and future collapse/view state. Preserve the
  recorded CX2 extension boundary while specifying what adapters can rely on.
- **Style portability and node charts:** settle the desktop/web portable style
  contract, chart data and colour-scale model, signed bars and heat-chart
  semantics, and slice/storage limits. Validate representative charts and
  unsupported-style diagnostics before fixing the public style schema.
- **Cluster regions and compound collapse:** define membership, convex versus
  organic-region scope, compound proxies, aggregate-edge identity and data,
  selection, events and persistence. Decide overlapping-membership scope and
  prove the chosen geometry/data model at useful scale; avoid committing an
  API that requires a new graph model to support the intended app workflows.
- **Semantic zoom, including compounds:** decide the core detail-rule contract
  and how zoom reveals nested children or returns to parent summaries. Specify
  its relationship to explicit collapse, edge aggregation, picking, selection,
  layout and export, with stable thresholds and preserved positions. Resolve
  the architecture before treating it as later visual polish.
- **Layout quality audit and iteration:** complete enough representative app
  review to settle layout choice, constraints, options, defaults, packing and
  lifecycle contracts. Exercise quality and runtime together; correct findings
  that require API or architectural changes before alpha. Further quality
  tuning can continue once those foundations are credible.
- **Dense-network rendering and interaction:** settle label priority and
  decluttering, transient emphasis, parallel evidence-edge handling and edge
  bundling contracts. Decide spatial-query/lasso scope and resolve picking and
  gesture ownership where it affects public events. Validate that these
  features compose with semantic zoom and aggregation at application scale.
- **Rendering output and compatibility:** working rendering in environments
  without WebGPU and SVG vector export are minimum requirements for the first
  alpha. WebGL is the likely fallback; settle the backend and supported
  environment matrix, automatic capability selection, shared rendering
  semantics and any explicit limits. Validate representative graph, style and
  label fixtures through both rendering paths and SVG export. These require
  working output before alpha, not only a feasibility decision; current
  WebGPU-only rendering and raster export do not meet this minimum.
- **Annotations, draw layers and export:** define annotation identity, storage,
  styling, picking and draw order, plus the rendering information shared by
  raster, SVG and headless export. Decide PDF and additional-layer scope so
  exporters or overlays do not later force a renderer or scene-model redesign.
- **Platform, text and accessibility foundations:** decide supported browser
  and headless capabilities beyond the rendering minimum above, and worker
  image/font limitations. Settle font/shaping dependencies and international-text
  scope,
  along with keyboard focus, accessible graph navigation and reduced-motion
  hooks that affect rendering and interaction architecture.
- **Core versus extension integration:** resolve which outstanding extension
  points are public and which remain excluded; only layouts currently have a
  public extension contract. Validate the chosen boundary with representative
  app adapters and lifecycle integrations, including cleanup and batching.
  Extension tooling and framework wrappers should exercise a defined contract.

These gates concern the remaining design work, not a claim that each foundation
is absent. The inventory retains its current Implemented, Partial, Planned,
Proposed and Undecided distinctions. Visual polish, further optimization,
codemods, additional examples and tooling can continue during alpha when they
do not conceal a foreseeable API or architectural change.

## Maintaining the review

Each inventory row cites its implementation, scoped plan or this proposal
rationale. Promote Proposed to Planned only with a recorded scope decision, and
to Implemented only with shipped prototype evidence. Refresh benchmark claims
from comparable archived runs; do not mix hardware, harness epochs or CPU/GPU
baselines. Revisit application assumptions when the pinned audits change.
