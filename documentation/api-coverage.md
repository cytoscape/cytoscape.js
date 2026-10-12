# v4 documentation parity audit

This audit compares the frozen v3 documentation sources with v4's current
documentation model and the implementation. It is a working coverage record
for round 46, not a claim that the v4 site is complete or published.

## Baseline and method

The v3 baseline is `v3/documentation/docmaker.json` plus its Markdown sources
under `v3/documentation/md/`. The docmaker has 238 distinct API function
entries; 169 point to a separate long-form Markdown page. Its prose tree has
12 non-demo sections: Introduction, Notation, Getting started, Core,
Collection, Selectors, Style, Events, Layouts, Animations, Extensions and
Performance. Its Demos section is excluded by the 12 October scope decision.
Those files remain frozen and are read only.

The v4 API model is generated from source JSDoc by `npm run -s docs:api`.
At this audit it contains 352 entries in 48 groups across seven namespaces.
The comparison accounts for v4's one `Collection` namespace (v3 split methods
across `ele`, `node`, `nodes`, `edge` and `edges`) and for documented v4
aliases. That leaves 23 v3 API names without a current v4 entry or alias.
Names alone are not treated as proof of parity: the comparison also reads each
JSDoc summary, overload description, parameter, return and failure contract,
then checks the relevant migration/design records and implementation.

API documentation remains in source JSDoc. The generator's output is a
derived model for the API renderer; this file records narrative coverage and
the decisions a name/count comparison cannot establish. The reproducible
`api-inventory.json` records each generated member's summary, overload and
argument description lengths, return and throw coverage, as well as the
normalized mapping for every v3 member name. `build-api-inventory.mjs`
regenerates it after `npm run -s docs:api`. `src/README.md` and `MIGRATING.md`
remain the current design and migration records.

## Prose coverage matrix

The authored v4 prose lives under `documentation/md/`. These pages carry
examples and explain behavior across API families; each individual API's
contract remains next to its implementation in JSDoc.

| Frozen v3 section | v4 authored coverage | Content to preserve or replace for v4 |
| --- | --- | --- |
| Introduction | `intro.md` | What Cytoscape.js v4 is, package entries, rendering/headless distinction and the prototype's current status. Do not carry forward v3 adoption lists, release cadence or published-package claims as v4 facts. |
| Getting started | `getting-started.md` | npm-based setup for npm, pnpm, yarn and Bun, browser/CDN entry, first graph, container sizing, headless setup, and which entry fits each environment. Alpha publication is npm; JSR is deferred until after alpha. Deno is removed from v4 support. |
| Notation | `notation.md` | Core and collections, node/edge definitions, model/rendered coordinates, JSON and columnar input, wire serialization, compound containment, identity and lifecycle. Derive all formats from v4 types and source. |
| Core API | API JSDoc plus `core.md`, `loading.md`, `exports.md`, `notation.md`, `events.md`, `layouts.md` and `animations.md` | Explain the core as graph and viewport handle, progressive loading, JSON/wire distinctions and GPU raster export. SVG remains explicitly provisional. |
| Collection API | API JSDoc plus `collection.md`, `notation.md`, `selectors.md`, `style.md`, `layouts.md` and `animations.md` | Explain collection shape, set operations, traversal, graph algorithms, per-element access and group-independent methods. Do not describe v3 mutability or classes. |
| Selectors | `selectors.md` | Structured query objects, collection predicates, event predicates and id lookup. State plainly that selector strings and the selector parser are absent. |
| Style | `style.md` plus `style-properties.md` | The `{ nodes, edges, parents, core }` sheet, accepted properties/defaults/groups, mapper scales, conditions, stored readback, bypasses, images/charts, edge routes and transitions. Explain current defaults/deviations, not v3's selector blocks or style functions. |
| Events | `events.md` | `Event`, core/element handlers, predicate delegation, bubbling, the curated vocabulary, gestures, pointer re-emits and removal. Cover literal event names and the lack of namespace parsing. |
| Layouts | `layouts.md` plus `layout-options.md` | Built-in layout families and their option defaults, collection scope, lifecycle, cancellation and direct `impl` contract. Layout instances are not event emitters; lifecycle events belong to the core. |
| Animations | `animations.md` | Element and viewport animations, handles, promises, channel concurrency, easing, geometry targets, style transitions and the no-queue contract. |
| Extensions | `extensions.md` | Direct imported custom layout implementations and their context. Core, collection and renderer extension points remain out of scope. |
| Performance | `performance.md` | Columnar loading, bulk changes, batching, public lookup/query choices, renderer costs and the limits of measurements. Include the stale-position caveat during a live GPU force run. |
| Demos | Excluded | The 12 October interview excludes demos from this pass. Demo porting and site wiring remain round 46 follow-up work. |

Additional v4 material can explain architecture and the provisional contracts
that have been specified but are not runtime APIs. Every such claim must carry
`TODO_PROVISIONAL`, link its source record, state that it is not implemented,
and name unresolved specification details.

