import { expect } from 'chai';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
Round 98.2: what keeps the cross-runtime smoke honest.

`test/runtimes/smoke.mjs` is one framework-free file that runs unchanged
under Node, Bun and Deno, over the built bundles, with the exit code as
the contract.  Two of its properties hold only while somebody checks
them:

- **It must stay import-free beyond what loading the bundles requires**,
  or it silently becomes a fourth test tier with its own compat needs on
  every runtime it runs on.  Its import list is enumerable, so this file
  enumerates it (the plan's own suggested lint).
- **It must be able to fail, loudly, never a soft-skip** — the parity
  suite's rule: a smoke that quietly stops running is worth less than one
  that is absent.  Both planned controls run here as specs, on the Node
  runtime (the one CI always has): a bundle path that does not exist, and
  the round-46.5 dict-as-array degraded reader, which produces exactly
  the plausible-looking graph with no labels the value assertions exist
  to catch.

The passing run is asserted too — three bundles, each with a named `ok`
line — because `test:modules` builds first (its own script), so a smoke
that cannot pass against a fresh build should fail *here*, before CI's
`ci-bun`/`ci-deno` jobs find it in a runtime this box may not have.

The npm scripts are pinned as shapes: each `test:runtimes:*` is
`run-s build …` so a stale bundle cannot pass for a fresh one (the
2026-08-06 lesson), and Deno's carries `--allow-read` because loading a
local bundle is a file read.  The quiet twins live in
`quiet-scripts.mjs`'s table like every other pair.
*/

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SMOKE = join(ROOT, 'test', 'runtimes', 'smoke.mjs');
const smokeText = readFileSync(SMOKE, 'utf8');
const { scripts } = JSON.parse(
  readFileSync(join(ROOT, 'package.json'), 'utf8'),
);

/** Run the smoke on Node with the given extra argv. */
const runSmoke = (...args) =>
  spawnSync(process.execPath, [SMOKE, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 120_000,
  });

describe('the cross-runtime smoke (round 98.2)', function () {
  it('imports nothing beyond what loading the bundles requires', function () {
    // the enumerable import list: `node:module` + `node:url` are the CJS
    // require's needs, and all three runtimes provide both.  Anything else
    // — chai, the test shim, a repo helper — makes the smoke a test tier
    // with its own compat surface, which is the thing it must never be.
    const staticImports = [...smokeText.matchAll(/from\s+'([^']+)'/g)].map(
      (m) => m[1],
    );

    expect(staticImports.sort()).to.deep.equal(['node:module', 'node:url']);

    // and no framework leaked in: the smoke is plain asserts
    expect(smokeText).to.not.match(/\b(describe|it|beforeEach)\s*\(/);
    // \b so 'chain' in a comment cannot trip it; an import would say 'chai'
    expect(smokeText).to.not.match(/\bchai\b/);
  });

  it('wraps the smoke in run-s build scripts, one per runtime', function () {
    for (const runtime of ['node', 'bun', 'deno']) {
      expect(scripts[`test:runtimes:${runtime}`]).to.equal(
        `run-s build test:runtimes:${runtime}:run`,
      );
      expect(scripts[`test:runtimes:${runtime}:run`]).to.contain(
        'test/runtimes/smoke.mjs',
      );
    }

    // Deno's sandbox: loading a local bundle is a file read, nothing more
    expect(scripts['test:runtimes:deno:run']).to.contain(
      'deno run --allow-read',
    );
  });

  it('passes on Node against the fresh build, all three bundles', function () {
    // `test:modules` builds before this tier runs, so a missing bundle
    // here is a broken build script, not a soft-skip
    expect(
      existsSync(join(ROOT, 'build', 'cytoscape.esm.mjs')),
      'build/cytoscape.esm.mjs is missing — test:modules should have built it',
    ).to.equal(true);

    const out = runSmoke();

    expect(out.status, out.stderr).to.equal(0);

    for (const bundle of [
      'cytoscape.esm.mjs',
      'cytoscape.esm.min.mjs',
      'cytoscape.cjs.js',
    ]) {
      expect(out.stdout, `no ok line for ${bundle}`).to.match(
        new RegExp(`^ok ${bundle.replace(/\./g, '\\.')} `, 'm'),
      );
    }
  });

  it('fails loudly when pointed at a bundle path that does not exist', function () {
    const out = runSmoke('no-such-dir');

    expect(out.status).to.not.equal(0);
    expect(out.stderr).to.contain('no-such-dir/cytoscape.esm.mjs');
    expect(out.stdout).to.not.contain('ok ');
  });

  it('fails loudly under the round-46.5 dict-as-array degraded reader', function () {
    // the control that keeps the value assertions honest: a reader that
    // hands back undefined for every dictionary value must fail on the
    // *values*, with the field named
    const out = runSmoke('--control=dict-as-array');

    expect(out.status).to.not.equal(0);
    expect(out.stderr).to.contain('a.label');
    expect(out.stderr).to.contain('expected "alpha", got undefined');
  });
});
