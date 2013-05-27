## Details

Though the elements specified to this function are removed from the graph, they may still exist in memory.  However, some functions will not work on removed elements.  For example, the `neighborhood` function will fail for a removed element:  An element outside of the context of the graph can not have a neighbourhood defined.

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