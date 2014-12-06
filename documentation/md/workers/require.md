## Examples

```js
var w = $$.Worker();

function foo(){
  return 'bar';
}

w.require( foo );

w.run(function(){
  message( foo() );
});

w.on('message', function(e){
  console.log( e.message );

  w.stop();
});

```