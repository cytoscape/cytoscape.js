## Details

This function uses its own hit-testing logic, separate from the renderer's mouse/touch click handling. Nodes are tested by their shape; edges are tested by their line/curve and arrows; labels (including rotated labels) are tested by their actual polygon, not an axis-aligned box. The thresholds and edge-collision details are not guaranteed to exactly match what a real click resolves to.

The returned collection is sorted topmost first by z-order, unlike a mouse click (which only ever resolves to a single topmost element) — this gives the full ranked list of everything under the point.
