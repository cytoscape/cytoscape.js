## The debug harness

Inserted ahead of the release sequence at the maintainer's request, which is
why rounds 43–50 renumbered to 44–51.  `debug/` is v4's only manual harness —
the page `npm run watch` opens, and what anyone forms a first impression from —
and it was both broken and misleading.

**What scoping found**, none of which any test could see, because `debug/` had
no coverage of any kind:

1. **Four of the seven networks 404'd.**  `debug/networks.js` pointed at
   `../webgl/*.json`, which resolved to `debug/webgl/` until round 42 moved the
   v3 tree to `v3/`.  The fetch rejected with no `.catch`, so the page rendered
   *nothing* and said nothing.  This is a regression **round 42 introduced**:
   its asset check read HTML `src`/`href` attributes, and these URLs are
   fetched from JS.
2. **`sanitizeStyle` threw the styling away** — a 14-property whitelist, every
   `mapData(...)` dropped, every `[attr = …]` block dropped, and it looked for
   `label` while all four Cytoscape-desktop exports spell it `content`.  Its
   comment still justified the drop in terms of "fn styles", removed in round 8.
   The visible result: every fixture rendered as flat monochrome discs, so the
   harness read as "v4 can't style" while v4 has ~120 node props and a mapper DSL.
3. **Labels defaulted off**, and turning them on *replaced* the sheet's mapping
   with `data(id)` — UUIDs on em-web, numeric SUIDs on the NDEx sets.
4. **No layout, view, toggles, selection, events or add/remove controls.**

- [x] **43.1 The breakage.**  Fixtures re-pointed at `../v3/debug/webgl/…`
  (69 MB already tracked under `v3/`; a copy would double the repo's weight, and
  a v4 harness reading a v3 asset is what `benchmark/graph.mjs` and
  `playwright-page/parity.html` already do).  The fetch gained a `.catch` that
  writes the failure — and the reason — into the stats overlay.  `?layout` and
  `?seed` joined `paramDefs` as **live** params, so a control change stops
  silently wiping them.  The overlay reads the public `cy.renderer()` rather
  than `cy._renderer`, and reports the three stats it was ignoring
  (`mapperUploadedBytes`, `mapperDispatches`, the label shaping-memo hit rate).
- [x] **43.2 `ndex-x-large`, re-slimmed.**  The previous slim kept
  `id`/`source`/`target`/`position` only, which left the biggest fixture
  unlabellable *and* unstylable.

  Re-derived from the 250 MB original by
  `debug/slim-ndex.mjs` (committed, so the provenance is re-runnable), now
  carrying node `name` (gene symbols) and `Node_Type` (`'TF'` on 6052 of 19607)
  and edge `Mechanism_of_Action` (−1..1).
  **One edge channel, not two**, and the reason is worth recording: at 465k
  edges the *key name* is the cost, so `Likelihood` would have added ~11 MB for
  a width mapper — and width is a geometry channel, CPU-evaluated by design,
  so it would have shown less for more bytes.  `Mechanism_of_Action` drives a
  diverging **paint** mapper, which is what the GPU eval kernel actually
  demonstrates at this scale.  Edge `id`s are dropped (v4 assigns one), which
  pays for about half the increase: 28.6 → 34.1 MB.
- [x] **43.3 Hand-authored styles.**  `sanitizeStyle` is deleted, not improved:
  the maintainer's call was that the interesting thing is what a v4 sheet looks
  like, not what survives a translation.  `debug/styles.js` carries one native
  sheet per fixture plus a `plain` sheet (the pre-round-43 look, kept for when
  you are debugging the *renderer* and want nothing to blame but geometry).
  The headline is **em-web: the real enrichmentmap.org style**, ported from the
  web app's `network-style.js` — whose v3 form is embedded in the fixture, so
  the two can be read side by side.

  Its node colour is a memoized per-element
  function over a chroma scale there and a declarative `diverging` mapper here,
  which is the clearest single argument for why v4 removed style functions.
  Two of its properties **cannot** be reproduced, both by decided design, and
  both recorded in the file: `z-index` (dropped 2026-08-01 — draw order is
  structural) and `node:selected` restyling (no selector blocks; the accent is
  shader-drawn).
- [x] **43.4 Two real compound networks.**  `compound-fixture` ports v3's
  hand-built graph (`v3/debug/compound.js`) verbatim — three levels of nesting,
  a self-loop on a parent, parent↔descendant edges, one very long label, awkward
  on purpose.  `em-web-clustered` materialises EnrichmentMap's own
  `mcode_cluster_id` into compound parents: **41 clusters over 354 of 569
  nodes**, a real compound structure sitting in real data rather than a
  synthesised one.
