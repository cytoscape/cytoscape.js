## Details

While the control points may be specified relatively in the CSS, this function returns the absolute model positions of the control points. The points are specified in the order of source-to-target direction.

This function works for bundled beziers, but it is not applicable to the middle, straight-line edge in the bundle.

The number of returned points for each curve style is as follows:

- `curve-style: bezier` (simple edge) : 1 point for a single quadratic bezier
- `curve-style: bezier` (loop) : 2 points for two quadratic beziers
- `curve-style: unbundled-bezier` : n points for n quadratic beziers, as the number of control points is defined by `control-point-distances` and `control-point-weights`