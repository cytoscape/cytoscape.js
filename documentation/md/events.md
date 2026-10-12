# Events and interaction

Core and element event methods use literal, space-separated event names.
`cy.on()` and `cy.one()` bind to the core; with three arguments they delegate
to elements using a predicate over the event target. `eles.on()` and `eles.one()`
bind per element in the collection. Core `removeAllListeners()` clears core,
element-bound and delegated listeners. Collection `off(events, handler?)`
removes named event types from its elements; v4 has no collection-wide
remove-every-type method, an open parity question listed in
[the API audit](../api-coverage.md#v3-api-names-without-a-v4-entry-or-alias).

```js
const isNode = ele => ele.isNode();
const onNodeTap = event => {
  const node = event.target;
  console.log(node.id());
};

cy.on('tap', isNode, onNodeTap);
// Later, pass the same predicate and handler function objects.
cy.off('tap', isNode, onNodeTap);
```

Predicates compare by function identity when removing a delegated listener.
Create the predicate once if it needs to be removed later. Collection event
handlers are qualified to their element and continue to work when the store
compacts slots, because the listener follows element identity rather than a
slot number.

Events from an element bubble through its compound ancestors and then to the
core. `stopPropagation()` stops later graph event phases and calls the
underlying DOM event's `stopPropagation()` when available. Returning `false`
from a handler has the same graph bubbling effect. `preventDefault()` only
prevents the browser's default via `originalEvent`; it does not veto selection,
grabbing or other Cytoscape gesture defaults. Use the dedicated options such
as `autounselectify`, `autoungrabify`, `boxSelectionEnabled`,
`userPanningEnabled` or `userZoomingEnabled` to control those interactions.

## Event vocabulary

Event names are literal strings. The built-in interaction vocabulary includes
these families:

- Normalized press events: `tapstart`, `tapdrag`, `tapend`, `tap`, `taphold`,
  `dbltap`, `tapselect`, and `tapunselect`.
- Drag state: `grab`, `grabon`, `drag`, `free`, `freeon`, `dragfree`, and
  `dragfreeon`. The `-on` forms target the directly grabbed element; the plain
  forms also reach selected companions moved with it.
- Drag-hover and context interaction: `tapdragover`/`tapdragout`,
  `cxttapstart`, `cxtdrag`, `cxttapend`, `cxttap`, and
  `cxtdragover`/`cxtdragout`.
- Pointer input: `pointerdown`, `pointermove`, `pointerup`, `pointercancel`,
  `pointerover`, and `pointerout`.
- Viewport gestures: `dragpan`, `scrollzoom`, `pinchzoom`, and `scrollpan`.
  They are core events and carry model/rendered positions where available.
- Selection and box selection: `select`, `unselect`, `boxstart`, `box`,
  `boxend`, and `boxselect`.
- Viewport/model notifications: `pan`, `zoom`, `viewport`, and `position`.

Other emitted core events include element/data changes (`add`, `remove`,
`data`, `patch`), style and batch changes (`style`, `legendchange`,
`batchstart`, `batchend`), layout lifecycle (`layoutstart`, `layoutready`,
`layoutstop`), progressive loading (`loadstart`, `loadchunk`, `loadready`,
`loadstop`), resize/render, device lifecycle and errors, and `destroy`. Their
payloads are described by the corresponding API entries.

The `tapdragover`/`tapdragout` and `cxtdragover`/`cxtdragout` pairs target
nodes only. They use synchronous CPU node picking; they do not promise edge
hover targets. Gesture hit-testing also applies the interaction halo used for
easier edge and node targeting, while `cy.pick()` remains exact geometry. See
the pick methods in the API reference when a query must match geometric API
behavior instead of pointer behavior.

The raw mouse/touch re-emits and `vmouse*` aliases are not emitted;
`pointer*` is the raw-input family. The older `mouseover` and `mouseout` names
remain available too. v4 accepts arbitrary custom names, so it does not reject
a misspelling or a name that no implementation emits. Such a listener
registers but never fires unless application code emits that exact name. The
curated interaction and model event names are also pinned by the gesture
inventory in `playwright-tests/lib/gesture-traces.mjs` and the event record in
`src/README.md`.

Namespaces are not parsed: `'tap.ns'` is one literal type, not a `tap` listener
with namespace metadata. `emit('tap')` does not reach a `'tap.ns'` handler,
while `emit('tap.ns')` reaches that exact name. The same rule governs `off()`.

`Event` exposes `type`, `target`, `cy`, timestamp, optional model and rendered
positions, the original DOM event when one exists, and lifecycle payloads such
as `layout`, `cancelled`, `progress` and `diff` when appropriate. Element event
targets are one-element collections; core events target the core. The
`layout` property identifies the layout instance for lifecycle events. Pointer
positions are translated between model and rendered spaces using the current
viewport.

The interaction vocabulary deliberately separates graph events from browser
defaults. Pointer-derived gestures include hit tolerance and device-specific
semantics; the exact geometric `cy.pick()` API does not apply the gesture halo.
See the API reference for its contract and the core options for independent
gesture controls.
