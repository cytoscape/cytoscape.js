# Queries instead of selectors

v4 has no selector-string grammar. Pass a structured query object or a
predicate function to `cy.elements()`, `cy.nodes()`, `cy.edges()`,
`cy.filter()` or `eles.filter()`. A query is validated and unknown keys throw;
a predicate is called for each element and can contain arbitrary application
logic.

```js
const selectedHighScores = cy.nodes({
  selected: true,
  data: { score: { gte: 0.8 } },
});

const readyForLayout = cy.nodes(node =>
  node.data('status') === 'ready' && !node.locked(),
);
```

Every supplied query term must hold. The `group` term can constrain a query to
`'nodes'` or `'edges'`; the node- and edge-specific collection methods also
restrict the search directly. State fields include `selected`, `selectable`,
`locked`, `grabbed`, `grabbable`, `active`, `hovered` and `emphasized`.
Structural node flags include `parent`, `childless`, `child`, `orphan` and
`collapsed`. These share state names with style conditionals so that the
elements an application can style can also be queried.

Data values use a bare value for strict equality, or a condition object with
exactly one operator: `eq`, `ne`, `lt`, `lte`, `gt`, `gte` or `in`. Missing
data fails all comparisons, including `ne`. Numeric operators require a
number. `in` requires a non-empty array. For a typed core, TypeScript restricts
data keys to the element data shape.

```js
const heavyEdges = cy.edges({
  data: { weight: { gt: 2 }, kind: { in: ['activation', 'binding'] } },
});

const notSelectedParents = cy.nodes({
  parent: true,
  selected: false,
});
```

The `cy.$` alias remains for symmetry and compatibility, but it takes the
same query/predicate inputs as `cy.filter()`. A selector string such as
`'node:selected'` throws with a migration explanation. `cy.getElementById(id)`
is the direct O(1) id lookup for a single id; it avoids building a query.

Core event delegation also uses a predicate, not a selector. For example,
`cy.on('tap', node => node.isNode(), handler)` runs only for events whose
target passes that function. Element collection events bind to each element in
the receiver. See [events](events.md) for event ownership and removal.

This model is intentionally small: queries cover indexed state and data tests,
while predicates provide a clear escape hatch. If a future query builder or
serialized query syntax is considered, it should compile to this same query
contract rather than inventing a second selector language.
