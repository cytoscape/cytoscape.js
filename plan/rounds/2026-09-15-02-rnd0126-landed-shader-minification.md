## Shader minification

**Status: landed 2026-09-29; round 126.** Originally drafted as provisional round
999 on `feature/shader-minification`. Renumbered to 126 when integrated
into `v4`, after round 125; the filename, subsection numbers and generated
index now use the assigned number.

### Problem and direction

Round 52's `scripts/wgsl-minify.mjs` already removes comments and
whitespace from `wgsl`-tagged templates. Interpolations remain opaque,
so the transform cannot safely rename identifiers across fragments or
eliminate unused declarations from a complete shader module.

Assemble complete WGSL modules at build time, then pass them through a
WGSL-aware minifier before embedding the resulting strings in the JS
bundles. Keep source generators readable and preserve one source of truth
for constants shared with CPU code. The minifier is a build dependency;
consumers should not load or run it.

### 126.1 — inventory and baseline

- Enumerate all shader producers and consumers, including rendering,
  picking, culling, mappers, tweens, force layout and GPU algorithms.
- Classify each interpolation: fixed numeric value, structural constant
  such as an array size, shared fragment, generated function/identifier,
  or value that actually depends on runtime configuration.
- Record current shader bytes and final bundle bytes, both raw and
  gzip/Brotli-compressed, plus build time. Use the same bundle and
  compression settings throughout the comparison.
- Identify host-visible entry-point and override names, binding indices,
  buffer layouts and any shader reflection dependencies that must survive
  minification.

### 126.2 — assemble shaders and evaluate minifiers

Evaluate these candidates against the real shader corpus; their published
capabilities are leads to verify, not evidence of compatibility here:

