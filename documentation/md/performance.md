# Performance

v4 is built around a CPU-canonical columnar model. Hot graph fields are stored
in typed arrays, arbitrary data is kept in sidecars, and an id index supports
direct lookup. This avoids creating and retaining one mutable JavaScript
object per field access. Collections are the public convenience layer; APIs
that consume or produce columns/slots can avoid materializing a handle for
every element when operating on large graphs.

## Loading and mutation

For bulk input, prefer the constructor's `elements` option, a columnar payload
or streamed `cy.load()` chunks over a loop of one-element mutations. The
classic object format is convenient at application boundaries; convert it to
columnar form when allocation and transfer volume matter. `load()` applies
chunks progressively and lets a rendered graph draw between them.

Use `cy.batch()` when several writes can share one stylesheet application.
It defers style work to the outermost end of the batch; reads of derived style
values may be stale inside it. `cy.patch()` can preserve the state of surviving
elements during data refresh, but it still scans and applies a diff. Its cost
depends on id overlap and on which fields changed, so compare it with
recreation for the application's actual workload instead of treating it as a
universal faster path.

## Queries and collections

Structured query objects test indexed flags and data columns without making a
predicate closure and element handle for every candidate. Use
`getElementById()` for a direct id lookup. Query objects are deliberately less
expressive than an arbitrary function; predicates remain available when the
application needs custom logic. A predicate pays the per-element callback and
handle cost, so use the structured form for common state/data filtering when it
expresses the rule.

The layout context exposes slot-oriented reads/writes for custom implementations.
Built-ins use these paths where suitable, and `setPositions()` batches the
tracked position updates. Directly modifying a public live column is not a
supported optimization; it can skip renderer dirty notifications and leave
the displayed graph stale.

## Algorithms and layouts

Algorithm execution policy is per algorithm. Some algorithms are synchronous
CPU routines; whole-graph routines may return a cancelable promise and select
between CPU, worker and GPU executors. An explicit executor may reject when
the build or environment does not provide it. `'cpu'` is the reproducible
reference for APIs that offer it. `'auto'` is a policy choice, not a promise
that the GPU always wins or that all algorithms have a GPU implementation.
Read each method's API entry before relying on result timing or numerical
details.

The `force` layout can move its simulation to a worker or GPU. During a live
GPU force run, the position column is GPU-owned and CPU reads are stale until
the layout's readback at completion. Its live stream also does not emit one
CPU position event per node. Await the run or read at `layoutstop` when final
positions or CPU-side persistence matter. GPU trajectories can vary in
floating-point order; the CPU executor is the repeatable reference.

## Rendering costs and limits

The full build keeps persistent GPU buffers and uses GPU geometry, label,
culling and pick paths. Labels, mapped styles, edge routes, arrows and
compound bounds add work that a node-only graph does not have. Measure the
features and graph shapes the application actually uses. Headless mode avoids
the renderer entirely, but headless text dimensions are estimates; a rendered
font atlas provides the glyph measurements used for exact label layout.

Avoid benchmarking only constructor time or total graph throughput. A useful
profile separates conversion, first visible chunk, settled layout, interaction,
dirty style updates, export/readback, memory and allocations. The repository's
benchmarks record those costs for concrete workloads; their reports are
measurements of those machines and fixtures, not a performance guarantee or a
public pass/fail budget.
