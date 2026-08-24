## Round 17 plan — event vocabulary + the extension contract (planned 2026-08-01)

Two permanent-API calls made in one sitting: the v4 event names, and
how extensions plug in.  Both are cheap to build once decided; both
gate ecosystem work.

**Signed-off design calls:**

1. **The curated vocabulary, plus the official pointer family.**
   Adopted with v3 semantics (each firing rule pinned against v3
   source in a red spec before implementation):
   - *Drag-state* (elements): `grab`, `grabon`, `drag`, `free`,
     `freeon`, `dragfree`, `dragfreeon` — the `-on` variants fire
     only on the directly grabbed element; the plain forms fire on
     every node the gesture moves (drag companions included);
     `dragfree`/`dragfreeon` only when the node actually moved.
   - *Device-normalized*: `tapstart`, `tapdrag`, `tapdragover`,
     `tapdragout`, `tapend` (element + core), `tapselect`/
     `tapunselect`, `cxtdragover`/`cxtdragout`.
   - *Viewport gestures* (core): `dragpan`, `scrollzoom`,
     `pinchzoom`.
   - *Pointer re-emits* (element + core): `pointerdown`,
     `pointermove`, `pointerup`, `pointercancel`, `pointerover`,
     `pointerout` — the official DOM vocabulary v4's interaction
     layer already consumes, re-emitted with graph positions and
     `originalEvent`.

   **Dropped, recorded**: the `vmouse*` aliases (the `tap*` names
   *are* the normalized vocabulary) and the raw mouse/touch re-emits
   (`mousedown`/`mousemove`/`mouseup`/`click`, `touchstart`/...) —
   `pointer*` is their one modern spelling; the existing
   `mouseover`/`mouseout` emissions stay.  `event.preventDefault()`
   stays unported (gesture defaults are gated by options/flags, not
   handlers; `originalEvent` keeps the DOM method) — recorded.  All
   new element events bubble through the round-14.5 phase machinery.

2. **Extensions are direct objects — no registry.**  No
   `cytoscape.use`, no string registration, no global state: an
   extension is an import the app passes in (tree-shakeable, typed).
   Pass 1 designs the **layout contract** only; core/collection/
   renderer extension points stay out (recorded: mappers +
   predicates cover the common cases; revisit on demand).
   - **Shape**: a layout impl implements
     `{ run(ctx): void | Promise<void>, stop?(): void }`.
     `cy.layout({ impl: Fcose, ...options })` (and
     `eles.layout({ impl, ... })`) construct and run it through the
     existing lifecycle — `layoutstart`/`layoutready`/`layoutstop`
     on the core, `promiseOn`, `stop()`, the animate/fit plumbing;
     `{ name }` keeps addressing builtins.
   - **LayoutContext (`ctx`) is columnar-first**: slot-indexed reads
     (a positions view, node iteration pre-filtered to unlocked
     leaves per the round-14 rule, CSR adjacency, per-slot degree,
     the scoped element list for subset layouts, bb/viewport
     helpers, resolved options) and one bulk write —
     `setPositions(slots, xy)` on the round-5 slot path (one dirty
     span, listener-gated events) — plus the `layoutPositions`
     finisher (spacingFactor/transform/animate/fit, v3 plumbing).
     Handles stay reachable (`ctx.eles`) at handle cost; the
     contract makes the columnar path the obvious one.
   - Layout instances stay non-emitters (v4 layout events fire on
     the core — the round-10 rule, recorded).

**Pass split** (tests-first per item; docs in-commit):

- [x] **17.0 Docs-first** — landed with the design-sitting commit
  (`0f0ee859`), before any round-17 implementation.
