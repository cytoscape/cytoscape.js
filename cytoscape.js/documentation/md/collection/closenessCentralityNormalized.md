## Details

This function returns an object of the form:

```js
{
  /* returns the normalised closeness centrality of the specified node */
  closeness: function( node ){ /* impl */ }
}
```

## Examples

```js
var ccn = cy.$().ccn();
console.log( 'ccn of j: ' + ccn.closeness('#j') );
```