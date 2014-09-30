## Background

You may notice that performance starts to degrade on graphs with large numbers of elements.  This happens for several reasons:

* Performance is a function of graph size, so performance decreases as the number of elements increases.
* The rich visual styles that Cytoscape.js supports can be very expensive.  Only drawing circles and straight lines is cheap, but drawing complex graphs is not.
* Edges are particularly expensive to render.  Multigraphs become even more expensive with the need for bezier curve edges.
* Interactivity is expensive.  Being able to pan, pinch-to-zoom, drag nodes around, et cetera is expensive &mdash; especially when having to rerender edges.
* The performance of rendering a (bitmap) canvas is a function of the area that it needs to render.  As such, an increased pixel ratio (as in high density displays, like on iPad) can significantly decrease rendering performance.


## Optimisations

You can get much better performance out of Cytoscape.js by tuning your options, in descending order of significance:

* **Haystacks make fast edges** : Set your edges `curve-style` to `haystack` in your stylesheet.  Haystack edges are straight lines, which are much less expensive to render than `bezier` edges.
* **Batch element modifications** : Use [`cy.batch()`](#core/graph-manipulation/cy.batch) to modify many elements at once.
* The pixel ratio is set for you to `1.0` by default.  If you want crisper rendering at the expense of performance, you can set `initOptions.pixelRatio: 'auto'`.  If you want even greater performance, you can experiment with pixel ratios less than `1.0`, e.g. `initOptions.pixelRatio: 0.666`.
* **Use textured zoom & pan** : Set `textureOnViewport` to `true` in your [initialisation options](#core/initialisation).  Rather than rerendering the entire scene, this makes a texture cache of the viewport at the start of pan and zoom operations, and manipulates that instead.  Makes panning and zooming much smoother for large graphs.
* **Labels** : Drawing labels is expensive.
 * If you can go without them or show them on tap/mouseover, you'll get better performance.
 * Consider not having labels for edges.
 * Consider setting `min-zoomed-font-size` in your style so that when labels are small &mdash; and hard to read anyway &mdash; they are not rendered.  When the labels are at least the size you set (i.e. the user zooms in), they will be visible.
* **Animations** : You will get better performance without animations.  If using animations anyway:
 * [`eles.flashClass()`](#collection/style/eles.flashClass) is a cheaper alternative than a smooth animation.
 * Try to limit the number of concurrent animating elements.
 * When using transition animations in the style, make sure `transition-property` is defined only for states that you want to animate.  If you have `transition-property` defined in a default state, the animation will try to run more often than if you limit it to particular states you actually want to animate.
* **Simplify edge style** : Use solid edges.  Dotted and dashed edges are much more expensive to draw, so you will get increased performance by not using them.  Edge arrows are also expensive to render, so consider not using them if they do not have any semantic meaning in your graph.
* **Simplify node style** : Keep your node styles simple to improve performance.  
 * Background images are very expensive in certain cases.  The most performant background images are non-repeating (`background-repeat: no-repeat`) and non-clipped (`background-clip: none`).  For simple node shapes like squares or circles, you can use `background-fit` for scaling and preclip your images to simulate software clipping (e.g. with [Gulp](https://github.com/scalableminds/gulp-image-resize) so it's automated).  In lieu of preclipping, you could make clever use of PNGs with transparent backgrounds.
 * Node borders can be slightly expensive, so you can experiment with removing them to see if it makes a noticeable difference for your use case.
* **Hide edges during interactivity** : Set `hideEdgesOnViewport` to `true` in your [initialisation options](#core/initialisation).  This makes interactivity a lot less expensive by hiding edges during pan, mouse wheel zoom, pinch-to-zoom, and node drag actions.
* **Hide labels during interactivity** : Set `hideLabelsOnViewport` to `true` in your [initialisation options](#core/initialisation).  This works similarly to hiding edges on viewport operations.

By making these optimisations, you can increase the performance of Cytoscape.js such that you can have high performance graphs several orders of magnitude greater in size.