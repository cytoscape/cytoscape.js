## Examples

```js
var handler;
cy.onRender(handler = function(){
  console.log('frame rendered');
});

cy.offRender( handler );
```