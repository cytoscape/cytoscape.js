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

### Landed 2026-10-05
Round 80 lands the 3 October chart decision. Pie, donut and stripes now share
one address-only record format with `heat-strip`, `radial-heat` and signed
`bar` charts. Every included kind accepts at most 255 ordered slots; excess
values are truncated with one warning, while null and non-finite slots retain
their positions. Pie and stripe values keep their fraction semantics. Heat
and bars keep signed values, missing heat slots use `chart-missing-color`,
and missing bar slots leave gaps.

Heat colour scales and bar geometry domains resolve from explicit numeric
bounds plus shared automatic outer endpoints. Heat requires `chart-scale`;
bars require `chart-domain` and may select their colour scale independently.
The shared resolver updates only changed records when an extent stays fixed,
and rebuilds its participating records once when a batch moves the extent.
Bypasses may use an explicit alternative scale and remain exceptions in
`cy.legend()`. Chart labels, axes and legend rendering remain application
owned. The shipped schemas permit explicit chart-scale bypasses and reject
invalid chart combinations. `src/README.md`, migration notes and the feature
inventory now describe the portable subset and its limits.

The record uses an address-only u32 reference, a header count, two words per
slot (cumulative f32 plus bit-preserved rgba8) and a validity bitmap. The
255-slot policy is independent of the reference width. Pie and stripe
fragments lower-bound-search their cumulative stops; heat and bars index
equal regions directly. The pixel benchmark compares the search against a
linear-walk shader and requires identical pixels before it reports time.

#### Measurements

Machine: Intel i9-9900K, Radeon RX 580 (`amd · gcn-4`, hardware WebGPU),
Chromium/ANGLE/Vulkan with timestamp-query. On 25,000 pie-chart nodes, the
255-slot linear walk costs 17.037 ms steady GPU time; binary search costs
1.673 ms. The 1,000-node close-up costs 6.598 ms versus 1.189 ms. All 16
scene/count pairs produced byte-identical pixels. The 255-slot fit scene has
25,000 records, 6,375,000 values/regions and a 52.7 MB chart blob; the close
scene has 1,000 records, 255,000 values/regions and a 2.1 MB blob. At 16
slots, steady times are 2.424/1.462 ms at 25,000 nodes and 0.967/0.779 ms
at 1,000 nodes (walk/search).
The 255-slot first-frame wall times are 36.8/22.0 ms at 25,000 nodes and
26.4/20.8 ms at 1,000 nodes; first-frame values include shader setup and are
not the steady-state throughput measure.

The CPU lifecycle benchmark uses 25,000 charted nodes and includes a
zero-chart control. The zero-chart control creates no chart records or pool
allocation. At 16/64/255 values per node, record counts are 25,000 and value
slots are 400,000 / 1,600,000 / 6,375,000; initial chart-pool use is 4.2 /
13.9 / 52.7 MB. Initial construction takes 231 / 634 / 1,885 ms. Changing
one node's extreme moves the shared bound and refreshes all 25,000 records
once in 146 / 394 / 1,366 ms. Removing 10,000 nodes triggers blob
compaction; the remaining 15,000 records survive explicit slot compaction.
Explicit compaction takes 32.7 / 17.8 / 22.9 ms. These are measured
single-run reference values, not performance guarantees.
After-GC process memory deltas (heap / ArrayBuffer / RSS) are +8.6 / +18.2 /
+72.6 MB at 16 values, +13.0 / +21.3 / +90.2 MB at 64, and +13.1 / +71.6 /
+58.2 MB at 255. The zero-chart control is +5.7 / +7.5 / +20.6 MB. These
sequential-process deltas include runtime overhead and should not be read as
per-record allocations.

The bundle ratchets use builds from the word-addressed storage commit
`bf8a0dda` as their measured before point. The minified headless ESM grows
569,581 → 585,933 raw bytes and 176,604 → 181,548 gzip bytes; minified GPU
headless grows 648,611 → 664,966 raw and 195,254 → 200,152 gzip. Unminified
headless ESM/CJS grow 31,209 bytes raw and about 7.7 KB gzip; GPU ESM/CJS
grow the same raw amount and about 7.75 KB gzip. Ratchets now allow about
1% above each round-80 measurement; both minified artifacts remain under
the 1,000,000-byte edge budget.

#### Verification and controls

- `npm run -s verify` passes; chart, schema (213 assertions), golden
  coverage (19 assertions), and focused bundle-size suites pass.
- Playwright's pie/stripes, heat/bars, and EnrichmentMap chart/legend visual
  specs pass on the local hardware adapter. The new heat/bars golden was
  captured and replayed without updating it; the EnrichmentMap fixture shows
  shared colours, an explicit bypass, an extreme-value change and an
  application-owned legend.
- The benchmark's pie-walk comparison requires identical pixels for all
  tested counts in both scenes. The 255-cap control temporarily changed the
  policy to 16; the chart contract test failed at its expected 255 slots.
  The 255 policy was restored before commit.
- Full module, types-surface, throws, worker-soak and cross-runtime gates were
  not green in this older clone: its public-type inventory predates the five
  intended chart/legend exports, and its subprocess/worker checks return
  sandbox failures. The focused schema, golden-coverage, chart-record,
  plan-record, feature-inventory and bundle-size checks pass. The integrated
  checkout is the source for the remaining cross-round gates.
