## Bun and Deno, first-class: the native runners measured, Deno's adapter, the install story

### 99.1 — the full suite under the native runners, measured

Can Bun and Deno run the real Node tier — `node:test` + chai +
the `.mjs`→`.mts` remap tsx does today?  This is an experiment
with a written record, not assumed work.  Method: run `test:js`'s
glob under each runtime's Node-compat, and **compare the executed
test count to Node's** — the enumerator rule, because the failure
mode to fear is not red, it is a runner that skips what it cannot
parse and reads green at a fraction of the suite.  Acceptable
outcomes, pre-declared: (a) a runtime runs the suite whole, and a
CI job is added running it; (b) it cannot, the record says exactly
where (the shim? the remap? chai?), and **the 98.2 smoke stays the
cross-runtime contract** — the suite remains Node's.  Both are
fine; a silent half-run is the only failure.

### 99.2 — Deno's native WebGPU drives the GPU executors

The flagship: the round-65 async algorithm tier with
`executor: 'gpu'` under plain Deno — no browser, no Dawn-in-Node
build, `algo-gpu.mts` already gating on `navigator.gpu` alone.
Go/no-go criteria written before the probe, 78.4-style: pipelines
compile on our WGSL set; CPU-vs-GPU parity holds by reusing the
`algorithms-gpu` parity spec *shape* (same fixtures, same bounds)
in a Deno-runnable form; the adapter is **identified in the
record** (the benchmark tier refuses SwiftShader for pricing —
the same honesty here: name Deno's backend, and note wgpu is not
Dawn, so this is also the first non-Dawn WGSL compile our shaders
get).  Findings feed 78.4's decision memo either way — a *go*
here is the cheapest "WebGPU outside a browser" answer on the
table.  Standing rule adapted: no "blocked, no adapter" without a
probe from a real Deno script with the permission flags right.

### 99.3 — the install story and the publish surfaces

- **Docs**: an install section covering npm, pnpm, yarn and bun,
  plus Deno's `npm:cytoscape@^4` specifier and the CDN `<script>`
  form — landing in `src/README.md`/`MIGRATING.md` now and in the
  round-46 site when it builds (round 46's plan carries the
  matching bullet as of today).  One snippet per manager, kept
  adjacent so drift is visible.
- **A runtime-support statement** with the tier language round
  100 firms up: which runtimes are CI-gated, at what floor.
- **JSR: a decision memo, not a decision** — the 78.3 shape,
  because publishing is round 50's to own.  Priced options:
  npm-only (Deno consumes `npm:` fine today), or an additional
  JSR publish (what it wants from `dist/`, what it does to the
  release workflows, who asks for it).

### 99.4 — close

CHANGELOG row, `MIGRATING.md` (the headless/cytosnap audience
overlaps the server-runtime audience), `AGENTS.md` gains the
smoke tier under Development flow, `EXECUTIVE_SUMMARY.md`
rewritten per the standing rule, gates green.

### Risks named at planning

- 99.1's compat surface is the moving target 98 already named,
  squared — pin the versions the record was taken on, and date
  the record; a "Bun cannot X" sentence is a claim future rounds
  must re-measure, per the plans-are-claims rule.
- 99.2 can eat unbounded time chasing wgpu/Dawn divergence; the
  pre-written go/no-go and the scratch-tree constraint (no `src/`
  changes from an investigation) bound it, as they bound 78.4.
- Coordination: ledger item 29's worker pool spells its workers
  `node:worker_threads` / browser `Worker` — if round 74 lands
  first, its runtime seam should prefer the Web Worker API where
  it exists (Bun and Deno both have it; Node does not), or the
  pool becomes the one v4 feature that is Node-shaped.  Named
  here so neither round discovers it in review.

**Open:** whether a green 99.1 job gates or only ci-node does
(recommended: the smoke gates everywhere, the full-suite jobs
gate only where they run whole); whether 99.2's parity subset
joins CI on a Deno runner or stays a recorded manual probe until
GitHub's runners say what adapter they give it; the JSR memo's
recommendation (leaning npm-only until someone asks).

