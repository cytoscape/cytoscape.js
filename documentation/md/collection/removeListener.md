## Examples

```js
var j = cy.$('#j');
var handler = function(){ console.log('tap') };

// listen
j.on('tap', handler);

// listen with some other handler
j.on('tap', function(){
  console.log('some other handler');
});

j.emit('tap'); // 'tap' & 'some other handler'

// remove the renferenced listener handler
j.removeListener('tap', handler);

j.emit('tap'); // some other handler

// remove all tap listener handlers (including unnamed handler)
j.removeListener('tap');
```
