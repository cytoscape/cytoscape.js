## Background

You may notice that performance starts to degrade on graphs with large numbers of elements.  This happens for several reasons:

* Performance is a function of graph size, so performance decreases as the number of elements increases.
* The rich visual styles that Cytoscape.js supports can be expensive.  Only drawing circles and straight lines is cheap, but drawing complex graphs is less so.
* Edges are particularly expensive to render.  Multigraphs become even more expensive with the need for bezier curve edges.
* The performance of rendering a (bitmap) canvas is a function of the area that it needs to render.  As such, an increased pixel ratio (as in high density displays, like on the iPad) can decrease rendering performance.


## Optimisations

You can get much better performance out of Cytoscape.js by tuning your options, in descending order of significance:

* **Batch element modifications** : Use [`cy.batch()`](#core/graph-manipulation/cy.batch) to modify many elements at once.
* **Animations** : You will get better performance without animations.  If using animations anyway:
 * [`eles.flashClass()`](#collection/style/eles.flashClass) is a cheaper alternative than a smooth animation.
 * Try to limit the number of concurrent animating elements.
 * When using transition animations in the style, make sure `transition-property` is defined only for states that you want to animate.  If you have `transition-property` defined in a default state, the animation will try to run more often than if you limit it to particular states you actually want to animate.
* **Function style property values** : While convenient, function style property values can be expensive.  Thus, it may be worthwhile to use caching if possible, such as by using the lodash [`_.memoize()`](https://lodash.com/docs#memoize) function.  If your style property value is a simple passthrough or linear mapping, consider using `data()` or `mapData()` instead.
* **Labels** : Drawing labels is expensive.
 * If you can go without them or show them on tap/mouseover, you'll get better performance.
 * Consider not having labels for edges.
 * Consider setting `min-zoomed-font-size` in your style so that when labels are small --- and hard to read anyway --- they are not rendered.  When the labels are at least the size you set (i.e. the user zooms in), they will be visible.
 * Background and outlines increase the expense of rendering labels.
* **Simplify edge style** : Drawing edges can be expensive.
 * Set your edges `curve-style` to `haystack` in your stylesheet.  Haystack edges are straight lines, which are much less expensive to render than `bezier` edges.  This is the default edge style.
 * Shadows are very expensive.  Avoid them if performance becomes an issue.
 * Use solid edges.  Dotted and dashed edges are much more expensive to draw, so you will get increased performance by not using them.  
 * Edge arrows are expensive to render, so consider not using them if they do not have any semantic meaning in your graph.
 * Opaque edges with arrows are more than twice as fast as semitransparent edges with arrows.
* **Simplify node style** : Certain styles for nodes can be expensive.
 * Shadows are very expensive.  Avoid them if performance becomes an issue.
 * Background images are very expensive in certain cases.  The most performant background images are non-repeating (`background-repeat: no-repeat`) and non-clipped (`background-clip: none`).  For simple node shapes like squares or circles, you can use `background-fit` for scaling and preclip your images to simulate software clipping (e.g. with [Gulp](https://github.com/scalableminds/gulp-image-resize) so it's automated).  In lieu of preclipping, you could make clever use of PNGs with transparent backgrounds.
 * Node borders can be slightly expensive, so you can experiment with removing them to see if it makes a noticeable difference for your use case.
* **Set a lower pixel ratio** : Because it is more expensive to render more pixels, you can set `pixelRatio` to `1` [in the initialisation options](#init-opts/pixelRatio) to increase performance for large graphs on high density displays.  However, this makes the rendering less crisp.
* **Compound nodes** : [Compound nodes](#notation/compound-nodes) make style calculations and rendering more expensive.  If your graph does not require compound nodes, you can improve performance by not using compound parent nodes.
* **Hide edges during interactivity** : Set `hideEdgesOnViewport` to `true` in your [initialisation options](#core/initialisation).  This can make interactivity  less expensive for very large graphs by hiding edges during pan, mouse wheel zoom, pinch-to-zoom, and node drag actions.  This option makes a difference on only very, very large graphs.
* **Use textured zoom & pan** : Set `textureOnViewport` to `true` in your [initialisation options](#core/initialisation).  Rather than rerendering the entire scene, this makes a texture cache of the viewport at the start of pan and zoom operations, and manipulates that instead.  Makes panning and zooming smoother for very large graphs.  This option makes a difference on only very, very large graphs.
