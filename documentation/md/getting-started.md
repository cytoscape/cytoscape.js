# Getting started

## Package and runtime

The package currently identifies itself as `cytoscape@4.0.0-unstable`. The
maintainer has chosen npm for the alpha publication, but publication has not
occurred yet.

**TODO_PROVISIONAL —** Once `4.0.0-alpha.1` is actually published, install
that explicit v4 version with a package manager. These commands are not
currently runnable against the public registry:

```sh
npm install cytoscape@4.0.0-alpha.1
pnpm add cytoscape@4.0.0-alpha.1
yarn add cytoscape@4.0.0-alpha.1
bun add cytoscape@4.0.0-alpha.1
```

Sources: [release engineering plan, alpha version](../../plan/rounds/2026-08-04-16-rnd0050-plan-release-engineering.md)
and [12 October publication decision](../../plan/rounds/2026-10-12-01-rnd0000-note-bun-documentation-and-table-benchmark-interview.md#bun-and-runtime-scope-99).

There is no Deno installation path for v4. The interview drops Deno from the
support scope and defers any JSR decision until after alpha. It also requires
**TODO_PROVISIONAL —** the complete Node verification tier to run under Bun
with equivalent executed-test counts; implementation of that full tier remains
planned work. Browser behavior continues to use Playwright. Source: [12 October
interview](../../plan/rounds/2026-10-12-01-rnd0000-note-bun-documentation-and-table-benchmark-interview.md#bun-and-runtime-scope-99).

Import the full entry in a browser application that can provide WebGPU:

```js
import cytoscape from 'cytoscape';

const cy = cytoscape({
  container: document.getElementById('graph'),
  elements: [
    { data: { id: 'a', label: 'Alpha' } },
    { data: { id: 'b', label: 'Beta' } },
    { data: { id: 'ab', source: 'a', target: 'b' } },
  ],
  style: {
    nodes: { label: 'data(label)' },
  },
  layout: { name: 'grid' },
});

await cy.ready;
```

The rendered build needs a non-zero-size container and WebGPU. The factory
throws immediately if the browser has no `navigator.gpu`; a browser can still
expose WebGPU while failing to acquire a usable adapter, in which case
`cy.ready` rejects. Keep both stages in the error path of an application. The
factory creates the model synchronously, ingests initial elements through a
bulk path and starts the requested layout; `ready` reports renderer readiness,
not a general promise that makes graph reads asynchronous.

For CPU-only work, omit the container or import the explicit headless entry:

```js
import cytoscape from 'cytoscape/headless';

const cy = cytoscape({
  elements: [
    { data: { id: 'a' } },
    { data: { id: 'b' } },
    { data: { id: 'ab', source: 'a', target: 'b', weight: 2 } },
  ],
});

const path = cy.elements().dijkstra({
  root: cy.getElementById('a'),
  weight: edge => edge.data('weight'),
}).pathTo(cy.getElementById('b'));
```

`cytoscape/headless` has no renderer or WebGPU code. It includes the CPU
algorithm path and all layouts, with a worker pool where available. If a
headless process needs an explicit GPU algorithm executor or GPU force host,
use `cytoscape/headless-gpu`; it does not provide `png()`, `jpg()`, pointer
gestures or a canvas. An explicit GPU executor rejects when the required device
is not available. An `auto` executor can choose a supported CPU or worker lane
according to that algorithm's documented policy.

In a browser without a module bundler, the full package also builds UMD files.
Once the alpha exists, an application can serve its local UMD bundle and use
the global `cytoscape` factory:

```html
<div id="graph"></div>
<script src="/vendor/cytoscape.min.js"></script>
<script>
  const cy = cytoscape({
    container: document.getElementById('graph'),
    elements: [{ data: { id: 'a' } }],
  });
</script>
```

This is a conditional local asset example, not a public CDN URL: v4 is not
published and this pass does not reserve a release URL. A container-backed
instance has the same WebGPU requirement regardless of how its JavaScript was
loaded.

## Layout and size

The graph container needs explicit layout size from CSS. The following rule is
enough for the example above:

```css
#graph {
  width: 800px;
  height: 600px;
}
```

After construction, query `cy.ready`, then read or mutate the core and its
collections synchronously. For a later layout, create a handle, call `run()`,
and await `promise()` when completion matters:

```js
const layout = cy.layout({ name: 'circle', fit: true });
layout.run();
await layout.promise();
```

Layout lifecycle events are emitted on the core (`layoutstart`,
`layoutready`, `layoutstop`). Layout objects are handles, not event emitters.

The generated API reference is the contract for constructor options, built-in
layouts, algorithms and their failure modes. See [notation](notation.md) for
the graph data forms, [styles](style.md) for sheet values and [layouts](layouts.md)
for layout scope and extension behavior.
