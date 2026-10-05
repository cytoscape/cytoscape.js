## Partial scale domains and legend JSON

Shared foundation for scalar visual mappers and round 80's charts, decided
in the alpha interview. Keep the existing serializable mapper DSL and its
CPU-evaluable compiled representation. This round does not add style
callbacks, biological normalization or aggregate-edge reducers.

### Settled domain contract

Numeric continuous domains may have `auto` at their first and/or last stop;
all interior stops are explicit finite numbers. Examples: `[0, 'auto']`,
`['auto', 0, 'auto']`. `Infinity` is not an auto spelling. Explicit domain
validation remains strict. Ordinal categories and threshold cuts remain
explicit; do not interpret an ordinal category named `auto` as a bound.
Quantize may reuse partial endpoint resolution for its two-stop domain.

Existing omitted/whole-`auto` scalar domains stay supported. Charts require
an explicit domain member; round 80 specifies those validation rules.
An explicit diverging midpoint is preserved while either outer bound can
be automatic. `[-1, 0, 2]` with blue/white/red reaches white at zero; core
does not equalize the positive/negative intensity. Apps can supply symmetric
bounds or adjusted endpoint colours. Retain OKLab/sRGB interpolation and
the existing clamp defaults.

Resolve auto endpoints from finite eligible source values. An empty or
degenerate extent, invalid resolved ordering, or a transform-incompatible
resolved interval is **unresolved**, using the mapping's fallback/channel
default with one warning per installed mapping per instance. Recover when
valid data arrives, without a new style application. Do not invent `[0, 1]`
or `[1, 10]` bounds for an unresolved domain: those are current behaviour
in `autoExtentFor`, and this alpha change must be documented and tested.
An explicit invalid domain throws at style validation, before mutation.
Missing/non-finite values do not become extrema; log extents use eligible
positive values, preserving the existing auto-log convention.

Bounds are live on add/remove/data/reparent changes relevant to their source
population. Coalesce refreshes at batch boundaries. A moved bound refreshes
all mappings in that group; an unchanged bound refreshes changed elements
only. Numeric explicit bounds avoid global work. Reapplying an identical
sheet must not repeatedly warn or restart extent state.

### Domain populations

Preserve the established scalar mapper population semantics unless this
plan explicitly changes them; do not accidentally change scalar extents to
chart population rules. Chart scales share bounds by the **stylesheet
definition that supplies the scale**, not object equality or data-key name.
Track origin through the `nodes`/`parents` overlay merge. Independent
definitions remain independent even if identical. Use each participating
node's base chart source, before bypasses, and only retained slots within
the chart capacity; round 80 excludes missing values.

Hidden nodes, selected/unselected nodes and miniaturized descendants remain
contributors. Viewport, decluttering and collapse do not change populations.
A palette/domain bypass does not remove its node's original source data.
Changing a bypass's chart data source must not contaminate the base group's
extent with a different quantity. There is no per-node autoscaling; an
explicit domain bypass is the exception mechanism. No explicit group-name
registry is added.

### `cy.legend()` and `legendchange`

Return a JSON-serializable detached object, not a JSON string or markup.
Proposed concrete output contract for implementation: `{ entries: [...] }`,
in deterministic sheet-definition/property order. Each entry has a stable
definition/property ID, `group`, `property`, and `kind` (`mapping` or
`chart`); records its authored source fields, scale and domain; includes
`resolvedDomain` (null when unresolved), range/scheme, interpolation,
clamping, fallback/missing appearance and resolution status where relevant.
For charts also carry kind, source, slot/palette information and the separate
bar-geometry domain. Explicit constant chart values may be included; do not
copy every node's chart payload into the legend.

Include mapped properties and charts, not every constant style property.
Conditional mappers describe their clauses and state conditions; a single
numeric legend must not be fabricated for a categorical/conditional rule.
No biological units or friendly labels are inferred from field names.

Bypasses produce **exception metadata on shared entries**, with affected
properties and distinct affected-element counts, not a legend per node.
Do not enumerate IDs or persist a huge object per overridden element. A
bypass that introduces a mapped/chart property absent from the base sheet
needs a property-level exception entry, so it is not silently omitted.

Emit `legendchange` only when the observable snapshot changes, once after
an outer batch has resolved style and extents. Put it before `batchend`,
which remains last. Outside batches, finish the associated update before
emitting. No duplicate JSON in the event: apps call `cy.legend()`. No event
for a data write whose legend snapshot remains equal. Getters during an
open batch follow the library's existing deferred-style convention; the
event guarantees the committed snapshot. No mutable internal objects escape.

No SVG legend yet. `cy.svgLegend()` versus `cy.legend({ format })` is a
future choice after SVG export. This data format must be useful headless
and in worker-hosted applications without requiring a renderer.

### 147.1 — compile, resolve and invalidate

Change `Mapper` domain types, `src/style-scales.mts` validation and programs,
CPU/GPU serialization/evaluation and the style bind/refresh machinery.
Keep authored stops separate from resolved stops. Extend the existing dirty
dependency path and preserve explicit-domain fast paths. Add group-source
provenance for charts without prematurely adding chart kinds.

### 147.2 — legend snapshots and event plumbing

Add public types/JSDoc and the core accessor. Build metadata from compiled
definitions plus resolved domains, with cached invalidation rather than a
whole-graph scan on every call. Update exception counts in bypass lifecycle
operations. Do not introduce nested mapper branches solely for the deferred
aggregate proposal. Include worker and clone behaviour: each instance's
legend describes its own sheet, data and overrides.

### 147.3 — acceptance

- Scalar width/colour, partial diverging and quantize; asymmetric anchors;
  log eligibility; add/remove the extreme; empty/constant/invalid extents;
  recovery and warning count; explicit-invalid atomic failure.
- CPU/GPU equality and JSON round trip retain `auto` in the authored sheet
  while legends expose numbers. Schema and declarations accept the same
  syntax. Three stops must remain anchored after an extremum changes.
- Legend event batch ordering, unchanged-write silence, snapshot isolation,
  bypass counts, independent definitions and headless operation.
- Controls: infer a midpoint; suppress a changed-bound refresh; exclude a
  bypassed contributor; emit per write inside a batch; leak internal arrays.
- Benchmark changed versus unchanged extrema, explicit domains, large
  batches and repeated legend reads. Report group size and rebuilt channels.
- Verify, Node, types, throws, soak and relevant Playwright gates. Document
  the empty-domain behaviour change and add examples to the maintained
  docs. Chart fixtures and chart legend acceptance finish in round 80.

### Implementation result (2026-10-05)

The scalar foundation and application legend landed in commit `95e346f5`.
Continuous and quantize domains accept `auto` at either outer endpoint;
explicit interior stops, including diverging midpoints, stay authored and
anchored. Resolved extents update on relevant data and structure changes,
refresh the whole group only when a bound moves, and recover from unresolved
populations without recompiling. CPU evaluation and packed GPU programs use
the same resolved bounds. `cy.legend()` returns detached, deterministic JSON
metadata for current mappers and existing charts, aggregates bypass
exceptions, and emits `legendchange` after the committed snapshot changes.

The chart population/domain contract and bar geometry domain remain for
round 80, which introduces the relevant scaled chart properties. This round
adds only chart metadata for the chart kinds already present.

The benchmark's one-off write controls passed at N=2,000: moved automatic
maximum 2,000 writes; unchanged automatic maximum 1; explicit-domain control
1; 25-write batch with a moved final bound 2,000 writes (one group refresh).
Repeated 100-entry reads came from the committed legend snapshot. See the
landed section for the measured timings and gate results.
