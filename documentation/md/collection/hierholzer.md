## Details

Note that this function performs Hierholzer's algorithm on only the subset of the graph in the calling collection.

This function returns an object of the following form:

```js
{
  found, /* true or false */
  trail /* Ordered collection of elements in the Eulerian trail or cycle, if found */
}
```

Regarding optional options:

* If no root node is provided, the first node in the collection will be taken as the starting node in the algorithm.
* The graph is assumed to be undirected unless specified otherwise.


## Examples

```js
var hierholzer = cy.elements().hierholzer({ root: "#j", directed: true });

hierholzer.trail.select();
```
