/*
Where this code was loaded from (round 86.3, shared since 129.3): the
URL a worker can load *the same artifact* through, so one build serves
both threads — the render worker (86.3) and the force sim worker
(129.3) both spawn from it.

Four cases, resolved once at module evaluation because
`document.currentScript` is null after the script has run:

  - a page's script tag → its `src`, a classic script (`importScripts`);
  - a page's native-ESM import → `import.meta.url`, a module worker;
  - Node loading an ESM bundle, or the source tree under tsx →
    `import.meta.url` (a `file:` URL the worker `import()`s; under tsx
    the worker inherits the loader — measured 2026-09-18, a Node worker
    keeps `execArgv`);
  - Node loading the CJS or UMD bundle → `import.meta` is defined away
    by the build, and `__filename` names the file.

Under the source tree the URL is this module's, which exports no entry:
the bootstrap then imports the package entry point (`../index.mjs`)
instead, so the statics the workers call exist on what they load.
*/

/** The artifact's URL and how a worker must load it. */
export interface SelfUrl {
  url: string;
  /** an ES module (dynamic `import()`), else a classic script */
  module: boolean;
}

declare const __filename: string | undefined;

const resolve = (): SelfUrl | null => {
  if (typeof document !== 'undefined') {
    const el = document.currentScript;

    if (el instanceof HTMLScriptElement && el.src !== '') {
      return { url: el.src, module: el.type === 'module' };
    }
  }

  let own: string | undefined;

  try {
    if (typeof import.meta !== 'undefined' && import.meta.url != null) {
      own = import.meta.url;
    }
  } catch {
    // a classic-script transform may leave no import.meta at all
  }

  if (own != null) {
    // the source tree under tsx (a `.mts` URL): the entry point is the
    // package index, two levels up from `src/util/` — spelled `.mts`
    // here and nowhere else, because the worker's bootstrap is a plain
    // eval script and tsx aliases `.mjs` to `.mts` only for imports
    // written in TypeScript modules (measured 2026-09-18: the `.mjs`
    // spelling is "Cannot find module" from `[worker eval]`); how the
    // worker then loads a `.mts` entry is the test setup's loader
    // (`_setForceWorkerLoader`), never the library's concern
    if (/\.mts$/.test(own)) {
      return { url: new URL('../index.mts', own).href, module: true };
    }

    return { url: own, module: true };
  }

  // the CJS / UMD bundle in Node: `import.meta` was defined away
  if (typeof __filename === 'string') {
    const proc = (
      globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } }
    ).process;
    const nodeUrl =
      proc != null && typeof proc.getBuiltinModule === 'function'
        ? (proc.getBuiltinModule('node:url') as {
            pathToFileURL(path: string): { href: string };
          } | null)
        : null;

    if (nodeUrl != null) {
      return { url: nodeUrl.pathToFileURL(__filename).href, module: false };
    }
  }

  return null;
};

/** Captured at evaluation time — `currentScript` is null after load. */
export const SELF_URL: SelfUrl | null = resolve();
