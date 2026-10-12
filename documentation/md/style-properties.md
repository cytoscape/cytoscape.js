# Style properties

This is the v4 style-property catalog. The accepted property/group surface is
defined by the compiler and read registries in
[src/style-props.mts](../../src/style-props.mts),
[src/style/tables.mts](../../src/style/tables.mts), and
[src/style/apply-prop.mts](../../src/style/apply-prop.mts). Defaults come from
[src/style/defaults.mts](../../src/style/defaults.mts),
[src/style/sheet.mts](../../src/style/sheet.mts), and the style parsers. The
[stylesheet schema](../../schemas/stylesheet.schema.json) is a useful
structural check; the runtime parser remains authoritative for values.

For stylesheet usage, mapper behavior, replacement and readback, see
[Styling](style.md). Public accessors are in the generated API reference;
[the coverage audit](../api-coverage.md) records the open v3
numericStyleUnits question.

## Sheet shape and values

A v4 sheet has optional props objects named nodes, edges, parents, core, and
bypasses. Property names may be kebab-case or camelCase. Invalid property
names, values, group combinations, and unknown sheet keys throw when the sheet
is compiled. A full cy.style(sheet) replaces the user sheet, including
bypasses. v4 does not accept v3 selector-rule arrays, selector strings as
style rules, CSS string stylesheets, or a function for a whole group.

Colors accept CSS color names, #rgb/#rrggbb, rgb()/rgba(), hsl()/hsla(), and
RGB(A) numeric arrays; they are stored as RGBA bytes. Numeric style lengths
use model pixels; there is no general CSS unit conversion. Prefer finite
numbers in JSON. The runtime numeric parser applies parseFloat to strings, so
a numeric prefix such as "12px" is accepted even though style numbers do not
have general CSS unit conversion.
Unless specified otherwise, invalid enum keywords or malformed lists throw.