## Exact style and layout catalog evidence

The style catalog inventories 183 unique kebab-case names from the `PROP`
object in `src/style-props.mts`. Of those, 181 are accepted canonical style
properties; `background-width-relative-to` and
`background-height-relative-to` are vocabulary-only reserved names that the
runtime rejects. CamelCase spellings normalize to the same canonical names
and do not increase the count. The catalog's group tables record accepted
groups, literal defaults and accepted-value guidance; its mapper matrix
records which properties accept data, scale or case definitions. Those tables
were checked against `src/style/tables.mts`, `src/style/defaults.mts`,
`src/style/normalize.mts` and `src/style/apply-prop.mts`. This is a v4 source
inventory, not a claim that every v3 style property was carried forward; the
catalog names the out-of-surface v3 properties and current migration
questions.

The layout catalog has a separate options table for each of the ten v4
built-ins: `grid`, `preset`, `circle`, `concentric`, `breadthfirst`, `random`,
`radial`, `pack`, `force` and `flow`. It also details the shared layout options,
score/sort mappings and component-packing options. Its type audit covers these
12 option interfaces and 115 direct fields (including `name` where declared,
excluding inherited fields):

| Public option interface | Direct fields |
| --- | ---: |
| `LayoutBaseOptions` | 15 |
| `ComponentPackingOptions` | 5 |
| `GridLayoutOptions` | 8 |
| `PresetLayoutOptions` | 2 |
| `CircleLayoutOptions` | 10 |
| `ConcentricLayoutOptions` | 12 |
| `BreadthFirstLayoutOptions` | 11 |
| `RandomLayoutOptions` | 2 |
| `PackLayoutOptions` | 1 |
| `RadialLayoutOptions` | 10 |
| `ForceLayoutOptions` | 24 |
| `FlowLayoutOptions` | 15 |

These type field names and defaults were cross-checked against
`src/public-types.mts` and the corresponding implementations under
`src/layout/`. This is an implemented-surface inventory; v3-only layout names
and options are called out where they lack a v4 counterpart.

## API entry audit

The 352 generated entries cover the current v4 public API. The durable
inventory makes the substance audit inspectable rather than equating counts
with quality: it preserves the actual JSDoc summary and text-length evidence
for each overload, argument, return and exception, then flags 206 summaries
below an 18-word review threshold. Short descriptions are not automatic
failures; simple scalar readers may need only one sentence. Human review uses
these checks:

1. Compare parameters and accepted shapes with current public types and
   parser validation.
2. Compare effects, defaults, result contents and errors with implementation
   rather than assuming familiar v3 semantics.
3. For asynchronous methods, verify completion, cancellation, event ownership
   and whether a run may already have settled.
4. For aliases and missing names, require a real source alias or a recorded
   migration/removal decision.

Deep-read examples recorded in the inventory include `cy.load()` first-chunk
readiness and partial failure, PNG/JPEG output modes and scale units,
delegated listener identity, node/edge coordinate reads, animation channel
replacement, layout cancellation, and representative synchronous and
asynchronous algorithms. The algorithm source review found more than terse
summaries: BFS invokes `(node, edge, previous, index, depth)`, queues multiple
callback roots in reverse input order, and its returned discovery path may
contain nodes not visited after an early stop; Dijkstra reports `Infinity` for
an unreachable valid node while its `pathTo()` returns that node alone;
Bellman–Ford returns an empty unreachable path. Those observed v4 contracts
are now stated in source JSDoc. Other reviewed examples include the
Karger–Stein connectivity assumption and error guard, biconnected component
parallel-edge handling, and the assumptions behind normalized degree values.
All twelve targeted `src/collection.mts` algorithm blocks were expanded with
current input, output and failure details; only comments changed. The
inventory's `substanceReview` object names the source files and finding for
each deep read, and its generated member records remain the per-entry evidence.

## v3 API names without a v4 entry or alias

Collection prefixes below are normalized to v4's `eles` owner. A missing name
is classified as a decided removal only when a source record says so; similar
names or a plausible substitute do not settle the migration decision.

