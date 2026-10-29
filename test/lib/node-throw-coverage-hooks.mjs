// Module hooks for the Node throw-site probe: instrument each src/**/*.mts
// that holds a throw site as it loads, before tsx transpiles it (see
// node-throw-coverage-setup.mjs).  Worker threads inherit these hooks.
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const sitesByFile = new Map();
let probePath;
let cacheDir;

export const initialize = (data) => {
  for (const site of JSON.parse(readFileSync(data.manifestPath, 'utf8'))) {
    const file = site.slice(0, site.lastIndexOf(':'));

    sitesByFile.set(file, [...(sitesByFile.get(file) ?? []), site]);
  }

  probePath = data.probePath;
  cacheDir = join(data.manifestPath, '..', 'instrumented');
  mkdirSync(cacheDir, { recursive: true });
};

// Every test process (and worker) loads the same sources, and parsing
// each twice with the TypeScript API cost ~1.4 CPU-s per process: the run
// went from 17 s to 46 s on a saturated machine.  The first loader to
// instrument a source leaves the result here for the rest of the run.
// The TypeScript parser loads only on a miss: most loaders never need it.
const instrumentCached = async (file, source, sites) => {
  const key = createHash('sha1').update(file).update(source).digest('hex');
  const path = join(cacheDir, `${key}.json`);

  if (existsSync(path)) {
    return JSON.parse(readFileSync(path, 'utf8'));
  }

  const { instrumentThrowSource } =
    await import('../../scripts/throw-site-probe.mjs');
  const transformed = instrumentThrowSource(file, source, sites);
  const tmp = `${path}.${process.pid}.${Math.random()}`;

  writeFileSync(tmp, JSON.stringify(transformed));

  try {
    renameSync(tmp, path);
  } catch (error) {
    // Windows refuses a rename onto a file another process has just
    // written or holds open (EPERM / EACCES), where POSIX replaces it
    // (round 151).  The key fixes the content, so losing the race is
    // harmless: keep theirs.
    if (!existsSync(path)) throw error;
    rmSync(tmp, { force: true });
  }

  return transformed;
};

export const load = async (url, context, nextLoad) => {
  const loaded = await nextLoad(url, context);

  if (!url.startsWith('file:') || !url.endsWith('.mts')) {
    return loaded;
  }

  const file = relative(ROOT, fileURLToPath(url)).split(sep).join('/');
  const sites = sitesByFile.get(file);
  const source = String(loaded.source);

  // a worker inherits these hooks and registers its own through the
  // preload; instrument a source once
  if (sites == null || source.includes('__cyThrowProbe(')) {
    return loaded;
  }

  const transformed = await instrumentCached(file, source, sites);

  // the hooks thread cannot tell which realm asked for the module; the
  // gate reads realms only from hits, so record the load as 'main'
  appendFileSync(
    probePath,
    transformed.sites
      .map((site) =>
        JSON.stringify({ kind: 'instrumented', site, realm: 'main' }),
      )
      .join('\n') + '\n',
  );

  return { ...loaded, source: transformed.contents };
};
