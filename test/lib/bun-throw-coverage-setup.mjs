import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { instrumentThrowSource } from '../../scripts/throw-site-probe.mjs';
import { expectedSites, recordThrowProbe } from './bun-throw-coverage-hook.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sourceRoot = resolve(ROOT).split(sep).join('/');
const sourceRootPattern = escapeRegex(sourceRoot).replaceAll('/', '[\\\\/]');
const sourceMts = new RegExp(`^${sourceRootPattern}[\\\\/]src[\\\\/].*\\.mts$`);
const recordedInstrumentation = new Set();
const record = (kind, site) => {
  recordThrowProbe(kind, site);
};

Bun.plugin({
  name: 'cytoscape-bun-throw-coverage',
  setup(build) {
    build.onLoad({ filter: sourceMts }, async ({ path }) => {
      const file = relative(ROOT, resolve(path)).split(sep).join('/');

      if (!file.startsWith('src/') || !file.endsWith('.mts')) {
        throw new Error(`Bun throw probe matched a non-source file: ${path}`);
      }

      const source = await Bun.file(path).text();
      const fileSites = expectedSites.filter((site) =>
        site.startsWith(`${file}:`),
      );
      const transformed = instrumentThrowSource(file, source, fileSites);

      for (const site of transformed.sites) {
        if (!recordedInstrumentation.has(site)) {
          record('instrumented', site);
          recordedInstrumentation.add(site);
        }
      }

      return { contents: transformed.contents, loader: 'ts' };
    });
  },
});

// Bun gives each worker its own global and module graph. Add the recorder to
// the Bun-specific Worker option so imported modules and eval'd function
// source both have the hook before they can execute.
if (globalThis.Bun?.isMainThread === true) {
  await import('../node-test-setup.mjs');

  const proc = globalThis.process;
  const getBuiltinModule = proc?.getBuiltinModule;

  if (typeof getBuiltinModule !== 'function') {
    throw new Error('Bun throw coverage needs process.getBuiltinModule()');
  }

  const patched = Symbol.for('cytoscape.bunThrowCoverageWorkerPreload');

  if (!proc[patched]) {
    const original = getBuiltinModule.bind(proc);
    const setupPath = fileURLToPath(import.meta.url);
    const hookPath = fileURLToPath(
      new URL('./bun-throw-coverage-hook.mjs', import.meta.url),
    );

    proc.getBuiltinModule = (id) => {
      const builtin = original(id);

      if (id !== 'node:worker_threads' || builtin?.Worker == null) {
        return builtin;
      }

      const { Worker, ...rest } = builtin;
      const ProbeWorker = class extends Worker {
        constructor(source, options = {}) {
          const preload =
            options.preload == null
              ? []
              : Array.isArray(options.preload)
                ? options.preload
                : [options.preload];
          const hasSourceImports =
            typeof source === 'string' && /\bimport\s*\(/.test(source);

          super(source, {
            ...options,
            preload: [...preload, hasSourceImports ? setupPath : hookPath],
          });
        }
      };

      return { ...rest, Worker: ProbeWorker };
    };

    Object.defineProperty(proc, patched, { value: true });
  }
}
