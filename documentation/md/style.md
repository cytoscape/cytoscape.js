Style in Cytoscape.js follows CSS conventions as closely as possible.  In most cases, a property has the same name and behaviour as its corresponding CSS namesake.  However, the properties in CSS are not sufficient to specify the style of some parts of the graph.  In that case, additional properties are introduced that are unique to Cytoscape.js.

It is important to note that in your stylesheet, [specificity rules](http://www.w3.org/TR/css3-selectors/#specificity) are completely ignored.  In CSS, specificity often makes stylesheets behave in ways contrary to the developer's natural mental model.  This is terrible, because it wastes time and overcomplicates things.  Thus, there is no analogue of CSS specificity in Cytoscape.js stylesheets.  For a given style property for a given element, the last matching selector wins.  In general, you should be using something along the lines of [OOCSS](http://oocss.org) principles, anyway &mdash; making specificity essentially irrelevant.



## Format

The style specified at [initialisation](#core/initialisation) can be in a functional format, in a plain JSON format, or in a string format &mdash; the plain JSON format and string formats being more useful if you want to pull down the style from the server.  If you pull the style from the server, you probably should initialise Cytoscape.js after the style has been loaded.  (Though you could altenatively modify the existing style or reassign a new style to an existing core instance.)



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

### Functional format

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


### Functional values

In the JSON or functional stylesheet formats, it is possible to specify a function as the value for a style property.  In this manner, the style value can be specified functionally on a per-element basis.

<span class="important-indicator"></span> Note that if using the JSON stylesheet format, it will not be possible to serialise and deserialise your stylesheet to JSON proper.

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

<span class="important-indicator"></span> Using a function as a style property value may be convenient in certain cases.  However, it may not be a performant option.  Thus, it may be worthwhile to use caching if possible, such as by using the lodash [`_.memoize()`](https://lodash.com/docs#memoize) function.



## Property types

 * Colours may be specified by name (e.g. `red`), hex (e.g. `#ff0000` or `#f00`), RGB (e.g. `rgb(255, 0, 0)`), or HSL (e.g. `hsl(0, 100%, 50%)`).
 * Values requiring a number, such as a length, can be specified in pixel values (e.g. `24px`), unitless values that are implicitly in pixels (`24`), or em values (e.g. `2em`).
 * Opacity values are specified as numbers ranging on `0 <= opacity <= 1`.
 * Time is measured in units of ms or s.



 ## Mappers

In addition to specifying the value of a property outright, the developer may also use a mapper to dynamically specify the property value.

<span class="important-indicator"></span> If a mapping is defined, either define the mapped data for all elements or use selectors to limit the mapping to elements that have the mapped data defined.  For example, the selector `[foo]` will apply only to elements with the data field `foo` defined.

* **`data()`** specifies a direct mapping to an element's data field.  For example, `data(descr)` would map a property to the value in an element's `descr` field in its data (i.e. `ele.data("descr")`).  This is useful for mapping to properties like label text content (the `content` property).
* **`mapData()`** specifies a linear mapping to an element's data field.  For example, `data(weight, 0, 100, blue, red)` maps an element's weight to gradients between blue and red for weights between 0 and 100.  An element with `ele.data("weight") === 0` would  be mapped to blue, for instance.  Elements whose values fall outside of the specified range are mapped to the extremity values.  In the previous example, an element with `ele.data("weight") === -1` would be mapped to blue.
* **`function( ele ){ ... }`** A function may be passed as the value of a style property.  The function has a single `ele` argument which specifies the element for which the style property value is being calculated.  The function must specify a valid value for the corresponding style property for all elements that its corresponding selector block applies.  <span class="important-indicator"></span> Note that while convenient, these functions ought to be inexpensive to execute:  The functions are called more often than if the developer writes data by `data()` or `scratch()` &mdash; where `data()` or `scratch()` would provide an automatic caching mechanism.




## Node body

These properties affect the style of a node's body:

 * **`width`** : The width of the node's body.
 * **`height`** : The height of the node's body.
 * **`shape`** : The shape of the node's body; may be `rectangle`, `roundrectangle`, `ellipse`, `triangle`, `pentagon`, `hexagon`, `heptagon`, `octagon`, `star`.  Note that each shape fits within the specified `width` and `height`, and so you may have to adjust `width` and `height` if you desire an equilateral shape (i.e. `width !== height` for several equilateral shapes).
 * **`background-color`** : The colour of the node's body.
 * **`background-blacken`** : Blackens the node's body for values from 0 to 1; whitens the node's body for values from 0 to -1.
 * **`background-opacity`** : The opacity level of the node's background colour.
 * **`border-width`** : The size of the node's border.
 * **`border-style`** : The style of the node's border; may be `solid`, `dotted`, `dashed`, or `double`.
 * **`border-color`** : The colour of the node's border.
 * **`border-opacity`** : The opacity of the node's border.

These node body properties only apply to compound nodes (i.e. nodes who have embedded children):

 * **`padding-left`** : The size of the area on the left of the compound node that can not be occupied by child nodes.
 * **`padding-right`** : The size of the area on the right of the compound node that can not be occupied by child nodes.
 * **`padding-top`** : The size of the area on the top of the compound node that can not be occupied by child nodes.
 * **`padding-bottom`** : The size of the area on the bottom of the compound node that can not be occupied by child nodes.



## Background image

A background image may be applied to a node's body:

 * **`background-image`** : The URL that points to the image that should be used as the node's background.  PNG, JPG, and SVG are supported formats.  You may use a [data URI](https://en.wikipedia.org/wiki/Data_URI_scheme) to use embedded images, thereby saving a HTTP request.
 * **`background-image-opacity`** : The opacity of the background image.
 * **`background-width`** : Specifies the width of the image.  A percent value (e.g. `50%`) may be used to set the image width relative to the node width.  If used in combination with `background-fit`, then this value overrides the width of the image in calculating the fitting &mdash; thereby overriding the aspect ratio.  The `auto` value is used by default, which uses the width of the image.
 * **`background-height`** : Specifies the height of the image.  A percent value (e.g. `50%`) may be used to set the image height relative to the node height.  If used in combination with `background-fit`, then this value overrides the height of the image in calculating the fitting &mdash; thereby overriding the aspect ratio.  The `auto` value is used by default, which uses the height of the image.
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
 * **`curve-style`** : The curving method used to separate two or more edges between two nodes; may be `bezier` (default, bundled curved edges), `unbundled-bezier` (curved edges for use with manual control points), or `haystack` (very fast, bundled straight edges for which loops are unsupported).  Note that `haystack` edges work best with `ellipse`, `rectangle`, or similar nodes.  Smaller node shapes, like `triangle`, will not be as aesthetically pleasing.  Also note that edge arrows are unsupported for `haystack` edges.
 * **`haystack-radius`** : A value between 0 and 1 inclusive that indicates the relative radius used to position haystack edges on their connected nodes.  The outside of the node is at 1, and the centre of the node is at 0.
 * **`control-point-step-size`** : From the line perpendicular from source to target, this value specifies the distance between successive bezier edges.
 * **`control-point-distance`** : Overrides `control-point-step-size` with a manual value.  Because it overrides the step size, bezier edges with the same value will overlap.  Thus, it's best to use this as a one-off value for particular edges if need be.
 * **`control-point-weight`** : Weights control points along the line from source to target.  This value ranges on [0, 1], with 0 towards the source node and 1 towards the target node.
 * **`line-color`** : The colour of the edge's line.
 * **`line-style`** : The style of the edge's line; may be `solid`, `dotted`, or `dashed`.



## Edge arrow

Towards the source node:

 * **`source-arrow-color`** : The colour of the edge's source arrow.
 * **`source-arrow-shape`** : The shape of the edge's source arrow; may be `tee`, `triangle`, `triangle-tee`, `triangle-backcurve`, `square`, `circle`, `diamond`, or `none`.
 * **`source-arrow-fill`** : The fill state of the edge's source arrow; may be `filled` or `hollow`.

Towards the source node, positioned in the middle of the edge:

 * **`mid-source-arrow-color`** : The colour of the edge's mid source arrow.
 * **`mid-source-arrow-shape`** : The shape of the edge's mid source arrow; may be `tee`, `triangle`, `triangle-tee`, `triangle-backcurve`, `square`, `circle`, `diamond`, or `none`.
 * **`mid-source-arrow-fill`** : The fill state of the edge's mid source arrow; may be `filled` or `hollow`.

Towards the target node:

 * **`target-arrow-color`** : The colour of the edge's target arrow.
 * **`target-arrow-shape`** : The shape of the edge's target arrow; may be `tee`, `triangle`, `triangle-tee`, `triangle-backcurve`, `square`, `circle`, `diamond`, or `none`.
 * **`target-arrow-fill`** : The fill state of the edge's target arrow; may be `filled` or `hollow`.

Towards the target node, positioned in the middle of the edge:

 * **`mid-target-arrow-color`** : The colour of the edge's target arrow.
 * **`mid-target-arrow-shape`** : The shape of the edge's target arrow; may be `tee`, `triangle`, `triangle-tee`, `triangle-backcurve`, `square`, `circle`, `diamond`, or `none`.
 * **`mid-target-arrow-fill`** : The fill state of the edge's target arrow; may be `filled` or `hollow`.



## Visibility

* **`display`** : Whether to display the element; may be `element` for displayed or `none` for not displayed.  Note that a `display: none` bezier edge does not take up space in its bundle.
* **`visibility`** : Whether the element is visible; may be `visible` or `hidden`.  Note that a `visibility: hidden` bezier edge still takes up space in its bundle.
* **`opacity`** : The opacity of the element, ranging from 0 to 1.  Note that the opacity of a compound node parent affects the effective opacity of its children.
* **`z-index`** : An integer value that affects the relative draw order of elements.  In general, an element with a higher `z-index` will be drawn on top of an element with a lower `z-index`.  Note that edges are under nodes despite `z-index`, except when necessary for compound nodes.



## Labels

 * **`color`** :  The colour of the element's label.
 * **`content`** : The text to display for an element's label.
 * **`font-family`** : A [comma-separated list of font names](https://developer.mozilla.org/en-US/docs/Web/CSS/font-family) to use on the label text.
 * **`font-size`** : The size of the label text.
 * **`font-style`** : A [CSS font style](https://developer.mozilla.org/en-US/docs/Web/CSS/font-style) to be applied to the label text.
 * **`font-weight`** : A [CSS font weight](https://developer.mozilla.org/en-US/docs/Web/CSS/font-weight) to be applied to the label text.
 * **`text-transform`** : A transformation to apply to the label text; may be `none`, `uppercase`, or `lowercase`.
 * **`text-wrap`** : A wrapping style to apply to the label text; may be `none` for no wrapping (including manual newlines: `\n`) or `wrap` for manual and/or autowrapping.
 * **`text-max-width`** : The maximum width for wrapped text, applied when `text-wrap` is set to `wrap`.  For only manual newlines (i.e. `\n`), set a very large value like `1000px` such that only your newline characters would apply.
 * **`edge-text-rotation`** : Whether to rotate edge labels as the relative angle of an edge changes; may be `none` for page-aligned labels or `autorotate` for edge-aligned labels.  This works best with left-to-right text.
 * **`text-opacity`** : The opacity of the label text, including its outline.
 * **`text-outline-color`** : The colour of the outline around the element's label text.
 * **`text-outline-opacity`** : The opacity of the outline on label text.
 * **`text-outline-width`** : The size of the outline on label text.
 * **`text-shadow-blur`** : The shadow blur, note that when greater than 0, this could affect performance. Default to 5.
 * **`text-shadow-color`** : The colour of the shadow.
 * **`text-shadow-offset-x`** : The x offset relative to the text where the shadow will be displayed, can be negative. If you set blur to 0, add an offset to view your shadow.
 * **`text-shadow-offset-y`** : The y offset relative to the text where the shadow will be displayed, can be negative. If you set blur to 0, add an offset to view your shadow.
 * **`text-shadow-opacity`** : The opacity of the shadow.
 * **`text-background-color`** : A color to apply on the text background, may be `none` or a valid color.
 * **`text-background-opacity`** : The opacity of the label background.
 * **`text-background-shape`** : The shape to use for the label background, can be rectangle or roundrectangle.
 * **`text-border-width`** : The border width to put around the label.
 * **`text-border-style`** : The style of the border around the label; may be `solid`, `dotted`, `dashed`, or `double`.
 * **`text-border-color`** : The color of the border around the label.
 * **`min-zoomed-font-size`** : If zooming makes the effective font size of the label smaller than this, then no label is shown.

These properties can only be used on node labels:

 * **`text-halign`** : The vertical alignment of a label; may have value `left`, `center`, or `right`.
 * **`text-valign`** : The vertical alignment of a label; may have value `top`, `center`, or `bottom`.



## Overlay

These properties allow for the creation of overlays on top of nodes or edges, and are often used in the `:active` state.

 * **`overlay-color`** : The colour of the overlay.
 * **`overlay-padding`** : The area outside of the element within which the overlay is shown.
 * **`overlay-opacity`** : The opacity of the overlay.

## Shadow

These properties allow for the creation of shadows on top of nodes or edges. Note that shadow-blur could seriously impact performance on large graph.

 * **`shadow-blur`** :The shadow blur, note that if greater than 0, this could impact performance.
 * **`shadow-color`** : The colour of the shadow.
 * **`shadow-offset-x`** : The x offset relative to the node/edge where the shadow will be displayed, can be negative. If you set blur to 0, add an offset to view your shadow.
 * **`shadow-offset-y`** : The y offset relative to the node/edge where the shadow will be displayed, can be negative. If you set blur to 0, add an offset to view your shadow.
 * **`shadow-opacity`** : The opacity of the shadow.

## Transition animation

 * **`transition-property`** : A comma separated list of style properties to animate in this state.
 * **`transition-duration`** : The length of the transition in seconds (e.g. `0.5s`).
 * **`transition-delay`** : The length of the delay in seconds before the transition occurs (e.g. `250ms`).



## Core

These properties affect UI global to the graph, and apply only to the core.  You can use the special `core` selector string to set these properties.

 * **`active-bg-color`** : The colour of the indicator shown when the background is grabbed by the user.
 * **`active-bg-opacity`** : The opacity of the active background indicator.
 * **`active-bg-size`** : The size of the active background indicator.
 * **`selection-box-color`** : The background colour of the selection box used for drag selection.
 * **`selection-box-border-color`** : The colour of the border on the selection box.
 * **`selection-box-border-width`** : The size of the border on the selection box.
 * **`selection-box-opacity`** : The opacity of the selection box.
 * **`outside-texture-bg-color`** : The colour of the area outside the viewport texture when `initOptions.textureOnViewport === true`.
 * **`outside-texture-bg-opacity`** : The opacity of the area outside the viewport texture.
