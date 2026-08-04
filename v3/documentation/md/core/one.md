## Examples

```js
cy.one('tap', 'node', function(){
  console.log('tap!');
});

cy.$('node').eq(0).trigger('tap'); // tap!
cy.$('node').eq(1).trigger('tap'); // nothing b/c already tapped
```