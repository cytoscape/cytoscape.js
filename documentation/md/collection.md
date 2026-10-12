# Collections

The public collection abstraction represents an ordered set of handles tied
to one core. `cy.elements()` returns all live elements with nodes first and
edges second; `cy.nodes()` and `cy.edges()` narrow the result. An element
lookup returns a collection of length zero or one, so the same methods work
for a missing id, one element or a larger traversal result. Empty collections
are valid values.

Collection APIs make the unit of work explicit. Methods such as `forEach()`
visit length-one element collections. `map()` returns a plain array in
collection order. `first()`, `last()` and `eq(i)` return collections, not
unwrapped element objects. Scalar queries such as `id()`, `position()` and
`data()` read from the first element; they answer `undefined` when there is no
first element. Bulk mutators apply to every element and typically return the
same collection for chaining.

```js
const a = cy.getElementById('a');
const adjacentNodes = a.neighborhood().nodes();
const ids = adjacentNodes.map(node => node.id());

const totalWeight = cy.edges().reduce(
  (sum, edge) => sum + edge.data('weight'),
  0,
);
```

## Set operations and filtering

Collections can be unioned, intersected, subtracted or compared. These
operations return new collections and deduplicate elements by their identity;
they do not mutate the graph. `filter()` accepts a query object or a predicate
function. Query objects operate on state and data columns; predicates run once
per element and can express application logic not included in the query form.
Unknown query keys throw. See [selectors](selectors.md) for the supported
query vocabulary.

## Graph changes and lifecycle

`remove()` deletes the receiver, cascading from a removed node to descendant
elements and incident edges. It returns the closure actually removed. Those
handles are terminal references; only cached identity methods such as `id()`
and `group()` remain readable. `cy.add()` consumes element definitions,
columnar input, wire buffers or an iterable of definitions. There is no
`restore()` method and no element-level clone operation.

`move()` changes topology without replacing identity: `{ parent }` reparents
nodes, while `{ source, target }` changes edge endpoints. The modes are
exclusive and `parent` takes precedence if both are present. `data()` updates
application fields; `id`, edge endpoints and parent are first-class immutable
fields. A position write is in model units. `positions(fn)` maps a function
over nodes and writes the resulting coordinates in bulk.

Selections and interaction state (`selected`, `locked`, `grabbable`,
`pannable`, emphasis and visibility) are element state. They can be queried and
mutated through collection methods. Classes and class strings are not part of
v4: use data, query predicates and declarative style conditions instead.

## Traversal, layouts and algorithms

Collections can traverse edge incidence (`source`, `target`,
`connectedNodes`, `connectedEdges`, `outgoers`, `incomers` and neighborhood),
compound containment (`parent`, `parents`, `children`, `descendants` and
`siblings`) and directed reachability (`successors`, `predecessors`, `roots`,
`leaves`). Compound ancestry remains distinct from graph connectivity. A
collection can scope a layout with `eles.layout(options)`; the resulting
handle uses the same `run()`, `promise()` and `stop()` lifecycle as a core
layout.

The algorithm family includes synchronous searches and paths, spanning and
cut algorithms, centrality measures and clustering, plus larger async
whole-graph algorithms. For example:

```js
const result = cy.elements().breadthFirstSearch({
  roots: cy.getElementById('a'),
  directed: true,
  visit(node, edge, previous, index, depth) {
    if (node.id() === 'goal') return true;
  },
});

console.log(result.found, result.path);
```

The `roots` argument is a collection, not a selector string. The callback
receives the visited node, incoming edge, node it came from, visit index and
depth; returning `true` stops and records that node as `found`, while `false`
stops without a found node. Search callbacks and result fields are documented
on `breadthFirstSearch()` and `depthFirstSearch()`. Async whole-graph
algorithms return a promise augmented with `cancel()`. Cancelling a pending
run rejects that promise with `CancelledError`; a synchronous CPU run may
already have settled before `cancel()` is called. Executor availability and
failures are specific to each method. The generated API reference carries the
full options, result shapes and errors.

Current v4 collection members use the `eles.` namespace in the reference even
when a v3 page named the method under `ele`, `node`, `nodes`, `edge` or `edges`.
Some old spellings are real v4 aliases, but similar names are not enough to
claim migration. The coverage inventory records the mapping and the five
undecided gaps.
