## Governance close-out

Small and first, because the gates protect every round after it.  All
calls already taken (fifth sitting); nothing here needs design.

- [x] **37.1 The two new gates** (2026-08-04) — landed.  Throw coverage
  is a zero-tolerance gate: `gateFailures()` turns an `audit()` result
  into the build's failures, the CLI exits nonzero on any, and
  `npm run test:throws` joins the `npm test` chain after `test:modules`
  (it re-runs the root Node suite under coverage, so it cannot live
  *inside* that suite — the one structural difference from the JSDoc
  gates).  `@returns` ratchets at 276/276 in
  `test/jsdoc-coverage.mjs`, beside `@throws` and `@param`.

  **`UNREACHABLE`/`MISATTRIBUTED` are now checked, not just written.**
  The promotion to "maintained allowlist" is a real mechanism rather
  than a change of tone: an entry that no longer names a `throw new`
  line, or whose reason is empty, fails the gate on its own.  Zero
  tolerance is only as good as its escape hatch, and this one is keyed
  by `file:line` — round 34 already moved a site out from under its
  entry by inserting two methods above it, and under a gate that
  failure mode does not merely lose a site, it *grants the exemption to
  a different throw* while reading as a pass.

  Controls (the 31.2 pattern), each staged and asserted to fail: a
  Node-reachable site with no spec (1 failure, naming it), an allowlist
  entry pointing at a line with no throw on it, and an entry with a
  blank reason.  Two more hold the gates against the real sources — the
  allowlist validation runs in the fast module suite against a report
  that says nothing (every site unknown, so only the exemptions can
  fail), and the `@returns` gate was run once with a tag deleted from
  `viewport.mts`, failing both its checks (the miss and the 276 floor).
  The CLI's exit code was checked end to end against a hand-written
  lcov marking one real site dead: exit 1.
- [x] **37.2 The alias split** (2026-08-04) — landed.
  `roundrectangle` throws, joining `cutrectangle`/`concavehexagon`, and
  its line in `test/decided-drops.mjs` flips from
  pinning-the-inconsistency to pinning-the-drop.
  **It was accepted in three enums, not one**, which the call's
  wording did not say and the code did: the node `shape` table,
  `parseLayerShape` (`overlay-shape`/`underlay-shape`) and
  `TEXT_BG_SHAPES` (`text-background-shape`).  Dropping it from
  `shape` alone would have moved the inconsistency rather than closed
  it, so all three go, with a spec per enum.

  A third spec pins a free
  consequence worth having: the `shape` error lists the accepted
  keywords from the table itself, so it stops advertising the dropped
  spelling to the v3 user who is reading it to find the replacement.
  `debug`'s v3-fixture sanitizer learns the new spelling too.
  `autolockNodes`/`autoungrabifyNodes` stay wired and pinned, and the
  alias table's comment changes from "an open call, recorded beside
  the `roundrectangle` one" to the reason they are kept.  Both
  documents' legacy-alias lines now carry the two-name exception, so
  code and ledger agree for the first time since 2026-07-29.

  **One line deleted from `style.mts` broke three specs elsewhere**, and
  fixing it properly was worth the detour:
  `test/modules/throw-coverage.mjs`'s fixture named real throw sites by
  hardcoded line number
  (`874`, `1031`, `1074`), so deleting the `roundrectangle` row shifted
  every one of them by one.  The fixture now *resolves* its lines from
  the sources by anchor text.  It is the round-34 lesson arriving in a
  third place — after the `UNREACHABLE` allowlist it broke then, and the
  gate 37.1 built to catch that — and the same fix applies: a `file:line`
  written down is a claim that nothing above it will ever move.
- [x] **37.3 Constructor options, closed at the type layer**
  (2026-08-04) — landed.  The options type needed no tightening: it
  carries no index signature, so TypeScript's excess-property check
  already rejects every case.  Four `@ts-expect-error` directives in
  `typescript/tests/api.test-d.ts` pin it — `motionBlur`,
  `hideEdgesOnViewport`, a plain typo, and one through the named
  `CytoscapeOptions` type — and the control ran: swapping one for a
  *valid* key (`zoom`) makes the directive unused and fails the build,
  so the check discriminates rather than passing vacuously.

  The runtime half is pinned too, which the plan did not ask for and
  the decision needs: three Node specs assert that the dropped
  canvas-era options are ignored, that a typo round-trips through
  `options()`, and — the contrast the whole decision rests on — that
  the names v4 *interprets* still throw.  The ctor's and the factory's
  JSDoc record the asymmetry, including its boundary: excess-property
  checking applies to object literals, so options assembled into a
  variable first widen and pass.
  **The item turned up a third instance of round 36's audit-scope
  failure**, and closing it was in scope because this round is the one
  that gates these audits.

  Writing the factory's doc comment meant
  reading it, which showed `cytoscape` had no `@param` — and yet
  `@param` reported 229/229.

  `src/index.mts` has been listed in
  `PUBLIC_API` since round 26 and contributed **zero** members to
  *every* audit, because the exported-function pattern round 36 added
  matches `export function` and `export const f =` but not
  `export default function`.  So the package's entry point — the most
  public member in the tree — sat outside coverage, `@param`,
  `@returns` and `@throws` while its file read as audited and
  complete, and all three of its tags were in fact missing.  Widened,
  written, and pinned by a spec that fails if the file ever again
  contributes nothing: **17/17, 230/230, 277/277**.
  Round 32 walked class bodies only; round 36 widened to exported
  functions; this widens again.  Same lesson each time — an audit's
  scope is part of its claim.
