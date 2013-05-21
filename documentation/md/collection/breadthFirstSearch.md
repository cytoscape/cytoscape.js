## Details

This function has a shorter alias, `eles.bfs()`.

## Examples

```js
cy.$('#n0').bfs(function(i, depth){
  console.log('visitiing ' + this.id());
}, true);
```