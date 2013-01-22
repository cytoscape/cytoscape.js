 * **Compound nodes** : A compound node is one that has children nodes.  They behave much like parent divs in HTML.  Support for compound nodes is half finished.  Support is in the core, and we will add support in the canvas renderer.

 * **Layouts from Cytoscape Web** : Several layouts from Cytoscape Web will be written for Cytoscape.js, including the hierarchical layout, the circle layout, and so on.

 * **Graph importers** : Cytoscape.js supports graph data in JSON format.  We will not be adding support for other formats in Cytoscape.js itself, but we will be working to create a separate library that could be used on the client side or the server side (via Node.js) to convert formats like GraphML and XGMML to JSON.