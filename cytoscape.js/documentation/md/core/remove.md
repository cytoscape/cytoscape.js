## Details

<span class="important-indicator"></span> Note that removing a node necessarily removes its connected edges.

Though the elements specified to this function are removed from the graph, they may still exist in memory.  However, almost all functions will not work on removed elements.  For example, the `eles.neighborhood()` function will fail for a removed element:  An element outside of the context of the graph can not have a neighbourhood defined.  In effect, removed elements just exist so you can restore them back to the originating core instance or to a new instance.

## Examples

Remove an element:

```js
var j = cy.$("#j");
cy.remove( j );
```

Remove a collection:

```js
var collection = cy.elements("node[weight > 50]");
cy.remove( collection );
```

Remove elements matching a selector:

```js
cy.remove("node[weight > 50]"); // remove nodes with weight greater than 50
```
