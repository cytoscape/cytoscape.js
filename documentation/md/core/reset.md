## Details

This resets the viewport to its state when Cytoscape Web was last loaded with [cy.load()](Core-load) &mdash; that is, the default viewport state or origin of the graph.

## Examples

```js
cy.pan( somePosition );
cy.zoom( someZoomLevel );
cy.reset(); // reset back to the viewport state at (1)
```