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

## Maintaining the review

Each inventory row cites its implementation, scoped plan or this proposal
rationale. Promote Proposed to Planned only with a recorded scope decision, and
to Implemented only with shipped prototype evidence. Refresh benchmark claims
from comparable archived runs; do not mix hardware, harness epochs or CPU/GPU
baselines. Revisit application assumptions when the pinned audits change.
