## Examples

```js
var t = cytoscape.Thread();

t.run(function(){
  listen(function( msg ){
  	console.log( 'thread heard: ' + [msg.foo, msg.bar].join(' ') );

    broadcast( msg ); // just send it back
  });
});

t.on('message', function( e ){
  var msg = e.message;

  console.log( 'main js entity/thread heard: ' + [msg.foo, msg.bar].join(' ') );

  t.stop();
});

t.message({ foo: 'hello', bar: 'world' });
```