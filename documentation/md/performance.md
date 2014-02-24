## Background

You may notice that performance starts to degrade on graphs with large numbers of elements.  This happens for several reasons:

* Performance is a function of graph size, so performance decreases as the number of elements increases.
* The rich visual styles that Cytoscape.js supports can be very expensive.  Only drawing circles and straight lines is cheap, but drawing complex graphs is not.
* Edges are particularly expensive to render.  Multigraphs become even more expensive with the need for bezier curve edges.
* Interactivity is expensive.  Being able to pan, pinch-to-zoom, drag nodes around, et cetera is expensive &mdash; especially when having to rerender edges.


## Optimisations

You can get much better performance out of Cytoscape.js by tuning your options:

* **Haystacks make fast edges** : Set your edges `curve-style` to `haystack` in your stylesheet.  Haystack edges are straight lines, which are much less expensive to render than `bezier` edges.
* **Hide edges during interactivity** : Set `hideEdgesOnViewport` to `true` in your [initialisation options](#core/initialisation).  This makes interactivity a lot less expensive by hiding edges during pan, mouse wheel zoom, pinch-to-zoom, and node drag actions.
* **Simplify node style** : Keep your node styles simple to improve performance.  Background images are very expensive, so you should remove them if you need high performance.  Node borders can be slightly expensive, so you can experiment with removing them to see if it makes a noticeable difference for your use case.
* **Concise stylsheets are fast stylesheets** : Try to keep your stylesheets from getting overly long.  Cut out unused blocks and try to limit the number of blocks &mdash; and therefore selectors &mdash; you have.  Each time style needs to be recalculated, each block's selector needs to be compared to each element.  Note that usually stylesheet length has a much lesser effect on performance than other factors.

By making these optimisations, you can increase the performance of Cytoscape.js such that you can have high performance graphs several orders of magnitude greater in size.