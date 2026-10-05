## Details

For each element, the body (an axis-aligned box) is tested first; if it doesn't intersect, the element's main label polygon is tested as a fallback, so a rotated label is tested by its actual polygon rather than an axis-aligned box. An element matches if either its body or its main label intersects the given polygon.

Unlike [`eles.hit()`](#eles.hit) and [`eles.withinBox()`](#eles.withinBox), this function does not go through the renderer, so it also matches non-interactive elements.

Because the body test uses the element's axis-aligned bounding box, a diagonal edge can match a polygon that only overlaps an empty corner of that box, not the line itself.
