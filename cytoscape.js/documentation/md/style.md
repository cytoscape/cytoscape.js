Style in Cytoscape.js follows CSS conventions as closely as possible.  In most cases, a property has the same name and behaviour as its corresponding CSS namesake.  However, the properties in CSS are not sufficient to specify the style of some parts of the graph.  In that case, additional properties are introduced that are unique to Cytoscape.js.

For simplicity and ease of use, [specificity rules](http://www.w3.org/TR/css3-selectors/#specificity) are completely ignored in stylesheets.  For a given style property for a given element, the last matching selector wins.



## Format

The style specified at [initialisation](#core/initialisation) can be in a function format, in a plain JSON format, or in a string format --- the plain JSON format and string formats being more useful if you want to pull down the style from the server.



### String format

Note that the trailing semicolons for each property are mandatory.  Parsing will certainly fail without them.

An example style file:

```
/* comments may be entered like this */
node {
  background-color: green;
}
```

At initialisation:

```js
cytoscape({
  container: document.getElementById('cy'),

  // ...

  style: 'node { background-color: green; }' // probably previously loaded via ajax rather than hardcoded

  // , ...
});
```

### Plain JSON format

```js
cytoscape({
  container: document.getElementById('cy'),

  // ...

  style: [
    {
      selector: 'node',
      style: {
        'background-color': 'red'
      }
    }

    // , ...
  ]

  // , ...
});
```

### Function format

```js
cytoscape({
  container: document.getElementById('cy'),

  // ...

  style: cytoscape.stylesheet()
    .selector('node')
      .style({
        'background-color': 'blue'
      })

      // ...


  // , ...
});
```

You may alternatively use `css` in place of `style`, e.g. `.selector( ... ).css( ... )` or `{ selector: ..., css: ... }`.


### Function values

In the JSON or function stylesheet formats, it is possible to specify a function as the value for a style property.  In this manner, the style value can be specified via a function on a per-element basis.

<span class="important-indicator"></span> Using a function as a style property value may be convenient in certain cases.  However, it may not be a performant option.  Thus, it may be worthwhile to use caching if possible, such as by using the lodash [`_.memoize()`](https://lodash.com/docs#memoize) function.

<span class="important-indicator"></span> Note that if using functions as style values, it will not be possible to serialise and deserialise your stylesheet to JSON proper.

Example:

```js
cytoscape({
  container: document.getElementById('cy'),

  // ...

  style: cytoscape.stylesheet()
    .selector('node')
      .style({
        'background-color': function( ele ){ return ele.data('bg') }

        // which works the same as

        // 'background-color': 'data(bg)'
      })

      // ...


  // , ...
});
```



## Property types

 * Colours may be specified by name (e.g. `red`), hex (e.g. `#ff0000` or `#f00`), RGB (e.g. `rgb(255, 0, 0)`), or HSL (e.g. `hsl(0, 100%, 50%)`).
 * Values requiring a number, such as a length, can be specified in pixel values (e.g. `24px`), unitless values that are implicitly in pixels (`24`), or em values (e.g. `2em`).  Sizes are specified in [model co-ordinates](#notation/position), so on-screen (rendered) sizes are as specified at zoom 1.
 * Opacity values are specified as numbers ranging on `0 <= opacity <= 1`.
 * Time is measured in units of ms or s.
 * Angles are measured in radians (e.g. `3.14rad`) or degrees (e.g. `180deg`).



 ## Mappers

In addition to specifying the value of a property outright, the developer may also use a mapper to dynamically specify the property value.

<span class="important-indicator"></span> If a mapping is defined, either define the mapped data for all elements or use selectors to limit the mapping to elements that have the mapped data defined.  For example, the selector `[foo]` will apply only to elements with the data field `foo` defined.

* **`data()`** specifies a direct mapping to an element's data field.  For example, `data(descr)` would map a property to the value in an element's `descr` field in its data (i.e. `ele.data("descr")`).  This is useful for mapping to properties like label text content (the `content` property).
* **`mapData()`** specifies a linear mapping to an element's data field.  For example, `mapData(weight, 0, 100, blue, red)` maps an element's weight to gradients between blue and red for weights between 0 and 100.  An element with `ele.data("weight") === 0` would  be mapped to blue, for instance.  Elements whose values fall outside of the specified range are mapped to the extremity values.  In the previous example, an element with `ele.data("weight") === -1` would be mapped to blue.
* **`function( ele ){ ... }`** A function may be passed as the value of a style property.  The function has a single `ele` argument which specifies the element for which the style property value is being calculated.  The function must specify a valid value for the corresponding style property for all elements that its corresponding selector block applies.  <span class="important-indicator"></span> Note that while convenient, these functions ought to be inexpensive to execute, ideally cached with something like lodash's [`_.memoize()`](https://lodash.com/docs#memoize).




## Node body

Shape:

 * **`width`** : The width of the node's body.  This property can take on the special value `label` so the width is automatically based on the node's label.
 * **`height`** : The height of the node's body.  This property can take on the special value `label` so the height is automatically based on the node's label.
 * **`shape`** : The shape of the node's body; may be `rectangle`, `roundrectangle`, `ellipse`, `triangle`, `pentagon`, `hexagon`, `heptagon`, `octagon`, `star`, `diamond`, `vee`, `rhomboid`, or `polygon` (custom polygon specified via `shape-polygon-points`).  Note that each shape fits within the specified `width` and `height`, and so you may have to adjust `width` and `height` if you desire an equilateral shape (i.e. `width !== height` for several equilateral shapes).
 * **`shape-polygon-points`** : A space-separated list of numbers ranging on [-1, 1], representing alternating x and y values (i.e. `x1 y1   x2 y2,   x3 y3 ...`).  This represents the points in the polygon for the node's shape.  The bounding box of the node is given by (-1, -1), (1, -1), (1, 1), (-1, 1).

Background:

 * **`background-color`** : The colour of the node's body.
 * **`background-blacken`** : Blackens the node's body for values from 0 to 1; whitens the node's body for values from 0 to -1.
 * **`background-opacity`** : The opacity level of the node's background colour.

Border:

 * **`border-width`** : The size of the node's border.
 * **`border-style`** : The style of the node's border; may be `solid`, `dotted`, `dashed`, or `double`.
 * **`border-color`** : The colour of the node's border.
 * **`border-opacity`** : The opacity of the node's border.

Padding:

A padding defines an addition to a node's dimension.  For example, `padding-left` adds to a node's outer (i.e. total) width.  This can be used to add spacing around the label of `width: label; height: label;` nodes, or it can be used to add spacing between a compound node parent and its children.

* **`padding-left`** : The amount of left padding.
* **`padding-right`** : The amount of right padding.
* **`padding-top`** : The amount of top padding.
* **`padding-bottom`** : The amount of bottom padding.

Compound parent:

 * **`compound-sizing-wrt-labels`** : Whether to include labels of descendants in sizing a compound node; may be `include` or `exclude`.



## Background image

A background image may be applied to a node's body:

 * **`background-image`** : The URL that points to the image that should be used as the node's background.  PNG, JPG, and SVG are supported formats.  You may use a [data URI](https://en.wikipedia.org/wiki/Data_URI_scheme) to use embedded images, thereby saving a HTTP request.
 * **`background-image-opacity`** : The opacity of the background image.
 * **`background-width`** : Specifies the width of the image.  A percent value (e.g. `50%`) may be used to set the image width relative to the node width.  If used in combination with `background-fit`, then this value overrides the width of the image in calculating the fitting --- thereby overriding the aspect ratio.  The `auto` value is used by default, which uses the width of the image.
 * **`background-height`** : Specifies the height of the image.  A percent value (e.g. `50%`) may be used to set the image height relative to the node height.  If used in combination with `background-fit`, then this value overrides the height of the image in calculating the fitting --- thereby overriding the aspect ratio.  The `auto` value is used by default, which uses the height of the image.
 * **`background-fit`** : How the background image is fit to the node; may be `none` for original size, `contain` to fit inside node, or `cover` to cover the node.
 * **`background-repeat`** : Whether to repeat the background image; may be `no-repeat`, `repeat-x`, `repeat-y`, or `repeat`.
 * **`background-position-x`** : The x position of the background image, measured in percent (e.g. `50%`) or pixels (e.g. `10px`).
 * **`background-position-y`** : The y position of the background image, measured in percent (e.g. `50%`) or pixels (e.g. `10px`).
 * **`background-clip`** : How background image clipping is handled; may be `node` for clipped to node shape or `none` for no clipping.



## Pie chart background

These properties allow you to create pie chart backgrounds on nodes.  Note that 16 slices maximum are supported per node, so in the properties `1 <= i <= 16`.  Of course, you must specify a numerical value for each property in place of `i`.  Each nonzero sized slice is placed in order of `i`, starting from the 12 o'clock position and working clockwise.

You may find it useful to reserve a number to a particular colour for all nodes in your stylesheet.  Then you can specify values for `pie-i-background-size` accordingly for each node via a [mapper](#style/mappers).  This would allow you to create consistently coloured pie charts in each node of the graph based on element data.

 * **`pie-size`** : The diameter of the pie, measured as a percent of node size (e.g. `100%`) or an absolute length (e.g. `25px`).
 * **`pie-i-background-color`** : The colour of the node's ith pie chart slice.
 * **`pie-i-background-size`** : The size of the node's ith pie chart slice, measured in percent (e.g. `25%` or `25`).
 * **`pie-i-background-opacity`** : The opacity of the node's ith pie chart slice.



## Edge line

These properties affect the styling of an edge's line:

 * **`width`** : The width of an edge's line.
 * **`curve-style`** : The curving method used to separate two or more edges between two nodes; may be [`haystack`](#style/haystack-edges) (default, very fast, bundled straight edges for which loops and compounds are unsupported), [`bezier`](#style/bezier-edges) (bundled curved edges), [`unbundled-bezier`](#style/unbundled-bezier-edges) (curved edges for use with manual control points), or [`segments`](#style/segments-edges) (a series of straight lines).  Note that `haystack` edges work best with `ellipse`, `rectangle`, or similar nodes.  Smaller node shapes, like `triangle`, will not be as aesthetically pleasing.  Also note that edge arrows are unsupported for `haystack` edges.
 * **`edge-pointing-direction`** : Indicates where the end points of an edge should be directed.  With value `inside`, each end point (e.g. arrow) of the edge points towards the middle of the connected node.  With value `outside`, each end point of the edge points towards the intersection of a line formed between the source node position and the target node position.  The `outside` value is useful for bundling the arrows of edges together, and it is also useful for large nodes (like compounds) as `inside` edges can tend to be impossible to draw for larger nodes.
 * **`line-color`** : The colour of the edge's line.
 * **`line-style`** : The style of the edge's line; may be `solid`, `dotted`, or `dashed`.


## Bezier edges

For automatic, bundled bezier edges (`curve-style: bezier`):

 * **`control-point-step-size`** : From the line perpendicular from source to target, this value specifies the distance between successive bezier edges.
 * **`control-point-distance`** : A single value that overrides `control-point-step-size` with a manual value.  Because it overrides the step size, bezier edges with the same value will overlap.  Thus, it's best to use this as a one-off value for particular edges if need be.
 * **`control-point-weight`** : A single value that weights control points along the line from source to target.  The value usually ranges on [0, 1], with 0 towards the source node and 1 towards the target node --- but larger or smaller values can also be used.
 * **`edge-distances`** : With value `intersection` (default), the line from source to target for `control-point-weight` is from the outside of the source node's shape to the outside of the target node's shape.  With value `node-position`, the line is from the source position to the target position.  The `node-position` option makes calculating edge points easier &emdash; but it should be used carefully because you can create invalid points that `intersection` would have automatically corrected.


## Loop edges

For loops (i.e. same source and target):

 * **`loop-direction`** : Determines the angle in degrees that loops extend from the node in cases when the source and target node of an edge is the same. A value of -90 will result in a loop that extends straight upward from the node. Default is -135 (extending to the upper left).
 * **`loop-sweep`** : Determines the angle in degrees between the leaving and returning edges in loops. Positive values result in clockwise looping and negative values result in counter-clockwise looping. Default is -90.  

Note that loops may only be `bezier` or `unbundled-bezier` for their `curve-style`.


## Unbundled bezier edges

For bezier edges with manual control points (`curve-style: unbundled-bezier`):

* **`control-point-distances`** : A series of values that specify for each control point the distance perpendicular to a line formed from source to target, e.g. `-20 20 -20`.
* **`control-point-weights`** : A series of values that weights control points along a line from source to target, e.g. `0.25 0.5 0.75`.  A value usually ranges on [0, 1], with 0 towards the source node and 1 towards the target node --- but larger or smaller values can also be used.
* **`edge-distances`** : With value `intersection` (default), the line from source to target for `control-point-weights` is from the outside of the source node's shape to the outside of the target node's shape.  With value `node-position`, the line is from the source position to the target position.  The `node-position` option makes calculating edge points easier &emdash; but it should be used carefully because you can create invalid points that `intersection` would have automatically corrected.


## Haystack edges

<span class="important-indicator"></span> Loop edges and compound parent nodes are not supported by haystack edges.  Haystack edges are a more performant replacement for plain, straight line edges.

For fast, straight line edges (`curve-style: haystack`):

* **`haystack-radius`** : A value between 0 and 1 inclusive that indicates the relative radius used to position haystack edges on their connected nodes.  The outside of the node is at 1, and the centre of the node is at 0.


## Segments edges

For edges made of several straight lines (`curve-style: segments`):

* **`segment-distances`** : A series of values that specify for each segment point the distance perpendicular to a line formed from source to target, e.g. `-20 20 -20`.
* **`segment-weights`** : A series of values that weights segment points along a line from source to target, e.g. `0.25 0.5 0.75`.  A value usually ranges on [0, 1], with 0 towards the source node and 1 towards the target node --- but larger or smaller values can also be used.
* **`edge-distances`** : With value `intersection` (default), the line from source to target for `segment-weights` is from the outside of the source node's shape to the outside of the target node's shape.  With value `node-position`, the line is from the source position to the target position.  The `node-position` option makes calculating edge points easier &emdash; but it should be used carefully because you can create invalid points that `intersection` would have automatically corrected.


## Edge arrow

 * **`<pos>-arrow-color`** : The colour of the edge's source arrow.
 * **`<pos>-arrow-shape`** : The shape of the edge's source arrow; may be `tee`, `triangle`, `triangle-tee`, `triangle-backcurve`, `square`, `circle`, `diamond`, or `none`.
 * **`<pos>-arrow-fill`** : The fill state of the edge's source arrow; may be `filled` or `hollow`.

For each edge arrow property above, replace `<pos>` with one of

  * `source` : Pointing towards the source node, at the end of the edge.
  * `mid-source` : Pointing towards the source node, at the middle of the edge.
  * `target` : Pointing towards the target node, at the end of the edge.
  * `mid-target`: Pointing towards the target node, at the middle of the edge.

Only mid arrows are supported on haystack edges.


## Edge endpoints

The endpoints for edges can be shifted away from the source and target node.  This is not supported for `curve-style: haystack` edges, because haystacks must be within the radius of the node shape.

 * **`source-distance-from-node`** : A value that shifts the edge away from the source node (default `0px`).
 * **`target-distance-from-node`** : A value that shifts the edge away from the target node (default `0px`).


## Visibility

* **`display`** : Whether to display the element; may be `element` for displayed or `none` for not displayed.  Note that a `display: none` bezier edge does not take up space in its bundle.
* **`visibility`** : Whether the element is visible; may be `visible` or `hidden`.  Note that a `visibility: hidden` bezier edge still takes up space in its bundle.
* **`opacity`** : The opacity of the element, ranging from 0 to 1.  Note that the opacity of a compound node parent affects the effective opacity of its children.

Elements are drawn in a specific order based on compound depth (low to high), the element type (typically nodes above edges), and z-index (low to high).  These styles affect the ordering:

* **`z-compound-depth`** : May be `bottom`, `orphan`, `auto` (default), or `top`.  The first drawn is `bottom`, the second is `orphan`, which is the same depth as the root of the compound graph, followed by the default of `auto` which draws in depth order from root to leaves of the compound graph.  The last drawn is `top`.
* **`z-index-compare`**: May be `auto` (default) or `manual`.  The `auto` setting draws edges under nodes, whereas `manual` ignores this convention and draws solely based on the `z-index` value.
* **`z-index`** : An integer value that affects the relative draw order of elements.  In general, an element with a higher `z-index` will be drawn on top of an element with a lower `z-index` within the same depth.


## Labels

Label text:

 * **`label`** : The text to display for an element's label.
 * **`source-label`** : The text to display for an edge's source label.
 * **`target-label`** : The text to display for an edge's target label.

Basic font styling:

 * **`color`** :  The colour of the element's label.
 * **`text-opacity`** : The opacity of the label text, including its outline.
 * **`font-family`** : A [comma-separated list of font names](https://developer.mozilla.org/en-US/docs/Web/CSS/font-family) to use on the label text.
 * **`font-size`** : The size of the label text.
 * **`font-style`** : A [CSS font style](https://developer.mozilla.org/en-US/docs/Web/CSS/font-style) to be applied to the label text.
 * **`font-weight`** : A [CSS font weight](https://developer.mozilla.org/en-US/docs/Web/CSS/font-weight) to be applied to the label text.
 * **`text-transform`** : A transformation to apply to the label text; may be `none`, `uppercase`, or `lowercase`.

Wrapping text:

 * **`text-wrap`** : A wrapping style to apply to the label text; may be `none` for no wrapping (including manual newlines: `\n`), `wrap` for manual and/or autowrapping or `ellipsize` to truncate the string and append '...' based on `text-max-width`.
 * **`text-max-width`** : The maximum width for wrapped text, applied when `text-wrap` is set to `wrap` or `ellipsize`.  For only manual newlines (i.e. `\n`), set a very large value like `1000px` such that only your newline characters would apply.

Node label alignment:

 * **`text-halign`** : The vertical alignment of a node's label; may have value `left`, `center`, or `right`.
 * **`text-valign`** : The vertical alignment of a node's label; may have value `top`, `center`, or `bottom`.

Edge label alignment:

 * **`source-text-offset`** : For the source label of an edge, how far from the source node the label should be placed.
 * **`target-text-offset`** : For the target label of an edge, how far from the target node the label should be placed.

Margins:

 * **`text-margin-x`** : A margin that shifts the label along the x-axis.
 * **`text-margin-y`** : A margin that shifts the label along the y-axis.
 * **`source-text-margin-x`** : (For the source label of an edge.)
 * **`source-text-margin-y`** : (For the source label of an edge.)
 * **`target-text-margin-x`** : (For the target label of an edge.)
 * **`target-text-margin-y`** : (For the target label of an edge.)

Rotating text:

 * **`text-rotation`** : A rotation angle that is applied to the label.
  * For edges, the special value `autorotate` can be used to align the label to the edge.
  * For nodes, the label is rotated along its anchor point on the node, so a label margin may help for some usecases.
  * The special value `none` can be used to denote `0deg`.
  * Rotations works best with left-to-right text.
 * **`source-text-rotation`** : (For the source label of an edge.)
 * **`target-text-rotation`** : (For the target label of an edge.)

Outline:

 * **`text-outline-color`** : The colour of the outline around the element's label text.
 * **`text-outline-opacity`** : The opacity of the outline on label text.
 * **`text-outline-width`** : The size of the outline on label text.

Shadow:

 * **`text-shadow-blur`** : The shadow blur distance.
 * **`text-shadow-color`** : The colour of the shadow.
 * **`text-shadow-offset-x`** : The x offset relative to the text where the shadow will be displayed, can be negative. If you set blur to 0, add an offset to view your shadow.
 * **`text-shadow-offset-y`** : The y offset relative to the text where the shadow will be displayed, can be negative. If you set blur to 0, add an offset to view your shadow.
 * **`text-shadow-opacity`** : The opacity of the shadow on the text; the shadow is disabled for `0` (default value).

Background:

 * **`text-background-color`** : A colour to apply on the text background.
 * **`text-background-opacity`** : The opacity of the label background; the background is disabled for `0` (default value).
 * **`text-background-shape`** : The shape to use for the label background, can be `rectangle` or `roundrectangle`.

Border:

 * **`text-border-opacity`** : The width of the border around the label; the border is disabled for `0` (default value).
 * **`text-border-width`** : The width of the border around the label.
 * **`text-border-style`** : The style of the border around the label; may be `solid`, `dotted`, `dashed`, or `double`.
 * **`text-border-color`** : The colour of the border around the label.

Interactivity:

 * **`min-zoomed-font-size`** : If zooming makes the effective font size of the label smaller than this, then no label is shown.  Note that because of performance optimisations, the label may be shown at font sizes slightly smaller than this value.  This effect is more pronounced at larger screen pixel ratios.  However, it is guaranteed that the label will be shown at sizes equal to or greater than the value specified.
 * **`text-events`** : Whether events should occur on an element if the label receives an event; may be `yes` or `no`.  You may want a style applied to the text on `:active` so you know the text is activatable.



## Events

 * **`events`** : Whether events should occur on an element (e.g. `tap`, `mouseover`, etc.); may be `yes` or `no`.  For `no`, the element receives no events and events simply pass through to the core/viewport.
 * **`text-events`** : Whether events should occur on an element if the label receives an event; may be `yes` or `no`.  You may want a style applied to the text on `:active` so you know the text is activatable.


## Overlay

These properties allow for the creation of overlays on top of nodes or edges, and are often used in the `:active` state.

 * **`overlay-color`** : The colour of the overlay.
 * **`overlay-padding`** : The area outside of the element within which the overlay is shown.
 * **`overlay-opacity`** : The opacity of the overlay.

## Shadow

These properties allow for the creation of shadows on nodes or edges. Note that shadow-blur could seriously impact performance on large graph.

 * **`shadow-blur`** :The shadow blur, note that if greater than 0, this could impact performance.
 * **`shadow-color`** : The colour of the shadow.
 * **`shadow-offset-x`** : The x offset relative to the node/edge where the shadow will be displayed, can be negative. If you set blur to 0, add an offset to view your shadow.
 * **`shadow-offset-y`** : The y offset relative to the node/edge where the shadow will be displayed, can be negative. If you set blur to 0, add an offset to view your shadow.
 * **`shadow-opacity`** : The opacity of the shadow.

## Transition animation

 * **`transition-property`** : A comma separated list of style properties to animate in this state.
 * **`transition-duration`** : The length of the transition in seconds (e.g. `0.5s`).
 * **`transition-delay`** : The length of the delay in seconds before the transition occurs (e.g. `250ms`).
 * **`transition-timing-function`** : An easing function that controls the animation progress curve; may be `linear` (default), `spring( tension, friction )` (the [demo](http://codepen.io/anon/pen/ZbzbbZ) has details for parameter values), `cubic-bezier( x1, y1, x2, y2 )` (the [demo](http://cubic-bezier.com) has details for parameter values), `ease`, `ease-in`, `ease-out`, `ease-in-out`, `ease-in-sine`, `ease-out-sine`, `ease-in-out-sine`, `ease-in-quad`, `ease-out-quad`, `ease-in-out-quad`,  `ease-in-cubic`, `ease-out-cubic`, `ease-in-out-cubic`,  `ease-in-quart`, `ease-out-quart`, `ease-in-out-quart`,  `ease-in-quint`, `ease-out-quint`, `ease-in-out-quint`,  `ease-in-expo`, `ease-out-expo`, `ease-in-out-expo`,  `ease-in-circ`, `ease-out-circ`, `ease-in-out-circ` (a [visualisation](http://easings.net/) of easings serves as a reference).


## Core

These properties affect UI global to the graph, and apply only to the core.  You can use the special `core` selector string to set these properties.

Indicator:

 * **`active-bg-color`** : The colour of the indicator shown when the background is grabbed by the user.
 * **`active-bg-opacity`** : The opacity of the active background indicator.
 * **`active-bg-size`** : The size of the active background indicator.

Selection box:

 * **`selection-box-color`** : The background colour of the selection box used for drag selection.
 * **`selection-box-border-color`** : The colour of the border on the selection box.
 * **`selection-box-border-width`** : The size of the border on the selection box.
 * **`selection-box-opacity`** : The opacity of the selection box.

Texture during viewport gestures:

 * **`outside-texture-bg-color`** : The colour of the area outside the viewport texture when `initOptions.textureOnViewport === true`.
 * **`outside-texture-bg-opacity`** : The opacity of the area outside the viewport texture.
