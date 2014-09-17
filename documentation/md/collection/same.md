## Examples

```js
var heavies = cy.$('node[weight > 60]');
var guys = cy.$('#j, #g, #k');

console.log( 'same ? ' + heavies.same(guys) );
```