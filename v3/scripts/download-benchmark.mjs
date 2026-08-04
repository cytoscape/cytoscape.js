import { mkdir, writeFile } from 'node:fs/promises';

const source = 'https://raw.githubusercontent.com/cytoscape/cytoscape.js/master/dist/cytoscape.cjs.js';
const response = await fetch(source);

if (!response.ok) {
  throw new Error(`Could not download benchmark bundle: ${response.status} ${response.statusText}`);
}

await mkdir('build', { recursive: true });
await writeFile('build/cytoscape.benchmark.js', await response.bytes());
