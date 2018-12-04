## Examples

```js
cy.on('tap', function(evt, f, b){
  console.log('tap', f, b);
});

cy.emit('tap', ['foo', 'bar']);
```
