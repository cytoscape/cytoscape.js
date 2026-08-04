## Details

Events are bound only to the currently existing elements; they must exist at the time your code makes the call to `eles.on()`. Alternatively, use core event handlers (`cy.on()`) to attach event handlers.

## Examples

```js
cy.$('#j').on('tap', function(evt){
  console.log( 'tap ' + evt.target.id() );
});
```
