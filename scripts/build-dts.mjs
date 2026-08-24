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
 * Strip `@internal`-tagged declarations from a declaration file (round 90).
 *
 * `rolldown-plugin-dts` carries doc blocks through, so a member demoted in
 * the source arrives here with its `@internal` tag intact — this removes the
 * block *and* the declaration under it, which is what makes the demotion
 * real for a consumer: the member keeps working at runtime but leaves the
 * typed surface.  Handles the three shapes the bundle emits: a one-line
 * member, a wrapped signature (tracked by paren/brace depth until the `;`
 * that closes it at depth 0), and a braced declaration (`class X { … }`),
 * consumed through its matching close brace.
 *
 * Idempotent by construction — a stripped declaration has no `@internal`
 * left to match.
 */
export function stripInternal(source) {
  const lines = source.split('\n');
  const kept = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!/^\s*\/\*\*/.test(line)) {
      kept.push(line);
      continue;
    }

    let end = i;

    while (end < lines.length && !lines[end].includes('*/')) end++;

    if (!/@internal\b/.test(lines.slice(i, end + 1).join('\n'))) {
      for (let k = i; k <= end; k++) kept.push(lines[k]);
      i = end;
      continue;
    }

    // tagged: drop the block, any blank run, and the declaration below it
    let j = end + 1;

    while (j < lines.length && lines[j].trim() === '') j++;

    i = declarationEnd(lines, j);
  }

  return kept.join('\n');
}

/**
 * Index of the last line of the declaration starting at `j`: a braced body
 * runs to its matching `}`, an unbraced member to the first line that ends
 * at paren depth 0 (its `;`).
 */
function declarationEnd(lines, j) {
  let paren = 0;
  let brace = 0;
  let opened = false;

  for (let k = j; k < lines.length; k++) {
    for (const ch of lines[k]) {
      if (ch === '(') paren++;
      else if (ch === ')') paren--;
      else if (ch === '{') {
        brace++;
        opened = true;
      } else if (ch === '}') brace--;
    }

    if (paren > 0 || brace > 0) continue;
    if (opened || /;\s*$/.test(lines[k])) return k;
  }

  return lines.length - 1;
}

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
  const dts = finalizeDts(stripInternal(readFileSync(src, 'utf8')));

  mkdirSync('dist', { recursive: true });
  writeFileSync(out, dts);
  console.log(`wrote ${out} (${dts.split('\n').length} lines)`);
}
