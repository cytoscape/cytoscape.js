## Examples

```js
var j = cy.$('#j');
var guys = cy.$('#j, #g, #k');

console.log( 'any same ? ' + j.anySame(guys) );
```