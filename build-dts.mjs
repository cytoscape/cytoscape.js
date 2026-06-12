// Finalizes the bundled declarations (build/dts/index.d.ts, generated from
// the TypeScript source) into the shipped dist/cytoscape.d.ts, adding the
// UMD global declaration for script-tag consumers.
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const src = 'build/dts/index.d.ts';
const out = 'dist/cytoscape.d.ts';

let dts = readFileSync(src, 'utf8');

// UMD global: `cytoscape.Core` etc. for <script>-tag consumers, mirroring the
// old `export as namespace cytoscape` in the hand-written index.d.ts
if (!dts.includes('export as namespace cytoscape')) {
  dts += '\nexport as namespace cytoscape;\n';
}

mkdirSync('dist', { recursive: true });
writeFileSync(out, dts);
console.log(`wrote ${out} (${dts.split('\n').length} lines)`);
