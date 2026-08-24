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

