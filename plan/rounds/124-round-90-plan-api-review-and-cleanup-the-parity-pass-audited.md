## Round 90 plan — API review and cleanup: the parity pass audited (raised by the maintainer 2026-08-17)

The early rounds went aggressively for v3 parity as a first pass, and
that was the right call then — the foundation needed to exist before
it could be judged.  The bill for it is that v4's public tier now
carries members that were *private* in v3 (`instanceString`) and
members v3 itself had marked backwards-compat/deprecated
(`forceRender`, `batchData`).  This round is the audit; the findings
below are proposals, not decisions.  **The maintainer reviews and
approves every proposed amendment before any of it lands — nothing in
this round is pre-approved, including the "obvious" removals.**

**Method** (so the numbers are reproducible, not vibes): the v4
surface is the 460 public members over the ten `PUBLIC_API` files, as
enumerated by `scripts/jsdoc-coverage.mjs`'s own scanner — not a
throwaway regex, per round 33.12's rule.  The v3 documented surface
is 703 names extracted from `v3/documentation/docmaker.json`:
`fn.name` **plus every `formats[].name` and `pureAliases` entry** —
the first extraction read `fn.name` only (342 names) and falsely
flagged half of `collection.mts`, because v3 documents `cy.elements`
inside the `cy.$` entry's formats and the degree family inside
`node.degree`'s.  The v3 privacy signal is the 112 member names
carrying `/** @internal */` in `v3/src`.  Diffing: **164 of the 460
carry names absent from v3's docs, and 42 of those carry names v3
tags `@internal`.**  Caveat the tables must carry: the match is by
bare name, so a v4 member can collide with a differently-owned v3
name (two known: `LayoutContext.options` is deliberate layout-author
surface, and `StyleEngine.removeBypass` is round 63's bypass API, not
v3's element-private of the same name).

The findings, in four classes:

1. **v3-internal, now public (42 names).**  The headline cases, each
   verified in v3's source: `cy.forceRender()` (`core.mts:2001`) is
   `@internal` in v3 (`v3/src/core/renderer.mts:46`) and is exactly
   the deprecated-in-v3 shape this round exists for;
   `cy.batchData()` (`core.mts:665`) is `@internal` *and* commented
   "for backwards compatibility" (`v3/src/core/notification.mts:
   117-118, 151`) — legacy twice over; and `instanceString()` ships
   on Core (`core.mts:2593`), Collection (`collection.mts:487`) and
   Event (`event.mts:149`), was never documented in v3 (it fed
   v3's is-checks), and **has zero callers in v4** — three
   definitions, no use, pure parity baggage.  The rest of core's 18:
   `batching`, `zoomRange`, `getFitViewport`, `getCenterPan`,
   `renderer`, `onRender`/`offRender`, `multiClickDebounceTime`,
   `isReady`, `headless`, `styleEnabled`, `hasCompoundNodes`,
   `hasElementWithId`, `mutableElements`, `window`, `options`.
   Collection's 21: `renderer`, `element`, `hasElementWithId`,
   `indexOf`/`indexOfId`, `byGroup`, `silentPosition(s)`,
   `silentShift`, `takesUpSpace`, `interactive`, `padding`,
   `paddedWidth`/`paddedHeight`, `isBundledBezier`, `show`/`hide`,
   `inactive`/`activate`/`unactivate`, `boundingBoxAt`.  Not all 42
   should go: some are useful and arguably better public
   (`hasElementWithId`, `show`/`hide`, the `silent*` family), and
   some are internally load-bearing so they can demote but not
   vanish (`boundingBoxAt` is `layoutPositions`' bounds source,
   `collection.mts:5405`; `getFitViewport`/`getCenterPan` back
   `animate()`'s fit/center).  Each gets a table row with a proposed
   disposition — **remove** / **demote to internal** / **keep,
   documented as deliberate** — for the maintainer to rule on.
2. **Machinery classes riding the public tier.**  `cy.style()`
   returns the whole `StyleEngine` (`core.mts:373`), and 28 of its
   31 public members are engine surface — `readProp`/`readProps`,
   `applyAll`/`applyBulk`, `paintInputs`/`paintContext`,
   `setGpuOwned`, `transitionSink`, `refreshMapped`/`refreshState`,
   `onCompacted`, `arrowEnds`/`arrowBase`/`arrowWidthModes`… — with
   the consumer-intended handful (`setSheet`, round 63's bypass
   trio, `update`) undistinguished from the plumbing.
   `animation.mts` is the same shape: 39 non-v3 names, nearly all
   the GPU tween driver (`buildChannelWrite`, `tick`, `schedule`,
   `settleGpu`/`demoteGpu`, `repairRefs`, `gpuBatches`,
   `attachDriver`/`detachDriver`, `settleGpuAll`/`demoteGpuAll`),
   while the `Animation` handle API a consumer holds matched v3
   cleanly.  `Viewport` (`viewport.mts:39`) publishes 9 members
   that duplicate cy's viewport surface under other spellings
   (`setZoom`, `setPan`, `fitViewport`, `centerPan`,
   `modelToRendered`…), and nothing hands a consumer one —
   `cy._viewport` is private — so the class may belong in the
   internal tier outright.  The root cause is structural:
   `PUBLIC_API` is a *file* list (`scripts/jsdoc-coverage.mjs:26`),
   so the tier boundary is file-grained where the truth is
   member-grained.  The renderer calls these members cross-module,
   so TS `private` cannot mark them; the fix needs a marker the
   audits, the docs generator and the d.ts build all respect
   (`@internal` support, or the `_` prefix the scanner already
   skips) — that mechanism choice is itself a maintainer decision.
3. **Verified-deliberate v4 additions — no action, listed so the
   next reader knows they were checked**: the algorithm tier
   (rounds 65/69/70: `katzCentrality` through `motifCensus`), the
   wire/columnar surface (`serialize`, `serializeElements`/
   `deserializeElements`/`isSerializedElements`, the four columnar
   exports), `compact`/`gc` (rounds 19/39.3), `pick`,
   `elementsInBox` (in no form in v3), `boxSelectionMode` (39.1),
   `boxSelectionIncludesLabels` (16.5), the interaction tuning
   quartet (20.1), `labelBoundingBox`, the `LayoutContext`/
   `CustomLayout` extension surface (round 71's substrate), and the
   `Event` field surface (`type`, `originalEvent`, `timeStamp`,
   `preventDefault`, `stopPropagation` — v3's event shape,
   documented there in prose rather than as fns).
4. **Discussion, not caught by the diff because v3 documents them**:
   the jQuery-era listener aliases `bind`/`unbind`/
   `removeListener`/`pon` (`core.mts:1427,1520,1522,1577` and the
   Collection equivalents).  Era cruft by the same argument as
   `forceRender`, but documented v3 API — one keep-or-drop decision
   covers the family.

Mechanics once dispositions are approved: anything removed or renamed
is a breaking-surface change — `MIGRATING.md` and `CHANGELOG.md`
rows, `dist/cytoscape.d.ts` regenerated, a `src/README.md` sweep (its
introspection bullet at line ~575 names several of the class-1
members), alias-table updates where an alias dies, and the coverage
gates re-run (removals shrink the 460 and the `@param`/`@returns`/
`@throws` tallies with it).  Guarded removals (a throwing stub, if
any member gets one) join the throw gate with a spec.

**Open:** the privacy-marker mechanism (`@internal` across
scanner + docs generator + d.ts build, vs `_` renames, vs facade
splits for StyleEngine/AnimationManager — recommended: `@internal`,
it leaves call sites untouched); whether `show`/`hide` and the
`silent*` family stay public (recommended: yes, with docs saying
they deviate from v3's privacy deliberately); whether `Viewport`
leaves the public tier entirely (recommended: yes, absent a consumer
path that holds one); and the alias-family question in class 4.


### Round 90 — the rulings, and the plan restated as passes (maintainer, 2026-08-24)

The maintainer reviewed the audit and ruled on the headline items; the
round is approved to land under the structure below.  Three of the
plan's own recommendations were **overruled**, which is the audit
working as designed — the tables were proposals.  The rulings:

1. **The privacy mechanism is `@internal`** (the plan's
   recommendation, confirmed).  Member-grained, and three consumers
   must respect it, none of which do today (verified — the string
   appears nowhere in `scripts/`): the jsdoc-coverage scanner moves a
   tagged member from the public tier to the internal tier (it still
   requires a doc comment — internal means *hidden from consumers*,
   not undocumented — and the `@param`/`@returns`/`@throws` gates stop
   applying, since those exist for shipped hover text); the docs
   generator omits tagged members; and the d.ts build strips them
   from `dist/cytoscape.d.ts` (`rolldown-plugin-dts` carries doc
   blocks through, so the tag is visible in the declaration text and
   a post-pass in `scripts/build-dts.mjs` can remove block +
   declaration).  Each consumer gets a spec with a control: tag a
   member, assert it vanishes from that consumer's output; untag,
   assert it returns.
2. **The seven flagged members**, ruled member by member:
   `forceRender`, `onRender`/`offRender` and `mutableElements` are
   **removed** (`onRender` was pure sugar for `on('render', …)`;
   `mutableElements` is `elements()` by another name — v4 has no
   immutable collections, so the name describes a v3 distinction that
   no longer exists); `instanceString` (Core, Collection, Event) is
   **demoted to `@internal`** rather than removed — zero callers in
   `src/`, but a benchmark row and the decided-drops sweep call it,
   and demotion keeps them at zero migration cost (maintainer,
   amending the initial remove ruling); `silentPosition(s)` and
   `silentShift` are **demoted to `@internal`** — the plan's
   keep-public recommendation is overruled; the layout path is
   `ctx.setPositions`/`layoutPositions` and consumers should not see
   the silent family (zero `src/` callers, verified); and
   `cy.renderer()` (and `Collection.renderer()`) are **demoted to
   `@internal`**, with the stats story resolved by option (b): a new
   typed **`cy.stats()`** passthrough (`RendererStats | null`,
   null when headless) so the one documented consumer surface that
   lived behind `renderer()` survives the demotion.  The debug
   page's stats overlay moves to `cy.stats()` with it.
3. **The events API is ruled by one principle: analogous to Node's
   `EventEmitter`, plus `pon`.**  So `addListener`/`removeListener`
   stay (they are Node's own spellings), `pon` stays (the maintainer
   likes it), **`bind`/`unbind` are removed**, and
   `listen`/`unlisten` — which the plan's class-4 list did not even
   name — are removed by the same principle, being neither Node's
   spellings nor load-bearing anywhere in this repo.  One correction
   from implementation: the plan said `once` would *join* as an alias
   of `one` — measurement says it has been there all along
   (`core.mts`/`collection.mts` both declare it), so the ruling's
   Node-emitter set was already complete and nothing was added.
4. **Class 2 lands as recommended**: the `StyleEngine` machinery
   (~28 members — `readProp`/`readProps`, `applyAll`/`applyBulk`,
   `paintInputs`/`paintContext`, `setGpuOwned`, `refreshMapped`/
   `refreshState`, `onCompacted`, the arrow/opacity readers, …) is
   tagged `@internal`, keeping public the consumer handful:
   `setSheet`, `json`, `update`, and round 63's bypass surface.
   `AnimationManager`'s GPU-driver members are tagged the same way;
   the `Animation` handle a consumer holds is untouched.
   **`Viewport` leaves the public tier entirely** — nothing hands a
   consumer one (`cy._viewport` is private, `index.mts` exports
   nothing viewport-shaped) — by dropping `src/viewport.mts` from
   `PUBLIC_API` and stripping the class from the declaration.
5. **The remaining class-1 table**, delegated to the round with the
   leanings endorsed: *keep, documented as deliberate* —
   `zoomRange`, `multiClickDebounceTime`, `isReady`, `headless`,
   `styleEnabled`, `hasCompoundNodes`, `hasElementWithId` (both
   owners), `window`, `options`, `indexOf`/`indexOfId`,
   `takesUpSpace`, `interactive`, `padding`,
   `paddedWidth`/`paddedHeight`, `show`/`hide`; *demote to
   `@internal`* — `batching`, `getFitViewport`/`getCenterPan`
   (they back `animate()`'s fit/center), `element`, `byGroup`,
   `isBundledBezier`, `inactive`/`activate`/`unactivate`,
   `boundingBoxAt` (`layoutPositions`' bounds source); *remove* —
   `batchData` (`@internal` **and** "for backwards compatibility"
   in v3 — legacy twice over, and `data()` covers it).

Two insights from the pre-implementation verification, recorded so
the implementation sweeps for them:

- **`src/animation.mts:690` has a runtime error message that advises
  `onRender` by name** — the exact defect class round 31 existed for
  (an error advising a removed form), found *before* landing this
  time.  The close therefore includes a dead-name sweep over runtime
  strings and doc comments, not only over markdown.
- **`benchmark/surface.mjs` has rows calling `mutableElements` and
  the silent family** — the `mutableElements` row dies with the
  member and the silent rows survive demotion; either way the suite
  file changes, so its harness fingerprint moves, and all benchmark
  edits land batched in one commit (the round-68/72 rule).

The passes: **90.0** the `@internal` mechanism across the three
consumers, specs with controls, built first because every demotion
rides on it; **90.1** the seven ruled members (removals, demotions,
`cy.stats()`); **90.2** the machinery classes and `Viewport`;
**90.3** the remaining class-1 table as ruled above; **90.4** the
event-alias family (`bind`/`unbind`/`listen`/`unlisten` out; `once`
was already present); **90.5** the close — MIGRATING/CHANGELOG rows per removal,
`dist/cytoscape.d.ts` regenerated, the alias table and
`src/README.md` swept, the dead-name sweep, coverage gates re-tallied
(the public tier shrinks by design), quiet gates green, and
`EXECUTIVE_SUMMARY.md` rewritten from this file.

