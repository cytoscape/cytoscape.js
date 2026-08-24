## Round 80 plan — node charts: heat, bars, and the slice ceiling (planned 2026-08-14)

Round 23's third-sitting call — "definitely yes, and consider
other charts in future" — comes due.  The consumers are named:
EnrichmentMap's core visuals are per-node charts (its default
multi-dataset chart is a *radial heat map* — equal sectors
colored by NES through a diverging scale — plus linear heat
strips and data-set pies; `debug/styles.js:76` already notes RdBu
as its regulation palette); Cytoscape Web caps pies at 16 slices
and misrenders desktop's 26-slice pies (their issue #589);
desktop's enhancedGraphics draws pie/ring/bar/heat-strip/line.
What the code does today, verified:

1. The chart family is 8 props (`src/style.mts:797-804`), with
   `chart-values` taking the `{ data }` per-element passthrough
   and `chart-colors` constants-only (list or named scheme).
   Readback decodes the **record**, not the computed
   (`style.mts:5227-5252` read through `chartAt`), which
   constrains the design below.
2. **The slice ceiling is policy, not packing.**
   `CHART_MAX_SLICES = 16` (`src/contract.mts:277`) is enforced
   in exactly one truncation loop (`style.mts:9365`); the packed
   ref is `offset | n << 24` (`graph-store.mts:853`) — 24-bit
   offset, 8-bit count, so the packing carries **255** slices and
   16-slice v3 parity was the only reason for 16.  The FS walks
   the stops O(n) per fragment (`shaders.mts:4900`).  Raising the
   cap is a constant plus specs, not a contract change.
3. **Donuts already exist** — `chart: pie` + `chart-hole`
   (round 23 call 1).  "Ring/donut" is not a new kind.
4. The value loop is pie/stripes-shaped: negatives skip as
   sidecar junk and the running total clamps at 1
   (`style.mts:9360-9382`).  NES values are signed — heat and bar
   kinds cannot reuse it unchanged.
5. Colors resolve at style-write (round 23 call 2), and the
   mapper DSL already compiles diverging scales and named schemes
   (`src/style-scales.mts:214,444-455`) — the value→color half of
   a heat chart exists, uncabled.
6. The chart pass binds one uniform + 8 storage buffers, seven
   FS-visible (`chart-pipeline.mts:70-88`); new kinds need **no
   new bindings** — everything rides the record blob.
7. Bench: `benchmark/store.mjs:249` prices chart record writes;
   no renderer scene draws a chart.

Kinds decided at planning, each with its named consumer:
**heat-strip** (EnrichmentMap's linear heat strip;
enhancedGraphics heatstripchart), **radial-heat** (EnrichmentMap's
default chart), **bar** (enhancedGraphics barchart; an up/down NES
strip is a signed bar chart).  **Declined:** ring/donut (exists —
recorded), line charts (no consumer among the named apps'
shipped defaults — logged, not foreclosed).  The design's spine:
**heat kinds are record-build variants, not shader work** — the
record keeps the author's values (readback stays exact through
`chartAt`) with colors resolved per value through a new
`chart-scale` at style-write; the FS treats the new kind ids as
aliases of the pie/stripes geometry, indexing region
`floor(t·n)` directly — O(1) per fragment, cheaper than the pie
walk.  Only bar adds a real FS branch.

### 80.1 — `chart-scale` + the heat kinds

