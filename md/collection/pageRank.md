## Details


This function returns an object of the following form:

```js
{
  /* function that computes the rank of a given node (either object or selector string) */
  rank: function( node ){ /* impl */ } 
}
```


## Examples

```js
var pr = cy.elements().pageRank();

console.log('g rank: ' + pr.rank('#g'));
```