- [x] **43.5 The v3 page's controls, carried over.**  View (fit / fit-selected /
  center-selected / reset / zoom / panBy, the animated `fit`/`center`/`panBy`
  targets v3's page never demos, the rendered-bounding-box overlay, mount and
  unmount), layout (all seven built-ins plus the spiral extension-contract
  example, with v3's `layoutstart`/`layoutstop` timing readout), the core
  toggles (v3's seven plus box selection, `selectionType`, the zoom range,
  wheel sensitivity, and the v4-only `boxSelectionMode` and
  `boxSelectionIncludesLabels`), v3's data-driven `button.toggler` pattern
  (dispatch on the button's own text) extended with select/show/hide/remove,
  add/remove with its `ms` readout plus a `compact()` button, and a **query
  panel** where v3 has a selector box — because that is the replacement, and a
  selector string would throw.

  The events section is the one deliberate departure: v3 pops a 3-second toast
  that the next event overwrites, so a *sequence* — the only interesting thing
  about the drag or tap families — can never be seen.  This is a scrolling,
  filterable, pausable log instead, with the per-frame families off by default
  and one delegated listener showing the **predicate** form.
- [x] **43.6 Production-like defaults.**  Labels on; the checkbox is now a plain
  on/off over whatever the sheet declares rather than a replacement for it.
- [x] **43.7 The active-bg indicator follows the drag.**  `showActiveBg` was
  called from exactly one site — `onPointerDown` — so the circle was positioned
  once, in screen space, and nothing moved it again.  Fixed **v3's way**: the
  press point is stored in *model* space and re-projected per move, because the
  graph moves under a background pan and a model-anchored circle therefore
  stays glued to the point pressed.
  Worth being precise about what that buys, since the two implementations are
  observationally equivalent in the common case: during a pan the graph delta
  equals the cursor delta, so re-placing at the cursor would look identical.

  They differ only when the press stays in `pan` mode while nothing pans, which
  takes **both** `userPanningEnabled: false` *and* `boxSelectionEnabled: false`
  (with box selection on, a background drag with panning off becomes a box
  gesture and shows no indicator at all).  A spec pins each half; the first was
  run with the reposition removed and fails, the second passes either way,
  which is itself the honest reading.
- [x] **43.8 The harness gets tested.**  `test/modules/debug-harness.mjs` loads
  the harness's browser globals as scripts and asserts the two things a headless
  process can: every fixture a network names **exists at the path the page will
  ask for**, and every sheet **compiles against that fixture's real data**
  through the real entry point.  It found a bug on its first run — `range:
  'category10'` for 30 MCL clusters throws ("scheme has only 10 entries; 30
  needed"), because v4 will not silently recycle a categorical palette — which
  is exactly the class of drift that made the page flat in the first place.
- [x] **43.9 Docs, and a sweep that found round 42's leftovers.**  This
  record, the renumbering, and a pass over all four documents.

  Two leftovers of the 42.6 rename: auto-generated element ids read
  `'gpu-' + n` (`Core#_newId`), which `ele.id()` returns — now `'cy-'`, and no
  spec asserted it — and the round-42 note under the directory layout still
  listed `gpu-types` among the names that deliberately keep the prefix, which
  42.6 had renamed to `public-types.mts` for exactly the opposite reason.
  One leftover of the *round-42 split*: the root's `test:build` script was
  copied across whole, but `TEST_BUILD` is read by `v3/src/test.mjs` and by
  nothing in v4 — so the script silently re-ran the ordinary Node suite while
  `AGENTS.md` claimed it "exercises the built bundle".

  Removed, and the claim
  replaced with what actually does (the Playwright projects and
  `benchmark/style-bundle.mjs`).
  **And a method worth keeping**: round 42's sweep worked from a hand-written
  substitution list, so it fixed every spelling it thought of and missed the
  ones it did not — `typescript/tests/gpu.test-d.ts` and
  `test/modules/gpu-import-graph.mjs` in `src/README.md`, three pointers at v3
  sources that had moved under `v3/`, and a line-wrapped `dist/cytoscape-gpu.d.ts`.
  Extracting every rooted path from the markdown and testing it with
  `existsSync` found all of them at once.  That check is now a rule in
  `AGENTS.md`; it is the only one that catches a spelling nobody anticipated.

**Verification (2026-08-04)**: typecheck, lint, **1998 Node tests**, **90 module
tests** (71 + 19 new), the throw gate at **177 run / 10 browser-only / 5
unreachable / 0 Node-reachable dead** over 192 sites, JSDoc 100%/100% with
`@throws` 18/18, `@param` 231/231 and `@returns` 278/278, the declaration at 42
type exports / 3 statics / **1148** doc blocks (one more than round 42: the new
`Core#_newId` comment, which ships because TypeScript emits private members into
the declaration), and **176 browser specs** (101 `renderer` + 75 `visual`) with
**goldens byte-stable** and the parity scenes at their recorded values — this
round moves no pixel in any scene they cover.
The new active-bg spec was run once with the fix removed and fails.
**And the check that would have caught round 42's breakage**: every one of the
nine networks was driven in a real browser and asserted to render — em-web at
569 nodes labelled "PKR-mediated signaling", ndex-x-large at 19607 nodes /
464657 edges labelled "TULP3", and so on through the list.

**Risks tracked**: the harness now reads fixtures from `v3/debug/webgl/`, so the
root module suite depends on the v3 tree being present — true in this repo by
construction, but it is a coupling that did not exist before, and it is why the
spec checks the *path* rather than trusting it.  The `ndex-x-large` fixture grew
5.5 MB.  And `debug/styles.js` is hand-authored against a style surface that
keeps growing: the module spec proves the sheets *compile*, not that they still
look right, so a property that changes meaning rather than disappearing will not
be caught by anything but opening the page.
