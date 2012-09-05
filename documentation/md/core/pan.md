## Details

This function pans the graph viewport origin to the specified rendered pixel [position](Position).

## Examples

Pan the graph to (100, 100) rendered pixels.
```js
cy.pan({
  x: 100, // note these fields work with the SVG renderer
  y: 100  // but an alternate renderer may use different coordinates
});

console.log( cy.pan() ); // prints { x: 100, y: 100 }
```