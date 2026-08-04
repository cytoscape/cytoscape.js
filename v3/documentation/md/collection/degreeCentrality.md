## Details

For `options.directed: false`, this function returns an object of the following form:

```js
{
  degree /* the degree centrality of the root node */
}
```

For `options.directed: true`, this function returns an object of the following form:

```js
{
  indegree, /* the indegree centrality of the root node */
  outdegree /* the outdegree centrality of the root node */
}
```

## Examples

```js
console.log( 'dc of j: ' + cy.$().dc({ root: '#j' }).degree );
```