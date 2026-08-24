## Round 52 — WGSL minification (planned 2026-08-05; scheduled at the sixth sitting; landed 2026-08-08)

**Where it belongs in the sequence**: it is numbered after 51 only because it
was scoped last.  It is behaviour-neutral and touches no API, so it can land
any time — but it should land **before round 50 cuts `4.0.0-alpha.1`**, since
after that the unminified shader text is in a published artifact.  (It landed
well before 50, out of the sitting's nominal order — being decision-free and
self-contained, it was the cheapest of the three unblocked rounds to close.)

### What prompted it

The maintainer asked why v4's bundle is larger than v3's.  Measured, not
estimated:

| | raw | gzipped |
|---|---|---|
| v3 `cytoscape.min.js` | 411.3 KiB | 126.1 KiB |
| v4 `cytoscape.min.js` | 660.1 KiB | 178.5 KiB |
| ratio | 1.60× | 1.42× |

**The single biggest contributor is WGSL source: 156.5 KiB across 42 string
literals — 23.7% of the minified bundle**, and v3 has none of it.  It is
disproportionate for one reason: *a minifier does not touch string contents*,
so every other part of the codebase roughly halves and this part does not
shrink at all.  Take the shaders out and v4's JavaScript is 503 KiB against
v3's 411 — **1.22×**, not 1.60×.

A methodology note, because the first attempt was wrong and would have sent
this round after the wrong file: attributing bundle bytes with rolldown's
`//#region src/…` markers gave 111 KiB to `image-registry.mts`, a 10.6 KiB
source, because rolldown merges modules and the marker names only the first.
The figures above come from a sourcemap instead.  Region markers are not an
attribution mechanism.

### What minifying is worth, measured

Comment-stripping plus whitespace collapse over all 154.1 KiB of shader text:

| stage | raw | gzipped |
|---|---|---|
| as written | 154.1 KiB | 38.0 KiB |
| comments stripped | 118.7 | **23.0** |
| + whitespace collapsed | 93.2 | **20.2** |

**60.9 KiB raw (9.2% of the bundle), 17.8 KiB gzipped (10.0% of the
download)** — and *comments alone are 23% of the WGSL text* and account for 15
of those 17.8 KiB.

The gzip figure is the surprise and the reason this is worth doing.  The
expectation going in was that compression would wash the saving out, since
shader text is repetitive; it does not, because comment prose is *unique* text
that gzip cannot dedupe.  The gzipped saving is proportionally as large as the
raw one.

### The obstacle, and how much of it is real

95% of the WGSL is assembled with `${}` interpolation — 114 sites — so a
build-time static minifier cannot see the final text.  The sites are not all
the same thing:

| | KiB | share | avoidable |
|---|---|---|---|
| static, no interpolation | 14.5 | 9% | already static |
| **build-time constants only** (`${SHAPE_MASK}`, `${COMMON}`, `${SDF}`) | 89.4 | **58%** | **yes, at build time** |
| runtime-generated (`ARROW_POLY.cases`, `edge ? … : ''`, per-polygon `fmtF32( pts[ i ] )`) | 50.1 | 33% | no |

The 58% interpolates constants from `src/contract.mts` — the co-signed
model↔renderer layout — and that interpolation exists for **correctness**: it
keeps one definition of every flag and offset.  Hand-inlining the numbers would
duplicate the contract, which is the thing that file exists to prevent.
Generating the WGSL from `contract.mts` at build time keeps the guarantee and
yields static text, so the ceiling on "make it statically minifiable" is
**67%**.

The remaining 33% is genuine variant generation — custom polygon shapes compile
per-polygon WGSL from user-supplied points.  Making it static means shipping
every variant (larger) or dropping the feature.  It stays dynamic.

### Tools surveyed (2026-08-05)

