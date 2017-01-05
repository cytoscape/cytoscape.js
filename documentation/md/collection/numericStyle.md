## Details

- Sizes (e.g. `width`) are in pixels.
- Times (e.g. `transition-duration`) are in milliseconds.
- Angles (e.g. `text-rotation`) are in radians.
- Plain numbers (e.g. `opacity`) are unitless.
- Colours (e.g. `background-color`) are in `[r, g, b]` arrays with values on [0, 255].
- Lists of numbers (e.g. `edge-distances`) are in arrays.
- Percents range on [0, 1] so that they are useful for calculations.
- Some properties can not have preferred units defined, like `background-position-x` --- it could be in `px` or `%`, for instance.  A property like this is returned in the units as specified in the element's style (e.g. the stylesheet).  In this case, the units can be returned explicitly via `ele.numericStyleUnits()`.
- Values that can not be expressed as numbers (e.g. `label`) are returned as a string.

## Examples

`node.numericStyle('width')` would return `30` for a 30px wide node, even if the node was specified as `width: 3em`.
