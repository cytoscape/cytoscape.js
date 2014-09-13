## Details

Note that this function performs `A Star` search on only the subset of the graph in the calling collection.

This function returns an object of the following form:

```
{
  found, /* true or false */
  distance, /* Distance of the shortest path, if found */
  path /* Array of node ids in the shortest path, if found */
}
```

the function receives an "options" object as argument, which has the following form:

```
{
  root, /* Mandatory. Starting node, wither object or selector string */
  weight, /* Optional. Weight function */
  heuristic, /* Optional. Heuristic function to guide search */
  directed, /* Optional. Whether consider this a directed (true) or undirected graph (false) */
  goal /* Mandatory. Node to search for a path to. Either object or selector string. */
}
```

If no weight function is defined, a constance weight of 1 is used for each edge. 
If no heuristic function is provided, a constant null function will be used, turning this into the same behaviour as Dijkstra's algorithm. Heuristic should be monotonic (also called consistent) in addition of being 'admissible'.


## Examples

```js
var options = {root: "#1", goal: "#2"};
var res = cy.elements().aStar(options);
```