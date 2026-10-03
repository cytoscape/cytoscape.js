## Alpha design interview: charts, hulls and miniature compounds

Maintainer decisions from the 3 October interview. These are plans, not
implemented capabilities. Later answers supersede earlier alternatives in
the interview and the older round plans. Rounds 80 and 82 are rewritten to
the final decisions; new rounds 146–148 separate the remaining work.

### The next implementation sequence

1. **146: arrows.** Settle the geometry once before SVG and WebGL2 port it.
2. **147: partial scale domains and legend JSON.** Shared scalar/chart
   contracts, with the chart integration completed by 80.
3. **80: chart storage, heat and bars.** Uses 147; no chart labels or axes.
4. **82: compound hulls.** Convex first, concave second in the same plan;
   complete label-inclusive sizing on the existing property.
5. **148: miniature compounds.** Actual position scaling plus reversible
   styled-size multipliers, manual operations and optional animation.

The proposed automatic semantic-zoom round is replaced by 148's zoom,
interaction and export acceptance work. No automatic expansion thresholds
or viewport snapping are required for alpha. Viewport snapping to a compound
for a full-screen view is a future maintainer decision. Existing label/chart
LOD remains applicable; screen-space sizing is not implicitly added here.

Annotations/editing-contract design, edge bundling, SVG (77), headless
figures (78), WebGL2 (137), layout review (125), CJK design and the other
alpha gates remain separate work. This batch does not claim alpha readiness.

### Decisions superseded during the interview

- Heat charts require an explicit scale object and domain; automatic outer
  bounds are requested with `auto`, not inferred from missing configuration.
- No per-node automatic chart domains. A node can use an explicit bypass.
- Bypassed nodes still contribute their underlying data to their shared
  domain. Presentation changes do not change the comparison population.
- Collapse shrinks children, it does not hide them or generate proxy edges.
- Locked children do not reject collapse: positions obey current locks,
  sizes still shrink. There is no lock-exception movement history.
- `collapse-scale` is style configuration and updates collapsed compounds
  immediately; it is not sampled only on the next explicit operation.
- No `hull-fallback-shape` property. Empty hulls use ordinary rectangular
  fallback geometry; a collapsed miniature still has visible children.
- Concave hulls are in the alpha plan, after convex hulls. Nonmember obstacle
  avoidance and a public concavity/tightness control are future enhancements,
  both **TBD by the maintainer**.

### Deferred aggregate-edge design

The maintainer treats aggregates as display-derived objects, outside the
model proper. The following agreed direction is retained for a possible
future feature; it is **not a dependency of miniature collapse**:

- `cy.aggregateEdges()` returns derived edge handles, excluded from
  `cy.edges()` and `cy.elements()` but usable in explicit collections for
  layout and interaction. `aggregate.originalEdges()` returns flattened
  original edges, never aggregates of aggregates.
- Click targets and selection belong to the aggregate, not automatically
  to every original. Events bubble once through the normal path to `cy`.
- One aggregate per unordered visible endpoint pair, folding directions.
  The overlay describes arrow appearance; original directions remain
  inspectable. A directed algorithm must not mistake arbitrary aggregate
  orientation for the original biological directions.
- **Developer-specified aggregate direction is TBD**, for future use cases.
- Identity survives member changes while a pair remains represented. On
  disappearance the handle is terminally removed. Recreation uses the same
  deterministic ID and a new instance; no historical state cache.
- Aggregate data is app-writable while the object exists. It, selection,
  bypasses and listeners survive membership changes during that lifetime.
- `aggregates` overlays `edges`, like `parents` overlays `nodes`.
  `{ aggregate: true/false }` is useful in queries and conditional styles.
  In `edges`, a data mapper reads the target edge's own data. In
  `aggregates`, data mappers require `reduce: sum | mean | min | max |
  count | self`; originals are implicit for reductions and `self` reads
  the aggregate's own data. No redundant `source` member is needed.
- Conditional branches must accept nested mappers to support this design;
  today `CaseClause.then` is a constant. That extension belongs with this
  future work, not automatically with round 147.
- Missing aggregate-owned data uses the normal fallback/default. Warn once
  per affected mapping unless an explicit fallback acknowledges the case;
  no mandatory aggregate branch where inherited styling already works.
- Explicit hiding stays independent of collapse. For future aggregation,
  explicitly hidden edges/endpoints do not contribute visible members.

**Persistence remains open, preference B.** The decision covers save/load
and initial cloning; it was deliberately deferred, not approved as B.

| Option | Benefit | Cost |
| --- | --- | --- |
| A: persist current aggregate customizations by stable ID | Restores the display, app data, bypasses and selection without app reconstruction | Extra format and reconciliation rules; couples saves to aggregate generation; stale entries need handling |
| B: reconstruct aggregates without customizations | Keeps the original model and collapse state authoritative; no stale derived records | Apps recreate summaries and overrides; selection is lost and appearance can differ until reconstruction |

No final aggregate persistence API or implementation-ready aggregate round
is claimed. Generic data reducers were considered, then narrowed to visual
mapper reductions; no automatic `weight` data field is committed.

### Evidence used and remaining implementation investigations

The arrow gallery and chart-capacity measurements are the prepared record
`2026-09-29-12-rnd0000-note-items-72-and-73-prepared-the-head-gallery-and-the-chart-capacity-measurement.md`.
Its proposals are superseded by the decisions in 146 and 80.

Code checks during the interview: `src/style-scales.mts` supports live full
auto domains but requires a numeric diverging triple; `CaseClause.then` in
`src/public-types.mts` is constant-only; `compound-sizing-wrt-labels` already
exists but rejects `include`; layouts do not filter hidden nodes, although
hidden layout dimensions collapse to a minimal footprint, and position
ordinary leaves rather than parents; `src/core/clone.mts` constructs an
independent serialized copy and optionally follows element updates.

The chart discussion distinguished shared biological magnitudes from local
pattern normalization. Desktop documents network-wide/manual chart ranges
in its [chart API](https://cytoscape.org/javadoc/3.10.0/org/cytoscape/view/presentation/customgraphics/CyCustomGraphics2Factory.html);
[EnrichmentMap](https://enrichmentmap.readthedocs.io/en/latest/Network.html)
uses chart segments and legends to compare datasets. App-owned biological
normalization and palette balancing are intentional boundaries.

Geometry tolerances, concave-kernel constants, memory and latency are
implementation measurements with specified controls in the plans. They do
not permit changing the public scope or introducing GPU-only geometry.
