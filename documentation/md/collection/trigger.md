## Examples

```js
var n1 = cy.$('#n1');

n1.on('click', function(){
  console.log('click!!');
});

n1.trigger('click'); // click!!
```