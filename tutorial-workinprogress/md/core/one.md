## Examples

```js
cy.one('click', 'node', function(){
  console.log('click!');
});

cy.$('node').eq(0).trigger('click'); // click!
cy.$('node').eq(1).trigger('click'); // nothing b/c already clicked
```