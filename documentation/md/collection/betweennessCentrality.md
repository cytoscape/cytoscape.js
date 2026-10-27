## Details

This function returns an object of the form:

```js
{
  /* returns the betweenness centrality of the specified node */
  betweenness: function( node ){ /* impl */ },

  /* returns the normalised betweenness centrality of the specified node */
  betweennessNormalized: function( node ){ /* impl */ }
  /* alias : betweennessNormalised() */
}
```

On an undirected graph (the default, `directed: false`), `betweenness()` counts each pair of nodes once in each direction, so its values are twice those of the usual undirected definition: for the path `a`–`b`–`c`, `betweenness('#b')` is 2 rather than 1. Halve them to compare with other tools. `betweennessNormalized()` divides by the largest value, so it is not affected.

## Examples

```js
var bc = cy.$().bc();
console.log( 'bc of j: ' + bc.betweenness('#j') );
```