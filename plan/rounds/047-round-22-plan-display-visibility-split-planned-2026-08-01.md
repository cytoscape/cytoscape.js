## Round 22 plan — display/visibility split (planned 2026-08-01)

**Signed-off design calls:**

1. **`show()`/`hide()` stay the display tier** (structural, element
   state): no draw, no pick, no space — excluded from bb/fit and
   compound auto-bounds (already true) — and, **new**, a hidden
   `bezier`-styled bundle member leaves its bundle: siblings re-fan
   (v3's display semantics; v4 previously kept the rank, which is
   visibility semantics).  Same rule for the per-node loop stagger
   and compound-loop member index.  A hidden *node* needs no bundle
   work: every member of a pair shares both endpoints, so the whole
   bundle disappears together — recorded.
2. **`visibility` is a style prop** (`'visible' | 'hidden'`, both
   groups, default visible, constants or `case` mappers — the v4
   mechanism for per-element variation; there is no element-state
   setter).  Paint-only: an invisible element draws nothing but
   **keeps its space** — bb/fit, compound auto-bounds, layouts and
   bundle ranks all unchanged — and is not pickable, not hoverable,
   not box-selectable (`interactive()` rides `visible()`).
   Ancestor-gated for nodes (v3: descendants of an invisible parent
   are invisible); an edge is additionally invisible while either
   endpoint is (rides the kernels' existing endpoint tests).
3. **Mechanism: one derived bit, one WGSL constant.**  The style
   engine maintains `FLAG_SELF_INVISIBLE`; the store derives
   **`FLAG_DRAWN`** (= effective shown AND no invisibility on self
   or, for nodes, any ancestor) in the same subtree walk that
   maintains effective `FLAG_VISIBLE`.  The WGSL `SHOWN` constant
   redefines from `ALIVE|VISIBLE` to `ALIVE|DRAWN`, so **every**
   cull kernel, vertex shader, depth prepass and glyph/ghost/layer
   stream honors visibility with zero per-kernel edits and zero new
   bindings; CPU picking tests DRAWN; bb/fit/box-geometry scans keep
   testing VISIBLE (space semantics — invisible elements stay in).
4. **Getter semantics** (v3's): `visible()` = drawn (edges fold
   endpoints); `hidden()` its negation; `takesUpSpace()` = the
   display tier alone (shown, whatever the visibility — it may now
   differ from `visible()`); `interactive()` = `visible()` && the
   20.2 events rule.  Readback: `style('visibility')` from the flag.

**Pass split** (tests-first; docs in-commit):

- [x] **22.1 Store + prop** (2026-08-01) — FLAG_SELF_INVISIBLE +
  FLAG_DRAWN landed with the derivation folded into
  refreshEffectiveVisibility (one subtree walk maintains both bits;
  a drawn-only change skips the geo/auto-bounds invalidation —
  invisible elements keep their space), `setInvisibility` as the
  style write's entry, `isDrawn(ref)` folding edge endpoints, the
  `visibility` prop (parse/readback/case mappers, both groups) and
  the getter updates (`visible()` = drawn + endpoint fold — v3's
  edge rule, now implemented; `hidden()` its negation;
  `takesUpSpace()` = the display tier).  **Two pre-existing space
  gaps closed en route**: the whole-graph fit scan
  (`store.boundingBox`) and the collection `boundingBox()` never
  filtered display-hidden elements — both now skip unshown
  elements (and edges with unshown endpoints), v3's rule, while
  deliberately including invisible ones.  7 Node specs
  (`test/visibility-prop.mjs`, red then green) + the
  cpu-pick hidden-node spec moved onto the real hide path.
- [x] **22.2 Renderer** (2026-08-01) — the WGSL `SHOWN` constant
  flipped to ALIVE|DRAWN (one line — every cull kernel, the depth
  prepass and all glyph/ghost/layer streams honor visibility with
  zero new bindings; scene pixels for fully-visible graphs are
  untouched, pinned by the unchanged goldens) and the CPU pick
  masks the same way.  Playwright: an invisible node paints
  nothing (body + label + incident edge via the endpoint test)
  while `fit()` still frames it; a tap where it sits
  background-taps; a restyle to visible returns the pixels; and a
  display-tier `hide()` then shrinks the fit box (the
  22.1-closed gap, pinned).
- [x] **22.3 Bundle re-fan** (2026-08-01) — `CurveHost.edgeShown`
  (reads FLAG_VISIBLE — the display tier by construction),
  `onEdgeShownChanged` marking the pair/loop on hide/show (wired
  from `setVisibility`; no-op for straight-only graphs until the
  pair index exists), and derivation filters: hidden members leave
  the bundle array, the compound-relation index and the loop
  stagger, and their own params freeze until a show() re-derives.
  Visibility flips never touch the curve index, so invisible
  members keep every rank by construction.  2 Node specs (red then
  green): hiding a 3-bundle's middle re-fans the outer pair (and
  show() restores byte-exact params); an invisible middle keeps
  the 3-bundle stagger byte-identical against a reference
  instance.  2204 Node tests, 148/148 Playwright (goldens
  untouched), typecheck + lint clean.  **Round 22 is complete.**
