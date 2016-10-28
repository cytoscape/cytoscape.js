The `cose` (Compound Spring Embedder) layout uses a physics simulation to lay out graphs.  It works well with noncompound graphs and it has additional logic to support compound graphs well.

It was implemented by [Gerardo Huck](https://www.linkedin.com/in/gerardohuck) as part of Google Summer of Code 2013 (Mentors: Max Franz, Christian Lopes, Anders Riutta, Ugur Dogrusoz).

Based on the article ["A layout algorithm for undirected compound graphs"](http://dl.acm.org/citation.cfm?id=1498047&CFID=429377863&CFTOKEN=94691144) by Ugur Dogrusoz, Erhan Giral, Ahmet Cetintas, Ali Civril and Emek Demir.

The `cose` layout is very fast and produces good results.  The [`cose-bilkent`](https://github.com/cytoscape/cytoscape.js-cose-bilkent) extension is an evolution of the algorithm that is more computationally expensive but produces near-perfect results.
