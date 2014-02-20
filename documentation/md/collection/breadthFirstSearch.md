## Details

By default, the nodes and edges traversed by the algorithm are returned.  If the handler returns `true` for `this` node, then that node is returned instead (i.e. a successful search for a node).  If the handler returns `false` for `this` node, the search is aborted and only the elements traversed up to that point are returned.

This function has a shorter alias, `eles.bfs()`.

## Examples

```js
cy.$('#j').bfs(function(i, depth){
  console.log('visit ' + this.id());
}, false);
```