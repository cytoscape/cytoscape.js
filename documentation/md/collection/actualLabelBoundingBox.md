## Details

This function returns an array of four `{ x, y }` points describing the label's polygon, in clockwise order. Unlike [`eles.boundingBox()`](#eles.boundingBox), the polygon reflects the label's actual rotation (e.g. for `text-rotation: autorotate` on an edge label), rather than an axis-aligned box around it.

Only the first element of the collection is used. If the collection is empty, or the element is headless, or the requested label is empty, this function returns `null`.
