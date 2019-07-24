
The function of a layout is to set the positions on the nodes in the graph.  Layouts are [extensions](#extensions/layouts) of Cytoscape.js such that it is possible for anyone to write a layout without modifying the library itself.

Several layouts are included with Cytoscape.js by default, and their options are described in the sections that follow with the default values specified.  Note that you must set `options.name` to the name of the layout to specify which one you want to run.

Each layout has its own algorithm for setting the position for each node.  This algorithm influences the overall shape of the graph and the lengths of the edges.  A layout's algorithm can be customised by setting its options.  Therefore, edge lengths can be controlled by setting the layout options appropriately.

For force-directed (physics) layouts, there is generally an option to set a weight to each edge to affect the relative edge lengths.  Edge length can also be affected by options like spacing factors, angles, and overlap avoidance.  Setting edge length depends on the particular layout, and some layouts will allow for more precise edge lengths than others.

A layout runs on the subgraph that you specify.  All elements in the graph are used for [`cy.layout()`](#cy.layout).  The specified subset of elements is used for [`eles.layout()`](#eles.layout).  In either case, the state of each element does not affect whether the element is considered in the layout.  For example, an [invisible node](#style/visibility) is repositioned by a layout if the node is included in the layout's set of elements.  You may use `eles.layout()` to address complex use-cases, like running a different layout on each component.
