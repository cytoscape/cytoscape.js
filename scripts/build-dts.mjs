// Finalizes the bundled declarations (build/dts/index.d.ts, generated from
// the TypeScript source) into the shipped dist/cytoscape.d.ts.
//
// v4's entry is ESM-first, so unlike v3's declaration (kept in v3/build-dts.mjs
// with its callable export-assignment reshaping) this needs no restructuring —
// the generated ESM form is what a `cytoscape` consumer imports.  The only
// addition is the UMD global name, for consumers loading build/cytoscape.umd.js
// from a script tag.
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { pathToFileURL } from 'url';

const src = 'build/dts/index.d.ts';
const out = 'dist/cytoscape.d.ts';

/**
 * Finalize the declaration.  Idempotent: a declaration that already carries
 * the global-name line is returned unchanged.
 */
export function finalizeDts(source) {
  if (!/\bcytoscape as default\b/.test(source)) {
    throw new Error('Generated declaration has no default factory export');
  }

  if (/^export as namespace cytoscape;$/m.test(source)) {
    return source;
  }

  return `${source.trimEnd()}\nexport as namespace cytoscape;\n`;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const dts = finalizeDts(readFileSync(src, 'utf8'));

  mkdirSync('dist', { recursive: true });
  writeFileSync(out, dts);
  console.log(`wrote ${out} (${dts.split('\n').length} lines)`);
}
