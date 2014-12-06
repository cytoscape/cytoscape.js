## Details

This function allows the developer to pass data back outside of the worker.


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