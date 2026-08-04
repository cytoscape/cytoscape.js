## Details

Note that this function performs hierarchical clustering on only the subset of the graph in the calling collection.  Hierarchical clustering does not normally take into account the topology of the graph.

This function returns an array, containing collections.  Each collection in the array is a cluster found by the algorithm.


## Examples

```js
var clusters = cy.elements().hca({
  mode: 'threshold',
  threshold: 25,
  attributes: [
    function( node ){ return node.data('weight'); }
  ]
});
```
