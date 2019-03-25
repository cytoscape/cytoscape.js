## Examples

Remove all classes:

```js
cy.nodes().classes([]); // array
cy.nodes().classes(''); // space-separated string
```

Replace classes:

```js
cy.nodes().classes(['foo']); // array
cy.nodes().classes('foo'); // space-separated string
```
