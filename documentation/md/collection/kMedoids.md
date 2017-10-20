## Details

Note that this function performs k-mediods clustering on only the subset of the graph in the calling collection.  K-medoids does not normally take into consideration topology.

This function returns an array, containing collections.  Each collection in the array is a cluster found by the algorithm.

One of the major differences between the k-means and k-medoids algorithms is the manner in which the cluster centres are initialized. In k-means, the cluster centres (centroids) are vectors with elements initialised to random values within each dimension's range. In k-medoids, the cluster centres (medoids) are random nodes from the data set.  

The other is that the k-means algorithm determines new cluster centres by taking the average of all the nodes within that cluster, whereas k-medoids selects the node with the lowest configuration cost as the new cluster centre.

## Examples

```js
var clusters = cy.elements().kMediods({
  k: 2,
  attributes: [
    function( node ){ return edge.data('weight'); }
  ]
});
```
