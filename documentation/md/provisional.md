# Provisional directions and open contracts

This page records design directions already present in the plan and interview
record. Every `TODO_PROVISIONAL` item is not an implemented API. It intentionally
names the remaining holes instead of filling them with guessed signatures,
defaults or behavior. Runtime documentation belongs in the generated API
reference only after implementation and source JSDoc land.

## Overlapping membership

**TODO_PROVISIONAL — Not implemented.** Compound containment remains a
single-parent node tree. A separate overlapping-membership relation has a
provisional direction to enumerate distinct nonzero members, preserve numeric
sign and magnitude, and keep participation separately when net cancellation
would hide it. Count of distinct members, signed total and absolute total are
distinct concepts. Negative values do not imply negative geometry, reversed
movement or duplicated visual nodes. Zero is provisionally outside enumerated
support. This is not a final naming, numeric-domain, validation, storage,
rendering, persistence or release contract.

The holes include public terminology and predicates; the relationship to
compound parents and annotations; integer/fraction and finite-value rules;
zero normalization; reads, writes and repeated-entry behavior; algebra and
aggregates; per-membership metadata; valid member kinds and cycles; drawing and
topology; movement/layout interaction; and JSON/wire/patch/clone staging.
Source: [11 October alpha interview follow-up, membership model](../../plan/rounds/2026-10-11-01-rnd0000-note-alpha-interview-open-questions.md#membership-model-provisional-direction-further-review-required)
and [11 October provisional multiset direction](../../plan/rounds/2026-10-08-01-rnd0000-note-annotation-use-cases-and-overlapping-membership.md#provisional-multiset-direction-11-october).

## Annotations and editing

**TODO_PROVISIONAL — No annotation object, collection or editing API is
implemented.** The research supports treating graph annotations as a real
visualization need, including leaders, background regions, dividers and
composite legends. It does not approve a shared visual-object collection,
annotation data model, anchor signature, placement pass, or topology rules.
One specified import direction keeps foreign `GroupAnnotation` members
independent and preserves their metadata; it does not turn them into v4
compound parents or overlapping membership.

Open details include object/collection ownership; annotation data; whether
enclosures use compounds or membership; anchor targets, offsets and deletion;
layout/placement order; geometry and sizing under locks; native grouping;
ordering and defaults; supported style properties; import/export and clone
fields; and implementation staging. Editing plans still need exact transaction
payloads, handle options, route conversion and hit-part enums, attachment
thresholds, and app-update conflict review. The source records explicitly mark
these as questions, so this page supplies no method names or event payload
shapes.

Sources: [annotation use cases and overlapping membership](../../plan/rounds/2026-10-08-01-rnd0000-note-annotation-use-cases-and-overlapping-membership.md)
and [alpha follow-up questions, annotations/editing](../../plan/rounds/2026-10-11-01-rnd0000-note-alpha-interview-open-questions.md#annotation-objects-placement-and-shared-apis).

## Rendering and style proposals

**TODO_PROVISIONAL — The following proposals are not style API entries.** A
label corner radius has a provisional numeric default of 4 model pixels and a
half-dimension clamp, while the public property spelling and mapper/transition
support remain open. Font work has a shared face and local CJK test-family
direction, while the exact line-break option, registration/fallback API, atlas
budget and exhaustion behavior remain open. Edge-bundle ownership and lifecycle
have settled pieces, but persistence remains a benchmark/design decision and
its schema, report fields and reason codes are not fully fixed.

Holes: label property name and accepted mappings/transitions; CJK legal-break
mode, registration/fallback and resource limits; bundle persistence choice,
arrowhead property spelling, report schema and validation. Source:
[11 October follow-up, bundling and fonts](../../plan/rounds/2026-10-11-01-rnd0000-note-alpha-interview-open-questions.md#benchmarks-styles-and-bundling)
and [layout/font/export follow-up](../../plan/rounds/2026-10-11-01-rnd0000-note-alpha-interview-open-questions.md#layouts-fonts-and-exports).

## Layout assessment and export

**TODO_PROVISIONAL — Planned result contracts are not current APIs.** Layout
assessment and constraint reporting have a settled direction to distinguish
violations, unsupported or unassessed constraints, skipped collections and
externally changed collections. Exact fields, thresholds and per-layout
coverage remain open. Existing `promise()` and `layoutstop` completion/cancel
behavior remains the implemented lifecycle; this proposal does not change it.

The 12 October SVG interview section in the alpha-contract record settles
parts of a future image/SVG export scope. The direction is
`imageMode: 'embed' | 'href'` (default `embed`), `resourceTimeout` (10,000 ms
default; 0 uses resources that are ready immediately), a shared deadline and
`signal` cancellation, and a result envelope `{ output, warnings }`. Warning
objects are shaped as `{ code, message, elementIds?, resource? }`; stable
codes and the detailed resource field type remain to be written. SVG output
modes are `string` by default, `base64uri`, `base64` or `blob`. `full` defaults
to false, matching PNG/JPEG, and headless viewport exports use configured
headless dimensions.

Empty full-graph export is planned to succeed. The agreed direction permits
using viewport or maximum dimensions; viewport dimensions as the blank
figure's base with aspect-preserving `maxWidth`/`maxHeight` are a proposed
resolution detail, not final behavior. Zero-sized input handling remains
open. A synchronous `advanceOf(character, font)` callback returns advances in
model pixels; `font` supplies family, size, style and weight, and a useful
default estimate is also required. Application-owned Fontkit or opentype.js
adapters may support custom TTF/OTF and WOFF/WOFF2 fonts; Cytoscape.js adds no
font dependency. These directions do not add options to `png()` or implement
SVG.

The remaining holes include exact warning codes and resource typing; output
overloads; zero-sized dimensions; mounted callback override/rejection; default
font reference/provenance/coverage/error bounds; kerning and ligature policy;
and per-feature fidelity tolerances. A per-character advance callback cannot
express pair kerning, and SVG viewer text may shape differently from current
GPU labels. External font libraries remain app-owned.

Sources: [11 October layout and export questions](../../plan/rounds/2026-10-11-01-rnd0000-note-alpha-interview-open-questions.md#layouts-fonts-and-exports)
and [6 October alpha contract, 12 October SVG interview section](../../plan/rounds/2026-10-06-01-rnd0000-note-alpha-contract-interview.md#svg-interview-decisions-and-font-considerations-2026-10-12).

## Runtime scope

v4 drops Deno completely. Bun verification is implemented and passed on Bun
1.4.0 and 1.4.3. In each run, public tests matched Node at 3,310 identities
across 174 files, module and packaging tests matched at 1,226 identities
across 72 files, and soak tests matched at 40 identities across 7 files, with
exact identity and outcome parity and no soft outcomes. The throw gate
accounts for 387 source sites: 361 were hit, 19 are browser-only and 7 are
unreachable; no site was dead, unknown or misattributed, and native Bun and
instrumented Bun outcomes matched. The nine-variant built-bundle smoke passed
as well.

This verification support does not provide Bun WebGPU compute or browser
renderer support. The existing worker-backed source path uses Node's
`worker_threads`; no Bun-specific worker backend was added. Browser tests and
WebGPU renderer behavior remain in Playwright. Alpha publication remains a
planned npm release action; JSR may be reconsidered after alpha. Sources:
[12 October interview, Bun and runtime scope](../../plan/rounds/2026-10-12-01-rnd0000-note-bun-documentation-and-table-benchmark-interview.md#bun-and-runtime-scope-99)
and [round 99 Bun implementation and verification](../../plan/rounds/2026-08-19-03-rnd0099-landed-native-bun-verification-and-deno-withdrawal.md).
