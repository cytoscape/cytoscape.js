This is the documentation for the core cytoscape.js object, referred to throughout this documentation as `cy` (i.e. `var cy = ...`), as "the core object", or simply as "the core".

There are several types that different functions can be executed on, and the variable names used to denote these types in the documentation are outlined below.

 * `cy.func()` : works for the core
 * `cy.background().func()` : works for the background
 * `eles.func()` : works for one or more elements (nodes and edges)
  * `ele.func()` : works only for a single element (node or edge)
  * `nodes.func()` : works only for one or more nodes
   * `node.func()` : works only for a single node
  * `edges.func()` : works only for one or more edges
   * `edge.func()` : works only for a single edge
