## Examples

```js
var j = cy.$('#j');

j.on('tap', function(){
  console.log('tap!!');
});

j.emit('tap'); // tap!!
```
