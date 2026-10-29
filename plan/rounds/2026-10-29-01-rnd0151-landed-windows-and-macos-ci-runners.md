## Windows and macOS CI runners

**Depends on:** 52, 99, 131

### Why

Every job in `.github/workflows/tests.yml` runs on `ubuntu-latest`.  The
scripts already branch on `win32` and `darwin` (`scripts/quiet-run.mjs`,
`scripts/runtime-test-tier.mjs`, `scripts/throw-coverage.mjs`,
`scripts/machine-info.mjs`) and the npm scripts set variables through
`cross-env`, but nothing runs them there, so a Windows or macOS break is
found by a user.

### Scope (decided 29 October)

| Job | Linux | Windows | macOS |
| --- | :-: | :-: | :-: |
| `ci-node` (`test:node`, `test:types:all`) | yes | yes | yes |
| `ci-bun` | 1.4.0 and latest | latest | latest |
| `ci-browser` `renderer` (Chromium) | yes | yes | — |
| `ci-browser` `renderer-webkit` | yes | — | yes (WebKit on Metal) |
| `ci-browser` `visual`, `parity` | yes | — | — |
| `ci-workerd` | yes | — | — |
| `ci-v3` | yes | — | — |

- **Excluded:** `visual` and `parity` compare against goldens rasterised by
  SwiftShader on Linux; another OS needs its own baselines, a separate
  decision.  `ci-workerd` tests the bundle, not the host.  v3 is frozen.
- The Bun floor stays a Linux-only leg, to bound the matrix.
- **The new legs gate.**  The round fixes what they surface, at the
  source, with a regression spec where practical, before it closes.  An
  assertion is never widened to pass; a spec that is genuinely
  platform-specific skips with a stated reason, recorded here.

### Status

Landed 29 October.  Six CI runs on branch `ci-windows-macos`; the sixth
had every Windows and macOS job green.

- **What the new legs found** — all portability defects in the test
  tooling and specs, none in `src/`:
  - **Temp dirs** (Bun parity and throws tiers): a `'/tmp'` fallback
    Windows lacks; on macOS `TMPDIR` is under `/var`, a symlink to
    `/private/var`, and Bun's JUnit names wrappers by real path, so every
    result read as "missing from Bun".  `os.tmpdir()`, then `realpath`.
  - **`\` in repo-path keys**: the JSDoc audit, the throw-coverage gate,
    import-graph, wgsl-minify and agent-docs keyed by `relative()`, so on
    Windows nothing matched `PUBLIC_API`, UNREACHABLE or the specs'
    spellings, and the audits checked nothing.  Now `/` throughout.
  - **Paths where Node wants URLs**: `--import`, `--test-reporter` and
    inline-script imports given `D:\…` (read as scheme `d:`);
    `URL.pathname` used as a file path (`/D:/…`).  File URLs and
    `fileURLToPath`.
  - **CRLF checkout**: `core.autocrlf` on the Windows runners broke the
    docs generator's line walk over `dist/cytoscape.d.ts`.
    `.gitattributes` `* text=auto eol=lf`; every tracked file was
    already LF, so nothing renormalised.
  - **Spawning on Windows**: `quiet-run`'s `shell: true` joined args
    unquoted, and `execFileSync('npm')` cannot start `npm.cmd`.
    `cross-spawn`, now a direct exact-pinned devDependency (it was
    already installed through `cross-env`).
  - **Robustness**: the parity harness's event reporter threw on a
    circular error and lost a file's results (new spec, control run);
    the throw probe's instrumented cache lost a rename race on Windows
    (`EPERM`), harmless because the key fixes the content.
- **The browser legs are thin.**  `renderer` on Windows ran 17 specs
  and skipped 240; `renderer-webkit` on macOS ran 16 and skipped 241
  (Linux `renderer`: 256 passed, 1 skipped).  Neither runner reached a
  WebGPU adapter, so the specs soft-skip: these legs gate the non-GPU
  browser paths only.  Getting an adapter there (Chromium's launch args
  are Linux-shaped; WebKit on Metal) is a separate piece of work.
- **Known flakes, not this round's**, recorded for a follow-up round:
  - `test/layout-cancel.test.mjs` "a live force run across destroy
    stops writing and throws nothing" failed on macOS (run 3, then in
    the throws tier in run 5) and Windows (runs 4, 5): after
    `cy.destroy()` positions sometimes still read the run's values
    (9.30) rather than the pre-run 3.  Locally, positions are restored
    at destroy, so the spec's assertion is right and this is an
    intermittent teardown race in the round-128 code, possibly a
    defect.  Not investigated here, by decision.
  - Cancellation timing specs on the Linux Bun `latest` leg
    (`algorithms-offload`, `algorithms-offload-clustering`, "cancelled
    mid-run"), failing under Node in the parity run.  `v4`'s own CI
    shows the same family intermittently (21 Oct: `fuzzyCMeans`), and
    `v4`'s last run before this branch had `ci-node` red.
- **Verification**: `test:node`, `test:types:all`, `test:soak` and
  `test:bun` (Bun 1.4.3, `TMPDIR` on a symlink) pass on Linux; CI as
  above.
