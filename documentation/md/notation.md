# Notation and graph data

## Nodes, edges and compounds

A graph contains nodes and directed edges. A node has a stable `id`; an edge
has its own `id`, a `source` node id and a `target` node id. Application fields
belong under `data`. A node may also have one `parent` node id, which models
compound containment. Compound ancestry is a tree relation: it does not create
multiple parents or replace pairwise edge topology.

```js
const elements = [
  { data: { id: 'pathway', label: 'Pathway' } },
  { data: { id: 'a', parent: 'pathway', score: 0.7 } },
  { data: { id: 'b', parent: 'pathway', score: 0.2 } },
  { data: { id: 'a-to-b', source: 'a', target: 'b', weight: 3 } },
];
```

`id`, `source`, `target` and `parent` are first-class fields. They can be read
through `data()` but are not ordinary mutable data keys: use `move()` to
re-parent a node or re-point an edge. Other `data` values are application
state; writes refresh data-driven style mappings and emit the corresponding
events. With TypeScript, explicit `cytoscape<NodeData, EdgeData>(...)`
generics type node and edge data separately. The generics are not inferred
from constructor options.

## Model and rendered coordinates

`position()` reads or writes node coordinates in model space. The core viewport
maps model coordinates into rendered CSS pixels through its zoom and pan.
`renderedPosition()` and the rendered bounds methods use that displayed
coordinate system. Use `cy.pan()` and `cy.zoom()` for a view change; they do
not move nodes. `cy.fit()` and `cy.center()` derive a viewport from element
bounds, with labels included where the bounds contract says so. Headless cores
still have model positions and configurable dimensions, but no rendered
canvas.

An element's public handle is a one-element `Collection`; a `Collection` is
the ordinary public view for zero, one or many elements. It is not a raw array
of mutable internal records. Scalar collection reads generally use the first
element and return `undefined` when the collection is empty; bulk methods
explicitly say when they return an array, a collection or a per-element
result. Public APIs read from and update the CPU-canonical model synchronously.

Removed elements are terminally removed. A removal result can include the
receiver's descendants and incident edges, and those returned handles are
dead; cached `id()` and `group()` are the remaining identity reads. v4 does not
restore a removed handle or add an element collection back into a graph.
Retain definitions or serialized data if an application needs to recreate
those elements.

## Three element input forms

The classic element-definition form accepts one element, an array, or a
`{ nodes, edges }` object. Nodes are established before edges in one add/load
operation, so edges may refer to nodes in that same payload. Input can be
provided to the constructor or passed to `cy.add()`, `cy.patch()` and `cy.load()`.
An add into a populated graph fires per-element `add` events; the constructor's
initial bulk ingest happens before a listener can exist.

The columnar form stores grouped fields in typed-array columns and represents
edge endpoints as references to node positions in the payload. It is intended
for large imports and streaming chunks where allocating one object per element
would be costly. `cytoscape.toColumnarElements()` converts classic v3-style
element JSON to this form. The public type is `ColumnarElements`; use its
documented shape rather than assuming an internal column order.

The binary wire form is emitted by `cy.serialize()` or
`cytoscape.serializeElements()` and accepted by the loading APIs. A whole-graph
serialization is self-contained: edge endpoints resolve within that payload.
It carries graph/element data and current element state needed by the wire
contract, but does not carry a stylesheet, viewport or scratchpad. `cy.json()`
is a readable export, not a restoration API. `serialize()` is the compact
round-trip form; `cytoscape.deserializeElements()` exposes a decoded payload
when an application needs to inspect it.

Wire graph-level `data()` needs care. A constructor load applies that data, and
`cy.serialize()` includes it. `cy.add(buffer)` ignores graph-level data so that
adding elements cannot overwrite the receiving graph's own fields. If the
application intends to replace those fields, read them from the decoded wire
payload and call `cy.data()` explicitly.

## A session is more than its elements

`cy.json()` exports elements, stylesheet, viewport, core flags and graph-level
data as a plain object. That object is useful for inspection or application
storage, but `cy.json(object)` is deliberately not an import form. The core's
columnar model does not retain the original element definitions needed to
restore arbitrary snapshots. `cy.serialize()` is the supported compact wire
export. `cy.clone()` makes another independent core, carrying graph and
selected session state while giving the clone its own renderer, stylesheet,
viewport and interactions. Scratch, active gestures, listeners and running
layouts/animations are not shared.

Overlapping membership and annotations are not part of the implemented graph
model. A provisional design note records directions and open questions in
[provisional behavior](provisional.md); it must not be read as an additional
element kind or an API contract.
