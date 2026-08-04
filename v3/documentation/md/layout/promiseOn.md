## Examples

```js
var layout = cy.layout({ name: 'random' });

layout.pon('layoutstop').then(function( event ){
  console.log('layoutstop promise fulfilled');
});

layout.run();
```
