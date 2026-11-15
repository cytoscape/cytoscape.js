import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';

const source = 'https://raw.githubusercontent.com/cytoscape/cytoscape.js/master/dist/cytoscape.cjs.js';
const build = new URL('../build/', import.meta.url);
const output = new URL('cytoscape.benchmark.js', build);
const temporary = new URL('cytoscape.benchmark-' + randomUUID() + '.tmp', build);

const response = await fetch(source);
if (!response.ok) {
  throw new Error('Benchmark download failed with HTTP ' + response.status);
}

const bundle = Buffer.from(await response.arrayBuffer());
await mkdir(build, { recursive: true });
try {
  await writeFile(temporary, bundle);
  await rename(temporary, output);
} finally {
  await rm(temporary, { force: true });
}
