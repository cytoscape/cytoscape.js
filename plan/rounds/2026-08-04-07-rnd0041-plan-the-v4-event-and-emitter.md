## The v4 Event and emitter

Prerequisite for round 42: v4's one remaining shared-module dependency
on v3 is `src/emitter.mts` (and the shared `Event` object with it).

**Landed 2026-08-04, except one item that turned into a call.**  Two of
this plan's premises were wrong, and both were wrong in the same way —
they stated a fact about the code that nobody had measured:

- **"v4's *one* remaining shared-module dependency"** is five: after the
  emitter and event object were severed, `src` still imports
  `src/math.mjs`, `src/types.mjs`, `src/util/colors.mjs`,
  `src/util/position.mjs` and `src/util/sort.mjs`.  They are a different
  kind of dependency — generic utilities, no v3 model or renderer types
  in their signatures — so the restructure may keep them shared rather
  than duplicate them, but that is round 42's call and it now has the
  list.  `test/modules/import-graph.mjs` is the audit, with the five
  as a maintained allowlist on 37.1's terms: a new edge fails, and so
  does an entry nothing imports any more.
- **`preventDefault()` could not be enumerated from v3** — see open call
  12.  v3 never reads `isDefaultPrevented` either, so there is nothing
  to port and the list is a v4 contract to design.  The DOM half of the
  item landed (below); the gesture half is logged.

- [x] **41.1 The v4 Event** (2026-08-04) — `src/event.mts`.  Typed
  `target` (the core or a one-element collection, so a handler narrows
  with a type guard instead of a cast — 26.5's logged item closes and
  the compile-only consumer test lost its `as`), `originalEvent`,
  `layout`, the derived `renderedPosition`, and **no `namespace` field**.
- [x] **41.2 The v4 emitter** (2026-08-04) — `src/emitter.mts`, the
  same qualified-listener model with v3's namespace parsing, `bubble`/
  `parent` recursion, `manualCallback` and function-in-qualifier-position
  shorthand all gone (v4 used none of them).  Kept deliberately, because
  behaviour depends on each: the listener snapshot at emit time, the
  copy-on-`off`-during-emit, `one` removing before the callback runs, and
  a handler returning `false` meaning `stopPropagation()`.
  One recorded difference from v3, and it is a fix: v3 snapshots the
  listener list once per `emit()` *call*, so in `emit( 'a b' )` a handler
  for `a` that calls `off( 'b' )` does not stop `b` firing.  v4 snapshots
  per event.

  **The swap is behaviour-neutral by measurement**: the whole Node suite
  passed unchanged except one spec — the namespace one round 37.4 had
  just written to pin v3's semantics, which is the single behaviour this
  round intends to change.  It is rewritten to assert the new contract
  (a dotted name is one literal type), so the removal is pinned rather
  than merely done.
- [x] **41.3 The import-graph audit** (2026-08-04) — above; five specs,
  controlled by adding an outward import and watching it fail.
- [x] **41.4 `originalEvent`, populated** (2026-08-04) — the pointer
  layer attaches the DOM event it is handling to everything it emits.
  Set in the one `listen()` wrapper rather than at ~25 emit sites, so
  the two cannot drift; cleared in a `finally`, which is what keeps it
  honest — an emit from a *timer* (taphold, onetap) has no DOM event
  behind it and reports none rather than the last one seen.  A `webgpu`
  spec asserts the DOM event's own coordinates reach the handler (so it
  is *this* event, not a retained earlier one) and that
  `preventDefault()` sets `defaultPrevented` on it; the control pins
  `domEvent` to null and the spec fails.
- [ ] **41.5 Functional `preventDefault()` for gesture defaults** — not
  built; the enumeration is open call 12.  *Direction set at the sixth
  sitting (2026-08-06): explicit gesture toggles come first and no
  default may be preventDefault-only — see item 12; the enumeration
  lands at this item's own docs-first stage.*
- [x] **41.6 Docs + declarations** (2026-08-04) — `Event`,
  `EventProps`, `EventTarget` and `EventHandler` are exported from
  the entry point, so a consumer can type a handler; `dist/
  cytoscape.d.ts` regenerated (42 type exports, 1147 doc blocks).
  Both documents carry the removal, including the two JSDoc paragraphs
  round 37.4 had *just* written to describe the old behaviour — a
  reminder that a docs fix has a shelf life when the code is about to
  move under it.

**Verification (2026-08-04)**: typecheck, lint, **2696 Node tests**, 107
module tests, **174 browser specs** (99 `webgpu` + 75 `visual`)
against a hand-rebuilt bundle with goldens byte-stable and parity scenes
at their recorded values, `test:types` clean, `test:types:surface` at 42 type
exports / 3 statics / 1147 doc blocks, JSDoc 100%/100%, `@throws` 18/18,
`@param` 231/231, `@returns` 278/278, and the throw gate green at 0
Node-reachable dead over 192 sites.

Controls: the import audit run with an outward import added (fails), the
`originalEvent` spec run with `domEvent` pinned to null (fails), and the
emitter swap itself measured against the whole suite — which is the
strongest of the three, since a behaviour-neutral claim is exactly what a
2696-test suite can check.
**Round 41 is complete except 41.5**, which is open call 12.

**Risks tracked**: the emitter is new code on the hottest shared path in
the library, and "the suite passes" is evidence rather than proof — the
snapshot/`one`/`off`-during-emit semantics are the fiddly part and are
carried by existing specs rather than new ones written for them.  The
per-event listener snapshot is a deliberate divergence from v3 in an
edge case nobody has asked about, so it could equally be a surprise.  And
`originalEvent` now retains a DOM event for the life of any event object a
handler keeps — harmless for the pointer events it comes from, but worth
remembering if an app stores events.

- **A v4 Event class**: typed `target` (core/collection), `cy`,
  positions; **no namespace fields or parsing anywhere**;
  `originalEvent` populated by the pointer layer (the DOM event
  reaches handlers at last); **`preventDefault()` functional** —
  docs-first enumerates the preventable gesture defaults from
  v3-source reading (candidates: tap-selection/-clear, grab
  initiation, box start, cxt menu suppression is already
  unconditional) and each preventable default gains a spec proving
  both directions.
- **A v4 emitter** replacing the `src/emitter.mts` import — the same
  ref/predicate-qualified listener model the core already uses, with
  the namespace machinery gone.  Note what round 37.4 measured: it is
  **live, not unexercised** — v4 emits only unqualified names, but a
  hand-emitted `'tap.ns'` runs the qualified listener and the plain one
  exactly as in v3, and `off('tap.ns')` removes it.  So this is a
  behaviour removal with existing specs to update (in
  `test/decided-drops.mjs`), not a dead-code deletion.  An
  audit pass confirms no other `src` import reaches outside
  `src` (the restructure's precondition, asserted by a spec that
  walks the import graph).
- Ships in `dist/cytoscape.d.ts`: `event.target: unknown`
  resolved, the compile-only consumer test extended (handlers narrow
  no more).  26.5's logged item closes.
- Bubbling, phase order, `stopPropagation`, and the round-14.5 specs
  carry over byte-for-byte — the event *semantics* do not change,
  only the object and its module.
