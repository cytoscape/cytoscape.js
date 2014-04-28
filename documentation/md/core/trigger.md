## Examples

```js
cy.bind('tap', function(evt, f, b){
  console.log('tap', f, b);
});

cy.trigger('tap', ['foo', 'bar']);
```