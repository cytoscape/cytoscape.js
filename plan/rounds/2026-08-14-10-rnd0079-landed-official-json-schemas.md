## Official JSON schemas

Issue #3487, the maintainer's own: JSON Schema documents for the
formats consumers hand this library.  v4 is unusually well-placed
for this because of a round-8 decision the schemas inherit: **no
style functions — everything in a stylesheet is serializable**, so
the entire input surface is JSON-representable by construction.
What the code does today, verified:

1. **The formats and where their truth lives.**  Element
   definitions: `ElementDefinition`/`ElementsDefinition`
   (`public-types.mts:9-44`; group inference and the accepted
   shapes in `element-defs.mts:10-64`).  The columnar bulk form:
   `ColumnarElements` with `PackedIds`/`DictColumn`
   (`public-types.mts:46-134`).  The object stylesheet:
   `Stylesheet` (`public-types.mts:295`) — but `StyleProps` is
   `Record<string, StylePropValue>` (`public-types.mts:284`),
   deliberately stringly, so **the real acceptance surface lives
   in `style.mts`**: the per-group property lists
   (`style.mts:805+`, `:890+`) and the per-property validators
   that throw on unknown names and bad values.  Layout options:
   the per-layout interfaces (`public-types.mts:370-525`) with the
   name set enumerated — and enforced by a throw — in
   `core.mts:703-737`.  The envelope: `CytoscapeOptions`
   (`public-types.mts:610`).  The wire format is *binary*
   (`wire.mts` header) — no JSON Schema applies; its JSON-side
   equivalent is the columnar form.
2. **Generated-from-types is the wrong pipeline here.**  The docs
   generator reads JSDoc as text and is gated against the shipped
   declaration (`scripts/docs-generate.mjs:1-40`,
   `test/docs-generate.mjs`); the d.ts chain is
   `rolldown.dts.config.mjs` → `scripts/build-dts.mjs`.  Nothing
   in that chain can emit JSON Schema, a generator would be a new
   build tool (code standard 7), and — decisive — the types are
   *vacuous exactly where a schema is valuable*: a type-derived
   stylesheet schema says "strings map to strings-or-numbers" and
   nothing about which properties exist or which values they take.
   Decision: **hand-written schemas, spec-gated against the
   running library** — the `test/modules/migration-guide.mjs`
   precedent, whose whole design is "a prose claim about runtime
   behaviour verifies itself by probing the library"
   (`migration-guide.mjs:9-25`, the `nameKnown` probe at `:53-70`).
3. **The fixture supply exists.**  `debug/fixtures.js` produces
   every harness network's element defs through one exported
   `toGpuElements` (already exercised by
   `test/modules/debug-harness.mjs`), and `debug/styles.js` holds
   fourteen real hand-authored v4 sheets, including the ported
   enrichmentmap.org style — the exact documents the schemas must
   accept.
4. **No JSON Schema validator exists in the tree** — devDeps
   (`package.json:132-157`) carry none, so the gate needs one
   (test-only; ships nothing).

### 79.1 — the harness: validator, gate shape, element schemas

`schemas/` at the repo root: `element.schema.json`,
`elements.schema.json` (the three accepted shapes: single, array,
`{nodes, edges}` — mirroring `partitionDefs`), and
`columnar-elements.schema.json`; draft 2020-12, `$id`s under a
base URL reserved as an Open item.  A devDep validator (ajv
proposed; sign-off under Open — precedent: pixelmatch/pngjs are
test-only devDeps) and `test/modules/schemas.mjs`: every
`debug/fixtures.js` network's defs and a swept set of `test/`
fixture defs must validate.  **Controls, run once deliberately:**
corrupt one fixture def (edge without `target`) — red; delete a
schema property — the acceptance half red.  The gate direction is
stated in the spec's header: the schema must accept everything
the library accepts and *reject what it rejects where the library
is strict* (`inferGroup`'s group throw, `element-defs.mts:12-16`,
is pinned both sides).

### 79.2 — the stylesheet schema, gated bidirectionally

