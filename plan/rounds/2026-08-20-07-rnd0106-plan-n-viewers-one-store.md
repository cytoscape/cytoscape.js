## N viewers, one store

Verified premise: the dirty tracker is documented and built
single-consumer — "there is exactly one consumer (the renderer's
frame)" (`src/store/dirty.mts` ~:95), a drain returns the spans
and resets them, and a second reader would see nothing.  One
renderer, one viewport, one container is assumed from
`src/index.mts` wiring on down.  Meanwhile three planned
consumers want a second reader: the navigator/minimap of item
50's port tier, round 47's devtools overlay (which wants to
*observe* without disturbing), and any linked-view comparison
UI.  This round builds the seam they all share, then proves it
with the smallest real second view.

Scope, deliberately layered:

1. **Consumer cursors in `DirtyTracker`.**  Registered
   consumers; spans retire when the *last* registrant drains;
   the resized flag per consumer.  The hard requirement is that
   the one-consumer case stays allocation- and cost-identical —
   this tracker sits under every mutation, so the change ships
   with a before/after benchmark row and the contract's
   co-signed comment updated first (`src/contract.mts` rule).
2. **The view split, named.**  Inventory of what is actually
   view state versus model state: pan/zoom live in core's
   viewport today (`src/viewport.mts`, core-owned), the canvas
   and container in the renderer, hover/gesture state in
   interact.  Multi-view forces "viewport is per-view" — which
   is a public-API semantics question (viewport events, `fit`,
   `extent` — whose viewport?), and the inventory is the
   design input, not the design.
3. **A second view, minimal.**  Renderer + viewport, read-only
   (no interact tier), driven correct-first (full re-upload is
   acceptable for the spike) — the minimap shape.  Its existence
   is the proof the seam works; its performance is follow-up.

The design fork the maintainer decides: a **view** as a light
handle (`cy.addView( container, opts )` → renderer + viewport +
optional interact, sharing store, style, and the element API of
the one core) versus views as sibling core facades over a shared
store (uniform API per view, but events, batching and destroy
semantics multiply).  The handle is recommended — it matches
"one graph, several windows", keeps the public surface small,
and the sibling-facade shape can be built on top later if an app
proves the need.

Measurements first: the single-consumer inventory (every drain
site, every `container`/`canvas` owner, every core field that is
secretly view state — a grep-and-read pass with the list as the
deliverable); the tracker change's cost at one consumer (must be
zero within noise); the spike's frame cost at two views on
ndex-x-large.

Controls: a two-consumer spec where each drains at a different
cadence and both converge to the same column state (the
round-46.5 columns-equal method); the one-consumer perf row as a
regression gate; destroy-order specs (view destroyed before
core, core before view — both defined, neither leaking; the
soak tier's isolation suite is the home).

Risks: per-view style divergence (a minimap wants simplified
style) is explicitly **out** of this round — one sheet, N
viewports; a per-view LOD override knob is the most that sneaks
in, and only if free.  Interaction ownership stays with the
primary view in this round.

**Open (maintainer):** the fork above; viewport event semantics
(namespaced per view versus event carries a view ref — the
round-41 event model has opinions); whether the devtools
overlay's read-only observer is the same registration or a
cheaper tap; whether `png()`/export binds to a view (it should —
it already renders through a viewport).

