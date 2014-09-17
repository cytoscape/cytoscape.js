## Details

Two edges are said to be codirected if they connect the same two nodes in the same direction: The edges have the same source and target.

That is, `edge1.source().id() === edge2.source().id() && edge1.target().id() === edge2.target().id()`.

## Examples

```js
cy.$('#je').codirectedEdges(); // only self in this case
```