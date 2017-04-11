## Details

For each event specified to this function, the handler function is triggered once per element.  This is useful for one-off events that occur on each element in the calling collection once.  

The semantics is a bit more complicated for compound nodes where a delegate selector has been specified:  Note that the handler is called once per element in the *calling collection*, and the handler is triggered by matching descendant elements.

## Examples

```js
cy.$('node').one('tap', function(e){
  var ele = e.target;
  console.log('tapped ' + ele.id());
});
```