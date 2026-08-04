## Details


This function returns an object of the following form:

```js
{
  /* Collection of edges that are in the cut */
  cut,

  /* Array of collections corresponding to the components
  containing each disjoint subset of nodes defined by the cut */
  components
}
```

## Examples

```js
var ks = cy.elements().kargerStein();

ks.cut.select();
```
