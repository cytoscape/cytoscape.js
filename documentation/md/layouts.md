# Layouts

A layout computes model-space node positions. The core supports whole-graph
runs through `cy.layout(options)` and scoped runs through
`eles.layout(options)`. Creating a layout returns a handle; no positions change
until `run()`. Await `promise()` to know that `layoutstop` has fired. The
`layoutstart`, `layoutready` and `layoutstop` lifecycle events belong to the
core, not the layout handle.

```js
const layout = cy.layout({
  name: 'flow',
  direction: 'rightward',
  nodeSep: 48,
  rankSep: 72,
});

cy.on('layoutstop', event => {
  if (event.layout === layout) console.log('positions are ready');
});

layout.run();
await layout.promise();
```

## Built-in families

The current built-ins are `grid`, `preset`, `circle`, `concentric`,
`breadthfirst`, `random`, `radial`, `pack`, `force` and `flow`. Discrete
geometric layouts place nodes in grids, rings, ranks, trees or a supplied
position map. `pack` rearranges disconnected components without changing a
component's internal coordinates. The seeded `random` layout can repeat a
placement when given the same seed.

`force` is spring/electric and can relax current positions or initialize a
fresh arrangement. It supports finite settle runs, streamed/infinite runs,
overlap separation, component packing and optional placement constraints.
Its executor can use a reproducible CPU reference, a worker or GPU integration
where the selected build and environment support it. The GPU path is
asynchronous and its live trajectory is not bit-for-bit stable between runs;
the CPU path is the reproducible reference. During a live GPU force run, the
GPU owns the position column and CPU position reads are stale until the run's
readback. Read after `layoutstop` or `promise()` when final CPU-visible
coordinates matter.

`flow` is a layered directed-graph layout. It computes node positions only;
pair it with an edge routing style such as `curve-style: 'taxi'` or a Bezier
route so edges remain routed when nodes move. The `breadthfirst` layout handles
depth rows or circles; `radial` assigns hierarchy-aware angular wedges. The
complete option table, with defaults and constraints for each built-in, is in
[layout options](layout-options.md). It also records which controls are shared
and which are specific to one algorithm.

Shared layout options control collection scope, animation/finishing,
viewport fit, padding, spacing and transforms. A layout may use element
collections for convenience or the slot-oriented context for lower allocation
cost. Under headless builds, dimensions are available from configured headless
width/height; text dimensions are estimates because no renderer has laid out
glyphs.

The shared finishing path can apply `transform(node, position)`, animate
positions, filter which nodes are animated and fit the viewport once to the
result. `nodeDimensionsIncludeLabels` opts into label-sized dimensions where a
layout's geometry calculations support it. Flow-specific layer assignment
uses directed edges, minimum edge lengths and optional cycle removal before
assigning ranks; its result is positions, so edge paths remain a style/render
concern. `force` offers fresh randomized initialization or relaxation from
current coordinates, overlap resolution and component tidying. Its CPU mode is
the reproducible reference. A live GPU run owns the position column until
readback; CPU position reads can be stale until completion.

## Stop, cancel and scope

`stop()` asks the implementation to stop and keeps the positions it reached.
`cancel()` abandons a run; after the implementation settles, the wrapper
restores the starting positions and rejects the run promise with
`CancelledError`. Destroying the core cancels its active layout. A layout
created from a collection receives that collection as its scope; whole-graph
layouts see the current graph.

## Direct extension contract

There is no string-based registry or `cytoscape.use()` requirement. Pass a
class or object implementing `run(ctx)` directly as `impl`. `run()` may return
a promise. The context provides the core, options, node/edge slots, positions,
endpoints, bounds, dimensions, connected components and helpers to write or
finish a placement. `nodeSlots()` is the slot-native movable-node list;
`setPositions()` is the tracked bulk write. `finish()` applies the shared
fit/animation lifecycle. An optional `stop()` cooperates with a normal stop;
an implementation may also supply `cancel()` or `reheat()` where its run
supports those operations.

```js
class RowLayout {
  run(ctx) {
    const slots = ctx.nodeSlots();
    const xy = new Float32Array(slots.length * 2);

    for (let i = 0; i < slots.length; i++) {
      xy[i * 2] = i * 80;
      xy[i * 2 + 1] = 0;
    }

    ctx.finish(slots, xy);
  }
}

const layout = cy.layout({ impl: RowLayout });
layout.run();
await layout.promise();
```

The example uses the public `LayoutContext` instead of reaching into
`cy._store`. A custom layout can instead call `setPositions()` for a direct
bulk write, but `finish()` is the helper that applies shared layout options,
fit and lifecycle behavior. See the generated `LayoutContext` and `LayoutImpl`
reference before publishing an extension.