- [miniray](https://github.com/HugoDaniel/miniray): first candidate for
  npm/WASM build integration, identifier shortening and dead-code
  elimination; its documented defaults preserve entry points and override
  names.
- [wgsl-minifier](https://docs.rs/wgsl-minifier): Naga-based alternative
  with simple dead-code elimination, identifier shortening and text
  minification.
- [Nagami](https://github.com/ekarad1um/Nagami): compare its compiler
  optimizations, including folding and inlining, if worthwhile. Leave
  lossy float-precision reduction disabled.

Run existing generators during the build wherever their inputs are known.
Templates need not be removed from authored source if they resolve before
minification. Do not minify interdependent fragments independently with
inconsistent name mappings.

For genuinely runtime-dependent values, use uniform buffers for values
that change between draws and consider WGSL `override` constants for
pipeline-specific scalar configuration. Uniforms cannot replace generated
code or compile-time array sizes; overrides also have context restrictions
and are not a universal substitute for WGSL `const`. Preserve existing
specialization where it matters, and measure any resulting runtime cost.

Choose the tool and integration on correctness, compressed bundle savings,
build cost, maintenance and licensing. Pin the chosen version. Record
unsupported syntax and failures explicitly. Compare full-module expansion
against the existing shared-fragment representation: duplicated shader
text can offset minification gains. If no candidate improves the final
bundle reliably, retain the current transform and record the evidence.

### 126.3 — integrate and verify

- Integrate with the existing rolldown build, generating outputs through
  project scripts. Apply the chosen transform in development builds too,
  so browser tests exercise the shipped shaders.
- Preserve host-visible names or generate consistent host name mappings;
  preserve binding indices and buffer layouts. Fail the build on shader
  transformation errors rather than silently shipping a partial result.
- Add focused regression coverage for cross-fragment references, generated
  identifiers, entry points and override configuration. Run the controls
  required by `docs/agents/testing.md`.
- Run `npm run -s verify`, `npm run build`, `npm run build:types`,
  `npm run -s test:modules:quiet`, `npm run -s test:runtimes:node:quiet`
  and `npm run -s test:node:quiet`. Exercise affected compute paths and
  run `npm run -s test:playwright:quiet` for shader compilation, rendering
  and pixel parity. Open the debug harness with `npm run watch`.
- Report measured raw and compressed bundle deltas and build time;
  investigate shader compilation or runtime performance regressions.
- Update the renderer/build notes and maintained scope documentation when
  implementation lands. Close the round with the measured record and the
  required executive-summary rewrite.

### 126.4 — future WebGL renderer fallback: glslx

Use [glslx](https://github.com/evanw/glslx) for build-time GLSL minification
in the future WebGL renderer fallback. Carry this requirement into the
fallback work scoped by round 73 (the WebGL2 fallback, scoped).
Validate glslx against the fallback's actual GLSL ES version and shader
features before integration, and preserve or map host-visible shader names.
Apply equivalent compressed-size measurements and browser/pixel-parity
gates. This round records that tooling direction; implementing the WebGL
fallback remains separate work.

### 126.5 — carried in: the constants' bundle price (item 63)

The eleventh design sitting (2026-09-28) folded PLAN.md item 63 into
this round.  Round 127's constants cost +8.8 KB minified / +2.7 KB
gzipped because the minifier keeps `.BACKGROUND_COLOR`-style member
names.  If this round's build-time inlining finds a real transform
(oxc/rolldown, not a regex) that can also inline `as const` members,
apply it to `COL`, `PROP` and the reserved keys and measure the bundle
before and after; otherwise the 2.7 KB is accepted and item 63 closes
on that.

### The round, as carried out

**Landed 2026-09-29** in three commits — `2cee1dff` (126.5, the
constant tables), `2c16ee7b` (126.3, the shader literals), `43ffb0d2`
(the size gate) — and this record.  Machine: i9-9900K (16 threads),
RX 580, Fedora 43, Node 24.18.0, rolldown 1.1.5; sizes are raw / gzip
level 9 / Brotli 11, the status site's gzip measure.

**The call, by the plan's own rule: the WGSL-aware minifiers do not
improve the final bundle here, so the round-52 representation stays**,
and the round shipped the parts that do pay: the constant tables
inlined at build time (item 63, closed), numeric shader constants
spliced into the text, float literals shortened, and a `glsl` tag for
round 137.

#### 126.1 — inventory and baseline

- **Producers.**  110 `wgsl`-tagged literals in 32 files: the renderer
  (`render/shaders/*`, `cull`, `mapper-shaders`, `gpu-tween`,
  `image-arrays`, `upscale`, `emphasis-veil`, `export-pack`), the force
  integrator (`gpu/gpu-force`) and fifteen GPU algorithm kernels.  As
  written 276,756 bytes; after round 52's transform 156,557 — render
  111,968, algorithms 34,201, force 10,388.  Only 23 of them are
  *complete* modules exported as constants (the node, edge, arrow,
  label, image and chart shaders, the two mapper eval shaders, and the
  dense/SpMV/triangle kernels); the rest are fragments or are built
  inside functions and class fields at run time.
- **Interpolations** (136 distinct expressions): fixed numeric
  constants (`WG`, `BS`, `TILE`, `SHAPE_SHIFT`, the stroke and arrow
  enums — 324 sites in the full build); structural expressions (`WG /
  2`, `BS * BS`, `MAX_CURVE_PTS + 2`); shared fragments (`COMMON` ×17,
  `PRELUDE` ×15, `SCAFFOLD`, `SDF`, `DASH_WGSL`, `CURVE_WGSL`,
  `ROUTE_WGSL`, `GLYPH_STRUCT`, …); generated functions and
  identifiers (`POLY.fns`, `ARROW_POLY.cases`, `poly${id}SD`,
  `fmtF32(…)`); and genuinely runtime-dependent values — the mapper
  programs (`n`, `id`, `lits`, `w.column`, `inputsKey`), the tween
  easings, the two label variants (`edge ? … : …`), the image tiers,
  the force levels (`lv`, `this.capacity`) and the algorithms' sizes.
  WGSL text also lives in **untagged** strings (`sdf.mts`'s generated
  `case` lines reference `crossBarSD` and `in.widthModel`) — which is
  what makes fragment-level renaming unsafe without evaluation.
- **Host-visible names**: 40 entry points (`vs*`/`fs*`/`cs*`/`main`),
  one override (`LABEL_PHASE`, set by `label-pipeline.mts`), explicit
  binding indices everywhere, `layout: 'auto'` in `algo-gpu.mts`,
  `image-arrays.mts` and `gpu-force.mts` (auto layouts already omit
  unused bindings, so dead-binding removal would have been safe); no
  name-based reflection.
- **Baseline** (HEAD `7eb6a5b1`), all eleven outputs in 1.88 s:

| Artifact | Raw | Gzip | Brotli |
| --- | --: | --: | --: |
| `cytoscape.esm.min.mjs` | 969,796 | 277,565 | 226,753 |
| `cytoscape.min.js` | 969,722 | 277,574 | 226,741 |
| `cytoscape.esm.mjs` | 2,397,523 | 639,384 | 480,749 |
| `cytoscape.umd.js` | 2,460,759 | 642,577 | 482,408 |
| `cytoscape-headless.esm.min.mjs` | 570,845 | 177,594 | 147,816 |
| `cytoscape-headless.esm.mjs` | 1,670,830 | 452,900 | 341,813 |
| `cytoscape-headless-gpu.esm.min.mjs` | 650,114 | 196,295 | 163,314 |
| `cytoscape-headless-gpu.esm.mjs` | 1,824,074 | 489,564 | 370,219 |

  (The CJS twins are within 70 bytes of their ESM.)  The slim builds
  had grown 8–9% since round 131's landing, and the ratchet's gzip rows
  stood 0.2–1.4% under their ceilings — `headless.esm.min` at 177,594
  of 178,000.

#### 126.2 — the minifiers, measured

The 23 complete shaders were evaluated at build time (tsx import of
each module) and fed to each candidate.

- **miniray 0.3.1** (MIT, npm/WASM; marked deprecated upstream on
  2026-08-09 in favour of wgslender): 12 of 23 fail to parse — its
  template-list parser rejects the `>>` closing `array<atomic<u32>>`
  and `array<array<u32, 8>>` ("expected >, got >>") — and 4 more
  (`CURVED_ARROW_SHADER`, `EDGE_LABEL_SHADER`, both mapper eval
  shaders) panic its Go runtime in the dead-code pass, after which the
  WASM instance refuses every later call.  Its validator panicked too.
  Rejected on correctness.
- **wgslender 1.4.1** (CC0, npm/WASM, the same author's successor): all
  23 parse, minify and validate clean, input and output.  On the
  assembled corpus (441,543 bytes; 229,476 after round 52's rules):

| Configuration | Raw | Gzip of the concatenation |
| --- | --: | --: |
| whitespace only | 230,694 | 39,396 |
| + syntax | 221,814 | 38,760 |
| + tree shaking | 201,498 | 36,209 |
| identifiers, no tree shaking | 200,787 | 65,583 |
| defaults (all) | 175,356 | 59,725 |
| all + `sortDeclarations` + `scopeLocalRename` | 163,858 | 38,188 |
| locals only (globals kept), `scopeLocalRename` | 204,853 | 43,396 |

  Renaming with a global frequency table *doubles* the gzip of the
  corpus, since shared fragments stop matching across shaders; its
  scope-local mode recovers that, and renaming only locals is −11% raw
  and **+10% gzip** — the descriptive names repeat, and gzip was
  already taking them.
- **wgsl-minifier and Nagami**: Rust crates with no npm or WASM build;
  there is no Rust toolchain here, and adding cargo to the build is the
  kind of new tool `AGENTS.md` rule 7 needs a reason for.  Both
  minify complete modules, which is the approach measured next.  Not
  evaluated.
- **Full-module expansion in the real bundles** (a prototype plugin:
  evaluate each module in the build, replace each exported complete
  shader with wgslender's output; not committed):

| wgslender options | `cytoscape.esm.min.mjs` | `headless-gpu.esm.min.mjs` |
| --- | --: | --: |
| defaults | +61,458 / +35,945 / +21,758 | −163 / +369 / +107 |
| compression-tuned | +49,960 / +12,752 / +5,500 | −163 / +359 / +88 |

  (raw / gzip / Brotli).  The duplication the plan warned of dominates:
  `COMMON`, `SDF`, the curve and arrow fragments ship once today and
  once per shader expanded.  No candidate improves the bundle, so none
  is a dependency.

#### 126.3 — what landed instead, and the verification

Per-step deltas on the full minified ESM (raw / gzip):

| Step | Sites | Delta |
| --- | --: | --: |
| tables inlined (126.5) | 1,520 | −8,908 / −3,428 |
| shader constants spliced | 324 | −290 / −59 |
| floats shortened | — | −1,108 / −119 |
| **total** | | **−10,306 / −3,606** |

Final sizes:

| Artifact | Raw | Gzip | Brotli |
| --- | --: | --: | --: |
| `cytoscape.esm.min.mjs` | 959,490 | 273,959 | 224,893 |
| `cytoscape.min.js` | 959,416 | 273,971 | 224,861 |
| `cytoscape.esm.mjs` | 2,371,949 | 630,924 | 475,616 |
| `cytoscape.umd.js` | 2,434,748 | 634,058 | 477,197 |
| `cytoscape-headless.esm.min.mjs` | 562,015 | 174,366 | 146,212 |
| `cytoscape-headless.esm.mjs` | 1,647,619 | 445,183 | 336,805 |
| `cytoscape-headless-gpu.esm.min.mjs` | 641,040 | 193,039 | 161,470 |
| `cytoscape-headless-gpu.esm.mjs` | 1,800,111 | 481,610 | 365,276 |

- **`headless-gpu` against round 131's 600 KB target: 641,040 bytes,
  6.8% over** (it was 604,356 at 131's landing, 650,114 before this
  round); `headless` 562,015 against its 540 KB, 4.1% over.  The growth
  since 131 is model-side (rounds 132–141); the shader text in
  `headless-gpu` is ~44.6 KB of 641 KB, so even a perfect shader
  minifier could not bring it under.
- **Build time**: 1.88 s -> 2.45 s for all eleven outputs.  The first
  cut of the inliner cost 3.3 s (each of the eleven configs re-parsed
  the tree); one parse/result cache per run, cleared on `watchChange`,
  brought it to 0.57 s.  Watch mode was smoke-tested: an edit to
  `contract.mts` and to `node.mts` each rebuilt the UMD in ~540 ms.
- **The shader-constant splice** is value-preserving by construction
  (`String(value)` is the runtime join), and the spec proves it on the
  real tree: every tagged module is inlined, evaluated from a temp
  file, and its exported strings compared with the original's; the
  control splices `SHAPE_SHIFT` as 17 and `NODE_SHADER` must differ.
- **Float shortening** never touches a number glued to an
  interpolation (`${n}.50`, `2.50${k}` continue a number the build
  cannot see), hex, integers or suffixes other than `f`/`h`.
- **The audit had been covering half the shaders**: `wgsl-minify.mjs`'s
  token-stream audit used a list written in round 52 — 15 of 32 tagged
  files, none of the GPU algorithm kernels.  It scans the tree now,
  with the file and literal counts pinned.
- **Pixels**: the full `npm run -s test:playwright:quiet` — renderer,
  renderer-webkit and visual projects, the exact goldens, the v3
  parity scenes, the WebGPU validation-error assertions and the
  worker-host parity — green (zero output, exit 0) on the dev UMD built
  through both transforms.  The GPU compute paths (the kernels'
  CPU-vs-GPU parity scenes, the force integrator) ran in the same
  projects.
- **The page, opened**: `debug/index.html` on the dev UMD in a scripted
  Chromium (the harness's WebGPU flags, the RX 580 reached) drew the
  EnrichmentMap web network — nodes, haystack edges, the mapper's one
  dispatch — with no shader-compilation or validation message in the
  console (the one console error was livereload's absent socket).
- **Controls**, each turning its spec red and then restored: the
  interpolation-boundary rule off; GLSL comments nesting; GLSL mode
  off; a float rewrite that drops a non-zero digit (the real-source
  audit); the splice as `value + 1`; the shadow check off; the member
  rewrite off.
- `npm run -s test:node:quiet` green (zero output; 1,124 module specs,
  18 of them new); `npm run build`, `npm run build:types` and
  `npm run -s test:runtimes:node:quiet` green; the doc gates
  (`plan-record`, `agent-docs`, `feature-inventory`, `status-features`,
  `migration-guide`) green.

**The size ratchets were not lowered.**  The task said lower them to
the new sizes plus round 131's rule (landing + ~10%); on the current
tree that rule raises every row by 14–130 KB, so the ceilings stay the
tighter gate, with 1.9–3.6% of headroom where there was 0.2–2.2%.  The
before/after table is in `test/modules/bundle-size.mjs`'s header.

#### 126.4 — glslx for round 137

glslx 0.4.5 (MIT) was probed with a GLSL ES 3.00 shader written the way
round 137's plan describes its data layer, plus one probe per builtin
and construct.  It handles `#version 300 es`, `in`/`out`,
`layout(location)`, `flat`, integer samplers, `texelFetch`,
`textureLod`, `textureSize`, `sampler2DArray`, `gl_FragDepth`,
`gl_VertexID`/`gl_InstanceID`, `floatBitsToUint`, the pack/unpack
builtins and bit operations — and **rejects uniform blocks** (`layout(
std140) uniform Frame { … }`, named or not), **`switch`** ("a reserved
word") and **`uintBitsToFloat`**.  It also renames uniforms and inputs
by default, and even its `internal-only` mode renames a uniform
struct's members, which `getUniformLocation(p, 'frame.viewport')` reads
by name.  So the direction 126.4 recorded is not taken as written:
round 137's `glsl` literals get this round's transform (comments,
whitespace, directives kept on their lines), and its plan now says so
and names the four conditions under which glslx is worth re-probing.

#### 126.5 — the constants' bundle price (item 63): closed

A real transform exists — rolldown's own oxc parser
(`rolldown/parseAst`) under a plugin — and it is applied to `COL`,
`PROP` and `TWEEN_COL`: 1,520 member sites become literals, the tables
no longer ship, and the full minified ESM is 8,908 bytes smaller raw
and 3,428 gzipped — more than round 127 recorded as the cost (+8.8 KB /
+2.7 KB), since the tables themselves are gone too.  The reserved keys
and group names (`DATA_SOURCE`, `GROUP_NODES`) are single `const`
bindings the JS minifier already mangles to one name each; rolldown's
`optimization.inlineConst: { mode: 'all' }` would inline them, and
measured +3,839 raw / −732 gzip on top of the tables — worse raw, so
not on.  The source keeps the constants and `string-keys.mjs` still
keeps the literals out of `src/`.

#### Calls taken in-round

1. **Keep the shared-fragment representation**; no WGSL-aware minifier
   as a dependency (126.2's measurements).
2. **Pure-AST transforms only**, from rolldown's parser, with a local
   `splice` rather than `magic-string` (a transitive dependency here,
   not a declared one); the transforms return `map: null` as round 52's
   does.
3. **A shadowed name is left alone, not scope-analysed**: any second
   binding of the name anywhere in the module disables its rewrite
   there (a warning for a table).  No module in the tree trips it.
4. **Splice numbers only**, as bare identifiers; an expression, a
   string or a non-finite value stays an interpolation.
5. **The ratchets stay** (above).

#### Deferred

- Shader text still carries its descriptive identifiers; renaming would
  need either full-module assembly (measured: loses) or a renamer that
  sees the untagged WGSL strings too.  Not worth re-opening unless the
  representation changes.
- `headless-gpu` stays 6.8% over its 600 KB target; the levers are
  model-side (and item 77's layouts-as-a-capability), not shaders.
