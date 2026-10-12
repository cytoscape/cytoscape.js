# Core

The core (`cy`) is the graph, its stylesheet and its viewport. It owns
instance-wide data, events, loading, layouts, exports and renderer lifetime.
An application creates one core per independent graph/view. `cy.clone()` makes
a second model and renderer when the same graph should appear in another
container; it is not a second renderer attached to one mutable store.

## Construction and readiness

The factory reads `options.elements` through the bulk path and runs
`options.layout` if supplied. It returns a usable core synchronously. With a
container, it also installs the renderer and pointer handler and requires
WebGPU. Missing `navigator.gpu` is a synchronous constructor error; adapter
acquisition is asynchronous and settles through `cy.ready`. In headless mode,
there is no renderer readiness wait and no GPU requirement.

Unknown options are ignored at runtime. TypeScript catches excess option keys
at compile time; runtime option validation does not try to recreate that type
check. Style sheets and structured queries are stricter: their unknown keys
throw because a typo there could otherwise silently alter rendering or match
the whole graph.

## Loading, mutation and batching

`add()` inserts new definitions, columnar data or wire data. Edges in a payload
can refer to nodes supplied alongside them. `patch()` reconciles a fresh view
of the same graph by id: it updates surviving elements, removes absent ones in
reconcile mode and returns added/removed/updated collections. Reconciliation
keeps the surviving element's session state such as listeners and selection;
the payload replaces data fields rather than deep-merging them. Rewiring an
edge is a removal/addition, not an update to its identity.

`load()` progressively consumes an iterable or async iterable of chunks. It
bulk-applies each chunk and gives the renderer a frame between chunks, so a
partial graph can appear while a stream continues. Its promise resolves with
progress counts and can be cancelled. Cancellation stops pulling the source
but keeps already loaded chunks. A layout should start after the load promise
resolves. See [progressive loading](loading.md) for readiness, fit, event and
failure details. `cy.destroy()` cancels active work owned by the core and
disposes its renderer.

Use `cy.batch(fn)` when multiple writes should defer style application to one
outermost flush. Batches nest; the close happens even if the callback throws.
Inside a batch, the model writes have landed but style-derived reads such as
`width()` and `label()` can be stale until `endBatch()`. This is different from
deferred graph writes. Sheet parsing and validation still occur at the
`cy.style(sheet)` call site, while the style application waits for the batch
flush.

```js
cy.batch(() => {
  cy.getElementById('a').data('score', 0.9);
  cy.getElementById('b').position({ x: 120, y: 80 });
  cy.add({ data: { id: 'a-to-b', source: 'a', target: 'b' } });
});
```

## Core data, viewport and events

`cy.data()` is the graph-level data sidecar; `cy.scratch()` is transient
application metadata. Graph data can be serialized, while scratch is not. The
viewport is a zoom factor and pan offset. Programmatic `pan()`/`zoom()` respect
the corresponding enabled flags, and user-gesture gates are separate controls.
`fit()`, `center()`, and the extent readers use the renderer/model bounds
contract rather than changing element positions.

The core can listen, delegate by an element predicate, emit custom events and
remove listeners. `removeAllListeners()` on the core also removes
element-bound and delegated listeners. The event vocabulary and bubbling rules
are described in [events](events.md). Layout lifecycle events are raised on
the core. Async algorithm runs and progressive loads also report their own
events and can be cancelled through their returned handles.

## Exports and independent views

`cy.json()` returns a plain inspection/export object. It is export-only;
`cy.json(object)` is not a restore form. `cy.serialize()` writes the compact
binary wire representation. Rendered `png()` and `jpg()` exports are
asynchronous GPU readbacks and reject on a headless core. [Image export](exports.md)
describes output encodings, viewport versus full-graph bounds, scaling and
format-specific backgrounds. Planned SVG export is documented separately as
provisional and is not a current method.

`cy.clone(options)` builds another independent instance. It can override its
container, stylesheet, zoom, pan or layout; optional follow mode syncs element
payload changes by serialize-and-patch. The follower owns its own view and
interaction state. Selection and hover do not become linked automatically;
an application that needs linked brushing should connect the two cores'
events. Scratch and active animations/layouts are not copied.

See the generated API reference for exact overloads and errors. The
[notation](notation.md) page distinguishes JSON, columnar and wire forms; the
[getting-started](getting-started.md) page distinguishes rendered and headless
entries.
