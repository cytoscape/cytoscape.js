## Headless Node image generation

The cytosnap replacement (#2561, #954): cytosnap spawns a whole
Chrome to screenshot v3; the ask is figures out of plain Node.
Round 77 makes the cheap route real — SVG is a string, and the
serializer was built DOM-free on purpose.  What the code does
today, verified:

1. **The entire Node test tier runs headless instances** — no
   container, no DOM, no adapter; a headless instance is ready
   immediately (`core.mts:338`) with `headlessWidth`/
   `headlessHeight` standing in for the container
   (`core.mts:284-285`, `public-types.mts:666-668`).  Routing,
   style, layouts (the CPU force included) and every accessor the
   round-77 serializer reads are exercised headless by `test:js`
   today.
2. **`png()`/`jpg()` are structurally browser-bound twice over**:
   the readback needs a renderer (throws headless,
   `core.mts:2087-2091`) and the encode needs a DOM canvas
   (`core.mts:2094-2102`).  The renderer needs `navigator.gpu`
   (`gpu-context.mts:43`) and a container element.
3. **Label measurement is the one degraded surface.**  The glyph
   atlas rasters through canvas 2D (`glyph-atlas.mts` header) and
   cannot exist in Node; headless label dims come from
   `estimateBlock` with flat per-character advances
   (`graph-store.mts:4029`), a recorded approximation
   (`label-wrap.mts:9-11`).  So a Node `svg()` gets correct
   geometry, correct single-line label *placement*, and
   approximate wrapped-line *breaks* — the breaks are pinned into
   the output (77.3), so they are deterministic, just not
   identical to a browser's.
4. **Nothing else breaks.**  Background images never decode in
   Node (the registry's decode path is browser-only) — the SVG
   href-passthrough form still serializes; gradients, dashes,
   charts, arrows, compounds are all CPU records.

### 78.1 — `svg()` headless, made contractual

Scope: whatever 77 left renderer-coupled is severed (the export
view helper reads headless dims; no `document` anywhere on the
path — a Node spec imports the serializer and proves it); the
label-estimate deviation is promoted from accident to documented
contract, with a spec pinning that a wrapped label's Node output
carries the estimator's breaks exactly.  Files:
`src/svg-export.mts`, `test/svg-export-headless.mjs`.
**Verification:** a cross-environment structural spec — the same
fixture serialized in Node (`test/`) and in the browser
(Playwright, reusing 77's page) must agree byte-for-byte outside
the label blocks, and the label blocks must differ only in line
breaking (control: perturb the Node serializer's viewport math and
watch the structural half fail).  **Measure-first gate:** measure
the Node-vs-browser wrapped-label divergence on the label-heavy
debug fixtures first; if flat advances break lines grossly (not
just slightly), 78.2's metrics option is justified — if the
divergence is a few px of ragged edge, ship the estimate and
record the measurement instead of building machinery.

### 78.2 — optional real metrics in Node (gated on 78.1's measure)

Only if the gate fires: `svg({ advanceOf })` — an injected
per-character advance function, the exact shape `breakLines`
already takes (`label-wrap.mts:82`), so the library adds an
option, not a dependency.  The docs show wiring it to `fontkit` or
a measured-once advance table; the library itself takes no font
dependency and no new tool.  A spec injects a fake metric and
asserts the breaks move (its control: the same spec with the
option ignored must fail).

### 78.3 — PNG in Node: the resvg question, structured for the maintainer

The route: rasterize 77's SVG with `@resvg/resvg-js` (Rust, no
Chrome, font files loadable).  Deliberately **not** a dependency
of cytoscape in any form this round proposes by default — the
deliverable is (a) a documented recipe (MIGRATING/README: headless
instance → layout → `svg()` → resvg → PNG file, fonts supplied by
the caller), and (b) a decision memo for the maintainer with the
options priced: recipe-only / `optionalDependencies` /
a small companion package (the cyext-round precedent of a nested
package keeping the root install clean — ci-node must stay
dependency-free either way, per the standing invariant).  If the
maintainer adopts a dependency form, a `test/modules/` spec
rasterizes one scene and structurally checks dimensions — kept
out of `ci-node`'s required path only if install cost demands it,
and then *loudly* (the parity-suite rule: fail with instructions,
never soft-skip).

### 78.4 — Dawn/WebGPU-in-Node: an investigation pass, go/no-go

True PNG parity (the real renderer, no browser) means WebGPU
bindings in Node — Dawn builds (`webgpu`/`node-webgpu` packages)
or Deno's WGPU.  This is explicitly an *investigation with a
written record*, the WebGL-scoping-round shape, not assumed work:
stand up the renderer against a Node WebGPU device in a scratch
tree and answer: does device/pipeline creation succeed on our
shader set; does the readback path work; what replaces the
container/canvas surface (the renderer draws to a texture for
export anyway — the export path may need *no* surface, which is
the interesting finding to chase); what are the platform-prebuild
and maintenance costs.  Go criteria written before the
investigation starts: all pipelines compile, export readback
bit-stable vs browser SwiftShader within the visual project's
experience, prebuilds for the three CI platforms.  No-go leaves
the SVG route as the answer and the record as the reason —
"blocked, no adapter here" has been wrongly concluded twice in
this repo, so the record must show the actual probe output.

### 78.5 — close

Docs: a "headless figures" page section in `src/README.md` +
MIGRATING (the cytosnap audience), CHANGELOG row,
`EXECUTIVE_SUMMARY.md` rewrite, gates green.  The cytosnap
repository itself gets an issue comment/pointer only on the
maintainer's say-so.

### Risks named at planning

The flat-advance estimate is the load-bearing risk: if real-world
labels break badly in Node, the "cheap route" ships figures
people won't publish — which is why 78.1 measures before 78.2
builds, on the repo's own fixtures rather than toys.  The resvg
question is a dependency-policy question wearing a feature's
clothes; structuring it as a memo keeps this round from making a
packaging decision that is round 50's to own.  The Dawn
investigation can eat unbounded time; the pre-written go/no-go
criteria and the scratch-tree constraint (no `src/` changes from
an investigation) bound it.

**Open:** the resvg adoption form (recipe / optionalDependency /
companion package); whether `cy.png()` should ever *exist*
headless (only meaningful if 78.4 goes — otherwise the honest
answer is "no, use svg()", documented); the Dawn go/no-go
criteria sign-off before 78.4 runs; whether the metrics option
(78.2) is wanted even if the measurement says the estimate
suffices.
