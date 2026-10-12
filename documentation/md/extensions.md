# Extensions

The v4 extension surface documented here is the layout implementation
contract. A custom layout is passed directly to `cy.layout({ impl })` or
`eles.layout({ impl })`; it is a class or object with `run(ctx)`. There is no
global layout registry, extension string, or `cytoscape.use()` step. The
returned wrapper adds `run()`, `promise()`, `stop()`, `cancel()` and `reheat()`
to the implementation lifecycle. Layout lifecycle events are emitted on the
core.

The `LayoutContext` is a supported seam between an extension and the columnar
core. It exposes a `cy` reference and resolved options; scope and node handles
can be materialized lazily. For slot-native code, `nodeSlots()` provides the
movable nodes, `edgeSlots()` the scoped edges, `positions()`/`endpoints()` the
live columns, and `degreeOf()`/`components()`/`nodeDimensions()` supply common
graph and geometry reads. Do not write directly into the live position
column: that bypasses dirty tracking. Use `setPositions()` or compute a packed
coordinate array and call `finish()`.

`finish(slots, xy)` applies the shared layout options and, when requested,
routes the placement through the common animation finisher. It also owns
`layoutready`/`layoutstop` for that path. A layout that writes positions
directly still gets the wrapper's lifecycle when `run()` settles. `run(ctx)`
may be asynchronous. A `stop()` method supports normal early stop; a `cancel()`
method can abandon work so the wrapper restores the pre-run positions after
the implementation settles. `reheat()` is used by live layouts whose fields
can become active again.

The following skeleton is a complete, intentionally small example:

```js
class RowLayout {
  run(ctx) {
    const slots = ctx.nodeSlots();
    const positions = new Float32Array(slots.length * 2);

    for (let i = 0; i < slots.length; i++) {
      positions[2 * i] = i * 80;
      positions[2 * i + 1] = 0;
    }

    ctx.finish(slots, positions);
  }
}

const handle = cy.layout({ impl: RowLayout, fit: true });
handle.run();
await handle.promise();
```

This example uses only the documented layout context. It intentionally does
not reach through private store fields or hold slot numbers after a run. A
subset layout receives the requested collection as its scope. Custom knobs
are available on `ctx.options`; keep them serializable when callers need to
persist layout settings. The full option and lifecycle contracts are in the
generated API reference and `src/layout/contract.mts`.

Core, collection and renderer extension points are not promised by this page.
The broader v3 extension catalogue is historical and does not establish a v4
registry. A separate extension toolchain remains a planned round, not part of
this prose/API scope.
