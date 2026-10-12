# v4 documentation sources

This directory is the hand-authored v4 documentation source tree for round 46.
The API reference is generated from JSDoc in `src/` by `npm run -s docs:api`;
the API-to-v3 audit and its machine-readable inventory live beside these pages.
The complete page/template integration, demos, site build and deployment are
follow-up work, so these Markdown files are reviewable content rather than a
claim that a published v4 site exists.

The pages under `md/` cover the twelve non-demo sections in v3's frozen
docmaker: introduction, getting started, notation, core, collection, selectors,
style, events, layouts, animations, extensions and performance. `provisional.md`
records only design directions already present in the plan/interview; it marks
each one and keeps unresolved contract details visible. It describes no
callable API. `loading.md` and `exports.md` provide additional v4 detail for
progressive ingestion and the implemented PNG/JPEG exporters; `style-properties.md`
and `layout-options.md` carry the corresponding exhaustive property/default
and built-in option references.

After `npm run -s docs:api`, regenerate `api-inventory.json` with:

```sh
node documentation/build-api-inventory.mjs
```

The inventory is an audit aid, not another API source. It records how each v3
name maps to a generated v4 member or an evidence-backed removal/open question,
and exposes the description fields reviewed for every generated member. The
source comments and their implementation remain authoritative.
