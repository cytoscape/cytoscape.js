## Details

This function returns a plain object with the fields `x1`, `x2`, `y1`, `y2`, `w`, and `h` defined.

An element that does not take up space (e.g. `display: none`) has a bounding box of zero `w` and `h`.  The `x1`, `x2`, `y1`, and `y2` values will have no meaning for those zero-area elements.  To get the position of a `display: none` node, use [`node.position()`](#node.position) instead.

Note that the `includeOverlays` option necessarily includes the dimensions of the body of the element.  So using `includeOverlays: true` with `includeNodes: false`, for example, does not make sense.  The case where the `includeOverlays` option is only useful in getting the non-overlay dimensions of an element, e.g. `{ includeOverlays: false, includeNodes: true }`. The same applies to the `includeUnderlays` option.