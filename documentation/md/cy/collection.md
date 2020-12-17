## Details

This function is useful for building up collections.

## Examples

Keep a collection of nodes that have been clicked:
```js
var collection = cy.collection();
cy.nodes().on('click', function(e){
  var clickedNode = e.target;

  collection = collection.union(clickedNode);
});
```