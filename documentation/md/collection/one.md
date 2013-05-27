## Details

For each event specified to this function, the handler function is triggered once per element.  This is useful for one-off events that occur on each element once.

## Examples

```js
cy.$('node').one('tap', function(e){
  var ele = e.cyTarget;
  console.log('tapped ' + ele.id());
});
```