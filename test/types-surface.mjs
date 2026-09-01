// Audit for the generated and shipped declaration of the `cytoscape`
// entry point (round 26.5).
//
// Checks five things:
//   1. The declaration exists and exports the factory as default.
//   2. Every name in EXPECTED_EXPORTS is present as a named type export.
//   3. No extra names leak beyond EXPECTED_EXPORTS.
//   4. The factory's static helpers (toColumnarElements, serializeElements,
//      deserializeElements) survive as namespace members — they are expando
//      properties on a function, which is exactly the shape a declaration
//      bundler is most likely to drop silently.
//   5. The round-26 JSDoc actually reaches the shipped declaration.  This is
//      the whole point of pairing the comment pass with the types build: if
//      the doc comments stop surviving the roll-up, consumers lose their
//      editor hover text and nothing else would notice.
//
// Update EXPECTED_EXPORTS deliberately when the v4 public surface changes.
// Run via `npm run test:types:surface`; use the `:run` variant after an existing
// build.

import fs from 'node:fs';
import ts from 'typescript-compiler-api';

/** The v4 public type surface, as exported from `cytoscape`. */
const EXPECTED_EXPORTS = new Set([
  'BoxSelectionMode', // round 39.1
  'CytoscapeOptions',
  'EventHandler', // round 41
  'Event', // round 41
  'EventProps', // round 41
  'EventTarget', // round 41
  'BoundingBoxInput',
  'BreadthFirstLayoutOptions',
  'CaseClause',
  'CaseMapper',
  'CircleLayoutOptions',
  'Collection',
  'ColumnarEdges',
  'ColumnarElements',
  'ColumnarNodes',
  'ConcentricLayoutOptions',
  'Condition',
  'Core',
  'CursorMap', // round 89
  'CursorState', // round 89
  // round 45: the layout-extension contract's own types.  `CustomLayoutOptions`
  // shipped from the start while the two types an external author actually
  // writes against did not — `LayoutContext` was in no declaration at all
  // (round 34.6) — so `cy.layout({ impl })`, the whole of v4's extension
  // story, typed its `run( ctx )` parameter as `any`.  Same fix and same
  // reason as round 41's event types.
  'CustomLayout',
  'CustomLayoutOptions',
  'LayoutContext',
  'LayoutImpl',
  'DataColumn',
  'DictColumn',
  'ElementData',
  'ElementDefinition',
  'ElementsDefinition',
  'ElementsInput',
  'ExportOptions',
  'ForceLayoutOptions',
  'GridLayoutOptions',
  'LayoutBaseOptions',
  'LayoutOptions',
  'LayoutScoreMapping', // round 85.3
  'LayoutSortMapping', // round 85.3
  'Mapper',
  'MapperSpec',
  'PackedIds',
  'PresetLayoutOptions',
  'RadialLayoutOptions', // round 85.1
  'RandomLayoutOptions',
  'RendererOptions',
  'StylePropValue',
  'StyleProps',
  'Stylesheet',
  'NO_PARENT',
  'Position',
  'RendererStats',
]);

/** Statics hung off the factory function (the UMD-friendly shape). */
const EXPECTED_STATICS = [
  'toColumnarElements',
  'serializeElements',
  'deserializeElements',
];

/**
 * Minimum JSDoc blocks expected in the shipped declaration.  A ratchet, well
 * below the ~1000 the round-26 pass produced: it catches the roll-up dropping
 * comments wholesale, without breaking on ordinary edits.
 */
const MIN_DOC_BLOCKS = 700;

const generatedPath = new URL('../build/dts/index.d.ts', import.meta.url);
const shippedPath = new URL('../dist/cytoscape.d.ts', import.meta.url);

let failed = false;

const fail = (message) => {
  console.error(`FAIL  ${message}`);
  failed = true;
};

for (const path of [generatedPath, shippedPath]) {
  if (!fs.existsSync(path)) {
    fail(`${path.pathname} does not exist; run \`npm run build:types\``);
  }
}

if (failed) {
  process.exit(1);
}

const shipped = fs.readFileSync(shippedPath, 'utf8');
const source = ts.createSourceFile(
  shippedPath.pathname,
  shipped,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);

// -- 1. the default export --

if (!/\bcytoscape as default\b/.test(shipped)) {
  fail('the shipped declaration does not export cytoscape as default');
}

if (!/^export as namespace cytoscape;$/m.test(shipped)) {
  fail('the shipped declaration is missing the UMD global name');
}

// -- 2 and 3. the named type surface --

const exported = new Set();

for (const statement of source.statements) {
  if (!ts.isExportDeclaration(statement) || statement.exportClause == null)
    continue;
  if (!ts.isNamedExports(statement.exportClause)) continue;

  for (const element of statement.exportClause.elements) {
    const name = element.name.text;

    if (name !== 'default') exported.add(name);
  }
}

for (const name of EXPECTED_EXPORTS) {
  if (!exported.has(name)) fail(`expected export '${name}' is missing`);
}

for (const name of exported) {
  if (!EXPECTED_EXPORTS.has(name)) {
    fail(
      `unexpected export '${name}' — add it to EXPECTED_EXPORTS if intended`,
    );
  }
}

// -- 4. the factory's statics --

const namespaceBlock = shipped.match(
  /declare namespace cytoscape \{([\s\S]*?)\n\}/,
);

if (namespaceBlock == null) {
  fail('the factory namespace (its static helpers) is missing entirely');
} else {
  for (const name of EXPECTED_STATICS) {
    if (!namespaceBlock[1].includes(name)) {
      fail(`factory static '${name}' did not survive into the declaration`);
    }
  }
}

// -- 5. the JSDoc reaches consumers --

const docBlocks = (shipped.match(/\/\*\*/g) ?? []).length;

if (docBlocks < MIN_DOC_BLOCKS) {
  fail(
    `only ${docBlocks} JSDoc blocks reached the shipped declaration ` +
      `(expected at least ${MIN_DOC_BLOCKS}) — the round-26 comments are not ` +
      `reaching consumers' editors`,
  );
}

if (failed) {
  process.exit(1);
}

console.log(
  `declaration surface ok: ${exported.size} type exports, ` +
    `${EXPECTED_STATICS.length} statics, ${docBlocks} doc blocks`,
);
