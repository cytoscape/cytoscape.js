## Details

This function shifts the viewport relatively by the specified position in rendered pixels.  That is, specifying a shift of 100 to the right means a translation of 100 on-screen pixels to the right.

## Examples

Pan the graph 100 pixels to the right.
```js
cy.panBy({
  x: 100,
  y: 0 
});
```