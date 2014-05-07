## Examples

Get an array of node weights:
```js
var weights = cy.nodes().map(function(){
  return this.data('weight');
});
```