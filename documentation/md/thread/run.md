## Details

Please note that the passed function to `thread.run()` is copied to the thread, and so it is not possible to make use of references that originate outside of the function itself.  That is, a thread has its own isolated memory space.

## Examples

```js
var t = cytoscape.thread();

t.run(function(){
  resolve( 3 );
}).then(function( val ){
  console.log( 'resolved value: ' + val );

  t.stop();
});
```