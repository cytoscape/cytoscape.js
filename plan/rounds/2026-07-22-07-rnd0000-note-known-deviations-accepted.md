## Known deviations, accepted

- Element/core listener firing order is registration order *within a bubbling phase* (compound bubbling landed round 14.5 with v3's cross-phase order).
- No z-index; compound parent bodies (round 14.9, depth order) under edges under leaf nodes under labels; within a stream, slot order (reused slots draw at the recycled position).
- Float32 position precision (~7 significant digits).
- Pan-vs-grab uses the ≤2-frame-stale resolved pick.
- `cy.elements()` returns nodes then edges, not mixed insertion order.
- Labels: nodes only, single-line, fixed below-node placement, not pickable, fixed-size atlas, color/text baked per glyph run.  (Since superseded: edge labels + label visuals landed in round 10; edge-label autorotate 2026-07-29.)
- `data()`, arrows, compounds, bezier, non-grid layouts: all since landed (animations round 9; circle/concentric/breadthfirst/random layouts round 10; the full curved-edge families rounds 12a–12c; **compound nodes round 14**; GPU layouts stay logged).