- [x] **17.1 Pointer re-emits + tap family** (2026-08-01) — the
  official vocabulary lands: `pointerdown` (all buttons, the cxt
  branch included), `pointermove` (every move),
  `pointerup`/`pointercancel`, and `pointerover`/`pointerout`
  riding the hover transitions beside mouseover/mouseout; plus the
  device-normalized `tapstart` (primary press), `tapdrag` (moves
  while a press is active — the raw pointermove covers unpressed
  motion) and `tapend` (release of a press, ahead of the
  tap/selection flow — v3's up → tapend → tap ordering).

  Targets
  follow the press (the grabbed/cxt element) else the hovered
  element, background to the core; touch arrives through the same
  pointer handlers by construction.  Pinned by a `webgpu`
  mouse-driver spec (hover-over/out, press-drag-release on the node
  and on the background).  2117 Node tests, 133/133 Playwright,
  typecheck + lint clean.
- [x] **17.2 Drag-state family** (2026-08-01) — `grab`/`grabon`,
  `drag`, `free`/`freeon`, `dragfree`/`dragfreeon` with v3's firing
  rules: the `-on` variants fire only on the *directly* grabbed
  element; the plain forms fire on it **and every selected
  companion** in the drag set; `drag` fires per movement on all of
  them; the dragfree pair fires only when the gesture actually
  moved; a cancelled gesture frees without dragfree.

  Pinned red
  first in a `webgpu` mouse-driver spec: exact per-name counts on a
  two-selected-node drag (companion never gets `-on`), grab → drag
  → free ordering, and a moveless press grabbing/freeing without
  drag events.  2117 Node tests, 134/134 Playwright, typecheck +
  lint clean.
- [x] **17.3 Selection + hover-during-drag** (2026-08-01) —
  `tapselect`/`tapunselect` fire on the tapped element beside its
  gesture-driven select/toggle-off (background clears and box
  selection keep their own events, as v3); `tapdragover`/
  `tapdragout` and `cxtdragover`/`cxtdragout` ride a throttled
  synchronous node pick while a press is active — **nodes only**
  (the exact CPU pick; edges would need the async GPU tile —
  recorded), state cleared silently when the gesture ends.

  Spec
  lesson kept in-file: a *panning* background drag moves the
  content with the cursor, so nothing is ever crossed — the pin
  drags across the node under the box gesture (panning disabled)
  and under a cxt drag.  2117 Node tests, 135/135 Playwright,
  typecheck + lint clean.
- [x] **17.4 Viewport gesture events** (2026-08-01) — `dragpan`
  (each applied background pan step), `scrollzoom` (each wheel zoom
  — trackpad pinches arrive as ctrl+wheel and take this path, the
  round-10 rule) and `pinchzoom` (each two-finger zoom step), all
  core-level with the gesture's model position.  Pinned in a
  `webgpu` spec (wheel, background drag-pan, and a synthetic
  two-finger pinch — each firing its own name and not the others').
  2117 Node tests, 136/136 Playwright, typecheck + lint clean.
- [x] **17.5 The layout contract** (2026-08-01) —
  `layout/contract.mts`: `cy.layout({ impl, ...opts })` (and
  `eles.layout`) runs a user class (constructed argless) or object
  implementing `{ run(ctx), stop?() }` — **no registry, no
  cytoscape.use, no global state**.  `run` may return a promise
  (the GPU-layout shape); the wrapper exposes `promise()` and
  drives the core lifecycle exactly once per run whether the impl
  uses the discrete finisher (`ctx.layoutPositions(fn)` — the full
  v3 plumbing, its layoutstart folded into the wrapper's via an
  internal flag) or the direct bulk path (`ctx.setPositions` on
  the round-5 slot path).

  The **LayoutContext is columnar-first**:
  `nodeSlots()` (scope order, pre-filtered to unlocked leaves —
  the 14.11 rule), live `positions()`/`endpoints()` views,
  O(1) `degreeOf` off CSR, `edgeSlots()`, scope bb + viewport
  dims, `ctx.options` carrying custom knobs, with handles reachable
  at `ctx.eles`/`ctx.nodes`.  Layout instances stay non-emitters
  (round-10 rule; events fire on the core with the wrapper as
  `event.layout`).

  Tests-first: 10 specs in
  `test/layout-contract.mjs` red then green — object + class
  impls, single-lifecycle finisher, async run, scoping, the
  leaf/unlocked filter, columnar reads, stop(), malformed rejects,
  and the random builtin re-expressed through the public contract
  (the conformance shape external authors can crib).  Two
  error-message pins updated for the new layout dispatch text.
  2127 Node tests, typecheck + lint clean.
- [x] **17.6 Example + true-up** (2026-08-01) — `debug`
  gained the worked example: `SpiralLayout`, a plain class run via
  `cy.layout({ impl: SpiralLayout })` with `?layout=spiral`
  (smoke-verified live in scripted Chromium: spiral positions, no
  page errors).  README gained the round-17 section (the curated
  vocabulary with its recorded drops + the direct-object contract).
  **Round 17 is complete.**  2127 Node tests, 136/136 Playwright,
  typecheck + lint clean.

**Risks tracked**: name-semantics divergence from v3 (red specs
against v3-source readings per event, before implementation); emit
volume on drag hot paths (all listener-gated; the 17.2 specs assert
the no-listener fast path stays allocation-free); contract surface
creep (pass 1 exposes only what random-via-contract and an
fcose-shaped consumer demand).
