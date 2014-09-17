## Details

Note that this function performs A* search on only the subset of the graph in the calling collection.

This function returns an object of the following form:

```js
{
  found, /* true or false */
  distance, /* Distance of the shortest path, if found */
  path /* Ordered collection of elements in the shortest path, if found */
}
```

Regarding optional options:

* If no weight function is defined, a constant weight of 1 is used for each edge. 
* If no heuristic function is provided, a constant null function will be used, turning this into the same behaviour as Dijkstra's algorithm. The heuristic should be monotonic (also called consistent) in addition to being 'admissible'.


## Examples

```js
var aStar = cy.elements().aStar({ root: "#j", goal: "#e" });

aStar.path.select();
```