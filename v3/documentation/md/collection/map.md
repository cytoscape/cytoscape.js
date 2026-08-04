## Examples

Get an array of node weights:
```js
var weights = cy.nodes().map(function( ele ){
  return ele.data('weight');
});

console.log(weights);
```
