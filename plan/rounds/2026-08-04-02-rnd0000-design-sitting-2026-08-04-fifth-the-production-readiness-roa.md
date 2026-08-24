## Design sitting (2026-08-04, fifth) — the production-readiness roadmap

Every open call in the ledger, taken with the maintainer in one
sitting; the per-item decisions are recorded in "Open calls for the
maintainer" near the top of this file, and the rounds below execute
them.  The sitting's own record, briefly:

1. **`border-style`/`outline-style`: full coverage** — every shape,
   the polygon perimeter tier included (round 38).
2. **Strictness resolves at the type layer, not the runtime.**  The
   constructor stays runtime-permissive (tsc's excess-property check
   is the typo guard — v4 does not replicate at runtime what the
   build checks); event names stay open because custom events
   (`node.emit('foo')`) are supported API and cannot be gated.
3. **The v4 Event is built** — typed `target`, populated
   `originalEvent`, **functional `preventDefault()`** (the
   maintainer's amendment to the proposal, which had dropped it), no
   namespaces (round 41).
4. **Packaging: v4 becomes the package.**  v4's source promotes from
   `src/gpu/` to `src/` and becomes the default export of
   `cytoscape@4`; the entire v3 file set moves into a self-contained,
   still-buildable **`v3/`** directory (parity and comparison
   benchmarks keep working against it), and no v3-specific file
   remains outside it (rounds 42–44).
5. **Gates: throw coverage and `@returns` both gate** (round 37);
   stranded blocks and bench coverage stay report-only.
6. **Aliases split**: `roundrectangle` drops, `autolockNodes`/
   `autoungrabifyNodes` are kept as recorded exceptions (round 37).
7. **The small feature calls**: overlap box mode, graph-level data in
   the wire format, and `cy.gc()` all build (round 39);
   core/collection extension points stay demand-gated deferred.
8. **The error policy is the one question deliberately left open.**
   `cytoscape.warnings()` builds, but v3's mostly-no-throw stance
   (a throw can crash an app where ignoring is recoverable) against
   v4's fail-loudly design needs real thought — options like
   disable-all-warnings and demote-recoverable-errors-to-warnings are
   on the table.  Round 40 is that sitting.
9. **The docs site**: the generated v4 site replaces `documentation/`
   at the root at release; v3's docs stay reachable through the
   existing versioned-docs mechanism (rounds 45–46).

Process note: at the maintainer's instruction this sitting lands as a
**PLAN.md-only** edit — decisions and plans, no implementation.  The
README true-up that the docs-travel rule would normally pair with it
is round 37's docs-first commit.
