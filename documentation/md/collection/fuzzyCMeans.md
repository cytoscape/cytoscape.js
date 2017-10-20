## Details

Note that this function performs fuzzy c-means clustering on only the subset of the graph in the calling collection.

This function returns an object of the following format:

```js
{
  // The resultant clusters
  clusters: [ /* cluster0, cluster1, ... */ ],

  // A two-dimensional array containing a partition matrix
  // degreeOfMembership[i][j] indicates the degree to which nodes[i] belongs to clusters[j]
  degreeOfMembership: [ /* row0, row1, ... */ ]
}
```

## Examples

```js
var clusters = cy.elements().fuzzyCMeans({
  k: 2,
  attributes: [
    function( node ){ return edge.data('weight'); }
  ]
});
```
