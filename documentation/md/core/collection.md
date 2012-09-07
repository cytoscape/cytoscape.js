## Details

This function is useful for starting a collection that may have things added to it.

## Examples

Keep a collection of nodes that have been clicked:
```js
var collection = cy.collection();
cy.nodes().live("click", function(){
  collection = collection.add(this);
});
```