## Details

Please note that the passed function to `worker.run()` is copied to the worker, and so it is not possible to make use of references that originate outside of the function itself.  That is, a worker has its own isolated memory space.

## Examples

```js
var w = $$.Worker();

w.run(function(){
  resolve( 3 );
}).then(function( val ){
  console.log( val );

  w.stop();

  next();
});
```