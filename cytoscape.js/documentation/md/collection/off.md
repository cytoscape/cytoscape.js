## Examples

```js
var j = cy.$('#j');
var handler = function(){ console.log('tap') };

// bind
j.on('tap', handler);

// bind some other handler
j.on('tap', function(){
  console.log('some other handler');
});

j.trigger('tap'); // 'tap' & 'some other handler'

// unbind the renferenced handler
j.off('tap', handler);

j.trigger('tap'); // some other handler

// unbind all tap handlers (including unnamed handler)
j.off('tap');
```