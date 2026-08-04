## Details

This function pans the graph viewport origin to the specified rendered pixel position.

## Examples

Pan the graph to (100, 100) rendered pixels.
```js
cy.pan({
  x: 100,
  y: 100 
});

console.log( cy.pan() ); // prints { x: 100, y: 100 }
```