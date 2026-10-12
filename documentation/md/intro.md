# Introduction

Cytoscape.js is a graph model, graph algorithms library and interactive graph
renderer. v4 is an active prototype with a CPU-canonical columnar data model and
a WebGPU renderer. It keeps the graph useful without a browser: the same core,
collection, style and layout APIs can run headlessly, and the pure CPU paths
remain available for tests and server-side work.

The package has three entries. `cytoscape` includes the renderer and pointer
interaction. A rendered instance requires WebGPU at construction; absence of
`navigator.gpu` throws synchronously, while adapter acquisition happens later
and is reported by `cy.ready`. `cytoscape/headless` carries the graph model,
style, CPU algorithms and layouts without renderer or WebGPU code.
`cytoscape/headless-gpu` adds GPU algorithm executors and a headless GPU force
host, but still has no renderer. All three entries have the same graph and
collection model. Pick the entry for the work the process needs to perform,
not as a way to silently substitute a renderer when no device is available.

The default graph and API keep Cytoscape.js's familiar nodes, edges and
compound-parent relationship. The model is columnar rather than a retained
array of mutable element objects: ids, endpoints, positions, flags and other
hot fields live in typed columns; arbitrary application data and metadata live
in sidecars. Public collections provide the convenient element-oriented view.
The renderer mirrors relevant data into persistent GPU buffers and draws
shapes, edges, labels and state. Application reads and writes remain
synchronous; some whole-graph algorithms and rendered exports are asynchronous
because they can be executed on a worker or GPU or require GPU readback.

The v4 surface deliberately differs from the v3 site in several places. There
is no selector-string language or class state; queries are typed objects or
predicate functions. Stylesheets are structured `{ nodes, edges, parents,
core }` sheets with declarative mappers rather than selector blocks or style
functions. Layout extensions are passed directly as implementations. Animation
has no queue. Removed elements are terminal. The API reference and migration
guide document these changes; the v3 pages are a historical reference, not a
contract to copy.

The package is currently marked `4.0.0-unstable`. The 12 October interview
sets npm as the alpha publication channel and postpones reconsideration of JSR
until after alpha. Publication itself has not happened. Bun remains in scope,
**TODO_PROVISIONAL —** complete Node-tier verification under Bun is required
but remains planned work. Deno support is dropped from v4 documentation and
planned support. See the
[authoritative interview](../../plan/rounds/2026-10-12-01-rnd0000-note-bun-documentation-and-table-benchmark-interview.md)
for the release and runtime decision.

This prototype does not yet have its v4 reference site integrated. This source
tree and the generated JSDoc model are the content under review in round 46;
demos, full site wiring and deployment remain later work.