| v3 API name(s) | Audit disposition | Evidence or maintainer question |
| --- | --- | --- |
| `cy.clearQueue`, `eles.clearQueue` | Decided removal: v4 has no animation queue, so there is no queued work to clear. | [Migration guide: animations](../MIGRATING.md#4-animations-sequence-by-promise-not-by-queue); [round 21](../plan/rounds/2026-08-01-11-rnd0021-landed-animation-queue-removal.md). |
| `eles.restore`, `eles.clone` | Decided removal: removed element references are terminal; graph-level `cy.clone()` is a separate multi-view API. | [Migration guide: removed elements and not ported](../MIGRATING.md#5-removed-elements-are-terminally-dead); [round 106](../plan/rounds/2026-08-20-07-rnd0106-landed-n-viewers-by-cloning.md). |
| `eles.addClass`, `eles.removeClass`, `eles.toggleClass`, `eles.classes`, `eles.flashClass`, `ele.hasClass` | Decided removal: v4 has no class state or class selectors. Use data, structured queries, predicates and stylesheet conditions according to the use case. | [Migration guide: classes](../MIGRATING.md#2-there-are-no-classes); [source design decisions](../src/README.md#design-decisions-v4-api-direction). |
| `layout.on`, `layout.promiseOn`, `layout.one`, `layout.removeListener`, `layout.removeAllListeners`, `layout.emit` | Decided removal: layout handles are not event emitters; layout lifecycle events are emitted on the core. | [Round 17 event and extension contract](../plan/rounds/2026-08-01-04-rnd0017-landed-event-vocabulary-and-the-extension-contract.md); [v4 layouts](../documentation/md/layouts.md). |
| `ani.apply`, `ani.applying` | Decided removal: animation progress is read-only and does not support scrubbing; the v4 handle exposes pause, resume and reverse. | [Round 24.3](../plan/rounds/2026-08-01-15-rnd0024-landed-style-transitions-and-animation-controls.md); [v4 animations](../documentation/md/animations.md). |
| `cy.delay` | Open: the v3 method delayed queued viewport animations. Round 21 removed the queue and says `delay` remains, while the current v4 implementation has delay methods on collections but no core/viewport `cy.delay()`. Decide whether the viewport no-op timeline method is intentionally removed or should be restored; do not imply either answer in prose. | [v3 method](../v3/documentation/md/core/delay.md); [round 21](../plan/rounds/2026-08-01-11-rnd0021-landed-animation-queue-removal.md); current `Core`/`Collection` JSDoc in `src/core.mts` and `src/collection.mts`. |
| `cy.delayAnimation` | Open: current `cy.animation()` accepts delayed targets, but there is no dedicated no-op viewport delay handle. Decide whether the v3 handle API was intentionally removed or needs a v4 equivalent. | v3 docmaker entry; current `Core.animation()` in `src/core.mts`; current `Collection.delayAnimation()` in `src/collection.mts`. |
| `eles.removeAllListeners` | Open: `eles.off(events, handler?)` removes selected event names and requires `events`; it cannot remove every event type from the collection as the v3 method did. Decide whether the omission is intentional or provide a documented collection-wide form. | v3 docmaker entry; current collection event methods in `src/collection.mts`; core counterpart in `src/core.mts`. |
| `ele.numericStyleUnits` | Open: v4 has `numericStyle()` and `renderedStyle()` but no unit-query member. Decide whether the v3 helper is intentionally removed and what unit information consumers should use, if any. | v3 docmaker entry; current style read API in `src/collection.mts`; [style properties](../documentation/md/style.md). |
| `ani.completed` | Open: v4's `promise()` resolves on completion or stop, but that is not a boolean completion-state getter. Decide whether the state API is intentionally omitted or needs an explicit equivalent. | v3 docmaker entry; current `AnimationHandle` API in `src/animation/handle.mts` and its public type. |

`cy.$` is not listed as missing: v4 retains it as an alias of `filter()` for
query objects and predicates, and selector strings still throw. Likewise,
v3's `nodes.ancestors()` maps to the documented `eles.ancestors()` alias.

## Follow-up questions and acceptance plan

The five open API questions remain follow-up items; they do not block this
bounded documentation pass. Prose describes only the current v4 surface while
the matrix keeps the missing names visible. The API-name audit cannot claim
full v3 parity until maintainers disposition those questions.

This scoped pass is acceptable when:

1. Every non-demo v3 prose section has a substantive v4 equivalent with
   accurate examples, or is explicitly identified as obsolete v3-only material.
2. All current v4 public APIs remain generated from source JSDoc; the
   generated reference covers the complete v4 surface, not v3 names copied
   forward. `api-inventory.json` can be regenerated and has no unclassified
   v3 API names.
3. The high-impact long-form JSDoc has been checked against type and runtime
   contracts for inputs, defaults, results, effects, lifecycle and failures;
   short summaries remain visible in the inventory for later review.
4. Each v3 API absent from v4 is either backed by a documented decision or
   remains listed with a concrete maintainer question.
5. Every unimplemented planned behavior in prose is marked `TODO_PROVISIONAL`,
   cites its source, calls out specification holes, and cannot be mistaken for
   a callable v4 API.
6. Demos, template/generator integration, complete site build, deployment and
   final round review remain explicit later work; this pass does not close
   round 46.

## Remaining round 46 work after the scoped pass

- Finish review of the authored pages and API comments, then incorporate the
  maintainer's dispositions for open v3 API gaps.
- Integrate the authored Markdown and JSDoc model with the v4 documentation
  renderer/template, preserve v3 through the versioned-docs mechanism, and
  verify all published relative links.
- Port or write demos after the prose/API content is accepted.
- Run the complete site build, open the served site, complete visual/content
  review and address any remaining cross-link or coverage gaps.
- Deploy only under the later site/release authorization and close round 46
  only after its remaining acceptance gates pass.
