// The Node half of the exact throw-site probe (scripts/throw-coverage.mjs).
// Imported ahead of tsx in every test process, and by Node in every file
// worker too.  It installs the recorder the instrumented throws call,
// registers the load hook that instruments them
// (node-throw-coverage-hooks.mjs), and prepends the recorder to `eval`
// workers, where preloads do not run — the algorithm pool sends its
// kernels that way, as copied function source.
import { register } from 'node:module';
import { PROBE_PRELUDE } from './node-throw-coverage-prelude.mjs';

const manifestPath = process.env.CY_THROW_SITE_MANIFEST;
const probePath = process.env.CY_THROW_PROBE_LOG;

if (manifestPath == null || probePath == null) {
  throw new Error('Node throw coverage needs its site manifest and log');
}

(0, eval)(PROBE_PRELUDE);

register('./node-throw-coverage-hooks.mjs', import.meta.url, {
  data: { manifestPath, probePath },
});

// src reaches worker_threads through process.getBuiltinModule (so no
// bundler sees an import); wrap the Worker it hands back
const patched = Symbol.for('cytoscape.nodeThrowCoverageWorker');

if (!process[patched]) {
  const original = process.getBuiltinModule.bind(process);

  process.getBuiltinModule = (id) => {
    const builtin = original(id);

    if (id !== 'node:worker_threads' || builtin?.Worker == null) {
      return builtin;
    }

    const { Worker, ...rest } = builtin;
    const ProbeWorker = class extends Worker {
      constructor(source, options = {}) {
        super(
          options.eval === true && typeof source === 'string'
            ? `${PROBE_PRELUDE}\n${source}`
            : source,
          options,
        );
      }
    };

    return { ...rest, Worker: ProbeWorker };
  };

  Object.defineProperty(process, patched, { value: true });
}
