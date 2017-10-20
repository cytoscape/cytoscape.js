## Details

Note that this function performs Markov clustering on only the subset of the graph in the calling collection.  Markov clustering uses the topology of the graph and the specified edge attributes to determine clusters.

This function returns an array, containing collections.  Each collection in the array is a cluster found by the Markov clustering algorithm.

## Examples

```js
var clusters = cy.elements().markovCluster({
  attributes: [
    function( edge ){ return edge.data('closeness'); }
  ]
});
```
