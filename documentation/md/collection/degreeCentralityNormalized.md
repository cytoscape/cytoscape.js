## Details

For `options.directed: false`, this function returns an object of the following form:

```js
{
  /* the normalised degree centrality of the specified node */
  degree: function( node ){ /* impl */ }
}
```

For `options.directed: true`, this function returns an object of the following form:

```js
{
  /* the normalised indegree centrality of the specified node */
  indegree: function( node ){ /* impl */ },

  /* the normalised outdegree centrality of the specified node */ 
  outdegree: function( node ){ /* impl */ }
}
```

## Examples

```js
var dcn = cy.$().dcn();
console.log( 'dcn of j: ' + dcn.degree('#j') );
```