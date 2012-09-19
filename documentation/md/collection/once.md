## Details

For each event specified to this function, the handler function is triggered once.  This is useful for one-off events that occur on just one element in the collection.

## Examples

```js
cy.$('node').once('click', function(){
  var ele = this;
  console.log('clicked ' + ele.id());
});

cy.$('#n1').trigger('click'); // clicked n1
cy.$('#n1').trigger('click'); // nothing
cy.$('#n2').trigger('click'); // nothing
```