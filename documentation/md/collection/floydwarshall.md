## Details


This function returns an object of the following form:

```
{
  pathTo, /* function that computes the shortest path between 2 nodes (either objects or selector strings) */
  distanceTo /* function that computes the shortest distance between 2 nodes (either objects or selector strings) */
}
```

the function receives an "options" object as argument, which has the following form:

```
{
  weight, /* Optional. Weight function */
  directed /* Optional. Whether consider this a directed (true) or undirected graph (false) */
}
```

If no weight function is defined, a constance weight of 1 is used for each edge. 


## Examples

```js
var res = cy.elements().floydWarshall({});
```