## Details

This function has a shorter alias, `eles.bfs()`.

## Examples

```js
cy.$('#j').bfs(function(i, depth){
  console.log('visit ' + this.id());
}, false);
```