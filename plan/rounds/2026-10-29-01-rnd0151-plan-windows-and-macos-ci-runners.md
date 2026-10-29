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

Planned.
