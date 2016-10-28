## Details

This resets the viewport to the origin (0, 0) at zoom level 1.

## Examples

```js
setTimeout( function(){
	cy.pan({ x: 50, y: -100 });
}, 1000 );

setTimeout( function(){
	cy.zoom( 2 );
}, 2000 );

setTimeout( function(){
	cy.reset();
}, 3000 );

```