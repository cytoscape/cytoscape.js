## Details

The `cy.destroy()` function is not necessary but can be convenient in some cases.  It cleans up references and rendering loops such that the memory used by an instance can be garbage collected.

If you remove the container DOM element from the page, then the instance is cleaned up automatically.  Similarly, calling `cy.destroy()` does this cleanup and removes all the container's children from the page.

When running Cytoscape.js headlessly, using `cy.destroy()` is necessary only if you've explicitly enabled style functionality.

To drop the memory used by an instance, it is necessary to drop all of your own references to that instance so it can be garbage collected.
