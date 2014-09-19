## Details

Two edges are said to be parallel if they connect the same two nodes.  Any two parallel edges may connect nodes in the same direction, in which case the edges share the same source and target.  They may alternatively connect nodes in the opposite direction, in which case the source and target are reversed in the second edge.

That is,
 * `edge1.source().id() === edge2.source().id() && edge1.target().id() === edge2.target().id()` or 
 * `edge1.source().id() === edge2.target().id() && edge1.target().id() === edge2.source().id()`. 

## Examples

```js
cy.$('#je').parallelEdges();
```