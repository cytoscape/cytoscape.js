## Examples

Get collection of nodes in order of increasing weight:
```js
var nodes = cy.nodes().sort(function( a, b ){
  return a.data('weight') - b.data('weight');
});

// show order via animations
var duration = 1000;
nodes.removeStyle().forEach(function( node, i ){
  node.delay( i * duration ).animate({
    style: {
      'border-width': 4,
      'border-color': 'green'
    }
  }, { duration: duration });
});

console.log('Animating nodes to show sorted order');
```
