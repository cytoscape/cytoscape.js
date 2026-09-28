/*
Round 131: the headless build on Cloudflare's own runtime.

    node test/runtimes/workerd.mjs

Starts `workerd serve test/runtimes/workerd.capnp` (the `workerd` npm
package, a devDependency) on a free local port, fetches the smoke worker
(`workerd-main.mjs`), and exits by the answer: `ok <n>` passes; anything
else fails with the worker's own message.  The dict-as-array control runs
in the same process against the same server and must fail, so a worker
that passes vacuously cannot.  `test/modules/isolate-smoke.mjs` is the
per-run gate that needs nothing installed; this is the real runtime, in
CI's `ci-workerd` job and by hand.
*/
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CONFIG = fileURLToPath(new URL('./workerd.capnp', import.meta.url));
const BIN = fileURLToPath(
  new URL('../../node_modules/.bin/workerd', import.meta.url),
);

/** A port nothing is listening on. */
const freePort = () =>
  new Promise((resolve, reject) => {
    const server = createServer();

    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();

      server.close(() => resolve(port));
    });
  });

const port = await freePort();
const child = spawn(
  BIN,
  ['serve', CONFIG, '--socket-addr', `http=127.0.0.1:${port}`],
  { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
);
let log = '';

child.stdout.on('data', (d) => (log += d));
child.stderr.on('data', (d) => (log += d));

const exited = new Promise((resolve) => child.once('exit', resolve));

/** GET the worker, retrying while it starts. */
const get = async (path) => {
  const deadline = Date.now() + 30_000;

  for (;;) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}${path}`);

      return { status: res.status, body: await res.text() };
    } catch (err) {
      if (Date.now() > deadline || child.exitCode != null) {
        throw new Error(`workerd did not answer on :${port}\n${log}`, {
          cause: err,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
};

let failure = null;

try {
  const ok = await get('/');

  if (ok.status !== 200 || !/^ok \d+$/.test(ok.body)) {
    failure = `workerd smoke failed (${ok.status}):\n${ok.body}`;
  } else {
    const control = await get('/?control=dict-as-array');

    if (
      control.status !== 500 ||
      !control.body.includes('expected "alpha", got undefined')
    ) {
      failure =
        'the dict-as-array control passed on workerd — the checks are ' +
        `not checking (${control.status}):\n${control.body}`;
    } else {
      console.log(
        `ok cytoscape-headless.esm.min.mjs (${ok.body.slice(3)} assertions) on workerd`,
      );
    }
  }
} catch (err) {
  failure = err.message;
} finally {
  child.kill();
  await exited;
}

if (failure != null) {
  console.error(failure);
  process.exit(1);
}
