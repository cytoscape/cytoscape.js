## Examples

```js
var t = cytoscape.thread();

function foo(){
  return 'bar';
}

t.require( foo );

t.run(function(){
  var ret = foo();

  console.log( 't::foo() return value: ' + ret );

  broadcast( ret );
});

t.on('message', function( e ){
  var msg = e.message;
  var ret = msg;

  console.log( 'return value as heard by main JS thread/entity: ' + ret );

  t.stop();
});

```