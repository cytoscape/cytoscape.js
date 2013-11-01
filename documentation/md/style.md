Style in Cytoscape.js follows CSS conventions as closely as possible.  In most cases, a property has the same name and behaviour as its corresponding CSS namesake.  However, the properties in CSS are not sufficient to specify the style of some parts of the graph.  In that case, additional properties are introduced that are unique to Cytoscape.js.

It is important to note that in your stylesheet, [specificity rules](http://www.w3.org/TR/css3-selectors/#specificity) are completely ignored.  In CSS, specificity often makes stylesheets behave in ways contrary to developer's natural mental model.  This is terrible, because it wastes time and overcomplicates things.  Thus, there is no analogue of CSS specificity in Cytoscape.js stylesheets.  For a given style property for a given element, the last matching selector wins.  In general, you should be using something along the lines of [OOCSS](http://oocss.org) principles, anyway &mdash; making specificity essentially irrelevant.



## Format

The style specified at [initialisation](#core/initialisation) can be in a functional format or in a plain JSON format, the plain JSON format being more useful if you want to pull down the style from the server.


### Plain JSON format

```js
$('#cy').cytoscape({
  // ...

  style: [
    {
      selector: 'node',
      css: {
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
$('#cy').cytoscape({
  // ...

  style: cytoscape.stylesheet()
    .selector('node')
      .css({
        'background-color': 'blue'
      })

      // ...


  // , ...
});
```


## Properties

### Notes

 * Colours may be specified by name (e.g. `red`), hex (e.g. `#ff0000` or `#f00`), RGB (e.g. `rgb(255, 0, 0)`), or HSL (e.g. `hsl(0, 100%, 50%)`).
 * Values requiring a number, such as a length, can be specified in pixel values (e.g. `24px`), unitless values that are implicitly in pixels (`24`), or em values (e.g. `2em`).
 * Opacity values are specified as numbers ranging on `0 <= opacity <= 1`.
 


### Element properties

These properties can be used on any element.

Labels:

 * **`color`** :  The colour of the element's label.
 * **`content`** : The text to display for an element's label.
 * **`font-family`** : A [comma-separated list of font names](http://www.w3schools.com/cssref/pr_font_font-family.asp) to use on the label text.
 * **`font-size`** : The size of the label text.
 * **`font-style`** : A [CSS font style](http://www.w3schools.com/cssref/pr_font_font-style.asp) to be applied to the label text.
 * **`font-weight`** : A [CSS font weight](http://www.w3schools.com/cssref/pr_font_weight.asp) to be applied to the label text.
 * **`text-opacity`** : The opacity of the label text, including its outline.
 * **`text-outline-color`** : The colour of the outline around the element's label text.
 * **`text-outline-opacity`** : The opacity of the outline on label text.
 * **`text-outline-width`** : The size of the outline on label text.

Size & visibility:

 * **`opacity`** * : The opacity of the element.
 * **`visibility`** : Whether the element is visible; can be `visible` or `hidden`.
 * **`width`** : The element's width; the line width for edges or the horizontal size of a node.
 * **`z-index`** : A non-negative integer that specifies the z-ordering of the element.  An element with a higher `z-index` is put on top of an element with a lower value.

For overlays (e.g. used in `:active` state):

 * **`overlay-color`** : The colour of the overlay.
 * **`overlay-padding`** : The area outside of the element within which the overlay is shown.
 * **`overlay-opacity`** : The opacity of the overlay.


### Node properties

These properties apply only to nodes.

Labels:

 * **`text-halign`** : The vertical alignment of a label; may have value `left`, `center`, or `right`.
 * **`text-valign`** : The vertical alignment of a label; may have value `top`, `center`, or `bottom`.

Body:

 * **`background-image`** : The URL that points to the image that should be used as the node's background.
 * **`background-color`** : The colour of the node's body.
 * **`background-opacity`** : The opacity level of the node's body.
 * **`border-color`** : The colour of the node's border.
 * **`border-opacity`** : The opacity of the node's border.
 * **`border-width`** : The size of the node's border.
 * **`height`** : The height of the node's body.
 * **`shape`** : The shape of the node's body; may be `rectangle`, `roundrectangle`, `ellipse`, `triangle`, `pentagon`, `hexagon`, `heptagon`, `octagon`.

Compound nodes:

 * **`padding-left`** : The size of the area on the left of the compound node that can not be occupied by child nodes.
 * **`padding-right`** : The size of the area on the right of the compound node that can not be occupied by child nodes.
 * **`padding-top`** : The size of the area on the top of the compound node that can not be occupied by child nodes.
 * **`padding-bottom`** : The size of the area on the bottom of the compound node that can not be occupied by child nodes.




### Edge properties

These properties apply only to edges:

 * **`line-color`** : The colour of the edge's line.
 * **`line-style`** : The style of the edge's line; may be `solid`, `dotted`, or `dashed`.
 * **`source-arrow-color`** : The colour of the edge's arrow on the source side.
 * **`source-arrow-shape`** : The shape of the edge's arrow on the source side; may be `tee`, `triangle`, `square`, `circle`, `diamond`, or `none`.
 * **`target-arrow-color`** : The colour of the edge's arrow on the target side.
 * **`target-arrow-shape`** : The shape of the edge's arrow on the target side; may be `tee`, `triangle`, `square`, `circle`, `diamond`, or `none`.

### Core properties

These properties apply only to the core.  You can use the special `core` selector string to set these properties.

 * **`active-bg-color`** : The colour of the indicator shown when the background is grabbed by the user.
 * **`active-bg-opacity`** : The opacity of the active background indicator.
 * **`active-bg-size`** : The size of the active background indicator.
 * **`selection-box-color`** : The background colour of the selection box used for drag selection.
 * **`selection-box-border-color`** : The colour of the border on the selection box.
 * **`selection-box-border-width`** : The size of the border on the selection box.
 * **`selection-box-opacity`** : The opacity of the selection box.



## Mappers

In addition to specifying the value of a property outright, the developer may also use a mapper to dynamically specify the property value.

**`data()`** specifies a direct mapping to an element's data field.  For example, `data(descr)` would map a property to the value in an element's `descr` field in its data (i.e. `ele.data("descr")`).  This is useful for mapping to properties like label text content (the `content` property).

**`mapData()`** specifies a linear mapping to an element's data field.  For example, `data(weight, 0, 100, blue, red)` maps an element's weight to gradients between blue and red for weights between 0 and 100.  An element with `ele.data("weight") === 0` would  be mapped to blue, for instance.  Elements whose values fall outside of the specified range are mapped to the extremity values.  In the previous example, an element with `ele.data("weight") === -1` would be mapped to blue.