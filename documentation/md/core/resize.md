## Details

If your code resizes the graph's dimensions or position (i.e. by changing the style of the HTML DOM element that holds the graph), you will want to call `cy.resize()` to have the graph resize and redraw itself.

Cytoscape.js can not automatically monitor the bounding box of the viewport, as querying the DOM for those dimensions can be expensive.  Although `cy.resize()` is automatically called for you on the `window`'s `resize` event, there is no `resize` or `style` event for arbitrary DOM elements.