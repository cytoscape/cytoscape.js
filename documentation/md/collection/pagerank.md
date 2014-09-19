## Details


This function returns an object of the following form:

```js
{
  rank /* function that computes the rank of a given node (either object or selector string) */
}
```


## Examples

```js
var pr = cy.elements().pageRank();

console.log('g rank: ' + pr.rank('#g'));
```