## Details

This function returns the same object that is used for [initialisation](#core/initialisation).  You will find this function useful if you would like to save the entire state of the graph, either for your own purposes or for future restoration of that graph state.

This function can also be used to set graph state as in `cy.json( cyJson )`, where each field in `cyJson` is to be mutated in the graph.  For each field defined in `cyJson`, `cy` is updated to match with the corresponding events emitted.   This allows for declarative changes on the graph to be made.

For `cy.json( cyJson )`, all mutable [initialisation options](#core/initialisation) are supported.

When setting `cy.json({ elements: ... })`

* the included elements are mutated as specified (i.e. as they would be by [`ele.json( eleJson )`](#collection/data/ele.json)),
* the included elements not in the graph are added, and
* the not included elements are removed from the graph.

When setting `cy.json({ style: ... })`

* the entire stylesheet is replaced, and
* the style is recalculated for each element.

Updating the stylesheet is expensive.  Similarly, it can potentially be expensive to update the existing elements for large graphs --- as each element needs to be considered, and potentially each field per element.  For elements, a much cheaper option is to selectively call `ele.json(...)` with only the fields that need to be updated.

## Examples

```js
console.log( cy.json() );
```

```js
cy.json({
  zoom: 2
});
```
