## Details

Each bezier edge consists of one or more quadratic bezier curves.

A [quadratic bezier curve](https://en.wikipedia.org/wiki/B%C3%A9zier_curve#Quadratic_B%C3%A9zier_curves) is specified by three points.  Those points include the start point (P0), the centre control point (P1), and the end point (P2).  Traditionally, all three points are called "control points", but only the centre control point (P1) is referred to as the "control point" within this documentation for brevity and clarity.  This function returns the centre control point, as other points are available by functions like `edge.targetEndpoint()`.

The number of returned points for each curve style is as follows:

- `curve-style: bezier` (simple edge) : 1 point for a single quadratic bezier
- `curve-style: bezier` (loop) : 2 points for two quadratic beziers
- `curve-style: unbundled-bezier` : n points for n quadratic beziers, as the number of control points is defined by [`control-point-distances` and `control-point-weights`](#style/unbundled-bezier-edges)

Notes:

- While the control points may be specified relatively in the CSS, this function returns the absolute [model positions](#notation/position) of the control points. The points are specified in the order of source-to-target direction.
- This function works for bundled beziers, but it is not applicable to the middle, straight-line edge in the bundle.
- For an unbundled bezier edge, the point that joins two successive bezier curves in the series is given by the midpoint (mean) of the two control points.  That join point specifies P2 for the first bezier, and it specifies P0 for the second bezier.