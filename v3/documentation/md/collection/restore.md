## Details

This function puts back elements in the graph that have been removed.  It will do nothing if the elements are already in the graph.

An element can not be restored if its ID is the same as an element already in the graph.  You should specify an alternative ID for the element you want to add in that case.

## Examples

```js
// remove selected elements
var eles = cy.$(':selected').remove();

// ... then some time later put them back
eles.restore();

```