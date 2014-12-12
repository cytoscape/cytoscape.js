## Details


This function returns an object of the following form:

```js
{
  /* function that computes the shortest path from root node to the argument node
  (either objects or selector string) */
  pathTo: function(node){ /* impl */ }, 

  /* function that computes the shortest distance from root node to argument node
  (either objects or selector string) */
  distanceTo: function(node){ /* impl */ }, 

  /* true/false. If true, pathTo and distanceTo will be undefined */
  hasNegativeWeightCycle 
}
```

If no weight function is defined, a constant weight of 1 is used for each edge. 

The Bellman-Ford algorithm is good at detecting negative weight cycles, but it can not return path or distance results if it finds them.


## Examples

```js
var bf = cy.elements().bellmanFord({ root: "#j" });

bf.pathTo('#g').select();
```