Style in Cytoscape.js follows CSS conventions as closely as possible.  In most cases, a property has the same name and behaviour as its corresponding CSS namesake.  However, the properties in CSS are not sufficient to specify the style of some parts of the graph.  In that case, additional properties are introduced that are unique to Cytoscape.js.



## Properties

### Notes

 * Colours may be specified by name (e.g. `red`), hex (e.g. `#ff0000` or `#f00`), RGB (e.g. `rgb(255, 0, 0)`), or HSL (e.g. `hsl(0, 100%, 50%)`).
 * Values requiring a number, such as a length, can be specified in pixel values (e.g. `24px`), unitless values that are implicitly in pixels (`24`), or em values (e.g. `2em`).
 * Opacity values are specified as numbers ranging on `0 <= opacity <= 1`.

### Element properties

These properties can be used on any element:

 * `cursor` : The [CSS cursor](http://www.w3schools.com/cssref/pr_class_cursor.asp) shown when the cursor is over top the element. 
 * `color` :  The colour of the element's label.
 * `content` : The text to display for an element's label.
 * `text-outline-color` : The colour of the outline around the element's label text.
 * `text-outline-width` : The size of the outline on label text.
 * `text-outline-opacity` : The opacity of the outline on label text.
 * `text-opacity` : The opacity of the label text, including its outline.
 * `font-family` : A [comma-separated list of font names](http://www.w3schools.com/cssref/pr_font_font-family.asp) to use on the label text.
 * `font-style` : A [CSS font style](http://www.w3schools.com/cssref/pr_font_font-style.asp) to be applied to the label text.
 * `font-weight` : A [CSS font weight](http://www.w3schools.com/cssref/pr_font_weight.asp) to be applied to the label text.
 * `font-size` : The size of the label text.
 * `visibility` : Whether the element is visible; can be `visible` or `hidden`.
 * `opacity` : The opacity of the element.
 * `z-index` : A non-negative integer that specifies the z-ordering of the element.  An element with a higher `z-index` is put on top of an element with a lower value.
 * `width` : The element's width; the line width for edges or the horizontal size of a node.

### Node properties

These properties apply only to nodes:

 * `text-valign` : The vertical alignment of a label; may have value `top`, `center`, or `bottom`.
 * `text-halign` : The vertical alignment of a label; may have value `left`, `center`, or `right`.
 * `background-color` : The colour of the node's body.
 * `background-opacity` : The opacity level of the node's body.
 * `background-image` : The URL that points to the image that should be used as the node's background.
 * `border-color` : The colour of the node's border.
 * `border-width` : The size of the node's border.
 * `height` : The height of the node's body.
 * `shape` : The shape of the node's body; may be `rectangle`, `roundrectangle`, `ellipse`, or `triangle`.

### Edge properties

These properties apply only to edges:

 * `source-arrow-shape` : The shape of the edge's arrow on the source side; may be `tee`, `triangle`, `square`, `circle`, `diamond`, or `none`.
 * `source-arrow-color` : The colour of the edge's arrow on the source side.
 * `target-arrow-shape` : The shape of the edge's arrow on the target side; may be `tee`, `triangle`, `square`, `circle`, `diamond`, or `none`.
 * `target-arrow-color` : The colour of the edge's arrow on the target side.
 * `line-color` : The colour of the edge's line.

### Core properties

These properties apply only to the core.  You can use the special `core` selector string to set these properties.

 * `selection-box-color` : The background colour of the selection box used for drag selection.
 * `selection-box-opacity` : The opacity of the selection box.
 * `selection-box-border-color` : The colour of the border on the selection box.
 * `selection-box-border-width` : The size of the border on the selection box.
 * `panning-cursor` : The [CSS cursor](http://www.w3schools.com/cssref/pr_class_cursor.asp) shown when the user pans the graph.



## Mappers

In addition to specifying the value of a property outright, the developer may also use a mapper to dynamically specify the property value.

**`data()`** specifies a direct mapping to an element's data field.  For example, `data(descr)` would map a property to the value in an element's `descr` field in its data (i.e. `ele.data("descr")`).  This is useful for mapping to properties like label text content (the `content` property).

**`mapData()`** specifies a linear mapping to an element's data field.  For example, `data(weight, 0, 100, blue, red)` maps an element's weight to gradients between blue and red for weights between 0 and 100.  An element with `ele.data("weight") === 0` would  be mapped to blue, for instance.  Elements whose values fall outside of the specified range are mapped to the extremity values.  In the previous example, an element with `ele.data("weight") === -1` would be mapped to blue.