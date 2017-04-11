## Details

For each event specified to this function, the handler function is triggered once.  This is useful for one-off events that occur on just one element in the calling collection.

## Examples

```js
cy.$('node').once('click', function(e){
  var ele = e.target;
  console.log('clicked ' + ele.id());
});
```