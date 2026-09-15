## Shader minification

**Status: planned; round 126.** Originally drafted as provisional round
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
fallback work scoped by [round 73](2026-08-14-04-rnd0073-plan-the-webgl2-fallback-scoped.md).
Validate glslx against the fallback's actual GLSL ES version and shader
features before integration, and preserve or map host-visible shader names.
Apply equivalent compressed-size measurements and browser/pixel-parity
gates. This round records that tooling direction; implementing the WebGL
fallback remains separate work.
