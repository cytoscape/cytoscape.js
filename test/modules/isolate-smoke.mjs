import { expect } from 'chai';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
Round 131: the headless build in a WinterTC-shaped isolate, every Node-tier
run.

`test/runtimes/isolate.mjs` loads `build/cytoscape-headless.esm.min.mjs` —
the artifact an edge deployment ships — as an ES module inside a `node:vm`
context carrying only the web platform's minimum (no `Worker`, `document`,
`window`, `process`, `navigator.gpu` or `URL.createObjectURL`), runs the
cross-runtime smoke's value checks there, and asserts that with no worker
platform `executor: 'auto'` ran on the calling thread.  This spec runs it
(`test:modules` builds first) and its controls: the dict-as-array degraded
reader must fail inside the isolate too, and a missing bundle must fail
loudly.  `test:runtimes:workerd` is the same checks on Cloudflare's own
runtime; this is the gate that needs nothing installed.
*/

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const RUNNER = join(ROOT, 'test', 'runtimes', 'isolate.mjs');

const runIsolate = (...args) =>
  spawnSync(process.execPath, ['--experimental-vm-modules', RUNNER, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 120_000,
  });

describe('the headless build in a WinterTC-shaped isolate (round 131)', function () {
  it('passes against the fresh headless build', function () {
    expect(
      existsSync(join(ROOT, 'build', 'cytoscape-headless.esm.min.mjs')),
      'the headless bundle is missing — test:modules should have built it',
    ).to.equal(true);

    const out = runIsolate();

    expect(out.status, out.stderr).to.equal(0);
    expect(out.stdout).to.match(
      /^ok cytoscape-headless\.esm\.min\.mjs \(\d+ assertions\) in a WinterTC-shaped isolate$/m,
    );
  });

  it('fails under the round-46.5 dict-as-array degraded reader', function () {
    const out = runIsolate('--control=dict-as-array');

    expect(out.status).to.not.equal(0);
    expect(out.stderr).to.contain('expected "alpha", got undefined');
    expect(out.stdout).to.not.contain('ok ');
  });

  it('fails loudly when the bundle does not exist', function () {
    const out = runIsolate('no-such-dir/cytoscape-headless.esm.min.mjs');

    expect(out.status).to.not.equal(0);
    expect(out.stderr).to.contain('no-such-dir');
  });

  it('imports only what hosting an isolate on Node needs', function () {
    // the runner is Node-only by design (node:vm is the isolate); the
    // checks it loads into the isolate import nothing (runtime-smoke.mjs)
    const imports = [
      ...readFileSync(RUNNER, 'utf8').matchAll(/from\s+'([^']+)'/g),
    ].map((m) => m[1]);

    expect(imports.sort()).to.deep.equal(['node:fs', 'node:url', 'node:vm']);
  });
});
