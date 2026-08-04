## Details

Note that this function performs affinity propagation clustering on only the subset of the graph in the calling collection.  Affinity propagation does not normally take into account the topology of the graph.

This function returns an array, containing collections.  Each collection in the array is a cluster found by the algorithm.


## Examples

```js
var clusters = cy.elements().ap({
  attributes: [
    function( node ){ return node.data('weight'); }
  ]
});
```
