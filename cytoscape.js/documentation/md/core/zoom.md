## Details

The zoom level must be a positive number.  Zoom levels that are not numbers are ignored; zoom levels that are numbers but outside of the range of valid zoom levels are considered to be the closest, valid zoom level.

When zooming about a point via `cy.zoom( options )`, the options are defined as follows.

For zooming about a rendered position (i.e. a position on-screen):

```js
cy.zoom({
  level: 2.0, // the zoom level
  renderedPosition: { x: 100, y: 100 }
});
```

For zooming about a model position:

```js
cy.zoom({
  level: 2.0, // the zoom level
  position: { x: 0, y: 0 }
});
```

For obvious reasons, you can zoom about a position or a rendered position but not both.  You should specify only one of `options.position` or `options.renderedPosition`.

## Examples

Zoom in to factor 2
```js
cy.zoom(2);
```

Zoom in to the minimum zoom factor
```js
cy.zoom(0); // 0 is outside of the valid range and
            // its closest valid level is the min
```

Zoom in to the maximum zoom factor
```js
cy.zoom(1/0); // infinity is outside of the valid range and
              // its closest valid level is the max
```

Zoom about a node
```js
var pos = cy.nodes("#j").position();
cy.zoom({
  level: 1.5,
  position: pos
});
```