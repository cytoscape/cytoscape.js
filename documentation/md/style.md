# Styling

v4 styles a graph with one structured sheet, not a list of selector rules.
The sheet is a plain object whose optional group blocks are `nodes`, `edges`,
`parents`, `core` and `bypasses`. Node and edge blocks contain property/value
pairs. A full `cy.style(sheet)` installs the sheet and replaces the previous
user-authored sheet. Property names accept kebab-case or camelCase; unknown
properties and invalid values throw at the call site.

```js
cy.style({
  nodes: {
    label: 'data(label)',
    'background-color': {
      data: 'score',
      scale: 'linear',
      domain: [0, 1],
      range: ['#fee08b', '#d73027'],
    },
    'border-width': {
      case: [{ when: { selected: true }, then: 4 }],
      else: 1,
    },
  },
  edges: {
    width: { data: 'weight', scale: 'sqrt', domain: [0, 9], range: [1, 6] },
  },
});
```

## Constants, mappers and conditions

Property values are constants, scale mappers or `case` conditionals. A mapper
reads one data field and can map it through `linear`, `log`, `sqrt`, `pow`,
`symlog`, `diverging`, `ordinal`, `threshold` or `quantize` scales. A domain may
be explicit or track the live data extent; missing or unmappable input uses
`fallback` or the property's normal default. Color output interpolates in
OKLab by default, with `interpolate: 'srgb'` as the explicit alternative. A
label can read a data field with the string form `'data(label)'` or the special
passthrough object `{ data: 'label' }`; both also support the first-class `id`
field. Labels do not accept scale or case mappers, and that data-only object
form does not make arbitrary properties data-mappable. There are no executable
style functions. The supported scale/property combinations and complete
mapper fields are listed in [the style property reference](style-properties.md).

A case mapper checks its clauses in order. A `when` can contain data tests,
state such as `selected`, or structural conditions such as `parent`; an array
of conditions is ANDed. The first matching `then` supplies the property, with
`else`, `fallback` or the channel default as the final value. Missing data
fails its comparisons. This declarative form is the replacement for v3 style
functions and selector blocks: values can be inspected, serialized, refreshed
and evaluated on supported GPU paths without executing application closures
per element.

Data writes refresh mapped channels for the affected elements. If an
auto-domain extent changes, its mapped channel is re-derived. Selection does
not run a full restyle: selected-state styling is a conditional in the default
sheet. A custom definition for a property replaces that property's default
selection condition as expected; include the condition explicitly when the
custom color should still change on selection.

## Group behavior and compound parents

`nodes` and `edges` describe the two element groups. `parents` is an overlay
for compound parent nodes: it can override node properties and set compound
padding and sizing behavior. It is separate from the ordinary node block so
parent labels, child bounds and padding can be treated explicitly. `core`
contains viewport-level theme properties such as selection-box colors,
background interaction indicators, `dim-opacity` during emphasis and the
`label-declutter` policy. These core values are constants; they do not map per
element.

Styles support node geometry, fill/border, opacity, labels and typography,
edge lines, arrows and route families, plus common overlay/underlay and text
properties. Node shapes include standard geometric shapes, custom polygon
points, and parent-only `convex-hull`, `round-convex-hull` and `concave-hull`.
Hull contours follow child outer-body outlines, nested parents contribute
their contours, and concave hulls form one connected region without holes or
islands. An empty hull falls back to the parent's rectangle or rounded
rectangle. The contour is shared by drawing, borders, edge endpoints, picking,
bounds and layout dimensions. There is no public tightness or obstacle-avoidance
control.

The exact supported property/group matrix, literal defaults and accepted
values are in [the style property reference](style-properties.md). A property
familiar from CSS or v3 is not necessarily accepted on every group. Node
`width`, `height`, edge `width`, compound `padding` and `font-size` affect
geometry; changing them updates dependent bounds and rendered geometry as part
of style application.

Parent nodes also support miniature collapse. The `parents` overlay's
`collapse-scale` is a finite number in `(0, 1]` (default `0.1`).
`collapsed()` reports the parent's own state and `insideCollapsed()` reports
strict descendants. `collapse()` and `expand()` scale descendants around the
parent's center while preserving the graph and hidden state. Style reads such
as `width()` retain authored dimensions while geometry uses the effective
scaled size. Decorations, images, charts, labels, hulls and shared
internal-edge geometry follow the descendant scale; edges crossing out of the
collapsed group keep their authored width.

Node charts are a paint-only family with kinds `none`, `pie`, `stripes`,
`heat-strip`, `radial-heat` and `bar`. `chart-values` has up to 255 ordered
slots; a data mapper can pass a per-node array through. Pie and stripe slots
are fractions: values below one leave transparency and values above one clamp.
Heat and bars preserve finite signed values; missing entries retain their
positions and do not shift later slots. Heat charts require `chart-scale` with
numeric bounds and a colour range. Bar geometry requires `chart-domain` and
uses a zero baseline clamped to that domain; bar colors are configured
separately. Missing heat values are transparent by default and missing bars
leave gaps. Charts do not affect bounding boxes or pick results. `cy.legend()`
returns mapping/chart metadata for an application-owned legend; it does not
draw one.

Nodes can also draw up to four background images, in list order with later
images composited on top. Image URLs or data URIs may be constant or mapped
per node; opacity and color/tint can also be mapped, while fit, position,
size, repeat, clipping, containment and smoothing use constant per-image lists.
The default image mode draws decoded raster content; SVG sources can be
rasterized again for zoom and export demand. Setting `background-image-type`
to `sdf-icon` instead uses an alpha silhouette tinted by
`background-image-color` for crisp monochrome icons. Failed URLs warn once and
draw no image. Images are paint only: they do not extend element bounds or
count as pick targets.
Rendered cores supply the decoder; a headless core may retain the style data
but cannot decode and display the image. The exact supported image property
lists and defaults are in the style-property reference.

## Bypasses and reads

`bypasses` is an id-keyed object of constant overrides. A bypass wins over
group definitions and defaults. It is a stylesheet declaration, not transient
element state: it may refer to an id not yet present, survives removing and
re-adding that id, and appears in `cy.json()`. A full sheet replacement
replaces bypasses as well. Element `style()` and `removeStyle()` are convenience
operations over those overrides; style functions are not accepted.

`eles.style()` reads resolved stored style for the first element (or a named
property); it does not return the declaration object. `numericStyle()` gives
the numeric value of a numeric property, while `renderedStyle()` accounts for
the rendered coordinate scale where that property has one. These synchronous
reads operate on stored channels and work headlessly. `effectiveOpacity()`
includes compound ancestor opacity. During a batch, style reads can remain
stale until the batch flush; see [core batching](core.md#loading-mutation-and-batching).

## Style transitions and animation

The sheet's `transition-property`, `transition-duration`, `transition-delay`
and `transition-timing-function` configure transitions when a style change
updates a listed channel. The transitionable set matches `animate()`'s
supported geometry and paint channels. Animations start immediately; there is
no queue, and an overlapping animation replaces the older one on the same
channels. Colors interpolate in OKLab, unlike v3's channel-wise sRGB tween.
See [animations](animations.md) for handles, easing and sequence patterns.

The generated reference covers API methods; the stylesheet source and
[style property reference](style-properties.md) cover accepted properties,
defaults and values. This page explains how declarations fit together; it does
not add accepted properties or invent unsupported selectors.
