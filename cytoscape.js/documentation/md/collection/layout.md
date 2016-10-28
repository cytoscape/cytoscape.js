## Details

This function is useful for running a layout on a subset of the elements in the graph.

For layouts included with Cytoscape.js, you can find their options documented in the [Layouts section](#layouts).  For external layouts, please refer to their accompanying documentation.

## Examples

Run the grid layout:

```js
cy.elements().layout({ name: 'grid' });
```