## Details


This function returns an object of the following form:

```
{
  rank /* function that computes the rank of a given node (either object or selector string) */
}
```

the function receives an "options" object as argument, which has the following form:

```
{
  dampingFactor, /* Optional */
  precision, /* Optional */
  iterations /* Optional */
}
```


## Examples

```js
var res = cy.elements().pageRank();
```