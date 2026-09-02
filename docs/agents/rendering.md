# The renderer, the shaders and the debug harness

Read this before changing the WebGPU renderer, a shader, or anything
the debug harness draws.  The recurring lesson is that a renderer defect
looks plausible — a graph with no labels still renders — so the harness and
the fixtures need their own controls.

## WGSL ships minified

- **The bundles ship minified WGSL, not the shader text as written** (round 52).  Multi-line WGSL literals carry the `wgsl` template tag (`src/render/wgsl.mts`; identity at runtime) and `scripts/wgsl-minify.mjs` strips comments/whitespace at build time with `${...}` kept byte-for-byte opaque — so when adding a shader, tag the literal, and never put an interpolation inside a WGSL comment (a build error; spell the name in prose).  The transform runs in dev builds too, deliberately: Playwright exercises the same transform that ships.

## `debug/` — the manual harness

- `debug/`: The manual dev harness (`npm run watch` → http://localhost:3333/), rebuilt in round 43.  Offers **fourteen networks**: six from real exports (four fixtures shared with v3's WebGL harness under `v3/debug/webgl/`, the 465k-edge `ndex-x-large` local to `debug/`, and a clustered variant derived from em-web in-page) and eight built in-page, each with a **hand-authored v4 stylesheet** in `debug/styles.js` — including the real enrichmentmap.org style, a port of **v3's own default debug graph** (`?network=v3-default`, round 46.6) and, since round 57.5, v3's four documentation demos (`?network=node-types` / `edge-types` / `edge-arrows` / `labels`).  Those five are the ones to open when the question is *drawing* rather than scale: between them they put every shape keyword, every curve style, every arrowhead in both fills and the whole label surface on one screen.  Plus plus view/layout/core-toggle/selection/event/add-remove sections and a stats overlay.  Use it for renderer, interaction and gesture changes that are hard to verify in unit tests alone.
  - Round 114.7 gave the layout section four things a person judging a layout needs: **Preset restores the positions the graph loaded with** (a snapshot `init.js` takes synchronously after `cytoscape()` returns — the factory runs the load layout to completion first, flow included), a force-only **Live** box (`animateLive`; Animate now tweens every layout to its finished positions), a **layout-appropriate edge types** box that re-applies the sheet with the curve style the layout reads best with (taxi for flow and breadthfirst, bezier for the rings, haystack for force — the table is `debug/layout-config.js`), and a **Hover** select that dims or hides everything outside the hovered neighbourhood (`debug/hover.js`, timed in the console — round 102's "app spelling today").  The spiral extension example lives in `debug/spiral-layout.js`, written over the contract the way a built-in is (`nodeDimensions`, `packComponents` over its own array, `finish`), so it animates and avoids overlap.  All three files export for the module suite, which runs the spiral headless against the real library.
  - `debug/fixtures.js` holds the fixture conversion and the generators, split out so `test/modules/debug-harness.mjs` can exercise the *same* code: that spec asserts every fixture exists at the path the page will fetch, and that every sheet compiles against that fixture's real data.  It is the only automated coverage `debug/` has, and both halves exist because both failed silently before round 43.  The 2026-08-05 review pass added three more, each pinning a defect a person had to open the page to find: the compound fixture lays out into **disjoint parent boxes** (grid places leaves in declaration order and parents derive from where their children land, so the node order and `cols` together decide readability), the event log reads layout **once per frame rather than once per event**, and `watch:sync` binds livereload on **every interface** (its `localhost` default resolves to `::1` here while `http-server -o` opens 127.0.0.1, so the client never connected).
  - **When the page does not come up, read the message on it: it names the phase.**  `debug/load-error.js` (round 65.13) writes it, and the phase — `network`, `http`, `decode`, `init` — is passed in by the caller rather than guessed, because guessing is what the previous version did: `init.js` called `loadNetwork` *inside* the fixture's promise chain, so every library error (sheet compile, `cytoscape()`, layout) was reported as a broken fixture, and for a wire-loaded network as "rebuild the site".  The generated networks build outside any promise and showed the real error, so a WebGPU failure read as *"the binary networks are broken, the built-in ones are fine"* — which is how it was reported.  A fatal message is also sticky now: `startStats` rewrites `#stats` twice a second and had been erasing the adapter error within half a second of it appearing.
  - `debug/slim-ndex.mjs` records how the 34 MB `ndex-x-large` fixture was derived from its 250 MB original, so the slim is re-runnable rather than a mystery blob.
  - **The status build ships the fixtures as v4's own binary wire format** (round 46.5).  Measured over the five fetched fixtures: 102.5 MiB of JSON becomes **37.5 MiB**, and the largest goes 34.1 -> 9.5 MiB — which is what puts every one of them under Cloudflare Pages' 25 MiB per-file cap, so the deploy carries every network itself with no off-site bucket and no CORS rule.  Note what it is *not*: gzipped, binary and minified JSON are within **1%** of each other, so this is a file-at-rest win (which is what the cap measures) and a parse win, not a transfer one.  The build writes a manifest (`status-config.js`, generated into the output tree) naming each encoded fixture; `debug/init.js` prefers it and falls back to the JSON when it is absent, which is what `npm run watch` does — local development is unchanged.  The encoder runs `debug/fixtures.js`'s own `toGpuElements` and calls the **built UMD bundle** — `build/cytoscape.umd.js`, the one file `debug/index.html` loads — not `src/`, so the page decodes with exactly the code that encoded it.  It read the CJS bundle until 2026-08-11, which only looked equivalent: `npm run watch` rebuilds the UMD alone and `npm run status` builds nothing, so a tree can hold a fresh UMD beside a CJS from an earlier commit.  A spec pins the encoder's bundle against the page's script tag.

## Something has to open the page

- **Something has to open the page.** `debug/` now has specs, and they are worth having, but round 43 shipped with its own risk note saying they prove sheets *compile* and not that anything still looks right — and one day later a maintainer opening the page found three defects, one of which (a conservative `fit()` inflating compound graphs ~2×) was in `src/` and visible in every app with a compound graph. When a change touches the harness, the renderer or bounds, drive the page: `npm run watch`, or a scripted browser that loads `debug/index.html`, screenshots it, and compares against `v3/debug/`'s equivalent.

## The adapter you got is not the GPU the box has

- **Run `npm run gpu` before writing "this environment has no GPU" or
  deferring hardware work.**  It launches Chromium with the harness's own
  WebGPU/Vulkan flags and prints a HARDWARE / SOFTWARE-ONLY / UNKNOWN
  verdict.  Twice a session has read a SwiftShader adapter label in an
  ad-hoc scripted browser and concluded the box had no GPU — on a machine
  with a discrete RX 580 — because its launch flags fell back to software
  (round 93.2 was the second time).  Two facts the script keeps separate:
  the *card being present* (lspci inventory) and the *browser reaching it*
  (adapter identity); only the second licenses a GPU benchmark number or a
  deferral.  Two footguns it encodes: `navigator.gpu` is unavailable on
  `about:blank` (the probe serves a loopback http page), and a failed probe
  reports UNKNOWN (exit 1) rather than "no GPU", so a broken environment
  cannot manufacture the very conclusion the script exists to prevent.
  Goldens stay pinned to SwiftShader regardless — the verdict governs
  benchmarks and hardware-only work, not the visual suite.

## A columnar payload can lose a whole column silently

- **A columnar payload can lose a whole column silently, and the page still looks plausible.**  Round 46.5 re-encoded the harness fixtures into the binary wire format, and the first reader treated a *dictionary* column (`{ dict, indices }`, 1-based, 0 = absent) as a plain array — so every string column in every fixture came back `undefined`.  The graph still rendered: right node count, right edges, right positions, no labels and no categorical colours.  Nothing throws on that.  When a format has more than one column encoding, the spec has to assert **each column still carries values after the round trip**, not that the payload parsed; the control (read the dict as an array) must fail on every fixture.

