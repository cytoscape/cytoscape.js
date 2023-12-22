Style in Cytoscape.js follows CSS conventions as closely as possible.  In most cases, a property has the same name and behaviour as its corresponding CSS namesake.  However, the properties in CSS are not sufficient to specify the style of some parts of the graph.  In that case, additional properties are introduced that are unique to Cytoscape.js.

For simplicity and ease of use, [specificity rules](http://www.w3.org/TR/css3-selectors/#specificity) are completely ignored in stylesheets.  For a given style property for a given element, the last matching selector wins.



## Format

The style specified at [initialisation](#core/initialisation) can be in a function format, in a plain JSON format, or in a string format --- the plain JSON format and string formats being more useful if you want to pull down the style from the server.



### String format

Note that the trailing semicolons for each property, except for the last, are mandatory. Parsing will certainly fail without them.

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

<span class="important-indicator"></span> The function should not read any other style values, nor should it mutate state for elements or for the graph.  Generally, it should depend only on reading `ele.data()`, `ele.scratch()`, `cy.data()`, or `cy.scratch()`.

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
 * Values requiring a number, such as a length, can be specified in pixel values (e.g. `24px`), unitless values that are implicitly in pixels (e.g. `24`), or em values (e.g. `2em`).  Sizes are specified in [model co-ordinates](#notation/position), so on-screen (rendered) sizes are as specified at zoom 1.
 * Opacity values are specified as numbers ranging on `0 <= opacity <= 1` (e.g `0.5`).
 * Time is measured in units of ms or s (e.g. `250ms`).
 * Angles are measured in radians (e.g. `3.14rad`) or degrees (e.g. `180deg`), clockwise.
 * Properties that specify a list of values may be formatted in one of the following formats:
   * A space-separated string (e.g. `'red rgb(0,255,0) blue'`)
     * Note that for lists of colours, this means that you can not use spaces within `rgb()` or `hsl()`.
     * This is the only format possible in string stylesheets (usually an external file).
   * A JS array (e.g. `['red', 'rgb(0, 255, 0)', 'blue']`)
     * This format may be used in the chained function stylesheets and in JSON stylesheets.



## Mappers

In addition to specifying the value of a property outright, the developer may also use a mapper to dynamically specify the property value.

<span class="important-indicator"></span> If a mapping is defined, either define the mapped data for all elements or use selectors to limit the mapping to elements that have the mapped data defined.  For example, the selector `[foo]` will apply only to elements with the data field `foo` defined.

* **`data()`** specifies a direct mapping to an element's data field.  For example, `data(descr)` would map a property to the value in an element's `descr` field in its data (i.e. `ele.data("descr")`).  This is useful for mapping to properties like label text (the `label` property).
* **`mapData()`** specifies a linear mapping to an element's data field.  For example, `mapData(weight, 0, 100, blue, red)` maps an element's weight to colours between blue and red for weights between 0 and 100.  An element with `ele.data("weight") === 0` would  be mapped to blue, for instance.  Elements whose values fall outside of the specified range are mapped to the extremity values.  In the previous example, an element with `ele.data("weight") === -1` would be mapped to blue.
* **`function( ele ){ ... }`** A function may be passed as the value of a style property.  The function has a single `ele` argument which specifies the element for which the style property value is being calculated.
  * **Do** specify a valid value for the corresponding style property for all elements that its corresponding selector block applies.
  * **Do** use pure functions that depend on only
    * `ele.data()`,
    * `ele.scratch()`, or
    * basic state that could alternatively be represented with selectors (e.g. `ele.selected()` is OK because there's a `:selected` selector).
  * **Do not** mutate the graph state for `cy` or for any `ele` inside your mapper function.
  * **Do not** create cyclic dependencies (i.e. one style property reads the value of another style property).  Your style function should not call functions like `ele.style()` or `ele.numericStyle()`.
  * **Do not** use functions if you can use built-in mappers and selectors to express the same thing.  If you use a function, you lose built-in style performance enhancements and you'll have to optimise and cache the function yourself.





## Node body

Shape:

 * **`width`** : The width of the node's body.
 * **`height`** : The height of the node's body.
 * **`shape`** : The shape of the node's body.  Note that each shape fits within the specified `width` and `height`, and so you may have to adjust `width` and `height` if you desire an equilateral shape (i.e. `width !== height` for several equilateral shapes).  Only `*rectangle` shapes are supported by compounds, because the dimensions of a compound are defined by the bounding box of the children.  The following values are accepted:
    * `ellipse`
    * `triangle`
    * `round-triangle`
    * `rectangle`
    * `round-rectangle`
    * `bottom-round-rectangle`
    * `cut-rectangle`
    * `barrel`
    * `rhomboid`
    * `right-rhomboid`
    * `diamond`
    * `round-diamond`
    * `pentagon`
    * `round-pentagon`
    * `hexagon`
    * `round-hexagon`
    * `concave-hexagon`
    * `heptagon`
    * `round-heptagon`
    * `octagon`
    * `round-octagon`
    * `star`
    * `tag`
    * `round-tag`
    * `vee`
    * `polygon` (custom polygon specified via `shape-polygon-points`).
 * **`shape-polygon-points`** : An array (or a space-separated string) of numbers ranging on [-1, 1], representing alternating x and y values (i.e. `x1 y1   x2 y2,   x3 y3 ...`).  This represents the points in the polygon for the node's shape.  The bounding box of the node is given by (-1, -1), (1, -1), (1, 1), (-1, 1).  The node's position is the origin (0, 0).

Background:

 * **`background-color`** : The colour of the node's body.
 * **`background-blacken`** : Blackens the node's body for values from 0 to 1; whitens the node's body for values from 0 to -1.
 * **`background-opacity`** : The opacity level of the node's background colour.
 * **`background-fill`** : The filling style of the node's body; may be `solid` (default), `linear-gradient`, or `radial-gradient`.

Gradient:

 * **`background-gradient-stop-colors`** : The colours of the background gradient stops (e.g. `cyan magenta yellow`).
 * **`background-gradient-stop-positions`** : The positions of the background gradient stops (e.g. `0% 50% 100%`). If not specified or invalid, the stops will divide equally.
 * **`background-gradient-direction`** : For `background-fill: linear-gradient`, this property defines the direction of the background gradient.  The following values are accepted:
   * `to-bottom` (default)
   * `to-top`
   * `to-left`
   * `to-right`
   * `to-bottom-right`
   * `to-bottom-left`
   * `to-top-right`
   * `to-top-left`


Border:

 * **`border-width`** : The size of the node's border.
 * **`border-style`** : The style of the node's border; may be `solid`, `dotted`, `dashed`, or `double`.
 * **`border-color`** : The colour of the node's border.
 * **`border-opacity`** : The opacity of the node's border.

 Outline:

 * **`outline-width`** : The size of the node's outline.
 * **`outline-style`** : The style of the node's outline; may be `solid`, `dotted`, `dashed`, or `double`.
 * **`outline-color`** : The colour of the node's outline.
 * **`outline-opacity`** : The opacity of the node's outline.
 * **`outline-offset`** : The offset of the node's outline.

Padding:

A padding defines an addition to a node's dimension.  For example, `padding` adds to a node's outer (i.e. total) width and height.  This can be used to add spacing between a compound node parent and its children.

* **`padding`** : The amount of padding around all sides of the node. Either percentage or pixel value can be specified. For example, both `50%` and `50px` are acceptable values. By default, percentage padding is calculated as a percentage of node width.
* **`padding-relative-to`** : Determines how padding is calculated if and only if the percentage unit is used. Accepts one of the keywords specified below.
  * **`width`** : calculate padding as a percentage the node width.
  * **`height`** : calculate padding as a percentage of the node height.
  * **`average`** : calculate padding as a percentage of the average of the node width and height.
  * **`min`** : calculate padding as a percentage of the minimum of the node width and height.
  * **`max`** : calculate padding as a percentage of the maximum of the node width and height.

Compound parent sizing:

 * **`compound-sizing-wrt-labels`** : Whether to include labels of descendants in sizing a compound node; may be `include` or `exclude`.
 * **`min-width`** : Specifies the minimum (inner) width of the node's body for a compound parent node (e.g. `400px`).  If the biases for `min-width` do not add up to 100%, then the biases are normalised to a total of 100%.
 * **`min-width-bias-left`** : When a compound node is enlarged by its `min-width`, this value specifies the percent of the extra width put on the left side of the node (e.g. `50%`).
 * **`min-width-bias-right`** : When a compound node is enlarged by its `min-width`, this value specifies the percent of the extra width put on the right side of the node (e.g. `50%`).
 * **`min-height`** : Specifies the minimum (inner) height of the node's body for a compound parent node (e.g. `400px`).  If the biases for `min-height` do not add up to 100%, then the biases are normalised to a total of 100%.
 * **`min-height-bias-top`** : When a compound node is enlarged by its `min-height`, this value specifies the percent of the extra width put on the top side of the node (e.g. `50%`).
 * **`min-height-bias-bottom`** : When a compound node is enlarged by its `min-height`, this value specifies the percent of the extra width put on the bottom side of the node (e.g. `50%`).




## Background image

A background image may be applied to a node's body.  The following properties support multiple values (space separated or array) with associated indices.

* **`background-image`** : The URL that points to the image that should be used as the node's background.  PNG, JPG, and SVG are supported formats.
  * You may use a [data URI](https://en.wikipedia.org/wiki/Data_URI_scheme) to use embedded images, thereby saving a HTTP request.
  * You can specify multiple background images by separating each image with a space (space delimited format), but if using a non-string stylesheet, then using arrays are preferred.
    * The images will be applied to the node's body in the order given, layering one on top of each other.
    * When specifying properties for multiple images, if the property for a given image is not provided, then the default value is used as fallback.
  * To put an image outside of the bounds of a node's body, it is necessary to specify `background-clip: none` and `bounds-expansion: n` for images that go `n` pixels beyond the bounding box of the node.  Note that values of `n` should be relatively small for performance.
  * To control the drawing order of background images (e.g overlay background images over borders), it is necessary to specify `background-image-containment: over` (default `inside`).
  * SVG image considerations:
    * Always include this XML header in each SVG image:
    ```
    <?xml version="1.0" encoding="UTF-8"?><!DOCTYPE svg>
    ```
    * Use [encodeURIComponent](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent) on SVG data URIs.
    ```
    var data = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgFile);
    ```
    * Do not use base 64 encoding for SVG within a data URI.
    * Web fonts (e.g. WOFF, WOFF2) may not work within SVG `<text>` elements in some browsers.  For best cross-browser compatibility, use native SVG versions of your icons --- usually defined as `<path>` elements.
    * If you memoize function mappers to generate SVGs procedurally, you may want to have your function return an object like `{ svg, width, height }`.  This allows you to use the dimensions of the image for other style properties, like node width and height.  E.g.:
        ```
        var makeSvg = memoize(function(ele){
            // impl...

            return { svg: s, width: w, height: h };
        });
        //
        // ...
        //
        // init stylesheet
        var options = {
            style: [
              {
                selector: 'node',
                style: {
                  'background-image': function(ele){ return makeSvg(ele).svg; },
                  'width': function(ele){ return makeSvg(ele).width; },
                  'height': function(ele){ return makeSvg(ele).height; }
                }
              }
            ]
        };
        ```
    * Using the `viewbox` attribute in SVG images may cause rendering problems in Firefox.
    * SVG images may not work consistently in Internet Explorer.
    * The [`cytoscape-sbgn-stylesheet`](https://github.com/PathwayCommons/cytoscape-sbgn-stylesheet) package serves as a good example for the use of SVG images in a stylesheet.  That stylesheet [creates decorations](https://pathwaycommons.github.io/cytoscape-sbgn-stylesheet/) on nodes in line with the [SBGN standard](https://sbgn.github.io).
* **`background-image-crossorigin`**: All images are loaded with a [`crossorigin`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#attr-crossorigin) attribute which may be `anonymous` or `use-credentials` or `null`. These values should be passed as a string (enclosed withing single or double quotes). The default is set to `anonymous`.
* **`background-image-opacity`** : The opacity of the background image.
* **`background-image-smoothing`** : Determines whether background image is smoothed (`yes`, default) or not (`no`). This is only a hint, and the browser may or may not respect the value set for this property.
* **`background-image-containment`** : Determines whether background image is within (`inside`, default) or over top of the node(`over`).
* **`background-width`** : Specifies the width of the image.  A percent value (e.g. `50%`) may be used to set the image width relative to the node width.  If used in combination with `background-fit`, then this value overrides the width of the image in calculating the fitting --- thereby overriding the aspect ratio.  The `auto` value is used by default, which uses the width of the image.
* **`background-height`** : Specifies the height of the image.  A percent value (e.g. `50%`) may be used to set the image height relative to the node height.  If used in combination with `background-fit`, then this value overrides the height of the image in calculating the fitting --- thereby overriding the aspect ratio.  The `auto` value is used by default, which uses the height of the image.
* **`background-fit`** : How the background image is fit to the node; may be `none` for original size, `contain` to fit inside node, or `cover` to cover the node.
* **`background-repeat`** : Whether to repeat the background image; may be `no-repeat`, `repeat-x`, `repeat-y`, or `repeat`.
* **`background-position-x`** : The x position of the background image, measured in percent (e.g. `50%`) or pixels (e.g. `10px`).
* **`background-position-y`** : The y position of the background image, measured in percent (e.g. `50%`) or pixels (e.g. `10px`).
* **`background-offset-x`** : The x offset of the background image, measured in percent (e.g. `50%`) or pixels (e.g. `10px`).
* **`background-offset-y`** : The y offset of the background image, measured in percent (e.g. `50%`) or pixels (e.g. `10px`).
* **`background-width-relative-to`** : Changes whether the width is calculated relative to the width of the node or the width in addition to the padding; may be `inner` or `include-padding`. If not specified, `include-padding` is used by default.
* **`background-height-relative-to`** : Changes whether the height is calculated relative to the height of the node or the height in addition to the padding; may be `inner` or `include-padding`. If not specified, `include-padding` is used by default.
* **`background-clip`** : How background image clipping is handled; may be `node` for clipped to node shape or `none` for no clipping.

The following properties apply to all images of a node:

* **`bounds-expansion`** : Specifies a padding size (e.g. `20px`) that expands the bounding box of the node in all directions.  This allows for images to be drawn outside of the normal bounding box of the node when `background-clip` is `none`.  This is useful for small decorations just outside of the node. `bounds-expansions` accepts 1 value (for all directions), 2 values, (`[topAndBottom, leftAndRight]`) or 4 values (`[top, right, bottom, left]`).

The following is an example of valid background image styling using JSON. The example images are taken from Wikimedia Commons with the Creative Commons license.
```
{
  'background-image': [
    'https://upload.wikimedia.org/wikipedia/commons/b/b4/High_above_the_Cloud_the_Sun_Stays_the_Same.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Pigeon_silhouette_4874.svg/1000px-Pigeon_silhouette_4874.svg.png'
  ],
  'background-fit': 'cover cover',
  'background-image-opacity': 0.5
}
```


## Pie chart background

These properties allow you to create pie chart backgrounds on nodes ([demo](demos/pie-style)).  Note that 16 slices maximum are supported per node, so in the properties `1 <= i <= 16`.  Of course, you must specify a numerical value for each property in place of `i`.  Each nonzero sized slice is placed in order of `i`, starting from the 12 o'clock position and working clockwise.

You may find it useful to reserve a number to a particular colour for all nodes in your stylesheet.  Then you can specify values for `pie-i-background-size` accordingly for each node via a [mapper](#style/mappers).  This would allow you to create consistently coloured pie charts in each node of the graph based on element data.

 * **`pie-size`** : The diameter of the pie, measured as a percent of node size (e.g. `100%`) or an absolute length (e.g. `25px`).
 * **`pie-i-background-color`** : The colour of the node's ith pie chart slice.
 * **`pie-i-background-size`** : The size of the node's ith pie chart slice, measured in percent (e.g. `25%` or `25`).
 * **`pie-i-background-opacity`** : The opacity of the node's ith pie chart slice.




## Edge line

These properties affect the styling of an edge's line:

 * **`width`** : The width of an edge's line.
 * **`curve-style`** : The curving method used to separate two or more edges between two nodes ([demo](demos/edge-types)); may be [`haystack`](#style/haystack-edges) (default, very fast, bundled straight edges for which loops and compounds are unsupported), [`straight`](#style/straight-edges) (straight edges with all arrows supported), [`straight-triangle`](#style/straight-triangle-edges) (straight triangle edges), [`bezier`](#style/bezier-edges) (bundled curved edges), [`unbundled-bezier`](#style/unbundled-bezier-edges) (curved edges for use with manual control points),  [`segments`](#style/segments-edges) (a series of straight lines), [`round-segments`](#style/round-segments-edges) (a series of straight lines with rounded corners), [`taxi`](#style/taxi-edges) (right-angled lines, hierarchically bundled), [`round-taxi`](#style/round-taxi-edges) (right-angled lines, hierarchically bundled, with rounded corners).  Note that `haystack` edges work best with `ellipse`, `rectangle`, or similar nodes.  Smaller node shapes, like `triangle`, will not be as aesthetically pleasing.  Also note that edge endpoint arrows are unsupported for `haystack` edges.
 * **`line-color`** : The colour of the edge's line.
 * **`line-style`** : The style of the edge's line; may be `solid`, `dotted`, or `dashed`.
 * **`line-cap`** : The cap style of the edge's line; may be `butt` (default), `round`, or `square`.  The cap may or may not be visible, depending on the shape of the node and the relative size of the node and edge.  Caps other than `butt` extend beyond the specified endpoint of the edge.
 * **`line-opacity`** : The opacity of the edge's line and arrow.  Useful if you wish to have a separate opacity for the edge label versus the edge line.  Note that the opacity value of the edge element affects the effective opacity of its line and label subcomponents.
 * **`line-fill`** : The filling style of the edge's line; may be `solid` (default), `linear-gradient` (source to target), or `radial-gradient` (midpoint outwards).
 * **`line-dash-pattern`** : The `dashed` line pattern which specifies alternating lengths of lines and gaps. (e.g. `[6, 3]`).
 * **`line-dash-offset`** : The `dashed` line offset (e.g. `24`). It is useful for creating edge animations.

## Gradient

 * **`line-gradient-stop-colors`** : The colours of the gradient stops (e.g. `cyan magenta yellow`).
 * **`line-gradient-stop-positions`** : The positions of the gradient stops (e.g. `0% 50% 100%`). If not specified (or invalid), the stops will divide equally.

## Bezier edges

For automatic, bundled bezier edges (`curve-style: bezier`, [demo](demos/edge-types)):

A bezier edge is bundled with all other parallel bezier edges.  Each bezier edge is a [quadratic bezier curve](https://en.wikipedia.org/wiki/Bézier_curve#Quadratic_Bézier_curves), separated from the others by varying the  curvature.  If there is an odd number of parallel edges in a bundle, then the centre edge is drawn as a straight line.

 * **`control-point-step-size`** : Along the line perpendicular from source to target, this value specifies the distance between successive bezier edges.
 * **`control-point-distance`** : A single value that overrides `control-point-step-size` with a manual value.  Because it overrides the step size, bezier edges with the same value will overlap.  Thus, it's best to use this as a one-off value for particular edges if need be.
 * **`control-point-weight`** : A single value that weights control points along the line from source to target.  The value usually ranges on [0, 1], with 0 towards the source node and 1 towards the target node --- but larger or smaller values can also be used.
* **`edge-distances`** : 
  * With value `intersection` (default), the line from source to target for `segment-weights` is from the outside of the source node's shape to the outside of the target node's shape.  
  * With value `node-position`, the line is from the source position to the target position.  
  * The `node-position` option makes calculating edge points easier --- but it should be used carefully because you can create invalid points that `intersection` would have automatically corrected.
  * With value `endpoints`, the line is from the manually-specified source endpoint (via `source-endpoint`) to the manually-specified target endpoint (via `target-endpoint`).
    * A manual endpoint may be specified with a position, e.g. `source-endpoint: 20 10`.
    * A manual endpoint may be alternatively specified with an angle, e.g. `target-endpoint: 90deg`.


## Loop edges

For loops (i.e. same source and target, [demo](demos/edge-types)):

A loop is normally drawn as a pair of [quadratic bezier curves](https://en.wikipedia.org/wiki/Bézier_curve#Quadratic_Bézier_curves), one bezier going away from the node and the second bezier going back towards the node.

 * **`loop-direction`** : Determines the angle that loops extend from the node in cases when the source and target node of an edge is the same.  The angle is specified from the 12 o'clock position and it progresses clockwise for increasing positive values. The default is `-45deg` (extending to the upper left).
 * **`loop-sweep`** : Determines the angle between the leaving and returning edges in loops. Positive values result in clockwise looping and negative values result in counter-clockwise looping. Default is `-90deg`.

Note that loops may only be `bezier` or `unbundled-bezier` for their `curve-style`.


## Unbundled bezier edges

For bezier edges with manual control points (`curve-style: unbundled-bezier`, [demo](demos/edge-types)):

An unbundled bezier edge is made of a series of one or more [quadratic bezier curves](https://en.wikipedia.org/wiki/Bézier_curve#Quadratic_Bézier_curves) --- one control point per curve.  The control points of unbundled bezier curves are specified manually, using a co-ordinate system relative to the source and target node.  This maintains the overall curve shape regardless of the positions of the connected nodes.

A quadratic bezier curve is specified by three points.  Those points include the start point (P0), the centre control point (P1), and the end point (P2).  Traditionally, all three points are called "control points", but only the centre control point (P1) is referred to as the "control point" within this documentation for brevity and clarity.

The start point (P0) for the first quadratic bezier curve in the series is specified by `source-endpoint`.  The end point (P2) for the last quadratic bezier curve in the series is specified by `target-endpoint`.

When two or more control points are specified for an unbundled bezier edge, each adjacent pair of bezier curves is joined at the midpoint of the two control points.  In other words, the start point (P0) and end point (P2) for a quadratic bezier curve in the middle of the series are set implicitly.  This makes most curves join smoothly.

* **`control-point-distances`** : A series of values that specify for each control point the distance perpendicular to a line formed from source to target, e.g. `-20 20 -20`.
* **`control-point-weights`** : A series of values that weights control points along a line from source to target, e.g. `0.25 0.5 0.75`.  A value usually ranges on [0, 1], with 0 towards the source node and 1 towards the target node --- but larger or smaller values can also be used.
* **`edge-distances`** : 
  * With value `intersection` (default), the line from source to target for `segment-weights` is from the outside of the source node's shape to the outside of the target node's shape.  
  * With value `node-position`, the line is from the source position to the target position.  
  * The `node-position` option makes calculating edge points easier --- but it should be used carefully because you can create invalid points that `intersection` would have automatically corrected.
  * With value `endpoints`, the line is from the manually-specified source endpoint (via `source-endpoint`) to the manually-specified target endpoint (via `target-endpoint`).
    * A manual endpoint may be specified with a position, e.g. `source-endpoint: 20 10`.
    * A manual endpoint may be alternatively specified with an angle, e.g. `target-endpoint: 90deg`.


## Haystack edges

For fast, straight line edges (`curve-style: haystack`, [demo](demos/edge-types)):

Haystack edges are a more performant replacement for plain, straight line edges.  A haystack edge is drawn as a straight line from the source node to the target node, randomly placed along some angle from each node's centre.  In this manner, many parallel haystack edges make a tight bundle, especially when semitransparent.  This makes haystack edges an effective way to visualise graphs with a high number of parallel edges.

<span class="important-indicator"></span> Loop edges and compound parent nodes are not supported by haystack edges.  Also note that source and target arrows are not supported for haystack edges, as the arrows would be behind the node body.  Mid arrows, however, are supported.

* **`haystack-radius`** : A value between 0 and 1 inclusive that indicates the relative radius used to position haystack edges on their connected nodes.  The outside of the node is at 1, and the centre of the node is at 0.  For simple graphs, a radius of 0 makes sense.


## Segments edges

For edges made of several straight lines (`curve-style: segments`, [demo](demos/edge-types)):

A segment edge is made of a series of one or more straight lines, using a co-ordinate system relative to the source and target nodes.  This maintains the overall line pattern regardless of the orientation of the positions of the source and target nodes.

* **`segment-distances`** : A series of values that specify for each segment point the distance perpendicular to a line formed from source to target, e.g. `-20 20 -20`.
* **`segment-weights`** : A series of values that weights segment points along a line from source to target, e.g. `0.25 0.5 0.75`.  A value usually ranges on [0, 1], with 0 towards the source node and 1 towards the target node --- but larger or smaller values can also be used.
* **`edge-distances`** : 
  * With value `intersection` (default), the line from source to target for `segment-weights` is from the outside of the source node's shape to the outside of the target node's shape.  
  * With value `node-position`, the line is from the source position to the target position.  
  * The `node-position` option makes calculating edge points easier --- but it should be used carefully because you can create invalid points that `intersection` would have automatically corrected.
  * With value `endpoints`, the line is from the manually-specified source endpoint (via `source-endpoint`) to the manually-specified target endpoint (via `target-endpoint`).
    * A manual endpoint may be specified with a position, e.g. `source-endpoint: 20 10`.
    * A manual endpoint may be alternatively specified with an angle, e.g. `target-endpoint: 90deg`.

## Round segments edges

For rounded edges made of several straight lines (`curve-style: round-segments`, [demo](demos/edge-types)):

A new segment edge type is introduced to facilitate the seamless creation of rounded segment edges, utilizing the same property as * **`segment-edges`**.

## Straight edges

For straight line edges (`curve-style: straight`, [demo](demos/edge-types)):

A straight edge (`curve-style: straight`) is drawn as a single straight line from the outside of the source node shape to the outside of the target node shape.  Endpoint and midpoint arrows are supported on straight edges.  Straight edges are not generally suitable for multigraphs.


## Straight triangle edges

For straight triangle edges (`curve-style: straight-triangle`, [demo](demos/edge-types)):

A straight triangle edge (`curve-style: straight-triangle`) is drawn as a single straight isosceles triangle in the direction from the source to the target, with a triangle base at the source and a triangle apex (a point) at the target.

The `width` property defines width of the triangle base.  The `line-style`, `line-cap`, `line-dash-pattern`, and `line-dash-offset` properties are not supported.


## Taxi edges

For hierarchical, bundled edges (`curve-style: taxi`, [demo](demos/edge-types)):

A taxi edge (`curve-style: taxi`) is drawn as a series of right-angled lines (i.e. in [taxicab geometry](https://en.wikipedia.org/wiki/Taxicab_geometry)).  The edge has a primary direction along either the x-axis or y-axis, which can be used to bundle edges in a hierarchy.  That is, taxi edges are appropriate for trees and DAGs that are laid out in a hierarchical manner.

A taxi edge has at most two visible turns:  Starting from the source node, the edge goes in the primary direction for the specified distance.  The edge then turns, going towards the target along the secondary axis.  The first turn can be specified in order to bundle the edges of outgoing nodes.  The second turn is implicit, based on the first turn, going the remaining distance along the main axis.

When a taxi edge would be impossible to draw along the regular turning plan --- i.e. one or more turns is too close the source or target --- it is re-routed.  The re-routing is carried out on a best-effort basis:  Re-routing prioritises the specified direction for bundling over the specified turn distance.  A `downward` edge, for example, will avoid going in the upward direction where possible.  In practice, re-routing should not take place for graphs that are well laid out.

<span class="important-indicator"></span> Only `outside-to-node` endpoints are supported for a taxi edge, i.e. `source-endpoint: outside-to-node` and `target-endpoint: outside-to-node`.

* **`taxi-direction`** : The main direction of the edge, the direction starting out from the source node; may be one of:
  * `auto` : Automatically use `vertical` or `horizontal`, based on whether the vertical or horizontal distance is largest.
  * `vertical` : Automatically use `downward` or `upward`, based on the vertical direction from source to target.
  * `downward` : Bundle outgoers downwards.
  * `upward` : Bundle outgoers upwards.
  * `horizontal` : Automatically use `righward` or `leftward`, based on the horizontal direction from source to target.
  * `rightward` : Bundle outgoers righwards.
  * `leftward` : Bundle outgoers leftwards.
* **`taxi-turn`** : The distance along the primary axis where the first turn is applied.
  * This value may be an absolute distance (e.g. `20px`) or it may be a relative distance between the source and target (e.g. `50%`).
  * A negative value may be specified to indicate a distance in the oppostite, target to source direction (e.g. `-20px`).
  * Note that bundling may not work with an explicit direction (`upward`, `downward`, `leftward`, or `rightward`) in tandem with a turn distance specified in percent units.
* **`taxi-turn-min-distance`** : The minimum distance along the primary axis that is maintained between the nodes and the turns.
  * This value only takes on absolute values (e.g. `5px`).
  * This property makes the taxi edge be re-routed when the turns would be otherwise too close to the source or target.  As such, it also helps to avoid turns overlapping edge endpoint arrows.
* **`edge-distances`** : With value `intersection` (default), the distances (`taxi-turn` and `taxi-turn-min-distance`) are considered from the outside of the source's bounds to the outside of the target's bounds.  With value `node-position`, the distances are considered from the source position to the target position.  The `node-position` option makes calculating edge points easier --- but it should be used carefully because you can create invalid points that `intersection` would have automatically corrected.

## Round taxi edges

Apply the round style to Taxi edges (`curve-style: round-taxi`, [demo](demos/edge-types)):

Similar to rounded segment edges, this round text edge type allows for smooth curvature to achieve a polished appearance.

## Edge arrow

* **`<pos>-arrow-color`** : The colour of the edge's source arrow.
* **`<pos>-arrow-shape`** : The shape of the edge's source arrow ([demo](demos/edge-arrows)); may be one of:
  * `triangle`
  * `triangle-tee`
  * `circle-triangle`
  * `triangle-cross`
  * `triangle-backcurve`
  * `vee`
  * `tee`
  * `square`
  * `circle`
  * `diamond`
  * `chevron`
  * `none`
* **`<pos>-arrow-fill`** : The fill state of the edge's source arrow; may be `filled` or `hollow`.
* **`<pos>-arrow-width`** : The width of the edge's source arrow shape; may be `match-line`, a number (pixel), or a string with units (`px` | `%` | `em`). The `%` unit is based on the edge `width`.
* **`arrow-scale`** : Scaling for the arrow size; may be any number >= 0.

For each edge arrow property above, replace `<pos>` with one of

  * `source` : Pointing towards the source node, at the end of the edge.
  * `mid-source` : Pointing towards the source node, at the middle of the edge.
  * `target` : Pointing towards the target node, at the end of the edge.
  * `mid-target`: Pointing towards the target node, at the middle of the edge.

Only mid arrows are supported on haystack edges.


## Edge endpoints

`source-endpoint` & `target-endpoint` : Specifies the endpoint of the source side of the edge and the target side of the edge, respectively.  There are several options for how those properties can be set:

- A special, named value may be used.
  - `outside-to-node` (default) indicates that the edge should be placed automatically to point towards the node's position and be placed on the outside of the node's shape.
  - `outside-to-node-or-label` uses the same rules as `outside-to-node` with the added rule that if the node's label would intersect the edge before the node's body, then the edge points to that intersection point.  This avoids overlap of edges with node labels.
  - `inside-to-node` indicates the edge should go all the way inside the node and point directly on the node's position.  This is the same as specifying `0 0`.
  - `outside-to-line` indicates the edge endpoint should be placed outside the node's shape where it would intersect the imaginary line from the source position to the target position.  This value is useful for automatically  avoiding invalid cases for bezier edges, especially with compound nodes.
  - `outside-to-line-or-label` uses the same rules as `outside-to-line` with the added rule that if the node's label would intersect the imaginary line before the node's body, then the edge points to that intersection point.  This avoids overlap of edges with node labels.
- Two numbers may specify the endpoint.  The numbers indicate a position relative to the node's position.  The numbers can be specified as percent values (e.g. `50%`, which are relative to the node's width and height respectively) or as absolute distances (e.g. `100px` or `2em`).
- A single angle value (e.g. `90deg` or `1.57rad`) may specify that the endpoint should be placed on the node's border at the specified angle.  The angle starts at 12 o'clock and progresses clockwise.

The endpoints for edges can be shifted away from the source and target node:

 * **`source-distance-from-node`** : A value that shifts the edge away from the source node (default `0px`).
 * **`target-distance-from-node`** : A value that shifts the edge away from the target node (default `0px`).

Endpoint modification is not supported for `curve-style: haystack` edges for performance reasons.


## Visibility

* **`display`** : Whether to display the element; may be `element` for displayed or `none` for not displayed.
  * A `display: none` element does not take up space.
    * A `display: none` bundled bezier edge does not take up space in its bundle.
    * A `display: none` node hides its connected edges.
    * A `display: none` node is considered a point rather than an area in layouts, affecting things like overlap avoidance.
    * A `display: none` element is not taken into consideration for viewport fitting.
  * A `display: none` element is not interactive.
* **`visibility`** : Whether the element is visible; may be `visible` or `hidden`.
  * A `visibility: hidden` element does take up space.
    * A `visibility: hidden` bundled bezier edge does take up space in its bundle.
    * A `visibility: hidden` node does not hide its connected edges.
    * A `visibility: hidden` element is considered normally by layouts.
    * A `visibility: hidden` element is taken into consideration for viewport fitting.
  * A `visibility: hidden` element is not interactive.
* **`opacity`** : The opacity of the element, ranging from 0 to 1.  Note that the opacity of a compound node parent affects the effective opacity of its children.
  * An `opacity: 0` element does take up space.
    * An `opacity: 0` bundled bezier edge does take up space in its bundle.
    * An `opacity: 0` node does not hide its connected edges.
    * An `opacity: 0` element is considered normally by layouts.
    * An `opacity: 0` element is taken into consideration for viewport fitting.
  * An `opacity: 0` element is interactive.
* **`z-index`** : A numeric value that affects the relative draw order of elements.  In general, an element with a higher `z-index` will be drawn on top of an element with a lower `z-index`.  
  * Note that edges are under nodes despite `z-index`, except when necessary for compound nodes.
  * Note that unlike CSS proper, the `z-index` is a floating point value.
  * Also unlike CSS proper, a negative value does not have special behaviour.  The element is layered according to `z-compound-depth` and `z-index-compare`, while `z-index` only sorts an element within a layer.

Elements are drawn in a specific order based on compound depth (low to high), the element type (typically nodes above edges), and z-index (low to high).  These styles affect the ordering:

* **`z-compound-depth`** : May be `bottom`, `orphan`, `auto` (default), or `top`.  The first drawn is `bottom`, the second is `orphan`, which is the same depth as the root of the compound graph, followed by the default of `auto` which draws in depth order from root to leaves of the compound graph.  The last drawn is `top`.  It does not usually make sense to set this value for non-compound graphs.
* **`z-index-compare`**: May be `auto` (default) or `manual`.  The `auto` setting draws edges under nodes, whereas `manual` ignores this convention and draws solely based on the `z-index` value.
* **`z-index`** : An integer value that affects the relative draw order of elements.  In general, an element with a higher `z-index` will be drawn on top of an element with a lower `z-index` within the same depth.


## Labels

Label text:

 * **`label`** : The text to display for an element's label ([demo](demos/labels)).
 * **`source-label`** : The text to display for an edge's source label.
 * **`target-label`** : The text to display for an edge's target label.

Basic font styling:

 * **`color`** :  The colour of the element's label.
 * **`text-opacity`** : The opacity of the label text, including its outline.
 * **`font-family`** : A [comma-separated list of font names](https://developer.mozilla.org/en-US/docs/Web/CSS/font-family) to use on the label text.
 * **`font-size`** : The size of the label text.
 * **`font-style`** : A [CSS font style](https://developer.mozilla.org/en-US/docs/Web/CSS/font-style) to be applied to the label text.
 * **`font-weight`** : A [CSS font weight](https://developer.mozilla.org/en-US/docs/Web/CSS/font-weight) to be applied to the label text.
 * **`text-transform`** : A transformation to apply to the label text; may be `none`,
 `uppercase`, or `lowercase`.

Wrapping text:

 * **`text-wrap`** : A wrapping style to apply to the label text; may be `none` for no wrapping (including manual newlines: `\n`), `wrap` for manual and/or autowrapping, or `ellipsis` to truncate the string and append '...' based on `text-max-width`.  Note that with `wrap`, text will always wrap on newlines (`\n`) and text may wrap on any breakable whitespace character --- including [zero-width spaces](https://en.wikipedia.org/wiki/Zero-width_space) (`\u200b`).
 * **`text-max-width`** : The maximum width for wrapped text, applied when `text-wrap` is set to `wrap` or `ellipsis`.  For only manual newlines (i.e. `\n`), set a very large value like `1000px` such that only your newline characters would apply.
 * **`text-overflow-wrap`** : The characters that may be used for possible wrapping locations when a line overflows `text-max-width`; may be `whitespace` (default) or `anywhere`.  Note that `anywhere` is suited to [CJK](https://en.wikipedia.org/wiki/CJK_characters), where the characters are in a grid and no whitespace exists.  Using `anywhere` with text in the Latin alphabet, for example, will split words at arbitrary locations.
 * **`text-justification`** : The justification of multiline (wrapped) labels; may be `left`, `center`, `right`, or `auto` (default).  The `auto` value makes it so that a node's label is justified along the node --- e.g. a label on the right side of a node is left justified.
 * **`line-height`** : The line height of multiline text, as a relative, unitless value.  It specifies the vertical spacing between each line.  With value `1` (default), the lines are stacked directly on top of one another with no additional whitespace between them.  With value `2`, for example, there is whitespace between each line equal to the visible height of a line of text.

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
  * Rotations are clockwise.
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


Background:

 * **`text-background-color`** : A colour to apply on the text background.
 * **`text-background-opacity`** : The opacity of the label background; the background is disabled for `0` (default value).
 * **`text-background-shape`** : The shape to use for the label background, can be `rectangle` or `round-rectangle`.
 * **`text-background-padding`** : A padding on the background of the label (e.g `5px`); zero padding is used by default.

Border:

 * **`text-border-opacity`** : The width of the border around the label; the border is disabled for `0` (default value).
 * **`text-border-width`** : The width of the border around the label.
 * **`text-border-style`** : The style of the border around the label; may be `solid`, `dotted`, `dashed`, or `double`.
 * **`text-border-color`** : The colour of the border around the label.

Interactivity:

 * **`min-zoomed-font-size`** : If zooming makes the effective font size of the label smaller than this, then no label is shown.  Note that because of performance optimisations, the label may be shown at font sizes slightly smaller than this value.  This effect is more pronounced at larger screen pixel ratios.  However, it is guaranteed that the label will be shown at sizes equal to or greater than the value specified.
 * **`text-events`** : Whether events should occur on an element if the label receives an event; may be `yes` or `no`.  You may want a style applied to the text on `:active` so you know the text is activatable.



## Events

 * **`events`** : Whether events should occur on an element (e.g. `tap`, `mouseover`, etc.); may be `yes` or `no`.  For `no`, the element receives no events and events simply pass through to the core/viewport.  The `events` property is per-element, so the value of a compound parent does not affect its children.
 * **`text-events`** : Whether events should occur on an element if the label receives an event; may be `yes` or `no`.  You may want a style applied to the text on `:active` so you know the text is activatable.


## Overlay

These properties allow for the creation of overlays on top of nodes or edges, and are often used in the `:active` state.

 * **`overlay-color`** : The colour of the overlay.
 * **`overlay-padding`** : The area outside of the element within which the overlay is shown.
 * **`overlay-opacity`** : The opacity of the overlay.
 * **`overlay-shape`** : The shape of the node overlay; may be `round-rectangle` (default), `ellipse`. Doesn't apply to edges.


## Underlay

These properties allow for the creation of underlays behind nodes or edges, and are often used in a highlighted state.

 * **`underlay-color`** : The colour of the underlay.
 * **`underlay-padding`** : The area outside of the element within which the underlay is shown.
 * **`underlay-opacity`** : The opacity of the underlay.
 * **`underlay-shape`** : The shape of the node underlay; may be `round-rectangle` (default), `ellipse`. Doesn't apply to edges.

## Ghost

The ghost properties allow for creating a ghosting effect, a semitransparent duplicate of the element drawn at an offset.

 * **`ghost`** : Whether to use the ghost effect; may be `yes` or `no`.
 * **`ghost-offset-x`** : The horizontal offset used to position the ghost effect.
 * **`ghost-offset-y`** : The vertical offset used to position the ghost effect.
 * **`ghost-opacity`** : The opacity of the ghost effect.

## Transition animation

 * **`transition-property`** : A space-separated list of style properties to animate in this state.
 * **`transition-duration`** : The length of the transition (e.g. `0.5s`).
 * **`transition-delay`** : The length of the delay before the transition occurs (e.g. `250ms`).
 * **`transition-timing-function`** : An easing function that controls the animation progress curve; may be one of the following values.  A [visualisation](http://easings.net/) of easings serves as a reference.
   * `linear` (default),
   * `spring( tension, friction )`
   * `cubic-bezier( x1, y1, x2, y2 )` (a [demo](http://cubic-bezier.com) has details for parameter values),
   * `ease`,
   * `ease-in`,
   * `ease-out`,
   * `ease-in-out`,
   * `ease-in-sine`,
   * `ease-out-sine`,
   * `ease-in-out-sine`,
   * `ease-in-quad`,
   * `ease-out-quad`,
   * `ease-in-out-quad`,
   * `ease-in-cubic`,
   * `ease-out-cubic`,
   * `ease-in-out-cubic`,
   * `ease-in-quart`,
   * `ease-out-quart`,
   * `ease-in-out-quart`,
   * `ease-in-quint`,
   * `ease-out-quint`,
   * `ease-in-out-quint`,
   * `ease-in-expo`,
   * `ease-out-expo`,
   * `ease-in-out-expo`,
   * `ease-in-circ`,
   * `ease-out-circ`,
   * `ease-in-out-circ`.


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
