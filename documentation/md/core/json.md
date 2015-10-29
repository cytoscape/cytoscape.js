## Details

This function returns the same object that is used for [initialisation](#core/initialisation).  You will find this function useful if you would like to save the entire state of the graph, either for your own purposes or for future restoration of that graph state.

This function can also be used to set graph state as in `cy.json( cyJson )`, where each field in `cyJson` is to be mutated in the graph.  For each field defined in `cyJson`, `cy` is diffed and updated to match with the corresponding events emitted.   This allows for declarative changes on the graph to be made.

For `cy.json( cyJson )`, all mutable [initialisation options](#core/initialisation) are supported.

When setting `cy.json({ elements: ... })`

* the included elements are mutated as specified (i.e. as they would be by [`ele.json( eleJson )`](#collection/data/ele.json)),
* the included elements not in the graph are added, and
* the not included elements are removed from the graph.


## Examples

```js
console.log( cy.json() );
```

```js
cy.json({
  zoom: 2
});
```
