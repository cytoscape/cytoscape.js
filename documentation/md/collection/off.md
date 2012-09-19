## Examples

```js
var n1 = cy.$('#n1');
var handler = function(){ console.log('click') };

// bind
n1.on('click', handler);

// bind some other handler
n1.on('click', function(){
  console.log('some other handler');
});

n1.trigger('click'); // 'click' & 'some other handler'

// unbind the renferenced handler
n1.off('click', handler);

n1.trigger('click'); // some other handler

// unbind all click handlers (including unnamed handler)
n1.off('click');
```