`chart` grows `heat-strip | radial-heat` (kind ids
`CHART_HEAT_STRIP`/`CHART_RADIAL_HEAT` in `contract.mts`, stored
in the record so readback answers the author's kind).
`chart-scale` — a constants-only serializable object
`{ scale, domain, range }` compiled by the mapper DSL's scale
compiler (diverging keeps its explicit `[min, mid, max]` throw) —
maps each chart value to a color at style-write; heat kinds
**throw when it is absent** (fail-loudly; a heat chart without a
scale has no meaning) and `chart-direction` applies to
heat-strip.  `writeChart` branches by kind: the heat path takes
signed values verbatim (no fraction clamp, no negative skip) and
writes scale-resolved colors; `chart-colors` on a heat kind is a
sheet error.  The FS adds two alias compares
(heat-strip → the stripes branch with equal bands, radial-heat →
the pie branch with equal sectors, both indexing by region rather
than walking stops).  Tests-first Node specs in `test/charts.mjs`:
parse/throws/readback, signed values, scale resolution, refresh
on data writes of the values key — and the round-23.2 trap
re-checked: the new scalar props join the mapper-capable set, and
the chart-refresh fast path still re-routes through the full
mapped write when defs carry mappers.

### 80.2 — the bar kind

`CHART_BAR`: n equal columns across the `chart-size`d sub-box
(vertical bars default; `chart-direction: horizontal` flips the
axis), heights normalized by **`chart-domain`** (`[min, max]`
pair, constants-only, default `[0, 1]`; a signed domain places
the baseline at 0's position).  The header grows
`CHART_HEADER` 7 → 9 (`domainMin`, `domainMax` — a blob-record
format change, invisible to the mirror, which copies the blob
wholesale; the contract comment is updated first, per the
contract-first rule).  Colors: `chart-scale` when set, else the
palette cycle (v3-free design, recorded).  FS branch: column
index, coverage against the signed height with px-space AA at
column boundaries and the bar top — every derivative hoisted
above the branch (the uniformity rule this shader already
follows).  Golden: signed bars about a mid baseline on a bordered
ellipse (the clip path is what the scene must expose).

### 80.3 — the slice ceiling, measured then raised

**Measure-first gate:** the FS stop walk is O(n) per fragment —
before choosing the cap, price it with a render-bench pair scene
(25k charted nodes, 16 vs 64 slices; the only difference is the
loop count, so the pair discriminates by construction; batched
with 76.1's scene edit).  Then raise `CHART_MAX_SLICES`
(proposal: **64** — covers desktop's 26-slice pies with headroom;
255 is the packing bound) and decide the overflow policy: today
longer lists truncate silently (the recorded cap), and Web's #589
is precisely a silent-misrender complaint — proposal: warn-once
+ truncate (a throw on a 65-entry *data-driven* array would take
down a frame on one element's sidecar).  Golden
`charts-many-slices`: a 26-slice pie (the #589 case) beside a
cap-bound case; control: the cap dropped back to 16 must fail it.
`benchmark/store.mjs`'s chart sweep gains rows per kind × slice
count, each asserting the kind and n it claims to price (the
row-asserts-its-property rule).

### 80.4 — verification + close

Goldens per kind with feature-off controls, plus one *magnified*
chart golden (slice-boundary AA is a boundary effect — the
close-up lesson applies to goldens too).  Parity: the existing
pie/stripes scenes re-run untouched; the new kinds have **no v3
counterpart** (v3's numbered props stop at pie/stripes-16), so
goldens + the magnified scene stand in — the record says so
explicitly.  `debug/styles.js` gains an EnrichmentMap radial-heat
+ NES-bar sheet on the em-web fixture and the page gets opened
(something has to).  Standing close: JSDoc/`@throws`/`@param`
gates at 100%, `test:throws` at zero (the new heat/domain
throws each get their deterministic spec), d.ts regenerated,
`src/README.md` chart section rewritten, MIGRATING/CHANGELOG
rows, `EXECUTIVE_SUMMARY.md` rewritten from this file.

### Risks named at planning

- WGSL uniformity in the bar branch — derivatives before
  non-uniform flow; the device-error guard catches it, but catch
  it in review first.
- The `writeChart` kind branch sits beside round 23.2's
  chart-refresh trap; its two shipped fixes are the regression
  surface — spec both paths per new kind.
- Goldens are exact: the cap raise must not move
  `charts-pie-stripes` (nothing in it exceeds 16 slices — assert
  by re-running, not by assumption).
- A 64-slice record is 9 + 192 floats; blob compaction pressure
  is priced by the store sweep, not guessed.
- The stranded-doc-block hazard (seventeen instances by round 36)
  — run the JSDoc gate per commit; `contract.mts` comment edits
  are its favorite terrain.

**Open:** the cap value (64 proposed; 32 if the pair scene says
the walk costs; 255 is the bound); overflow warn-once vs throw;
the `chart-scale` shape (one object vs three flat props); whether
heat kinds throwing on a missing scale is right, or a default
scheme + domain-from-extent is wanted (the fail-loudly reading
says throw); and the declined line kind staying declined.
