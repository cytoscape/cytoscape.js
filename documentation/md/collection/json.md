## Details

This function returns the [plain JSON representation](#notation/elements-json) of the element, the same format which is used at initialisation, in [`cy.load()`](#core/graph-manipulation/cy.load), in [`cy.add()`](#core/graph-manipulation/cy.add) etc.

This function can also be used to set the element's state using the [plain JSON representation](#notation/elements-json) of the element.  Each field specified in `ele.json( eleJson )` is diffed against the element's current state, the element is mutated accordingly, and the appropriate events are emitted.  This can be used to declaratively modify elements.

## Examples

```js
console.log( cy.$('#j').json() );
```

```js
cy.$('#j').json({ selected: true });
```
