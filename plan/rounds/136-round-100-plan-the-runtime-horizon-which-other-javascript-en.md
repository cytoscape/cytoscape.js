## Round 100 plan — the runtime horizon: which other JavaScript environments are worth supporting (raised by the maintainer 2026-08-19)

An investigation round with a written record — the WebGL-scoping
shape.  No `src/` changes except where a one-line capability
guard buys a whole environment (the `animation.mts`
rAF-fallback shape), each such line with a spec.

### 100.1 — the capability ladder, stated once

What each tier of v4 *actually* needs, so environments are judged
against requirements rather than vibes:

- **T0 — headless core** (store, wire, style, layouts,
  CPU algorithms, `json()`, and round 77's `svg()` when it
  lands): the WinterTC baseline v4 already confines itself to —
  typed arrays, TextEncoder/Decoder, `queueMicrotask`, timers.
- **T1 — + Web Workers**: the round-74 pool.
- **T2 — + WebGPU**: the GPU executors (no canvas — 99.2's
  tier), then the renderer's export path if 78.4 goes.
- **T3 — + DOM/canvas**: the full renderer, glyph atlas, image
  decode, gestures — browsers and browser-shells only.

### 100.2 — the candidates, each run through the 98.2 smoke

Measured, not assumed — the smoke is the instrument, and for
each environment the record says which tier it reaches and names
the first failing assertion when it misses:

- **Cloudflare Workers / workerd** (locally via the wrangler dev
  runtime): the real use case is server-side layout, metrics and
  `svg()` at the edge; the thing to measure is T0 under the CPU
  budget an isolate actually grants, on a real fixture, not a toy.
- **Vercel Edge and friends** — workerd-adjacent; record, do not
  re-investigate.
- **Electron / Tauri-with-Node-sidecar**: expected to be Node +
  Chromium wearing a trenchcoat; verify with the smoke and one
  renderer sanity check, one line of record each.
- **React Native / Hermes**: T0 would put the graph *model* and
  algorithms in apps; Hermes' standard-library gaps are exactly
  what the smoke enumerates.
- **Embedded engines (QuickJS, GraalJS)**: long tail; run the
  smoke where it is cheap, record-only, no support claim.
- **Service workers / worklets**: T0/T1 contexts inside the
  browser; round 86 owns the worker-hosted *renderer*, so this
  round only checks the model tier loads there.

### 100.3 — the deliverable: a support matrix with teeth

A tiered statement, docs-side: **Tier 1** — CI-gated (Node, Bun,
Deno, the Playwright browsers); **Tier 2** — expected-to-work
(WinterTC-baseline environments; the smoke is run against them at
release time, the round-51 bake being the natural first
occasion); **Tier 3** — recorded as unsupported *with the failing
assertion named*, so the answer to "does it run on X" is a link,
not a shrug.  Anything that earns real work becomes a ledger item
with its measurement attached, not a bullet in this round.

### Risks named at planning

- The environment zoo is unbounded; the pre-agreed candidate list
  and the ladder bound it, and "record-only" is a legitimate
  verdict.
- A smoke that *completes* in an exotic environment with subtly
  wrong values is the 98.2 risk again, and the same answer
  applies: the smoke asserts values and ordering, so "runs" means
  "computed the right numbers".
- Publishing a support matrix creates an expectation of
  maintenance; Tier 2's release-time cadence is the deliberate
  ceiling, and the matrix says so in its own text.

**Open:** whether workerd joins CI as a Tier-1½ (cheap and
high-signal if the wrangler runtime is stable on runners);
whether the matrix lives in `src/README.md` or becomes a docs-site
page in round 46 (recommended: README now, page at 46); whether
React Native demand justifies a tracked example app (default no —
wait for an issue with a real use case).

