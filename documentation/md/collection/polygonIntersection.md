## Details

For each element, the body (an axis-aligned box) is tested first; if it doesn't intersect, the element's main label polygon is tested as a fallback (using [`eles.actualLabelBoundingBox()`](#eles.actualLabelBoundingBox), so a rotated label is tested by its actual polygon). An element matches if either its body or its main label intersects the given polygon.

Unlike [`eles.hit()`](#eles.hit) and [`eles.withinBox()`](#eles.withinBox), this function does not go through the renderer, so it also matches non-interactive elements.
