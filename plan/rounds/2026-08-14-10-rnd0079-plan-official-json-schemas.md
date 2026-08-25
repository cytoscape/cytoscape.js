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
