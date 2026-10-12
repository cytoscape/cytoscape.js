# Loading graph data progressively

`cy.load()` ingests an iterable or async iterable whose values are graph
chunks. Each chunk may use the standard element-definition array, a columnar
payload or serialized wire data. It goes through the bulk ingest path, and the
renderer gets a turn between chunks. The first chunk is drawn before the
loader requests the next one, so the page can show correct partial state while
the remaining data arrives.

```js
async function* graphChunks() {
  yield [
    { data: { id: 'a' } },
    { data: { id: 'b' } },
  ];
  yield [{ data: { id: 'ab', source: 'a', target: 'b' } }];
}

cy.on('loadchunk', event => {
  const { chunks, nodes, edges } = event.progress;
  console.log(`chunk ${chunks}: ${nodes} nodes, ${edges} edges so far`);
});

const progress = await cy.load(graphChunks());
console.log(progress); // { chunks: 2, nodes: 2, edges: 1 }
```

An initial load starts while the core has no elements. It keeps `cy.ready`
pending until the first chunk is drawn (or ingested in headless mode), and fits
once to that first chunk by default. A load into a populated graph behaves
like streamed `add()`: it does not replace existing elements, re-fit the
viewport or apply chunk graph-level data. `fit` controls the one initial fit;
`padding` supplies its rendered-pixel padding. No later chunk changes the
viewport. Read `cy.ready` after calling `load()`, since an initial load replaces
the promise with the first-chunk gate.

Each chunk emits `loadchunk` after ingestion. `loadstart` fires before the
source is first read, `loadready` follows the first drawn chunk, and `loadstop`
closes a completed, failed or cancelled run. These events carry a progress
snapshot `{ chunks, nodes, edges }`. Bulk `add` events are also emitted for
inserted elements when listeners are registered. No `loadready` event is
emitted for a source that yields no chunks.

`load()` returns a promise with a required `cancel()` method. Cancelling stops
the iterator, calls its `return()` when available, preserves chunks already
ingested and rejects the promise with `CancelledError`. The `loadstop` event
has `cancelled: true`; normal completion and input failure have `cancelled:
false`. A failed chunk rejects the promise and earlier chunks remain. A chunk
that refers to a node not yet present fails before adding any part of that
chunk. Only one load may run on a core at a time. Start a layout after the
load promise settles, so it sees the final intended graph.

`load()` consumes iterable values as chunks. A top-level array of element
definitions is therefore a sequence of single-definition chunks; to load the
whole array as one chunk, nest it: `cy.load([[nodeA, nodeB]])`. A lone
definition object is not iterable and is rejected. A columnar or wire payload
is also rejected as the source itself because its own iterable shape is not a
chunk stream; wrap that payload in a one-item iterable such as
`cy.load([columnarPayload])`. For a single addition, prefer `cy.add(payload)`.

| Type | Contract |
| --- | --- |
| `LoadOptions` | `fit` fits once to the first chunk (default on for an initial load, off into a populated graph); `padding` is rendered-pixel padding for that fit (default 0). |
| `LoadProgress` | Cumulative `{ chunks, nodes, edges }` counts. |
| `LoadRun` | `Promise<LoadProgress>` augmented with `cancel(): boolean`; cancellation rejects while running, and `cancel()` returns false after settlement. |

The method appears in the generated API reference. These named types are
defined in [`src/core/load.mts`](../../src/core/load.mts); read them for the
source-level TypeScript contract.
