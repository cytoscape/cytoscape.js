## Design sitting (2026-08-14, tenth) — the idea backlog swept into a shortlist

Three research sweeps ran before this sitting: the repo's own record
(this file's ledger and follow-up notes, `src/README.md`'s hooks),
the GitHub tracker (open **and** closed — the tracker is aggressively
triaged at 15 open issues, so demand signal lives almost entirely in
closed ones), and the ecosystem (Cytoscape Web, EnrichmentMap web,
GeneMANIA, Cytoscape desktop parity, the comparison literature).  The
finding that organises everything else: **the strongest demand signal
is what the ecosystem apps had to build around the library.**
Cytoscape Web ships three layout engines, two export extensions, a
layered-canvas annotation renderer and a full CX2 visual-style
conversion layer; EnrichmentMap web ships five extensions (fcose,
layers, bubblesets, automove, pdf-export).  Each of those is a
candidate feature with a guaranteed first consumer.

Checked against source before listing, because several perennial
tracker asks turn out to be *done* in v4 already: combined
pan+zoom/fit viewport animation in one `animate()` (#2966 — the
viewport channel in `AnimateOptions`), source/target edge labels
(#382), and of course the GPU tier itself.  Declined territory was
not re-proposed (round 40's warning policy, 41.5's preventDefault,
z-index, classes, selector strings, style functions).

**The shortlist — fifteen items kept by the maintainer:**

- **SVG vector export** — #639 (2014, the most-demanded export
  feature ever filed); both flagship apps bolt on third-party
  svg/pdf extensions for publication figures.  v4 computes all
  geometry CPU-side (routing, arrows, labels), so this is a
  serializer, not a second renderer.
- **Official JSON schemas** for elements/styles/layouts — #3487.
- **Headless Node image generation** (obsolete cytosnap) — #2561,
  #954; research-gated (Dawn-in-Node vs SVG-in-headless).
- **Annotations layer** — model-space text/shapes/images, z-ordered
  with the graph; the desktop-parity item with the longest paper
  trail (Cytoscape Web renders desktop annotations read-only via a
  layered canvas today).
- **More node chart kinds** — ring/bar/heat-strip, high slice
  counts, on the round-23 surface (whose record already says
  "consider other charts"); EnrichmentMap's core visual.
- **Cluster hulls/bubble sets + expand-collapse aggregation** — the
  AutoAnnotate/EM idiom plus issue #3486's own "cluster or component
  proxies" LOD plan.
- **GPU edge bundling** — #2332; desktop parity; headline
  large-graph visual.
- **WebGL fallback renderer** — ledger 18b, scheduled below as a
  scoping round first.
- **Worker-pool CPU executor** — ledger 29, measure-first gate as
  written there.
- **Algorithm perf follow-ups** — scheduled as round 72, plan below.
- **Worker/OffscreenCanvas-hosted renderer** — #1350/#2799; frees
  the main thread entirely.
- **DX polish bundle** — container auto-resize (#2401), font-load
  re-raster (#3408 + the round-9.7 logged follow-up), iterable
  collections (`Symbol.iterator`, verified absent), a public
  elements-at-position API (#1209 — `pickNodeAt` and the GPU pick
  exist, unexposed), wheel/gesture tuning toggles (#1905 family —
  explicit toggles are the sanctioned mechanism; 41.5 declined
  preventDefault, not toggles), viewport counts (#2283).
- **Small style wins bundle** — gradients (#2091/#3407),
  zoom-invariant screen-space sizing (#789), `text-border-style`
  (the one recorded not-yet style gap), and the ledger-23
  arrow-precision/17th-arrowhead decision.
- **Attribute-table / filter affordances** — columnar column views
  plus fast predicate/degree/topology filters, feeding table UIs
  (Cytoscape Web's TableModel/TableBrowser/FilterModel; desktop
  filters parity).  The columnar store is uniquely positioned here.
- **Layouts** — radial tree (#2493), constraints on the force layout
  (absorbs fcose's main draw — fcose #54/#53), edge-length control
  (#1514), per-side compound padding (the logged hook).

**Not shortlisted:** CX2 import/export with visual styles (the
research's top cross-source candidate, set aside by the maintainer at
this sitting), multilevel force refinement (stays a logged
direction), file splitting (ledger 26, stays a direction).

**Two sequencing decisions, made at the sitting:**

1. **The WebGL fallback's pre/post-4.0.0 positioning is decided
   after a scoping round, not now.**  It is the one shortlist item
   that changes what 4.0 *is* — WebGPU-only at launch versus reach
   on Firefox stable and weak GPUs — and the call gets made with
   data on what WebGL2 can and cannot carry of the v4 contract
   (instancing paths for the pipelines, compute-culling and picking
   substitutes, the SDF label pipeline).  The scoping round produces
   a written feasibility record, not code.
2. **Round 72 (algorithm perf follow-ups) runs first** — a natural
   continuation of rounds 65/69/70 while their context is fresh,
   with every input already logged as a follow-up.
