## Round 90 — API review and cleanup, landed (2026-08-24)

The parity pass audited, ruled on (the 2026-08-24 rulings above), and
landed the same day.  The public tier went **460 → 355 members**
(`dist/cytoscape.d.ts` 9,695 → 8,387 lines), with every removal and
demotion recorded in MIGRATING/CHANGELOG and the gates re-tallied
(`@param` 205/205, `@returns` 254/254 — the ratchet *moved down* with
the surface, which a demotion does by design — `@throws` 17/17, both
tiers at 100%).

**90.0 — the `@internal` mechanism.**  One tag, three consumers, each
with a fixture spec and a control (`test/modules/internal-tag.mjs`):
the scanner (`INTERNAL_RE`; member-grained tier move in `audit()`, the
three tag gates stop at the boundary), the docs generator (tagged
members and constructors no longer publish), and the d.ts build — where
implementation found the mechanism half-shipped already:
`tsconfig.dts.json` has carried `stripInternal: true` since the dts
build existed, and **oxc strips a tagged declaration itself**.  The
`stripInternal()` post-pass in `scripts/build-dts.mjs` stays as the
belt-and-braces layer.  Two findings for the next tagger, both pinned:
oxc honors the tag **only as a standalone doc-comment tag line** — an
inline `— @internal` suffix is invisible to it while this repo's
scanner matched it, exactly the tool-divergence the spec now checks by
source location — and a tag can cascade: stripping the last reference
to a class tree-shakes the class out of the declaration (how
`Animation` left, correctly; and why `Viewport` could not — see 90.2).

**90.1 — the seven ruled members.**  `forceRender`,
`onRender`/`offRender`, `mutableElements` removed; `instanceString`
(×3), the silent position family and `renderer()` (both owners)
demoted; **`cy.stats()`** added (`RendererStats | null`) as the public
frame-stats snapshot, and `debug/init.js`'s overlay moved to it.  The
round-31-class defect found in planning — `animation.mts`'s `step`
rejection advising `onRender` by name — fixed with the member, and the
close's dead-name sweep over `src/` runtime strings and doc comments
reads clean.

**90.2 — the machinery classes.**  `StyleEngine`: 23 members tagged,
the consumer handful (`setSheet`, `json`, `update`, `setBypass`/
`removeBypass`/`hasBypasses`) stays.  The animation tier's demotion
went further than planned, truthfully: a consumer holds the
`AnimationHandle` interface — `cy.animation()`/`eles.animation()`
return it — and never the `Animation` class, so the *whole class* is
machinery; with every member tagged, `Animation` and
`AnimationHandleImpl` left the declaration entirely, the docs `ani`
namespace now reads from `AnimationHandleImpl` (shipping as the
interface — `DTS_NAMES` maps the spelling for the cross-check), and
`Animation` joined `NOT_PUBLISHED` with its reason.  `Viewport` left
`PUBLIC_API` and ships as an opaque shell — the class name must remain
because `Core._viewport` is a value-import rolldown cannot drop, so
every *member* is tagged instead, and Core's `zoom`/`extent`/
`renderedExtent` signatures moved off `Viewport['…']`-derived types
onto the exported `ZoomOptions`/`Extent` so the demotion cannot
re-couple them.

**90.3 — the delegated table.**  Kept public, each carrying a
"Public in v4 by decision (round 90)" doc note: `zoomRange`,
`multiClickDebounceTime`, `isReady`, `headless`, `styleEnabled`,
`hasCompoundNodes`, `hasElementWithId` (both owners), `window`,
`options`, `indexOf`/`indexOfId`, `takesUpSpace`, `interactive`,
`padding`, `paddedWidth`/`paddedHeight`, `show`/`hide`.  Demoted:
`batching`, `getFitViewport`/`getCenterPan`, `element`, `byGroup`,
`isBundledBezier`, `inactive`/`activate`/`unactivate`,
`boundingBoxAt`.  Removed: `batchData`, with its spec rewritten to
pin the tombstone and the `batch()`-over-`data()` idiom.

**90.4 — the alias family.**  The ruling's one principle — Node's
`EventEmitter`, plus `pon` — kept `addListener`/`removeListener`,
removed `bind`/`unbind` and (same principle, unlisted in the audit)
`listen`/`unlisten`: declares, prototype wiring and alias-table rows
on both classes.  The plan's "once joins as an alias" was corrected by
measurement: `once` has been `one`'s declared alias all along.

**90.5 — the close.**  All four benchmark-row edits in one commit
(`surface.mjs`'s fingerprint moves once; the removed members' rows
became `pair()` rows pricing the surviving idiom against v3's helper
spelling), MIGRATING/CHANGELOG rows, the `src/README.md` sweep,
`dist/cytoscape.d.ts` regenerated through the strip, and the quiet
gates green end to end.

Left open, deliberately: the underscore-field leak — `_renderer`,
`_animations` and kin are emitted into the declaration as typed public
fields (pre-existing, out of this round's written scope; `_viewport`
is the one the Viewport work touched).  A follow-up can tag or
`private`-ify the family as one sweep.
