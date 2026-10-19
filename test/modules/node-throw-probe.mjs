import { expect } from 'chai';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  instrumentThrowSource,
  parseThrowProbeLog,
} from '../../scripts/throw-site-probe.mjs';

/*
The Node throw-site probe (test/lib/node-throw-coverage-*.mjs) records a
hit only in a realm that has the recorder.  In a realm without it an
instrumented guard throws the probe's TypeError in place of its own
error, so a spec asserting the message fails for the wrong reason.  The
three realms the suite uses get the recorder three ways, so each is
checked here:

  - the main thread: the `--import` setup installs it;
  - an `eval` worker running copied function source (the algorithm
    pool's kernels): `--import` preloads do not run in workers, so the
    setup prepends the recorder to the worker's source;
  - a module worker importing src: Node runs `--import` preloads in a
    file worker, so the setup installs it there as in main.

Control run while writing: dropping the prepend fails the eval-worker
case with "globalThis.__cyThrowProbe is not a function".
*/

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PARSE = 'src/style/parse.mts';
const parseUrl = pathToFileURL(join(ROOT, 'src/style/parse.mts')).href;

describe('the Node throw-site probe reaches every realm', function () {
  let dir;
  let sites;
  let probe;
  let result;

  before(function () {
    dir = mkdtempSync(join(tmpdir(), 'node-throw-probe-'));
    sites = instrumentThrowSource(
      PARSE,
      readFileSync(join(ROOT, PARSE), 'utf8'),
    ).sites;

    const manifest = join(dir, 'throw-sites.json');
    const log = join(dir, 'throw-probe.jsonl');
    const moduleWorker = join(dir, 'module-worker.mjs');
    const script = join(dir, 'control.mjs');

    writeFileSync(manifest, JSON.stringify(sites));
    writeFileSync(log, '');
    writeFileSync(
      moduleWorker,
      `import { parentPort } from 'node:worker_threads';\n` +
        `import { parseLineCap } from ${JSON.stringify(parseUrl)};\n` +
        `try { parseLineCap('not-a-cap'); parentPort.postMessage('no throw'); }\n` +
        `catch (e) { parentPort.postMessage(e.message); }\n`,
    );
    writeFileSync(
      script,
      `import { parseLayerShape, parseLineCap } from ${JSON.stringify(parseUrl)};\n` +
        `const { Worker } = process.getBuiltinModule('node:worker_threads');\n` +
        `const reply = (w) => new Promise((ok, no) => { w.once('message', ok); w.once('error', no); });\n` +
        `const out = {};\n` +
        `try { parseLineCap('not-a-cap'); } catch (e) { out.main = e.message; }\n` +
        `out.evalWorker = await reply(new Worker(\n` +
        `  "const { parentPort } = process.getBuiltinModule('node:worker_threads');" +\n` +
        `  'const f = (' + parseLayerShape.toString() + ');' +\n` +
        `  "try { f('x', 'not-a-shape'); parentPort.postMessage('no throw'); }" +\n` +
        `  ' catch (e) { parentPort.postMessage(e.message); }',\n` +
        `  { eval: true }));\n` +
        `out.moduleWorker = await reply(new Worker(new URL(${JSON.stringify(
          pathToFileURL(moduleWorker).href,
        )})));\n` +
        `console.log(JSON.stringify(out));\n`,
    );

    result = JSON.parse(
      execFileSync(
        // the probe is Node's (module hooks Bun does not implement), so the
        // Bun parity run spawns Node too; that job keeps Node for tooling
        process.versions.bun == null ? process.execPath : 'node',
        [
          '--import',
          './test/lib/node-throw-coverage-setup.mjs',
          '--import',
          'tsx',
          script,
        ],
        {
          cwd: ROOT,
          encoding: 'utf8',
          env: {
            ...process.env,
            CY_THROW_PROBE_LOG: log,
            CY_THROW_SITE_MANIFEST: manifest,
          },
        },
      ),
    );
    probe = parseThrowProbeLog(readFileSync(log, 'utf8'), sites);
  });

  after(function () {
    rmSync(dir, { recursive: true, force: true });
  });

  it("every realm threw the guard it was sent, not the probe's TypeError", function () {
    for (const realm of ['main', 'evalWorker', 'moduleWorker']) {
      expect(result[realm], realm).to.be.a('string');
      expect(result[realm], realm).not.to.match(/__cyThrowProbe|no throw/);
    }
  });

  it('records a ready recorder and an exact hit in main and worker realms', function () {
    expect(probe.ready.get('main')).to.be.greaterThan(0);
    expect(probe.ready.get('worker')).to.be.greaterThan(0);

    const hitIn = (realm) =>
      [...probe.hitRealms].filter(([, set]) => set.has(realm)).length;

    // parseLineCap's guard in main and in the module worker; the copied
    // parseLayerShape's in the eval worker: two distinct worker sites
    expect(hitIn('main')).to.equal(1);
    expect(hitIn('worker')).to.equal(2);
  });

  it('instruments every site in the file it loaded', function () {
    expect(probe.missingInstrumentation).to.deep.equal([]);
  });
});
