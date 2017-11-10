## Details

Note that this function performs Dijkstra's algorithm on only the subset of the graph in the calling collection.

This function returns an object of the following form:

```js
{
  distanceTo: function( node ){ /* impl */ }
  pathTo: function( node ){ /* impl */ }
}
```

`distanceTo(node)` returns the distance from the source node to `node`, and `pathTo(node)` returns a collection containing the shortest path from the source node to `node`.  The path starts with the source node and includes the edges between the nodes in the path such that if `pathTo(node)[i]` is an edge, then `pathTo(node)[i-1]` is the previous node in the path and `pathTo(node)[i+1]` is the next node in the path.

If no weight function is defined, a constant weight of 1 is used for each edge. 


## Examples

```js
var dijkstra = cy.elements().dijkstra('#e', function(edge){
  return edge.data('weight');
});

var pathToJ = dijkstra.pathTo( cy.$('#j') );
var distToJ = dijkstra.distanceTo( cy.$('#j') );
```
