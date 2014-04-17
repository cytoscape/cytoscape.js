## Background

You may notice that performance starts to degrade on graphs with large numbers of elements.  This happens for several reasons:

* Performance is a function of graph size, so performance decreases as the number of elements increases.
* The rich visual styles that Cytoscape.js supports can be very expensive.  Only drawing circles and straight lines is cheap, but drawing complex graphs is not.
* Edges are particularly expensive to render.  Multigraphs become even more expensive with the need for bezier curve edges.
* Interactivity is expensive.  Being able to pan, pinch-to-zoom, drag nodes around, et cetera is expensive &mdash; especially when having to rerender edges.


## Optimisations

You can get much better performance out of Cytoscape.js by tuning your options, in descending order of significance:

* **Haystacks make fast edges** : Set your edges `curve-style` to `haystack` in your stylesheet.  Haystack edges are straight lines, which are much less expensive to render than `bezier` edges.
* **Hide edges during interactivity** : Set `hideEdgesOnViewport` to `true` in your [initialisation options](#core/initialisation).  This makes interactivity a lot less expensive by hiding edges during pan, mouse wheel zoom, pinch-to-zoom, and node drag actions.
* **Hide labels during interactivity** : Set `hideLabelsOnViewport` to `true` in your [initialisation options](#core/initialisation).  This works similarly to hiding edges on viewport operations.
* **Use textured zoom & pan** : Set `textureOnViewport` to `true` in your [initialisation options](#core/initialisation).  Rather than rerendering the entire scene, this makes a texture cache of the viewport at the start of pan and zoom operations, and manipulates that instead.  Makes panning and zooming much smoother for large graphs.
* **Animations** : You will get better performance without animations.  If using animations anyway:
 * Try to limit the number of concurrent animating elements.
 * When using transition animations in the style, make sure `transition-property` is defined only for states that you want to animate.  If you have `transition-property` defined in a default state, the animation will try to run more often than if you limit it to particular states you actually want to animate.
* **Edge selection** : If your app does not need edge selection, you can get performance gains by unselectifying edges (i.e. `edges.unselectify()`).  This disables selection for edges, so their style will not have to be recalculated during box selection et cetera.
* **Labels** : Drawing labels is expensive.
 * If you can go without them or show them on tap/mouseover, you'll get better performance.
 * Consider not having labels for edges.
 * Consider setting `min-zoomed-font-size` in your style so that when labels are small &mdash; and hard to read anyway &mdash; they are not rendered.  When the labels are at least the size you set (i.e. the user zooms in), they will be visible.
* **Simplify edge style** : Use solid edges.  Dotted and dashed edges are much more expensive to draw, so you will get increased performance by not using them.
* **Simplify node style** : Keep your node styles simple to improve performance.  
 * Background images are very expensive in certain cases.  The most performant background images are non-repeating (`background-repeat: no-repeat`) and non-clipped (`background-clip: none`).  For simple node shapes like squares or circles, you can use `background-fit` for scaling and preclip your images to simulate software clipping (e.g. with [https://github.com/scalableminds/gulp-image-resize](gulp) so it's automated).
 * Node borders can be slightly expensive, so you can experiment with removing them to see if it makes a noticeable difference for your use case.
* **Opacity** : Making elements semitransparent is more expensive than leaving them opaque.  Try to use `visibility: hidden` or `display: none` to hide elements rather than using opacity.
* **Concise stylsheets are fast stylesheets** : Try to keep your stylesheets from getting overly long.  Cut out unused blocks and try to limit the number of blocks &mdash; and therefore selectors &mdash; you have.  Each time style needs to be recalculated, each block's selector needs to be compared to each element.  Note that usually stylesheet length has a much lesser effect on performance than other factors.

By making these optimisations, you can increase the performance of Cytoscape.js such that you can have high performance graphs several orders of magnitude greater in size.