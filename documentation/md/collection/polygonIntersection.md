## Details

For each element, the body is tested first; if it doesn't intersect, each of the element's labels is tested as a fallback (main label for nodes and edges, plus source/target labels for edges), so a rotated label is tested by its actual polygon rather than an axis-aligned box. An element matches if either its body or any of its labels intersects the given polygon.

A node's body is tested as an axis-aligned box. An edge's body is tested as the straight-line segments between its rendered points (including intermediate points for curves), so the test follows the edge's actual path rather than its bounding box.

This function uses the [Separating Axis Theorem](https://en.wikipedia.org/wiki/Hyperplane_separation_theorem) for body/label polygon tests, which is only valid for convex polygons. Passing a concave polygon can produce false-positive matches.

Unlike [`eles.hit()`](#eles.hit) and [`eles.withinBox()`](#eles.withinBox), this function does not go through the renderer, so it also matches non-interactive elements.

Because a node's body test uses its axis-aligned bounding box, a node can match a polygon that only overlaps an empty corner of that box, not its actual shape.
