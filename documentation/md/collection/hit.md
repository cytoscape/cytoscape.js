## Details

This function proxies to the renderer's hit-testing logic, so the result matches what the user would click on at the same position. Nodes are tested by their shape; edges are tested by their line/curve and arrows; labels (including rotated labels) are tested by their actual polygon, not an axis-aligned box.

The returned collection is sorted topmost first by z-order, unlike a mouse click (which only ever resolves to a single topmost element) — this gives the full ranked list of everything under the point.
