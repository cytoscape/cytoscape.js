## Examples

```js
var layout = cy.makeLayout({ name: 'random' });

layout.pon('layoutstop').then(function( event ){
  console.log('layoutstop promise fulfilled');
});

layout.run();
```
