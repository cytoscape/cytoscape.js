## Examples

```js
cy.bind('click', function(evt, foo, bar){
  console.log('click');
});

cy.trigger('click', ['foo', 'bar']);
```