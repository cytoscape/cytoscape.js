// Finalizes the bundled declarations (build/dts/<entry>.d.ts, generated
// from the TypeScript source) into the shipped dist/ declarations.
//
// v4's entries are ESM-first, so unlike v3's declaration (kept in
// v3/build-dts.mjs with its callable export-assignment reshaping) this
// needs no restructuring — the generated ESM form is what a consumer
// imports.  The only addition is the UMD global name, for consumers loading
// build/cytoscape.umd.js from a script tag — and only on the full entry's
// declaration (round 131): the slim entries ship no UMD, and two
// declarations each saying `export as namespace cytoscape;` are a
// duplicate identifier for a consumer whose program resolves both.
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { pathToFileURL } from 'url';

/** Each entry's declaration: the rolled-up source, the shipped file, and
 * whether it names the UMD global (the full entry's alone). */
export const DECLARATIONS = [
  { src: 'build/dts/index.d.ts', out: 'dist/cytoscape.d.ts', umdGlobal: true },
  {
    src: 'build/dts/headless.d.ts',
    out: 'dist/cytoscape-headless.d.ts',
    umdGlobal: false,
  },
  {
    src: 'build/dts/headless-gpu.d.ts',
    out: 'dist/cytoscape-headless-gpu.d.ts',
    umdGlobal: false,
  },
];

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
 *
 * @param {string} source — the rolled-up declaration
 * @param {{ umdGlobal?: boolean }} [options] — `umdGlobal` (default true)
 *   appends `export as namespace cytoscape;`; the slim entries pass false
 * @returns {string} the declaration to ship
 */
export function finalizeDts(source, { umdGlobal = true } = {}) {
  if (!/\bcytoscape as default\b/.test(source)) {
    throw new Error('Generated declaration has no default factory export');
  }

  if (!umdGlobal || /^export as namespace cytoscape;$/m.test(source)) {
    return source;
  }

  return `${source.trimEnd()}\nexport as namespace cytoscape;\n`;
}

/**
 * Finalize one entry's declaration from `src` into `out`.
 *
 * @param {string} src — the rolled-up declaration under build/dts/
 * @param {string} out — the shipped path under dist/
 * @param {{ umdGlobal: boolean }} options — see {@link finalizeDts}
 */
export function buildDts(src, out, { umdGlobal }) {
  const dts = finalizeDts(stripInternal(readFileSync(src, 'utf8')), {
    umdGlobal,
  });

  mkdirSync('dist', { recursive: true });
  writeFileSync(out, dts);
  console.log(`wrote ${out} (${dts.split('\n').length} lines)`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  for (const { src, out, umdGlobal } of DECLARATIONS) {
    buildDts(src, out, { umdGlobal });
  }
}
