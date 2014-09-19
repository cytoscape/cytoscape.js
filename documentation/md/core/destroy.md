## Details

The `cy.destroy()` function is not necessary but can be convenient in some cases.  It is equivalent to removing the container DOM element from the document and removing any bound listeners from the renderer.

Calling `cy.destroy()` is unnecessary if the container DOM element is removed from the document manually.  In that case, listeners are cleaned up automatically.

To drop the memory used by an instance, it is necessary to drop all of your own references to that instance so it can be garbage collected.