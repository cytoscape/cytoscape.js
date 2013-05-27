## Examples

```js
cy.bind('tap', function(evt, foo, bar){
  console.log('tap');
});

cy.trigger('tap', ['foo', 'bar']);
```