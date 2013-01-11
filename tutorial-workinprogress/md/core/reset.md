## Details

This resets the viewport to the origin (0, 0) at zoom level 1.

## Examples

```js
cy.pan({ x: 100, y: 100 });
cy.zoom( 2 );
cy.reset();
```