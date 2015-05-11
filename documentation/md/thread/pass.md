## Details

This function allows for sending data to the thread.  The data must be serialisable via `JSON.stringify()`.


## Examples

```js
var t = cytoscape.Thread();

t.pass( { foo: 1, bar: 2 } ).run(function( data ){
  data.foo++;
  data.bar++;

  resolve(data);
}).then(function( data ){
  console.log( data );

  t1.stop();
});
```