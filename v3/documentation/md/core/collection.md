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

Create a collection of new nodes that have not been added to the graph:
```js
var removedCollection = cy.collection([{ data: { id: 'a' } }, { data: { id: 'b' } }], { removed: true });

removedCollection.forEach(element => {
  console.log(element.removed()); // true
};
```
