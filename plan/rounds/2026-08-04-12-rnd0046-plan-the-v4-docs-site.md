## The v4 docs site

**Depends on:** 45, 2026-08-04-02

**12 October scoped pass:** audit v3 Markdown prose and API coverage, write
comparable v4 prose/API documentation and a detailed follow-up plan. Cover at
least the same content; demos are excluded from this pass. Document only
implemented or already specified provisional behavior, marking provisional
claims and specification holes with TODO_PROVISIONAL plus source references.
Flag missing v3 APIs without a clear migration/removal decision. This pass does
not close round 46. The [interview](2026-10-12-01-rnd0000-note-bun-documentation-and-table-benchmark-interview.md) is authoritative over the older full-site scope below.

- Prose sections written by hand (the generator covers members, not
  narrative): introduction, getting started, loading (columnar + the
  wire format), styling with mappers and the sheet, events + the
  interaction surface, layouts + the extension contract, animations +
  transitions, performance.  Demos ported to v4.
- The docmaker template updated for the v4 config; the generated site
  lands at root `documentation/`; v3's site (now `v3/documentation/`)
  is archived through the existing versioned-docs mechanism
  (`versions.json`), so old links keep resolving; the Pages deploy in
  the release workflows re-points.
- **Install instructions per package manager** (added 2026-08-19,
  with the runtime rounds 98–100): getting started shows install
  instructions for npm, pnpm, yarn and Bun side by side, plus the plain
  `<script>` CDN form. **Superseded 12 October:** Deno is dropped completely
  from v4 support and has no install snippet; alpha publication is through
  npm, and JSR is reconsidered after alpha. The [authoritative interview](2026-10-12-01-rnd0000-note-bun-documentation-and-table-benchmark-interview.md)
  controls over this older Deno/JSR text.

### 12 October documentation parity pass

The scoped audit and acceptance plan are in
[`documentation/api-coverage.md`](../../documentation/api-coverage.md). It
compares frozen v3 Markdown and API records with v4's generated API model,
maps every non-demo v3 prose section to a v4 content page, records absent v3
APIs by evidence, and leaves maintainer questions for the names whose
disposition is not established. It does not close this round.

The v4 API reference continues to come from source JSDoc through
`npm run -s docs:api`. The authored narrative belongs in
`documentation/md/`; demos and the site/template integration remain later
work. The twelve public graph-algorithm comments in `src/collection.mts` were
expanded to document current traversal order, stopping rules, path shapes,
assumptions and edge cases; the edits are comment-only and generated types
were refreshed.

The scoped content pass is authored. Its twelve non-demo prose equivalents
cover the v3 introduction, notation, getting-started, core, collection,
selectors, style, events, layouts, animations, extensions and performance
sections. Additional v4 pages cover loading, raster exports and explicitly
provisional decisions; style-property and layout-option catalogs record the
implemented defaults, accepted values and constraints. The durable API audit
and machine-readable inventory compare all 238 frozen v3 API names with 352
generated v4 members in 48 groups and seven namespaces: 215 names map to a v4
entry, 18 removals have source-backed decisions, and five remain explicit
maintainer questions. No v3 name is unclassified. The source census records
183 unique style vocabulary names (181 accepted; two reserved and rejected),
ten built-in layouts, and 115 direct fields across twelve public layout option
interfaces. The v3 tree remained read-only.

Focused validation passed: `npm run -s docs:api` plus
`node documentation/build-api-inventory.mjs` generated all 352 entries;
headless getting-started/style examples and catalog probes passed; the
relative-link audit found no broken paths or anchors across 19 Markdown files
and 67 links; and `npm pack --dry-run --json` contained 308 files and no
`documentation/` files. Status-markdown passed 28/28, and its deliberately
broken source-path control failed as expected. Status-site passed 54/54 with
the spec reporter and isolation disabled. `npm run -s status` built 149 files
(57.0 MiB); the generated status index opened in headless Chromium and its
title, heading and navigation were verified. The existing server on port
3335 pointed to an older preview, so the generated file URL was used. The
preview reports a stale bundle because runtime bundles were not rebuilt in
this docs pass.

This is a source-content milestone, not round closure. Template integration,
demo work, complete site publication, Bun full-tier validation, final
integration checks and maintainer dispositions for the five open API
questions remain follow-up work. Deployment and full round review remain
outside this scoped pass.
