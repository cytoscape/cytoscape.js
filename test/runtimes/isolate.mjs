/*
Round 131: the headless build in an edge-shaped isolate, on Node.

    node --experimental-vm-modules test/runtimes/isolate.mjs [bundle] [--control=dict-as-array]

A Cloudflare Worker (and the WinterTC runtimes generally) has the web
platform's minimum and nothing else: no `Worker`, no `document`, no
`window`, no `navigator.gpu`, no `URL.createObjectURL`, no `process`.
`cytoscape/headless` is the build for that host, so this loads its
minified ESM — the artifact one deploys — as an ES module inside a fresh
`node:vm` context whose global carries only those WinterTC globals, and
runs the cross-runtime smoke's checks there (`smoke-checks.mjs`, loaded
into the same context), plus the one property an isolate adds: with no
worker platform, `executor: 'auto'` runs on the calling thread.

This is the gate that runs on every Node-tier run
(`test/modules/isolate-smoke.mjs`); `test:runtimes:workerd` runs the same
checks on the real runtime.  The exit code is the contract, and the
dict-as-array control must fail here too.
*/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const args = process.argv.slice(2);
const control = args.find((a) => a.startsWith('--control='))?.slice(10);
const bundle = fileURLToPath(
  new URL(
    args.find((a) => !a.startsWith('--')) ??
      '../../build/cytoscape-headless.esm.min.mjs',
    args.some((a) => !a.startsWith('--'))
      ? `file://${process.cwd()}/`
      : import.meta.url,
  ),
);
const checksFile = fileURLToPath(
  new URL('./smoke-checks.mjs', import.meta.url),
);

/** `URL` without the Blob-URL statics an isolate lacks. */
class IsolateURL extends URL {
  static createObjectURL = undefined;
  static revokeObjectURL = undefined;
}

// the WinterTC minimum common API's globals that exist in Node, and
// nothing else: the context's own intrinsics (Array, Promise, Map,
// WebAssembly, …) come with the context
const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  queueMicrotask,
  structuredClone,
  TextEncoder,
  TextDecoder,
  URL: IsolateURL,
  URLSearchParams,
  AbortController,
  AbortSignal,
  Event,
  EventTarget,
  Blob,
  performance,
  crypto,
  atob,
  btoa,
  fetch,
  Request,
  Response,
  Headers,
  navigator: { userAgent: 'cytoscape-isolate-smoke' },
};

sandbox.self = sandbox;

const context = vm.createContext(sandbox, { name: 'isolate-smoke' });

/** Load one file as an ES module inside the context. */
const load = async (file) => {
  const mod = new vm.SourceTextModule(readFileSync(file, 'utf8'), {
    context,
    identifier: `isolate:${file}`,
  });

  await mod.link(() => {
    throw new Error(`${file}: an isolate module imports nothing`);
  });
  await mod.evaluate();

  return mod.namespace;
};

const inIsolate = (expr) => vm.runInContext(expr, context);

const checks = await load(checksFile);

// the host is what it claims to be: every missing global really is missing
for (const [expr, expected] of [
  ['typeof Worker', 'undefined'],
  ['typeof document', 'undefined'],
  ['typeof window', 'undefined'],
  ['typeof process', 'undefined'],
  ['typeof require', 'undefined'],
  ['typeof navigator.gpu', 'undefined'],
  ['typeof URL.createObjectURL', 'undefined'],
]) {
  checks.eq(inIsolate(expr), expected, `isolate: ${expr}`);
}

const cytoscape = (await load(bundle)).default;
const label = bundle.split('/').pop();

checks.assert(
  typeof cytoscape === 'function',
  `${label}: default export is the factory`,
);
await checks.smokeOneBundle(cytoscape, `isolate ${label}`, control ?? null);
await checks.smokeKind(cytoscape, 'headless', `isolate ${label}`);
await checks.smokeCpuOnly(cytoscape, `isolate ${label}`);

console.log(
  `ok ${label} (${checks.assertionCount()} assertions) in a WinterTC-shaped isolate`,
);
