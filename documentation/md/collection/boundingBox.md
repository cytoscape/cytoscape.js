## Details

This function returns a plain object with the fields `x1`, `x2`, `y1`, `y2`, `w`, and `h` defined.

Note that the `includeOverlays` option necessarily includes the dimensions of the body of the element.  So using `includeOverlays: true` with `includeNodes: false`, for example, does not make sense.  The case where the `includeOverlays` option is only useful in getting the non-overlay dimensions of an element, e.g. `{ includeOverlays: false, includeNodes: true }`.