- **[miniray](https://github.com/HugoDaniel/miniray)** — npm, MIT, Go→WASM,
  v0.3.1 (Dec 2025).  The real analogue of glslx: whitespace, **identifier
  renaming**, dead-code elimination, validation, reflection, source maps; CLI
  and JS API; validated against the Dawn Tint suite.  4.35 MiB unpacked, which
  is fine for a devDependency and rules out any runtime use — it is 27× what it
  would save.
- **[wgsl-plus](https://github.com/JSideris/wgsl-plus)** — npm, MIT, 259 KiB,
  v1.0.1 (Mar 2025).  Preprocessor + linker + minifier + obfuscator.  Its
  C-style `#include` is a direct answer to the `${COMMON}`/`${SDF}` chunk
  inclusion, if that route is preferred over generating from `contract.mts`.
- **[wgsl-minifier](https://github.com/LucentFlux/wgsl-minifier)** — Rust crate
  over naga; not on npm, needs a Rust toolchain.  Out for this repo.
- **[wgslx-loader](https://github.com/wgslx/wgslx-loader)** — webpack; we use
  rolldown.  Out.
- **shader-minifier** (laurentlb) — GLSL/HLSL only, no WGSL.
- Context: [gpuweb#3503](https://github.com/gpuweb/gpuweb/issues/3503),
  *Make WGSL more suitable for minification*, is open — the tooling here is
  young and the language is not yet designed for it.

### Proposed passes

- [x] **52.1 The cheap pass, and probably the whole round** (2026-08-08) —
  landed, and it was the whole round: 52.3 stays unbuilt because the number
  did not disappoint.  Measured on the day's source (which had grown since
  the plan's table — rounds 53–57 landed in between): `cytoscape.min.js`
  **663.3 → 601.1 KiB raw, 182.3 → 163.3 KiB gzipped** — 62.2 KiB raw
  (9.4%) and **19.0 KiB gzipped (10.4% of the download)**, slightly better
  than the plan's 60.9/17.8 estimate.

  The shape of the thing: a `wgsl` template tag (`src/render/wgsl.mts`,
  an identity join at runtime) marks every multi-line WGSL literal — 49
  across the seven shader-bearing modules — and a rolldown plugin
  (`scripts/wgsl-minify.mjs`, wired into all five bundle configs) lexes
  each tagged literal, strips comments (nested block comments per the
  WGSL spec), collapses whitespace where tokens cannot fuse, and **drops
  the tag** — an untagged template joins identically, so the bundles pay
  no per-shader call and the tag itself tree-shakes away.  The build-time
  marker is what lets the transform find WGSL without parsing JS
  semantics or guessing which template literals are shaders (several of
  those files also hold GPU-label and error-message templates that must
  not be touched).

  `${…}` opacity is the contract the plan named, and it is stricter than
  "don't parse the interpolation": whitespace *adjacent* to an
  interpolation collapses to a single space but is never deleted (the
  value's edge characters are unknowable, so `return ${X}` must keep its
  space), while `poly${id}SD` stays glued (a space is never invented).
  Single-line generated fragments (the per-polygon `case` lines) stay
  untagged — no comments, nothing to collapse.  Two authoring rules
  became build errors with specs: an interpolation inside a WGSL comment
  (stripping the comment would strand the interpolated text as live
  shader code — two such doc comments existed and were reworded to prose),
  and an unterminated block comment.

  The spec suite (`test/modules/wgsl-minify.mjs`, 17 specs) carries the
  plan's control: the fixture puts `${ n - 1 }` and a `'a//b'` string
  interpolation next to punctuation, and the **non-opaque transform run
  against it mangles both** — the spaced interpolation is rewritten and
  the `//` inside the string is eaten as a comment — so the fixture
  demonstrably discriminates.  Beyond the unit specs, a token-stream
  audit runs every one of the 49 real literals through an *independent*
  tokenizer (regex-based, sharing no code with the transform): original
  and minified static chunks must produce the identical WGSL token
  sequence, and the literal count is pinned at ≥45 so a scanner that
  silently stops matching fails rather than auditing nothing.  A bundle
  spec then asserts the built outputs carry the shaders (`fn edgeLod`)
  without their comments and without the tag.

  Two things went wrong on the way and are worth keeping.  The tag
  detector first required the preceding significant character to be
  non-word, which silently skipped the one tag written as `return
  wgsl\`…\`` — caught by the bundle spec finding a surviving tag, and the
  fix is that identifiers scan atomically so a preceding word char means
  a *separate* token, a legitimate expression position.  And the
  round-37.1 throw gate fired on the tagging commit itself: the added
  import line moved `gpu-tween.mts`'s exempted throw from line 470 to
  471, and the build failed naming it — the fourth time that gate has
  caught a silent allowlist re-point, this time from a one-line import.
- [x] **52.2 Prove it did not change what runs** (2026-08-08) — the full
  Playwright suite against the transformed dev UMD build (the plugin is
  deliberately unconditional across dev and production, so the pixel gate
  exercises exactly the transform that ships): **220 passed, 103
  soft-skipped** (the `renderer-webkit` project — WebKit has no WebGPU
  here), with all 45 goldens at **zero differing pixels** under 57.1e's
  exact bound and every live parity scene at its recorded value
  (`parity-selection` 0 px, the close-up tiers at 0.000–0.020%).  The
  Node tier is green end to end (typecheck, 2078 + 280 + 24 specs, throw
  gate at 182 run / 10 browser-only / 5 unreachable / 0 dead, lint,
  format).  `benchmark:renderer` ran on this machine's real adapter (AMD gcn-4 —
  the RX 580 of the round-18.5 hardware pass), 17.9 minutes over all ten
  scenes: every pipeline compiled from minified text, v4 held its
  vsync-bound 16.7 ms frames everywhere, and the 160 GPU rows paired
  against the 2026-08-06 pre-change run have a **geometric-mean ratio of
  1.018** — run-to-run noise, with the largest movers the sub-millisecond
  compaction device rows that jitter in both directions between any two
  runs.
- [ ] **52.3 Only if 52.1's number disappoints — generate from `contract.mts`.**
  Resolve the build-time constants at build time so 67% of the text becomes
  static, then run **miniray** over that portion for identifier renaming.
  Sequencing matters: this stacks on a comment-strip that has already taken
  the easy 15 KiB, reaches only two thirds of the text, and buys renaming of
  identifiers that gzip already compresses well.  The estimate is single-digit
  KiB gzipped for a substantial amount of build machinery, and **that estimate
  should be measured on one shader before the machinery is built**.

  ***Not built (2026-08-08), as the sitting expected.***  52.1 landed 19.0
  KiB gzipped — above its own estimate — so the trigger ("if the number
  disappoints") never fired.  Ledger item 17 (miniray) stays where it is:
  reached only if this pass is ever wanted, measure-first.

### Calls this round needs

1. **Is 10% of the download worth a build step at all?**  52.1 is ~30 lines and
   no dependency, so the bar is low, but it is still a transform between the
   source and what ships.
   **Call taken (2026-08-06, sixth sitting): yes — 52.1 builds**, with its
   fixture (interpolation sites next to punctuation) and its control (a
   transform that does *not* treat `${}` as opaque must fail), gated by 52.2's
   pixel diff, and it lands **before round 50 cuts the alpha**.  The round is
   now scheduled, not merely scoped.
2. **Does miniray become a devDependency?** (52.3 only.)  It is 4.35 MiB of
   Go-compiled WASM in the toolchain for a single-digit-KiB gain, and it should
   not be added on the strength of the tool's quality alone — measure first.
   **Held open as ledger item 17** (2026-08-06): reached only if 52.1's number
   disappoints, and only after the single-shader estimate is measured.

### Risks tracked

- **A transform between source and shipped shader is a new class of defect.**
  Everything else in this repo ships the source it was tested against.  After
  this round the browser runs text no human wrote, so 52.2's pixel gate is not
  optional — it is the only thing standing between a whitespace bug and a
  silently wrong render.
- **The saving is not where intuition puts it.**  Comments, not whitespace, are
  the win (15 KiB of 17.8 gzipped).  A future round tempted to skip
  comment-stripping "because gzip handles repetition" would be reasoning from
  the wrong model — and losing almost all of the benefit.
