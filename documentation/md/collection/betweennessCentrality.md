## Details

This function returns an object of the form:

```js
{
  /* returns the betweenness centrality of the specified node */
  betweenness: function( node ){ /* impl */ },

  /* returns the normalised betweenness centrality of the specified node */
  betweennessNormalized: function( node ){ /* impl */ },
  /* alias : betweennessNormalised() */

  /* returns the betweenness centrality of the specified edge */
  betweennessEdge: function( edge ){ /* impl */ },

  /* returns the normalised betweenness centrality of the specified edge */
  betweennessEdgeNormalized: function( edge ){ /* impl */ },
  /* alias : betweennessEdgeNormalised() */
}
```

## Examples

```js
var bc = cy.$().bc();
console.log( 'bc of j: ' + bc.betweenness('#j') );
```