- [x] **37.4 Event-name openness, documented** (2026-08-04) — landed,
  and it **corrected this file**.  `Core#on`, `Core#emit` and
  `Collection#on` now state the contract: any name registers, custom
  events are supported API (which is *why* no name can be gated), and a
  name v4 never emits registers cleanly and then silently never fires —
  so port event names from the vocabulary rather than by trying them.
  No denylist, no runtime change.
  Three specs pin it, because a documented contract nothing asserts is
  one that comes back by accident, and writing them is what turned up
  the correction.

  **Namespaces do not behave as this file recorded.**  Contradiction 11
  said `cy.on('tap.ns', h)` "never fires, not for `tap` and not for
  `tap.ns` either", and the README said the shared emitter keeps
  namespace parsing "only for v3".  Measured (and true until round 41.2
  removed the machinery): v4 imported v3's emitter,
  so namespaces parsed and worked in **full v3 semantics** —
  `on('tap.ns')` listens for `tap` qualified by `.ns`, `emit('tap.ns')`
  runs both it and any plain `tap` listener, `emit('tap.other')` runs
  only the plain one, `off('tap.ns')` removes it.

  The narrower true
  statement is that **v4 never emits a qualified name**, so a
  namespaced listener sees application emits and never a library event
  (a `data` write reaches a `'data'` listener and not a `'data.ns'`
  one).  Both documents corrected; the spec asserts each row of the
  table above, so round 41 — which removes the machinery — will have to
  change a test that describes what the machinery actually did.
  The original claim was probably taken from v4's *own* events only,
  which is the sense in which it read true; it is a good example of why
  "measured 2026-08-03" in a record still deserves re-measuring when a
  round leans on it.
- [x] **37.5 Closing docs sweep** (2026-08-04) — landed, carrying the
  README true-up the fifth sitting deferred.
  The README gains a round-37 paragraph and the sitting's own summary
  in its header; the follow-up hooks' round-28 entry, which listed
  every open call as open, now records each decision and the round that
  executes it; the JSDoc section carries the two new gates, the widened
  audit and the corrected tallies; the events section and the
  `Events: no namespaces` paragraph carry the namespace correction; a
  new decided-design bullet states the type-layer-versus-runtime
  strictness split; and the legacy-alias line carries its two-name
  exception.

  This file gains the round-37 paragraph in "Suggested sequencing" (one
  of the three sites the standing rule names), the pass records above,
  the four closed items in "Open calls for the maintainer", the
  namespace correction in contradiction 11 **and** in round 41's plan,
  and the alias closure in the decided-drops ledger.  "Needs a call"
  and "Gaps with direction already set" were checked by name: the
  sitting had already annotated the one live entry
  (`border-style`/`outline-style` → round 38) and the rest are history.

  `AGENTS.md` gains the two gates in the places that asserted the
  opposite — "it reports, it does not gate" and "`@returns` …
  **reported rather than gated**" were both false the moment 37.1
  landed — and its audit-scope note gains round 37.3's third instance.

**Verification (2026-08-04)**: typecheck, lint, **2675 Node tests**, 102
module tests, **172 browser specs** (97 `webgpu` + 75 `visual`)
against a hand-rebuilt bundle with goldens byte-stable and parity scenes
at their recorded values, `test:types` and `test:types:surface` clean (37
type exports, 3 statics, 1097 doc blocks), JSDoc coverage 100%/100%,
`@throws` **17/17**, `@param` **230/230**, `@returns` **277/277**,
stranded blocks **1** (the module header, by judgement), and the
now-gating `gpu-throw-coverage` green at **176 run / 10 browser-only /
5 unreachable / 0 Node-reachable dead**.

The two new gates were each run once in the failing direction, which is
the only way to know a gate is a gate: a deleted `@returns` fails both
of its checks, a staged dead throw site exits 1, a stale allowlist entry
and a reasonless one each fail, and a valid key in place of an
`@ts-expect-error` fails the typecheck as an unused directive.
**Round 37 is complete.**

**Risks tracked**: `npm test` now runs the root Node suite twice (once
plainly, once under coverage for the throw gate), which is the cost of
measuring a suite's coverage from outside it — worth watching if CI wall
time becomes a complaint, and cheap to split into a separate job.  The
throw gate's zero tolerance sits on top of allowlists whose staleness the
gate now checks but whose *judgement* it cannot: an entry that is
honestly wrong ("no caller can reach this" when one can) reads exactly
like one that is right, which is why each carries prose rather than a
flag.

And `roundrectangle` is the round's one behaviour change — a v3
stylesheet using it now throws where it silently worked, which is the
intended failure but is the sort of thing a migration guide has to carry
(round 47).
