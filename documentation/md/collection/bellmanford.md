## Details


This function returns an object of the following form:

```
{
  pathTo, /* function that computes the shortest path from root node to the argument node (either objects or selector string) */
  distanceTo, /* function that computes the shortest distance from root node to argument node (either objects or selector string) */
  hasNegativeWeightCycle /* true/false. If true, pathTo and distanceTo will be undefined */
}
```

the function receives an "options" object as argument, which has the following form:

```
{
  root, /* Mandatory. Starting node */
  weight, /* Optional. Weight function */
  directed /* Optional. Whether consider this a directed (true) or undirected graph (false) */,
}
```

If no weight function is defined, a constance weight of 1 is used for each edge. 


## Examples

```js
var options = {root: "#1"};
var res = cy.elements().bellmanFord(options);
```