## Rounds 98–100 — the runtime rounds (raised by the maintainer 2026-08-19)

The ask: **first-class support for Bun and Deno in addition to
Node**, and a third round that scopes what other JavaScript
environments are worth supporting.  Orthogonal to round 49
(cross-platform validation is about OSes and GPU backends; this is
about JS runtimes) and feeding rounds 50 (publishing) and 78.4 (the
WebGPU-outside-a-browser investigation, which already names Deno's
WGPU as a candidate).  What the code does today, verified:

1. **`src/` imports zero runtime built-ins and zero bare
   specifiers** — no `node:` import anywhere, no dependency in
   `package.json` (`dependencies` is absent), and the one grep hit
   for a bare specifier (`from 'fcose-gpu'`,
   `src/layout/contract.mts:8`) is inside a JSDoc example, not an
   import.  The library is runtime-clean *by fact* — but **not by
   gate**: `test/modules/import-graph.mjs` classifies bare
   specifiers as "a dependency, not a repo edge" and skips them
   (its own comment, ~line 73), so a `node:fs` import added
   tomorrow passes the invariant that reads as pinning this.
2. **The headless path already speaks web-platform, not Node**:
   `TextEncoder`/`TextDecoder` (`src/wire.mts:228,438`,
   `src/store/id-map.mts:34-35`), `queueMicrotask`
   (`src/store/dirty.mts:153`), `performance.now()` with a
   `Date.now()` fallback (`src/animation.mts:2241`), and the
   animation auto-driver already guards `requestAnimationFrame`
   behind a `typeof` check with a 16 ms `setTimeout` fallback
   (`animation.mts:1741-1748`).  Everything named is in the
   WinterTC minimum-common-API baseline.
3. **The GPU algorithm tier needs no canvas and no DOM.**
   `src/algorithms/algo-gpu.mts` says it in its header — "a
   headless instance can run GPU algorithms wherever
   `navigator.gpu` exists" — and gates on
   `globalThis.navigator?.gpu` (:44).  **Deno ships native
   WebGPU**, so executor `'gpu'` plausibly runs under plain Deno
   with no browser in the room.  The renderer proper stays
   browser-bound (canvas + container, `gpu-context.mts:32-35`).
4. **Nothing runs any artifact of this repo under any runtime but
   Node and the Playwright browsers.**  `engines` says
   `node >= 24`, CI is `ci-node` + the `ci-browser` matrix
   (`tests.yml:13,39`), the Node tier runs `src/` through tsx, and
   the standing note that almost nothing exercises the built
   bundles applies doubly here: no bundle has ever been *loaded*
   by Bun or Deno on this repo's watch.
5. **The test suite is `node:test` + chai behind a shim**
   (`test/node-test-setup.mjs`), over `.mts` sources imported
   through `.mjs` specifiers with tsx doing the remap.  Whether
   Bun's runner/Node-compat and Deno's do both of those jobs is a
   measurement, not an assumption, and the plan below treats it as
   one.

The split: round 98 makes the support *true and gated* (the
invariant pinned, a cross-runtime smoke tier over the built
bundles, CI).  Round 99 makes it *first-class* (the native test
runners measured, Deno's own adapter driving the GPU executors,
the install and publish story).  Round 100 is the scoping round
for everything else.

