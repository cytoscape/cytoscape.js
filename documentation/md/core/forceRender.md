## Details

This function is useful where manually causing the graph to visually update is required.  For example, if your code resizes the graph's dimensions (i.e. by changing the size of the HTML DOM element that holds the graph), you will want to call `cy.forceRender()` to have the graph resize and redraw itself.