The centerpiece and the drift risk.  `stylesheet.schema.json`
enumerates the per-group property names and the value shapes the
compiler accepts — constants, and the mapper DSL
(`Mapper`/`Condition`/`CaseMapper`,
`public-types.mts:157-268`) as schema objects, which the
no-style-functions rule makes possible at all.  The value spaces
JSON Schema cannot fully carry (CSS color strings, the percent
forms) validate as `type` + pattern where cheap, with the spec —
not the schema — remaining the authority on deep value validity;
that division is written into the schema's own `description`.
**The drift gate, both directions:** (a) every property name the
schema enumerates, per group, must compile in a live sheet (the
`nameKnown` probe); (b) every property the live compiler accepts
must appear in the schema — enumerated by importing `style.mts`'s
own property lists from `test/modules/` (internal imports are the
tier's precedent), so **a future round adding a style prop
without touching the schema fails this spec**, which is the
"fails when the schema drifts from the running library"
requirement made mechanical.  Controls: add a fake property to
the schema — (a) red; remove a real one — (b) red.  The fourteen
`debug/styles.js` sheets all validate; the migration guide's
rejected-property table cross-checks as *non*-members.

### 79.3 — layout options and the envelope

`layout-options.schema.json`: a `oneOf` over the seven built-in
names (the enum pinned against `core.mts:703-737` — the spec
probes that every schema name constructs and every non-schema
name throws, reusing the existing throw's spec fixture), each
branch carrying that layout's options from the interfaces plus
the shared `LayoutBaseOptions`.  Policy decision, taken here and
recorded: `additionalProperties` stays **permissive** for layout
options, because the runtime ignores unknown keys (to-verify in
79.3's first commit by probing; if the runtime is strict anywhere,
the schema tightens to match — the library is always the
authority).  The `impl` extension form validates as an escape
branch (object with `impl`) rather than being schematized.
`cytoscape-options.schema.json` composes the pieces
(`elements` | columnar | wire-`ArrayBuffer` noted as out of JSON
scope, `style`, `layout`, the renderer/headless knobs from
`public-types.mts:610+`).

### 79.4 — shipping, and the close

Where schemas live for a consumer: the npm tarball (a `schemas/`
entry in `files` — `test/modules/packaging.mjs`'s allowlist gate
is run *before* the manifest edit so the failure is the control,
the round-71 discipline) and the status site (a schemas page in
`scripts/status-build.mjs`, rendering each document plus its
validation-run summary — the one place a human sees schema and
fixtures together).  Standing close: JSDoc untouched surfaces
stay at 100% (no public runtime API is added by this round unless
the Open item below lands one), `src/README.md` gains the schema
contract section (what validates, what stays the library's job),
MIGRATING/CHANGELOG rows, `EXECUTIVE_SUMMARY.md` rewritten, gates
green including the new spec file under `test:modules`.

### Risks named at planning

The stylesheet schema creates a third place a style property
lives (compiler, docs, schema) — the bidirectional 79.2 gate is
the entire defense, and it must import the compiler's own tables
rather than a hand-copied list or it is two documents drifting in
sync.  Value-space fidelity is a permanent partial: a schema pass
does not mean a sheet compiles, and saying otherwise in the docs
would be a defect — the contract prose owns that line.  The
validator devDep must stay out of the shipped dependency graph
and out of `src/` entirely.  Schema versioning is deliberately
naive this round (the schemas describe `4.0.0-unstable`'s
surface; they version with the package) — inventing a schema
evolution policy before 4.0.0 ships would be design ahead of
need.

**Open:** the `$id` base URL (js.cytoscape.org/schemas/… needs
the maintainer's say on the domain and round 46's site shape);
the validator choice (ajv vs a lighter draft-2020-12 validator —
a devDep either way, maintainer sign-off); whether a runtime
`cytoscape.validate( doc, kind )` helper should ever exist (out
of scope here — it would drag a validator into the bundle; noted
because #3487's consumers may ask); whether the schemas are
submitted to SchemaStore once stable; whether the columnar form's
schema ships in v1 of this or follows once the wire docs settle
(79.1 drafts it; the maintainer can hold it back at review).

**Decided at the eleventh design sitting (2026-09-28):** the `$id` base
is **decided at round 46** with the docs site; the tests validate with
**ajv** (a devDependency); **no runtime `validate()`**; the
columnar/wire schema is **held until 4.x**, matching the wire format's
experimental status (PLAN.md item 43); SchemaStore submission **after
4.0**, once the schemas are stable.

### The round, as carried out (2026-09-28)

Landed the same day as the eleventh sitting, on its calls: ajv as the
validator (a devDependency), no runtime `validate()`, the `$id` base
left to round 46, the columnar schema held until 4.x, SchemaStore
after 4.0.  Built against the surface as it stands now, not as the plan
knew it: ten built-in layouts (not seven — radial, pack and flow landed
since), `cy.patch()` and `cy.load()` taking the definition form the
element schemas describe, the round-131 `exports` map, and the
round-133 sheet diff (which changes nothing a sheet may say).

| # | Commit | What landed |
| --- | --- | --- |
| 79.1 | `444759da` | `schemas/element.schema.json`, `schemas/elements.schema.json`, `scripts/schemas.mjs` (the harness and `SCHEMA_BASE`), `test/modules/schemas.mjs`, ajv |
| 79.2 | `c62fe61c` | `schemas/stylesheet.schema.json` and its two-way gate; `Condition.eq`/`ne`/`in` declared with booleans |
| 79.3 | `b0405c3e` | `schemas/layout-options.schema.json`, `schemas/cytoscape-options.schema.json`; `cy.layout()`'s JSDoc names the ten built-ins |
| 79.4 | `e0812c94` | the `./schemas/*.json` export and its packaging specs, the status site's schemas page, the docs |
| 79.5 | this commit | the close |

**What the schemas are.**  Five draft 2020-12 documents under
`schemas/`, shipped and exported as `cytoscape/schemas/*.json`, each
`$id` under the placeholder `https://placeholder.invalid/cytoscape/
schemas/` (a reserved `.invalid` host; decided in one place,
`SCHEMA_BASE` in `scripts/schemas.mjs`, with every cross-reference
relative so round 46 rewrites only the `$id`s, which the gate checks).
The element pair covers the three shapes `partitionDefs` takes; the
stylesheet enumerates per group what the compiler accepts — 122 node,
116 edge, the nodes' plus 9 compound for parents, 7 core — each with
its camelCase alias and its mapper allowance (a scale or case, the
`{ data }` passthrough only, or constants), plus the mapper DSL
schematized; layouts are an `anyOf` over the ten names and the `impl`
escape; the envelope composes the three.  The stylesheet's first draft
was written by a scratch script from the live compiler's per-group
acceptance and a hand table of value kinds (in the session's
scratchpad, not committed — the committed JSON is the maintained
document, and the gate is what keeps it true).

**The gate** (`test/modules/schemas.mjs`, 202 specs; the header states
the direction):

- *Accept what the library accepts*: all 20 debug networks in the three
  element shapes, every sheet in `debug/styles.js` (production and
  default, per network), v4's default sheet blocks, `cy.json()`'s
  elements, style and whole export for every network under 20k
  elements, the harness's layout runs (every page layout but the spiral
  extension, three UI states, JSON round-tripped) and the options
  panel's defaults.  The same run, `validationRun()`, is what the status
  page shows: 157 documents, all valid.
- *Reject what it rejects where it is strict*: paired probes run one
  payload through the library and the schema and require the same
  answer — 13 element rows (5 refusals: `inferGroup`'s group throw, an
  explicit edge or an edge-bucket entry without endpoints), 39
  stylesheet rows (29 refusals: sheet keys, unknown and wrong-group
  props, mappers where the channel is constant-only, bypass rules, the
  condition and case shape rules, keyword and range violations, a v3
  selector array), 20 layout rows (14 refusals) and 5 envelope rows.
- *Names held to the declaration*: every schema's property names equal
  the members `src/public-types.mts` declares, read through the
  TypeScript checker (so `extends` and pack's `Omit` resolve); every
  keyword enum with a declared literal union equals it (the scale and
  interpolation names, eight layout keywords, two envelope ones).
- *The stylesheet, both ways against the engine*: (a) every name the
  schema enumerates is in `PROP` and compiles in its group with every
  `examples` value the schema carries; (b) every `PROP` name the schema
  leaves out of a group is refused there **by name** (unknown, other
  group, parents group, unsupported — messages raised before the value
  is parsed, so the value cannot mask them).  Mapper allowance is
  compared per (group, prop) with the compiler; the keyword sets are
  pinned to the engine's tables (`SHAPES`, `CURVE_STYLES`,
  `EASING_NAMES`, `SCHEMES`, … — thirty sets) and every keyword listed
  compiles; no property in MIGRATING.md's rejected table is in the
  schema.

**Controls, run deliberately on the files**: stripping the element
schema's edge rule and group enum — six red; dropping the edge-bucket
rule — its probe red; a fake `background-blacken` added to nodes and
`taxi-turn` removed from edges — (a), (b) and eleven fixture specs red;
the pack branch, flow's `nodeSep`, a force executor keyword and the
envelope's `tapholdDuration` removed (and the envelope closed) — nine
red.  Eight controls also run as specs against mutated copies.  The
packaging specs ran before the manifest edit: the export spec failed
and `import.meta.resolve()` answered ERR_PACKAGE_PATH_NOT_EXPORTED.

**Calls taken in-round, and why.**

- *Open where the runtime ignores, closed where it throws.*  Probed
  first: all ten layouts run with an unknown key, the factory ignores
  unknown options (the fifth sitting's decision), element definitions
  and mapper objects ignore unknown keys — so those schemas are open,
  and the probes are specs, so a runtime that turns strict goes red and
  the schema tightens with it.  The sheet's keys, a group's property
  names and bypass entries throw, so those are closed.
- *The declaration governs coercions.*  The library takes a numeric id,
  `selected: 'yes'`, `width: [1]`; the schemas describe the declared
  forms, and the gate's header says why (a coercion is not a promise).
- *The fixtures outrank the declaration where the runtime agrees with
  them.*  `debug/styles.js`'s edge-arrows sheet compares a boolean datum
  (`eq: true`); the runtime has always compared by strict equality, so
  `Condition` now declares `string | number | boolean` for
  `eq`/`ne`/`in` — a documentation widening, the three declarations
  regenerated.
- *Hand-written, plus a draft script.*  The plan rejected generation
  from types; the stylesheet's 2,900 lines were drafted once by probing
  the compiler, then committed as the document.  A future property is
  added by hand in two lines (the group entry and its value kind), and
  the gate names what is missing.
- *ajv's strict mode, minus its two style lints.*  `strictTypes` and
  `strictRequired` reject ordinary `$ref`/`anyOf` composition; the
  keyword check that catches a misspelled keyword stays on.
- *Scheme names are the canonical lowercase spelling.*  The library
  resolves them case-insensitively; JSON Schema has no case-insensitive
  enum, and the enum is pinned to `SCHEMES` — a recorded narrowing.

**Deferred, on the sitting's calls**: the columnar schema (4.x, with
the wire format's experimental status — not drafted), the real `$id`
base (round 46), SchemaStore (after 4.0), a runtime `validate()`
(declined).  **Found in passing**: `cy.layout()`'s JSDoc listed seven
built-ins (fixed); force reads an undeclared `tidyComponents` (the
schema, open, accepts it; left undeclared); `options.elements` with
`{ nodes: {} }` loads an empty graph while `cy.add()` throws on it (the
schema follows the declared array).

`npm run -s test:node:quiet` green (zero bytes; 2,998 unit and 1,021
module tests); plan-record, agent-docs, feature-inventory,
status-features and migration-guide green.
