## Details


This function returns an object of the following form:

```js
{
  pathTo, /* function that computes the shortest path from root node to the argument node (either objects or selector string) */
  distanceTo, /* function that computes the shortest distance from root node to argument node (either objects or selector string) */
  hasNegativeWeightCycle /* true/false. If true, pathTo and distanceTo will be undefined */
}
```

If no weight function is defined, a constance weight of 1 is used for each edge. 


## Examples

```js
var bf = cy.elements().bellmanFord({ root: "j" };
```