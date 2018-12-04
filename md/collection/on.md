## Examples

```js
cy.$('#j').on('tap', function(evt){
  console.log( 'tap ' + evt.target.id() );
});
```
