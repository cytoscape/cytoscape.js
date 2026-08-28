## The error policy and `cytoscape.warnings()`

The one question the fifth sitting deliberately kept open.  v4 fails
loudly by decided design — 191 throw sites are public contract, gated
since round 37 — while v3 mostly avoided throwing because an exception
can crash an app in a case that is recoverable by ignoring it.  The
maintainer wants real design here, not a quick answer.

**Questions the sitting takes** (docs-first carries them with a
proposal to react to):

1. **A two-tier taxonomy** — *contract errors* (programmer mistakes:
   unknown props/keys/options, invalid arguments, malformed payloads —
   always throw) vs *recoverable runtime conditions* (a failed image
   fetch, a full glyph atlas, a deferred compact — today's warn
   sites).  Which of the 191 sites sits in which tier is the sitting's
   real work; `scripts/throw-coverage.mjs` enumerates them, so the
   review is a pass over a list that already exists.
2. **`cytoscape.warnings()`'s shape** — boolean toggle
   (`warnings(false)` silences the warn tier, v3's surface), or an
   options form (`warnings({ demoteErrors: true })` / an
   `errorPolicy` ctor option) that demotes *recoverable-tier* throws
   to warnings — never the contract tier, or the fail-loudly design
   dissolves.  Global vs per-instance is part of the same call.
3. **What a demoted error does** — return value conventions for a
   call that would have thrown (no-op + warn?  the v3 behaviour per
   site?), and whether the `error` event carries them.

Implementation follows the sitting inside the same round; the
throw-coverage gate's classification lists absorb any re-tiering, and
every site whose behaviour changes keeps a spec for both policies.

### Taxonomy-first prep (2026-08-08; the autonomous pass the sixth sitting approved)

All **198** throw sites (the count moved 191 → 197 → 198 as rounds 48.3,
55–57 and 38 added guards) classified by reading each site's message and
context, so the sitting reacts to a measured list rather than building
one live.  The headline: **the demotion option is small.**  Demoting
recoverable-tier throws would touch about **11 sites**, all in the
browser tier, in exactly two families — everything else is contract.

**Contract tier: ~187 sites.**  Six clusters, none of which any sane
policy demotes, because each is a caller holding the API wrong or a
payload that cannot be honoured:

- *Style validation*, the largest block by far (~95 sites in
  `style.mts`, `easing.mts`, `style-schemes.mts`, `animation.mts`):
  unknown properties and keywords, values out of range, mappers where
  constants are required, the decided-drop errors whose messages carry
  the replacement (`queue`, the style function form, `pie-N-*`…).
  These messages are load-bearing documentation — several are pinned by
  specs asserting the *guidance*, not just the throw.
- *The selector-replacement errors* (`matcher.mts`, `events.mts`,
  `algo-shared.mts`): a string where v4 takes a query object or
  predicate.  Round 47's migration guide leans on these firing.
- *Algorithm preconditions* (~10): a missing `root`, k > n,
  Karger-Stein on a disconnected graph.  v3 errors here too.
- *Structural/data integrity* (~25): duplicate ids, edges to
  nonexistent endpoints, immutable data fields, remove-order and batch
  invariants, `move()` targets.
- *Malformed payloads* (~20 in `wire.mts`, `columnar.mts`,
  `data-store.mts`, `id-map.mts`): truncated buffers, out-of-range
  indices, corrupt dictionaries — round 48.3's fuzz guards.  Demoting a
  corruption error would hand the app a silently wrong graph, the exact
  failure mode the guards exist to prevent.
- *Internal invariants* (~8, five of them in the gate's UNREACHABLE
  list): packing overflows, column/group mismatches — loud-fail by
  design, unreachable by construction.

**Recoverable-runtime tier: ~11 sites, two families.**

1. **GPU acquisition** (5): `index.mts` ×2 and `gpu-context.mts` ×3 —
   WebGPU missing, no adapter, no canvas context.  The canonical
   environment condition… with a caveat the sitting has to weigh: v4
   has **no fallback renderer**, so a demoted acquisition failure is a
   permanently blank container with a console line.  (The WebGL
   fallback logged at the sixth sitting as a future direction is the
   thing that would make this demotion meaningful.)
2. **Image export** (5–6): destroyed renderer, empty graph, zero-sized
   container, texture-limit overflow (`renderer.mts` ×4), export from
   headless (`core.mts:1942`), and arguably the glyph-atlas 2d-context
   failure.  These are runtime *states*, not static misuse — an app
   exporting during a resize race hits the zero-size guard through no
   bug of its own.  A demoted export resolving `null` with a warning is
   a coherent contract.

(The image-decoder HTTP throw is internal — the registry already
catches it into the existing warn path — and the big-endian wire guard
is UNREACHABLE.)

**The warn tier as built**: 14 `console.warn` sites (deferred
compaction ×2, image tier/layer caps ×3, glyph-atlas full, negative
Bellman-Ford cycle, breadthfirst fallbacks, hierarchy and curve-index
recoveries, columnar/style notes) — this is what `warnings(false)`
silences on day one, no re-tiering needed.

**What this hands the sitting**: with the demotion list this small and
half of it undermined by the missing fallback renderer, the measured
recommendation is `cytoscape.warnings(boolean)` (global) + a
per-instance ctor override as the v3-parity surface, and **deferring
the `errorPolicy` demotion option** until the WebGL fallback exists to
give family 1 a story — family 2 alone (≤6 sites) may not justify the
policy machinery.  The sitting decides; the list above is the evidence.

### The sitting (2026-08-09, seventh design sitting) — closed with no new surface

The maintainer read the classification and took a smaller call than
even the measured recommendation: **errors and warnings stay exactly
as they are.**  With GPU acquisition and image export the only
recoverable families — and the acquisition family meaningless to
demote while v4 has no fallback renderer — the demotion machinery is
not worth its surface, and neither is the boolean toggle: the 14
`console.warn` sites stay plain warns with no `cytoscape.warnings()`
over them.

So round 40 ships **nothing**: no `warnings()`, no `errorPolicy`, no
re-tiering.  Its lasting outputs are the taxonomy above (now the
recorded rationale for the fail-loudly contract standing whole) and
the closure of ledger item 4's second half — `cy.gc()` returned,
`warnings()` did not.  The three questions the sitting was to take
resolve as: (1) the taxonomy stands as classified, all 198 sites
contract-or-warn as built; (2) no shape, because no function; (3)
moot.  If a WebGL fallback renderer ever lands (the direction logged
at the sixth sitting), the acquisition family's demotion question may
be reopened by whoever builds it — that is a new call, not a residue
of this one.
