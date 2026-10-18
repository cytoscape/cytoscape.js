## Details

For each element, the body (an axis-aligned box) is tested first; if it doesn't intersect, each of the element's labels is tested as a fallback (main label for nodes and edges, plus source/target labels for edges), so a rotated label is tested by its actual polygon rather than an axis-aligned box. An element matches if either its body or any of its labels intersects the given polygon.

This function uses the [Separating Axis Theorem](https://en.wikipedia.org/wiki/Hyperplane_separation_theorem), which is only valid for convex polygons. Passing a concave polygon can produce false-positive matches.

Unlike [`eles.hit()`](#eles.hit) and [`eles.withinBox()`](#eles.withinBox), this function does not go through the renderer, so it also matches non-interactive elements.

Because the body test uses the element's axis-aligned bounding box, a diagonal edge can match a polygon that only overlaps an empty corner of that box, not the line itself.
