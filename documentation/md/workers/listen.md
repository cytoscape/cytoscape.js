## Examples

```js
var w = $$.Worker();

w.run(function(){
  listen(function( m ){
  	console.log( 'worker heard: ' + e.message );

    message(m);
  });
});

w.on('message', function(e){
  console.log( 'main js entity/thread heard: ' + e.message );

  w.stop();
});

w.message('hello there');
```