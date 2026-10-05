## Partial scale domains and legend JSON

Round 147 implements the scalar domain foundation and application-facing
legend contract from the 3 October alpha interview. The change is isolated in
commit `95e346f5` in the round clone;
the parent integration can pick up that commit independently.

Numeric continuous and quantize domains now accept `auto` at the first or
last stop while preserving authored stops separately from live resolved
bounds. Diverging mappings keep their explicit midpoint fixed. Ordinal
categories named `auto` remain categories, threshold cuts stay explicit, and
invalid authored domains still fail before stylesheet mutation. Empty,
degenerate, invalid-order and transform-incompatible extents are unresolved
rather than receiving invented fallback bounds; values then use the authored
fallback or channel default, warn once per installed mapping, and recover as
eligible data arrives. Add/remove/data/reparent changes update the relevant
source population, while batches coalesce work and an unchanged bound updates
only changed elements. Explicit domains keep the local fast path.

The CPU evaluator and packed GPU program both use the resolved interval. The
stylesheet schema and declarations accept the new syntax. Tests cover partial
linear/diverging/quantize domains, log eligibility, removal and recovery,
warning stability, atomic invalid updates, GPU packing, round trips, and
refresh write counts.

`cy.legend()` returns `{ entries: [...] }` as detached JSON in deterministic
sheet/property order. Entries report authored source and scale metadata,
resolved domains and status, conditional source clauses, existing pie/stripe
chart source and palette data, and aggregate bypass exceptions without node
IDs or per-node chart payloads. A cached serialized snapshot keeps repeated
reads independent of mutable graph internals. `legendchange` fires only when
that snapshot changes and, at the outer batch boundary, precedes `batchend`.
Headless instances and clones carry independent snapshots. The public types,
generated declarations, stylesheet schema, `src/README.md`, and feature
inventory were updated together.

Chart scale domains, retained-slot population rules, and bar-geometry domains
remain in round 80 because the scaled chart properties land there. No SVG
legend or biological labels were added.

### Measurements and controls

On an i9-9900K with N=2,000, `benchmark:report -- --suite scale-domains`
measured p50 of about 1.42 ms for a moved auto maximum (2,000 channel writes),
27.1 µs for an unchanged auto maximum (1 write), and 20.1 µs for an explicit
domain update (1 write). A batch of 25 writes with one final moved bound took
about 1.39 ms and performed one group refresh (2,000 writes). One hundred
reads of a two-entry cached legend took about 428 µs total (4.28 µs/read).
The benchmark asserts those write counts before timing.

The new mapper, legend, and schema specs pass, including controls for partial
diverging midpoint preservation, unchanged-bound refresh scope, bypassed
contributors, batch ordering/silence, and returned-object isolation.
`test:js:quiet`, `typecheck`, `test:types`, schema validation, build, the
benchmark controls, and `git diff --check` passed. `verify` remains red on the
same eight pre-existing oxlint warnings in unrelated files. The Node module
gate reports six subprocess-dependent failures (`bundle-size`,
`isolate-smoke`, `packaging`, `quiet-reporter`, `quiet-run`, and
`runtime-smoke`); the soak gate reports only the two worker subprocess cases
(`force-worker` and `workers`). `test:throws:quiet` exits 1 without diagnostics
in this sandbox. A focused WebGPU mapper Playwright check could not start its
configured local server: connection attempts return `EPERM`, and the
escalated attempt found port 3333 occupied by round 146's browser gate. These
process/browser gates therefore remain environment-limited rather than
validated by this clone.

**Round 147 implementation is complete.**
