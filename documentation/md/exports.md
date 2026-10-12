# Image export

Rendered cores export the currently displayed graph through `cy.png()` or
`cy.jpg()`. Both return promises because the renderer draws to an offscreen
GPU target and reads the pixels back asynchronously. Headless cores reject:
they have no renderer to export. The exporter renders at native output
resolution, independent of the on-screen adaptive render scale, and evaluates
label visibility at the export scale.

```js
const blob = await cy.png({ full: true, maxWidth: 1600, output: 'blob' });
const url = URL.createObjectURL(blob);
const image = document.createElement('img');
image.src = url;
document.body.append(image);
// Revoke the URL when the application no longer needs it.
```

The default output is `'base64uri'`, a PNG data URI. `output: 'base64'`
returns only the base64 payload; `'blob'` resolves to a `Blob`, and
`'blob-promise'` is an alias for
`'blob'`. JPEG uses the same options with `cy.jpg()` (or `cy.jpeg()`). Its
default background is white because JPEG has no alpha channel; `quality` is a
format-specific encoder hint from 0 to 1. PNG defaults to a transparent
background. Set `bg` to a CSS color to paint behind either format.

Viewport export is the default: it captures the current container dimensions
and viewport transform. `scale` multiplies rendered CSS pixels, default 1.
With `full: true`, the exporter instead uses the model-space graph bounds and
`scale` means output pixels per model unit. `maxWidth` and `maxHeight` replace
`scale`; if both are set, the smaller resulting scale is used so the full
image fits within both dimensions. These limits are output pixels.

An empty graph cannot be exported with `full: true`, and a viewport export
requires a nonzero container size. The background color and scale are
validated. Output larger than the GPU's maximum texture size rejects with
guidance to reduce scale or set a dimension cap. Browser canvas encoding can
also reject if it cannot produce the requested image.

The current APIs are raster PNG and JPEG. **TODO_PROVISIONAL —** SVG and its
image/font options are a planned contract, not implemented export methods; see
[provisional directions](provisional.md#layout-assessment-and-export) and the
[6 October alpha contract's 12 October SVG interview section](../../plan/rounds/2026-10-06-01-rnd0000-note-alpha-contract-interview.md#svg-interview-decisions-and-font-considerations-2026-10-12).
No PDF export is planned in core; the decision is to treat PDF as an
SVG-to-PDF application recipe after SVG exists.
