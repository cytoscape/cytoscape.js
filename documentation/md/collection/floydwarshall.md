## Details


This function returns an object of the following form:

```js
{
  pathTo, /* function that computes the shortest path between 2 nodes (either objects or selector strings) */
  distanceTo /* function that computes the shortest distance between 2 nodes (either objects or selector strings) */
}
```

If no weight function is defined, a constant weight of 1 is used for each edge. 


## Examples

```js
var fw = cy.elements().floydWarshall();
```