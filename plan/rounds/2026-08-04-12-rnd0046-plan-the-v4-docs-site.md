## The v4 docs site

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
  with the runtime rounds 98–100): getting started shows the install
  for npm, pnpm, yarn and bun side by side, plus Deno's
  `npm:cytoscape@^4` specifier and the plain `<script>` CDN form
  (the `unpkg`/`jsdelivr` fields already point at the min UMD).  One
  snippet per manager, kept adjacent so drift is visible; if round
  99.3's JSR memo lands as a publish, the Deno snippet gains the JSR
  spelling.
