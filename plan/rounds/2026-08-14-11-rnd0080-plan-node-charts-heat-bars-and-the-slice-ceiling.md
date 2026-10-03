## Node charts: explicit scales, heat, bars and 255 values

Revised by the 3 October alpha interview. This replaces the old cap-64,
implicit heat-scale and packed-count proposals. Depends on round 147's
partial domains and legend contract. The shipped charts still have their
old capabilities until this round lands.

### Settled public surface

Keep pie, stripes and donut (pie plus `chart-hole`). Add `heat-strip`,
`radial-heat` and signed `bar`. Line and scatter are deferred beyond 4.0;
the storage must accommodate future point-series passes without redesign.

All included kinds accept at most **255 values**. Warn once and truncate
beyond the limit, preserving the first 255 slots and their corresponding
colours. Missing slots count toward the limit; dropping them must not shift
dataset identities. Existing pie/stripe fraction semantics stay unchanged;
this round is not an implicit normalization of arbitrary pie weights.

`chart-scale` is one serializable object using the existing scale compiler.
For heat kinds it is required, with an explicit `domain` and `range` (colour
stops or named scheme). Linear remains the default scale type. Outer stops
may explicitly be `auto`; interior anchors remain numeric. No per-node
automatic domain, no inference of biological meaning or symmetric colour
intensity. Missing scale configuration fails stylesheet validation.
`chart-colors` with a heat kind is an error; colour comes from its scale.

Heat bands/sectors have equal size; signed values affect colour, not region
width. `chart-direction` applies to linear heat. Keep the original values
available for readback; colours are resolved at style-write time. Node
bypasses can supply explicit alternative scales without excluding the
node's base data from the shared population.

Bar geometry uses required `chart-domain: [min, max]`, allowing either
endpoint to be `auto` through the shared resolver. Vertical is default;
`chart-direction: horizontal` flips the axis. The baseline is zero clamped
to the domain, so a wholly positive/negative domain uses its near boundary.
Heights are clipped to the geometry domain. Colour is independent:
`chart-colors` or the existing categorical default, alternatively an
explicit `chart-scale`. Supplying both colour mechanisms is an error;
the default palette does not count as an explicitly supplied declaration.
A bar's geometry domain need not equal its colour domain.

For heat and bars, null/missing array entries and non-finite numbers retain
slots, are excluded from auto extents, and are not zero. Heat uses
`chart-missing-color` (transparent by default); bars leave gaps. Zero is a
real observation. An entirely unresolved colour scale uses the specified
fallback/missing appearance and the round-147 warning contract. An
unresolved bar geometry domain draws no bars until valid bounds arrive.
Do not fabricate heights from an invented range. Invalid non-numeric
configuration is still validated rather than string-coerced into numbers.

Chart labels, per-node axes and legends are **application-owned**, with no
commitment to add them inside charts later. `cy.legend()` provides the
resolved mapping and missing-value information. No SVG legend renderer in
this round; application decorations are not silently included in export.

### 80.1 — records and addressing

Use an address-only u32 reference (`offset + 1`, zero meaning absent); read
the count from the header. The public cap is policy, not a count-field
limit. Use **8 bytes per value**: one f32 value and one bit-preserved rgba8
word, instead of the old three-float encoding. Write colour through a u32
view; never allow JS float NaN canonicalization to corrupt colour bits.
Document the header and offsets in the shared contract before writers and
readers change. Store bar-domain metadata and missing-slot validity without
silently converting a missing value into a zero observation.

Pie/stripes store cumulative stops and binary-search them instead of a
linear per-fragment walk. Preserve fraction clamping and existing readback
precision; retain a reference implementation and compare both pixels and
readbacks. Heat/bar index directly into equal regions. Keep deterministic
boundary ownership and antialiasing at stops.

Round 145's allocation/overflow protection remains: removing the 24-bit
packing ceiling does not remove device limits. Derive a checked record
reach from actual buffer/texture limits. For WebGL2, specify an integer
blob texture and bit-cast float values on read; do not forward 137's old
R32F assumption for these mixed records. Changing image references or the
custom-polygon guard is separate work unless required by a shared helper.

### 80.2 — compiler, data writes and legend integration

Touch `src/style/parse.mts`, `defaults.mts`, `engine-write.mts`, readers,
refresh dependencies, `src/contract.mts`, store chart records and
`src/render/shaders/chart.mts`/`chart-pipeline.mts`. Re-check paths after
refactors; old August source line numbers are not authority.

Use round 147's definition-owned extent resolver for chart lists; changed
values that do not move the extent update only the changed records. Changed
bounds rebuild the participating colour/geometry records once per batch.
Selection, viewport, miniaturization and explicit hiding do not rescale the
chart domain. Keep group provenance through parent overrides and bypasses.
Integrate chart entries into `cy.legend()` and `legendchange`, including
separate bar geometry and colour domains and exception counts.

### 80.3 — pixels, storage and application fixtures

- Desktop-sized 26-slice pie, 255-value pie, 256-value warning/truncation,
  donut and stripes; keep existing <=16-value scenes unchanged.
- Heat and signed bars with aligned dataset slots, holes, all-missing,
  zero, negative-only and mixed-sign values. Explicit [-1, 0, 2] colour
  anchors; partial domains and recovery from an invalid automatic interval.
- Border/shape clipping, both directions, palette cycle, transparency and
  magnified boundaries. Re-style and mutate chart data through both normal
  and mapped-refresh paths; readbacks remain the authored values.
- An EnrichmentMap fixture showing consistent colours across nodes, an
  explicit node override, a live extreme change and an application legend.
  Demonstrate no per-node labels are required.
- Controls: restore cap 16, restore the linear walk for timing comparisons,
  drop missing slots, use per-node bounds, shift binary-search boundaries,
  and round-trip colour through a NaN float. Relevant tests must fail.

Benchmark 25k charted nodes at 16/64/255 values, the 1k close-up case, record
writes/compaction, first frame, changed-extreme updates and memory. Count
actual records/values/drawn regions in each row. Compare against the same
machine's pre-round build; the 29 September prototype is evidence, not a
current performance guarantee. Include the zero-chart control.

### 80.4 — portable contract and close

Write a desktop/web chart-subset table: supported kinds, ordered dataset
slots, signed values, explicit/partial scales and bounds, cap/truncation,
missing values, palettes, geometry domains, and omitted chart labels/axes.
Adapters own CX2/desktop translation and must report unsupported semantics
rather than imply complete desktop fidelity. Do not add an import adapter
to core. Feed shared CPU records/geometry into round 77's SVG work and
round 137's port; neither gets its own independent colour-domain inference.

Open the debug fixture. Run verify, Node, types, throws, soak, schema/module
and Playwright gates with the controls. Update JSDoc, schemas, migration,
feature inventory, scope doc, item 73 and the executive summary at landing.
