## Details

This function converts given `controlPoints` for an edge with `sourcePoint` and `targetPoint` into corresponding `control-point-distances` and `control-point-weights` and returns them.

`sourcePoint` and `targetPoint` can be either the source and target node positions as in the case of `edge-distances: 'node-position'` or the ends of the line from source to target which is from the outside of the source node’s shape to the outside of the target node’s shape as in the case of `edge-distances: 'intersection'`.

## Examples

```js
var je = cy.$('#je');
var controlPoints = je.controlPoints();
var jPos = je.source().position();
var ePos = je.target().position();

var result = cy.controlsToRelativePositions(controlPoints, jPos, ePos);
var controlPointDistances = result.distances;
var controlPointWeights = result.weights;
```
