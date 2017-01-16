## Details

If your code resizes the graph's dimensions or position (i.e. by changing the style of the HTML DOM element that holds the graph, or by changing the DOM element's position in the DOM tree), you will want to call `cy.resize()` to have the graph resize and redraw itself.

If tapping in the graph is offset rather than at the correct position, then a call to `cy.resize()` is necessary.  Tapping can also become offset if the container element is not empty; the container is expected to be empty so the visualisation can use it.

Cytoscape.js can not automatically monitor the bounding box of the viewport, as querying the DOM for those dimensions can be expensive.  Although `cy.resize()` is automatically called for you on the `window`'s `resize` event, there is no `resize` or `style` event for arbitrary DOM elements.