Mapper objects with scale or case behavior are available only for the
channels listed in [Mapper support](#mapper-support). Labels and chart-values
also accept a restricted `{ data: key }` passthrough; it does not scale or
branch. A scale mapper looks like:

~~~js
{
  data: 'score',
  scale: 'linear',
  domain: [0, 100], // or 'auto'
  range: ['#fee08b', '#d73027'],
  clamp: true,
  fallback: '#999'
}
~~~

Supported scales are linear, log, sqrt, pow, symlog, diverging, ordinal,
threshold, and quantize. A missing domain or domain: 'auto' tracks the live
data extent. Continuous and quantize domains may use auto at either outer
endpoint; diverging domains require an explicit midpoint. pow defaults to
exponent 2, log to base 10, and symlog to constant 1. Ranges take numeric or
color stops, or a named color scheme such as viridis, plasma, magma, inferno,
ColorBrewer ramps, category10, or dark2. Colors interpolate in OKLab unless
interpolate: 'srgb' is set. Missing or unmappable data uses fallback, then the
channel default. Log scales use positive values only.

Conditional values use ordered case clauses. Each when is one condition or an
array ANDed together; the first match wins. Conditions can compare data with
eq, ne, lt, lte, gt, gte, or in, and can read state/structure such as
selected, active, parent, child, collapsed, or emphasized. String and boolean
data support equality and membership; numeric data supports all comparisons.
Missing data never matches. The final value is else, then fallback, then the
channel default.

## Groups and defaults

The defaults in the property tables are base channel defaults. The installed
default sheet adds these ordinary conditional declarations:

| Group | Default sheet declarations |
| --- | --- |
| nodes | background-color is #999 or #0169D9 when selected; active nodes get overlay-opacity: 0.25. |
| edges | line-color and source, target, and mid-arrow colors are #999 or #0169D9 when selected; width is 3; active edges get overlay-opacity: 0.25. |
| parents | Parent overlay defaults are rectangular shape, #eee fill, 1px #ccc border, and 10px padding. Selected parents use #CCE1F9 fill and #aec8e5 border. A user's nodes block overrides parent defaults; a user's parents block overrides both. |

nodes applies to all nodes, including compound parents. edges applies to
edges. parents overlays node styling for compound parents and owns the
compound-sizing properties below. core affects viewport-level behavior and
accepts constants only. A bypass is an id-keyed constant declaration; it beats
group blocks and defaults, and can be declared before its element exists.

## Shared element channels

These channels apply to nodes and edges; parent channels use the node form.

| Property | Base default | Accepted values |
| --- | --- | --- |
| opacity | 1 | Finite number; mapped. The parser does not restrict it to [0, 1]; use that interval for conventional opacity values. |
| events | yes | yes/no or boolean; mapped. no/false makes the element pointer-transparent. |
| visibility | visible | visible or hidden; mapped. hidden suppresses paint without removing the element. |

## Node and parent node properties

Unless a row says node-only or parent-only, the property is accepted in nodes
and parents. A mapper can replace a constant only for properties named in the
mapper inventory below. Lists and global font-face settings remain constants
even where nearby values accept mappers.

### Body geometry and paint

| Property | Base default | Accepted values |
| --- | --- | --- |
| width | 30 | Finite model-pixel number; mapped. Also edge line width. Parent size is derived from children. |
| height | 30 | Finite model-pixel number; mapped. Parent size is derived from children. |
| shape | ellipse | Mapped keyword: ellipse, circle, rectangle, square, round-rectangle, triangle, pentagon, hexagon, heptagon, octagon, diamond, rhomboid, right-rhomboid, vee, star, tag, polygon, concave-hexagon, cut-rectangle, round-triangle, round-diamond, round-pentagon, round-hexagon, round-heptagon, round-octagon, round-tag, bottom-round-rectangle, barrel, convex-hull, round-convex-hull, or concave-hull. circle and square resolve to ellipse and rectangle. Hull shapes describe compound-parent contours. |
| shape-polygon-points | [-1,-1, 1,-1, 1,1, -1,1] | Constant array or whitespace-separated numeric string with an even number of values and at least 3 x/y pairs in [-1, 1]. Used with shape: polygon; values after the 32nd pair are truncated. |
| corner-radius | auto | Mapped non-negative model-pixel number or auto. auto is min(width/4, height/4, 8). |
| background-color | #999 | Color; mapped. The default sheet supplies the selected-state color. |
| background-opacity | 1 | Number in [0, 1]; mapped; folds into fill alpha. |
| background-fill | solid | Mapped keyword: solid, linear-gradient, radial-gradient. |
| background-gradient-stop-colors | empty | Constant color array or whitespace-separated string; at most 5 stops are drawn. |
| background-gradient-stop-positions | evenly spread | Constant array/string of percentages or numbers; clamps to [0, 100] and never decreases between stops. |
| background-gradient-direction | to-bottom | Mapped keyword: to-bottom, to-top, to-left, to-right, to-bottom-right, to-bottom-left, to-top-right, to-top-left. |
| border-color | #000 | Color; mapped. |
| border-width | 0 | Finite model-pixel number; mapped. |
| border-opacity | 1 | Number in [0, 1]; mapped and folded into border alpha. |
| border-position | center | Mapped keyword: center, inside, outside. |
| border-style | solid | Mapped keyword: solid, dashed, dotted, double. |
| border-dash-pattern | [4, 2] | Constant numeric array, number, or whitespace-separated string. Negative entries throw. It normalizes to two on/off pairs; odd lists repeat and longer lists truncate. |
| border-dash-offset | 0 | Finite model-pixel number; mapped. |
| outline-color | #999 | Color; mapped. |
| outline-opacity | 1 | Number in [0, 1]; mapped. |
| outline-width | 0 | Non-negative model-pixel number; mapped. |
| outline-offset | 0 | Non-negative model-pixel number; mapped. |
| outline-style | solid | Mapped keyword: solid, dashed, dotted, double. The current double outline path renders as a solid outline. |

border-position: center places the border across the shape boundary.
corner-radius only affects shapes that have rounded corners. Outlines sit
outside the border and contribute to bounds; they are not pick targets.

### Labels and typography

The common text properties also apply to edges. Edge endpoint-label
properties are listed separately below.

| Property | Base default | Accepted values |
| --- | --- | --- |
| label | empty string | Constant string, data(key) string form, or `{ data: key }` passthrough object; `id` reads the first-class id in either mapper form. Scale/case mappers are rejected. |
| font-size | 16 | Finite model-pixel number; mapped. |
| font-family | sans-serif | Non-empty string, constant-only. The glyph atlas uses one font face. |
| font-style | normal | normal, italic, or oblique; constant-only. |
| font-weight | normal | normal, bold, bolder, lighter, or hundreds from 100 to 900; constant-only. |
| color | #000 | Label color; mapped. |
| text-opacity | 1 | Number in [0, 1]; mapped; folds into text, outline, and text-background alpha. |
| text-outline-width | 0 | Finite model-pixel number; mapped. |
| text-outline-color | #000 | Color; mapped. |
| text-outline-opacity | 1 | Finite number; mapped. Use [0, 1] for conventional opacity values; the parser accepts finite values outside that range. |
| text-background-color | #000 | Color; mapped. |
| text-background-opacity | 0 | Finite number; mapped. Use [0, 1] for conventional opacity values; the parser accepts finite values outside that range. |
| text-background-padding | 0 | Finite model-pixel number; mapped. |
| text-background-shape | rectangle | Mapped keyword: rectangle or round-rectangle. |
| text-border-width | 0 | Non-negative model-pixel number; mapped. |
| text-border-color | #000 | Color; mapped. |
| text-border-opacity | 0 | Number in [0, 1]; mapped. |
| text-border-style | solid | Mapped keyword: solid, dashed, dotted, double. |
| text-margin-x, text-margin-y | 0 | Finite model-pixel numbers; mapped. |
| min-zoomed-font-size | 0 | Non-negative device-pixel number; mapped. Zero disables the floor. The label hides below this zoomed, DPR-scaled size. |
| text-transform | none | Mapped keyword: none, uppercase, lowercase. |
| text-wrap | none | Mapped keyword: none, wrap, ellipsis. |
| text-max-width | 9999 | Non-negative model-pixel number; mapped. |
| line-height | 1 | Non-negative multiplier; mapped. |
| text-overflow-wrap | whitespace | Mapped keyword: whitespace or anywhere. anywhere allows long words to break. |
| text-justification | auto | Mapped keyword: auto, left, center, right. auto follows horizontal alignment. |
| text-halign | center | Node-only mapped keyword: left, center, right. |
| text-valign | bottom | Node-only mapped keyword: top, center, bottom. v4 differs from v3's top default. |
| text-rotation | 0 (none) | Mapped none, autorotate, or finite radians. autorotate is edge-only; nodes take numeric rotations. |
| text-events | no | Node-only mapped yes/no or boolean. When enabled, the label box can pick the node. |
| label-priority | 0 | Node-only mapped finite number. Higher values claim space first when core.label-declutter is cull. |

Wrapping preserves embedded newlines. whitespace leaves an unbreakable word
overflowing; anywhere can break it. ellipsis truncates one line. A text border
is drawn within the padded background box. Label dimensions join layout or
fit geometry only where those operations request labels.

### Ghosts and overlays

| Property | Base default | Accepted values |
| --- | --- | --- |
| ghost | no | Node-only mapped yes/no or boolean; draws one extra copy of the basic node body. |
| ghost-offset-x, ghost-offset-y | 0 | Node-only finite model-pixel numbers; mapped. |
| ghost-opacity | 0 | Node-only number in [0, 1]; mapped. |
| overlay-color, underlay-color | #000 | Node and edge colors; mapped. Node layers surround the body; edge layers stroke the edge path. |
| overlay-opacity, underlay-opacity | 0 | Number in [0, 1]; mapped. The default sheet sets overlay-opacity to 0.25 on active elements. |
| overlay-padding, underlay-padding | 10 | Non-negative model-pixel number; mapped. |
| overlay-shape, underlay-shape | round-rectangle | Node-only round-rectangle or ellipse; constants only. |
| overlay-corner-radius, underlay-corner-radius | auto | Node-only non-negative model-pixel number or auto; constants only. |

Ghosts duplicate only the basic node body, not labels or decorations. They are
not pickable and do not add extents to box selection. Node overlays draw above
the body but below labels. Edge underlays sit beneath edges; edge overlays sit
over edges and arrows. Edge layers do not accept node-only shape/radius props.

### Background images

These properties are node-only. Image settings may be scalars or arrays;
arrays distribute by image index and repeat their last item for later images.
At most four image layers are composited. Only background-image,
background-image-opacity, and background-image-color take mapper objects; a
mapped image represents one URL per node.

| Property | Base default | Accepted values |
| --- | --- | --- |
| background-image | none | none, URL, url(...) wrapper, or URL array; mapped single URL is allowed. |
| background-fit | none | Per-image none, contain, cover; scalar or non-empty array. |
| background-image-opacity | 1 | Per-image number in [0, 1]; scalar or non-empty array; mapped single value is allowed. |
| background-position-x, background-position-y | 50% | Per-image percentage, pixel number, Npx, or N%; scalar or non-empty array. |
| background-offset-x, background-offset-y | 0 | Per-image pixel number or percentage string; scalar or non-empty array. |
| background-width, background-height | auto | Per-image auto, non-negative pixel number, Npx, or N%; scalar or non-empty array. |
| background-repeat | no-repeat | Per-image no-repeat, repeat-x, repeat-y, or repeat; scalar or non-empty array. |
| background-clip | node | Per-image node or none; scalar or non-empty array. |
| background-image-containment | inside | Per-image inside or over; scalar or non-empty array. |
| background-image-smoothing | yes | Per-image yes/no or boolean; scalar or non-empty array. |
| background-image-crossorigin | anonymous | anonymous, use-credentials, or null; constant-only. |
| background-image-type | auto | Per-image auto or sdf-icon; scalar or non-empty array. |
| background-image-color | #999 | SDF icon tint; color, mapped. |

background-width-relative-to and background-height-relative-to are reserved
names in the internal property vocabulary but throw as unsupported. They are
not part of the accepted style surface.

### Node charts

Charts are node paint decorations; they do not change bounds or picking. The
chart kind and scalar channels accept mappers. List/config values are
constant-only except chart-values, which can use a { data: key } passthrough
to read a per-node array.

| Property | Base default | Accepted values |
| --- | --- | --- |
| chart | none | Mapped none, pie, stripes, heat-strip, radial-heat, or bar. |
| chart-values | unset | Numeric/null list or whitespace-separated numeric list; `{ data: key }` passthrough may read a per-node array. First 255 slots are kept, preserving missing slots. |
| chart-colors | category10 | Color list or named palette; constant-only. Pie/stripe values cycle a shorter palette. |
| chart-scale | unset | Constant scale object with explicit domain and color range; only outer domain endpoints may be auto. Used by heat colors and optional bar colors. |
| chart-domain | unset | Constant two-number domain with min < max, or auto endpoint(s). Required for bars. |
| chart-missing-color | transparent | Color; constant-only; heat missing-value appearance. |
| chart-size | 1 | Fraction in [0, 1] or percentage string; mapped. |
| chart-hole | 0 | Fraction in [0, 1] or percentage string; mapped. |
| chart-start-angle | 0 radians | Number in radians or deg/rad string; mapped. |
| chart-direction | vertical | Mapped vertical or horizontal; stripe/bar axis. |
| chart-opacity | 1 | Number in [0, 1]; mapped. |

Pie/stripe values represent fractions: a sum below 1 leaves a transparent
remainder and values over 1 clamp. Heat and bar values can be signed. Missing
and non-finite entries retain their positions but do not affect extents. Heat
requires an explicit scale domain and color range. Bars require chart-domain,
use a zero baseline clamped to that domain, and leave missing values empty.
Categorical chart-colors and chart-scale cannot both color bars.

## Edge properties

All properties here belong in edges. The common text properties above also
apply to edge labels unless marked node-only. Edges have a center label and
source/target endpoint labels.

### Line paint and arrows

| Property | Base default | Accepted values |
| --- | --- | --- |
| width | 3 from default sheet | Finite model-pixel number; mapped. |
| opacity | 1 | Number; mapped. Also affects effective arrow alpha. |
| line-color | #999 | Color; mapped; selected color is supplied by the default sheet. |
| line-opacity | 1 | Number in [0, 1]; mapped; folds into line and arrow alpha. |
| line-style | solid | Mapped solid, dashed, or dotted. |
| line-cap | butt | Mapped butt, round, or square. |
| line-dash-pattern | [6, 3] | Constant numeric array/number/whitespace string; negative entries throw; normalized to two on/off pairs. |
| line-dash-offset | 0 | Finite model-pixel number; mapped. |
| line-outline-width | 0 | Non-negative model-pixel number; mapped; draws a casing under each edge line. |
| line-outline-color | #000 | Color; mapped. |
| line-fill | solid | Mapped solid, linear-gradient, or radial-gradient. |
| line-gradient-stop-colors | empty | Constant color list/string; at most 5 stops. |
| line-gradient-stop-positions | evenly spread | Constant percentages/numbers; clamped to [0, 100] and nondecreasing. |
| arrow-scale | 1 | Constant must be positive; mapped values are floored at 1/16. |
| source-arrow-shape, target-arrow-shape | none | Mapped none, triangle, arrow (triangle alias), vee, chevron, circle, square, diamond, tee, triangle-tee, circle-triangle, triangle-backcurve. |
| source-arrow-color, target-arrow-color | #999 | Color; mapped; selected color is supplied by the default sheet. |
| source-arrow-fill, target-arrow-fill | filled | Mapped filled or hollow. |
| source-arrow-width, target-arrow-width, mid-source-arrow-width, mid-target-arrow-width | 1 | Non-negative model-pixel number, match-line, or percentage of edge width; constants only. These widths set hollow-head strokes; mid heads are currently always filled, so their width values do not change their drawing. |
| mid-source-arrow-shape, mid-target-arrow-shape | none | Same arrow keywords; mapped. |
| mid-source-arrow-color, mid-target-arrow-color | #999 | Color; mapped; selected color is supplied by the default sheet. |

Gradient stops interpolate in sRGB. Linear edge stops follow the drawn span;
curved/routed edges use path length. line-opacity folds into stored line and
arrow color alpha. A zero-alpha arrow reads back as shape none because stored
color alpha controls whether it draws. The casing is paired with each edge in
draw order. Edge overlay/underlay layers are separate from the casing.

### Edge routes and endpoints

| Property | Base default | Accepted values |
| --- | --- | --- |
| curve-style | straight | Mapped straight, bezier, unbundled-bezier, segments, round-segments, taxi, round-taxi, haystack, or straight-triangle. v4 defaults to straight; v3 defaulted to bezier. |
| control-point-step-size | 40 | Finite model-pixel number; mapped. |
| control-point-weight | 0.5 | Finite number; mapped. |
| loop-direction | -45° | Angle in radians or deg/rad string; mapped. |
| loop-sweep | -90° | Angle in radians or deg/rad string; mapped. |
| control-point-distances | unset | Constant number, array, or whitespace-separated number string; mapper values are not supported. |
| control-point-weights | [0.5] | Constant number, array, or whitespace-separated number string; mappers are not supported. |
| segment-distances | [20] | Constant number, array, or whitespace-separated number string; mappers are not supported. |
| segment-weights | [0.5] | Constant number, array, or whitespace-separated number string; mappers are not supported. |
| segment-radii | [15] | Constant number, array, or whitespace-separated number string; mappers are not supported. |
| radius-type | arc-radius | One arc-radius or influence-radius keyword, or a constant array/whitespace-separated list; mappers are not supported. |
| edge-distances | intersection | Mapped intersection, node-position, or endpoints. |
| taxi-direction | auto | Mapped auto, vertical, horizontal, upward, downward, leftward, rightward. |
| taxi-turn | 50% | Constant accepts a finite pixel number, percentage string, or auto; negative pixel turns select from the target side. Mappers produce pixel numbers; use fallback: auto to select auto routing, since percentage strings are constants-only. |
| taxi-turn-min-distance | 10 | Finite model-pixel number; mapped. |
| taxi-radius | 15 | Finite model-pixel number; mapped. |
| taxi-track | source | Mapped source, target, or family. |
| taxi-track-spacing | 10 | Non-negative model-pixel number; mapped. |
| haystack-radius | 0 | Number in [0, 1]; mapped. |
| source-endpoint, target-endpoint | outside-to-node | Constant keyword, point, or angle. Keywords: outside-to-node, inside-to-node, outside-to-line. Points have two components with optional % or px; angles are radians or deg/rad strings. |
| source-distance-from-node, target-distance-from-node | 0 | Non-negative model-pixel number; mapped. |

The list-valued curve properties are constants-only: a mapper's scalar output
is not an array. bezier is the parallel-edge bundle family; unbundled, taxi
and segment families route per edge. taxi-turn: auto participates in the taxi
track pass. Endpoint outside-to-node-or-label and outside-to-line-or-label
forms throw because edge-to-label bounds are not available. This catalog does
not imply other v3 endpoint forms are supported.

### Edge labels

| Properties | Base default | Accepted values |
| --- | --- | --- |
| source-label, target-label | empty string | Constant string, data(key) string form, or `{ data: key }` passthrough object; scale/case mappers are rejected. |
| source-text-offset, target-text-offset | 0 | Non-negative model-pixel number; mapped. |
| source-text-margin-x, source-text-margin-y, target-text-margin-x, target-text-margin-y | 0 | Finite model-pixel number; mapped. |
| source-text-rotation, target-text-rotation | 0 (none) | Mapped none, autorotate, or finite radians. |
| text-rotation | 0 (none) | Shared mapped rotation; edge labels also accept autorotate. |

## Compound-parent sizing and miniatures

Compound props are constants-only and valid only in parents. Putting them in
nodes, edges, or core throws. Parent base sizing defaults are 10px padding,
zero minimum inner dimensions, and compound-sizing-wrt-labels: exclude.

| Property | Default | Accepted values and behavior |
| --- | --- | --- |
| padding | 10px | Non-negative pixel number or percentage string such as 12%. Percent uses padding-relative-to. |
| padding-left, padding-right, padding-top, padding-bottom | unset; inherit padding | Non-negative pixel number or percentage string; an authored side overrides uniform padding for that side. |
| padding-relative-to | width | width, height, average, min, or max; used only with percentage padding. |
| min-width, min-height | 0 | Non-negative model-pixel number; minimum inner dimension before padding. |
| compound-sizing-wrt-labels | exclude | exclude or include. Include visible direct-child label bounds in model space before parent padding; a parent's own label never sizes itself. |
| collapse-scale | 0.1 | Parent-only finite number in (0, 1]; mapper or bypass is allowed. Used as the configured miniature factor when a collapsed state has no separately applied factor. |

convex-hull, round-convex-hull, and concave-hull are shape values for compound
parents. Their contours follow visible direct-child outer body outlines;
nested parents contribute their contours. Concave hulls remain a single
connected region, may cover unrelated nodes, and have no public tightness or
obstacle control. Empty hulls fall back to a rectangle, rounded for the round
shapes. Child label bounds join sizing and hull inputs only with
compound-sizing-wrt-labels: include. Collapse state itself is carried on node
definitions and collections; collapsed: true is available as a node condition.

## Core properties

Every core value is a constant. Scale/case mapper objects are rejected.

| Property | Default | Accepted values and behavior |
| --- | --- | --- |
| selection-box-color | #ddd | Color for the DOM selection box. |
| selection-box-opacity | 0.65 | Number in [0, 1]. |
| selection-box-border-color | #aaa | Color. |
| selection-box-border-width | 1 | Non-negative model-pixel number. |
| active-bg-color | #000 | Color for the background-grab indicator. |
| active-bg-opacity | 0.15 | Number in [0, 1]. |
| active-bg-size | 30 | Non-negative model-pixel number. |
| dim-opacity | 0.15 | Number in [0, 1]; opacity outside the set passed to cy.emphasize(). |
| label-declutter | none | none or cull; cull gives higher label-priority node labels first claim to space. |

The selection box and background-grab indicator are DOM overlays and do not
appear in graph image export.

## Transitions

transition-property, transition-duration, transition-delay, and
transition-timing-function are per-group settings accepted in nodes, edges,
and parents. They are not channels; they cannot be mapped or bypassed.
transition-property is a constant list/string of properties valid for the
group. Duration and delay are non-negative milliseconds, defaulting to zero.
Timing defaults to linear and must name a supported easing function.

The engine currently tweens node opacity, background-color, border-color,
border-width, width, height, and font-size; edge opacity, line-color, width,
and font-size; and parent padding together with its node channels. Other
property names can pass group validation but do not become tweenable merely by
appearing in transition-property; discrete style changes snap when the style
update starts. A first style application is immediate. See
[animations](animations.md) for handle and channel behavior.

## Mapper support

This is the channel inventory in [src/style/mappable.mts](../../src/style/mappable.mts).
Every accepted property outside it takes constants only, with the restricted
label/chart-values passthroughs and chart-scale configuration form noted above.

| Group | Mapper-capable properties |
| --- | --- |
| Nodes | background-color, border-color, width, height, border-width, opacity, shape, font-size, min-zoomed-font-size, label-priority, text-halign, text-valign, color, text-outline-width/color/opacity, text-background-color/opacity/padding, text-margin-x/y, text-rotation (except autorotate), text-transform, text-background-shape, text-wrap, text-max-width, line-height, text-overflow-wrap, text-justification, text-border-width/color/opacity/style, background-fill, background-gradient-direction, background-opacity, events, visibility, text-events, ghost and its offsets/opacity, overlay/underlay color/opacity/padding, outline color/opacity/width/offset/style, corner-radius, border-position/style/dash-offset, chart kind/opacity/size/hole/start-angle/direction, background-image/image-opacity/image-color. |
| Parents | Node channels above plus collapse-scale; parent channel values resolve only on parent slots. |
| Edges | width, opacity, font-size, color, shared text outline/background/margin/wrap/rotation/transform/border channels, text-opacity, events, visibility, overlay/underlay color/opacity/padding, line-color/style/opacity/cap/dash-offset/outline/fill, arrow-scale, source/target/mid-arrow shape and color, source/target arrow-fill, curve-style, control-point step/weight, loop direction/sweep, edge-distances, taxi direction/turn/min-distance/radius/track/track-spacing, haystack-radius, endpoint distance, and endpoint-label offset/margin/rotation. |
| Core and bypasses | None. Core properties are constants; bypass entries are constant-only. |

Mapper use on a non-mappable property, on the wrong group, or on a global font
property throws. collapse-scale belongs in parents, not the nodes block.
Node-only properties such as charts, images, text-events, label-priority, and
shape-polygon-points are rejected in edges; route and endpoint-label properties
are edge-only.

## v3 properties outside this v4 surface

This is not a compatibility list for all v3 styling. v4 does not provide
selector blocks, style functions, background-blacken, border-cap, border-join,
image bounds-expansion, endpoint *-or-label forms, per-side min-width or
min-height bias props, or per-element font faces. Some names throw as
unsupported; others have no v4 property spelling. Use the tables above and
the stylesheet schema as the v4 contract. The API coverage audit records the
open v3 numericStyleUnits helper question; this page does not invent an
equivalent.
