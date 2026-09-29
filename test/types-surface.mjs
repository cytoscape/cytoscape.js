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
  'HeadlessOptions', // round 131
  'EventHandler', // round 41
  'Event', // round 41
  'EventProps', // round 41
  'EventTarget', // round 41
  'AlgoRun', // round 128
  'BoundingBoxInput',
  'BreadthFirstLayoutOptions',
  'CaseClause',
  'CaseMapper',
  'CircleLayoutOptions',
  'Collection',
  'ComponentPackingOptions', // round 123.1
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
  'DefinitionData', // round 140: a definition's data, typed or not
  'DictColumn',
  'ElementData',
  'ElementDefinition',
  'ElementFields', // round 140: the first-class fields beside a typed shape
  'ElementsDefinition',
  'ElementsInput',
  'ExportOptions',
  'ForceLayoutOptions',
  'GpuErrorInfo', // round 138.3: the device-error report
  'GpuMemoryStats', // round 138.3: the allocation counts
  'FlowLayoutOptions',
  'GridLayoutOptions',
  'LayoutBaseOptions',
  'LayoutComponentInfo', // round 123.1
  'LayoutOptions',
  'LayoutScoreMapping', // round 85.3
  'LayoutSortMapping', // round 85.3
  'Mapper',
  'MapperSpec',
  'PackedIds',
  'PackLayoutOptions', // round 123.1
  'PatchDiff', // round 107: cy.patch()'s result and the patch event's diff
  'PatchMode', // round 107
  'PatchOptions', // round 107
  'CloneOptions', // round 106: cy.clone()'s options
  'FollowOptions', // round 106: how a following clone keeps up
  'LoadOptions', // round 103: cy.load()'s options
  'LoadProgress', // round 103: a load's progress (event.progress, the result)
  'LoadRun', // round 103: the promise cy.load() returns, with cancel()
  'ToColumnarOptions', // round 103: the converter's { refs } option
  'PresetLayoutOptions',
  'RadialLayoutOptions', // round 85.1
  'RandomLayoutOptions',
  'RendererOptions',
  'WorkerFontFace', // round 141: one entry of renderer.fonts (the worker host)
  'StylePropValue',
  'StyleProps',
  'Stylesheet',
  'NO_PARENT',
  'Position',
  'RendererStats',
  'ViewportCounts', // round 75.6: cy.viewportCounts()'s result
  'WheelBehavior', // round 75.5: the wheelBehavior option
]);

/** Statics hung off the factory function (the UMD-friendly shape). */
const EXPECTED_STATICS = [
  'toColumnarElements',
  'serializeElements',
  'deserializeElements',
  'CancelledError', // round 128
  'GpuUnfitError', // round 138
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

// -- 6. the slim entries' declarations (round 131) --
//
// Each slim entry ships its own standalone declaration with the same named
// type surface as the full one, a default factory that takes
// `HeadlessOptions` — the options minus the renderer- and pointer-only
// fields, so a `container` is a type error — and no UMD global name (two
// declarations naming it are a duplicate identifier for a consumer whose
// program resolves both).

for (const name of ['headless', 'headless-gpu']) {
  const path = new URL(`../dist/cytoscape-${name}.d.ts`, import.meta.url);

  if (!fs.existsSync(path)) {
    fail(`${path.pathname} does not exist; run \`npm run build:types\``);
    continue;
  }

  const slim = fs.readFileSync(path, 'utf8');
  const slimSource = ts.createSourceFile(
    path.pathname,
    slim,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const slimExports = new Set();

  for (const statement of slimSource.statements) {
    if (!ts.isExportDeclaration(statement) || statement.exportClause == null)
      continue;
    if (!ts.isNamedExports(statement.exportClause)) continue;

    for (const element of statement.exportClause.elements) {
      if (element.name.text !== 'default') slimExports.add(element.name.text);
    }
  }

  if (!/\bcytoscape as default\b/.test(slim)) {
    fail(`cytoscape-${name}.d.ts does not export cytoscape as default`);
  }

  if (/^export as namespace /m.test(slim)) {
    fail(`cytoscape-${name}.d.ts names a UMD global; only the full entry may`);
  }

  // round 140: the factory is generic over the application's data shapes,
  // and the parameters must survive the roll-up into each declaration
  if (
    !/declare function cytoscape<NodeData = Untyped, EdgeData = DefaultEdgeData<NodeData>>\(options\?: HeadlessOptions<NoInfer<NodeData>, NoInfer<EdgeData>>\): Core<NodeData, EdgeData>;/.test(
      slim,
    )
  ) {
    fail(
      `cytoscape-${name}.d.ts: the factory does not take HeadlessOptions generically`,
    );
  }

  for (const n of exported) {
    if (!slimExports.has(n)) fail(`cytoscape-${name}.d.ts lacks '${n}'`);
  }

  for (const n of slimExports) {
    if (!exported.has(n)) fail(`cytoscape-${name}.d.ts adds '${n}'`);
  }

  if (/^import /m.test(slim)) {
    fail(`cytoscape-${name}.d.ts imports a chunk; it must stand alone`);
  }
}

// -- 7. typed element data survives, with its hover text (round 140) --
//
// PLAN.md item 45's measurement, kept as a gate: generic parameters are
// what a declaration bundler is likeliest to flatten, and a flattened one
// fails nothing in the type tests' *untyped* half.  So each shipped
// declaration gets a consumer program through the language service — the
// thing an editor asks — and must answer a typed `data( key )` read with
// the field's type, show that overload's own doc block on hover, and keep
// the untyped read `unknown`.

const HOVER_PROBE = (specifier) => `import cytoscape from '${specifier}';
interface N { weight: number; label: string }
interface E { kind: 'a' | 'b' }
const cy = cytoscape<N, E>();
const typedRead = cy.nodes().data('weight');
const edgeRead = cy.edges().data('kind');
const untypedRead = cytoscape().nodes().data('weight');
`;

for (const name of [
  'cytoscape',
  'cytoscape-headless',
  'cytoscape-headless-gpu',
]) {
  const dts = new URL(`../dist/${name}.d.ts`, import.meta.url).pathname;
  const file = new URL('../build/types-probe.ts', import.meta.url).pathname;
  const text = HOVER_PROBE(dts.replace(/\.d\.ts$/, '.js'));
  const readFile = (f) => (f === file ? text : fs.readFileSync(f, 'utf8'));
  const service = ts.createLanguageService({
    getScriptFileNames: () => [file],
    getScriptVersion: () => '1',
    getScriptSnapshot: (f) =>
      f === file || fs.existsSync(f)
        ? ts.ScriptSnapshot.fromString(readFile(f))
        : undefined,
    getCurrentDirectory: () => process.cwd(),
    getCompilationSettings: () => ({
      strict: true,
      noEmit: true,
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      lib: ['lib.es2020.d.ts', 'lib.dom.d.ts'],
      types: [],
    }),
    getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
    fileExists: (f) => f === file || fs.existsSync(f),
    readFile,
  });
  const diagnostics = service.getSemanticDiagnostics(file);

  for (const d of diagnostics) {
    fail(
      `${name}.d.ts typed-data probe: ` +
        ts.flattenDiagnosticMessageText(d.messageText, ' '),
    );
  }

  const hover = (needle, offset = 0) =>
    service.getQuickInfoAtPosition(file, text.indexOf(needle) + offset);
  const typeOf = (needle) =>
    ts.displayPartsToString(hover(needle)?.displayParts);

  if (!typeOf('typedRead =').endsWith('typedRead: number | undefined')) {
    fail(`${name}.d.ts: a typed data( key ) read lost its field type`);
  }
  if (!typeOf('edgeRead =').endsWith('edgeRead: "a" | "b" | undefined')) {
    fail(`${name}.d.ts: an edge collection lost the edge shape`);
  }
  if (!typeOf('untypedRead =').endsWith('untypedRead: unknown')) {
    fail(`${name}.d.ts: the untyped data( key ) read is no longer unknown`);
  }

  const docs = ts.displayPartsToString(
    hover("data('weight')", 1)?.documentation,
  );

  if (!/Read one data key/.test(docs)) {
    fail(`${name}.d.ts: the typed data( key ) overload lost its hover doc`);
  }
}

if (failed) {
  process.exit(1);
}

console.log(
  `declaration surface ok: ${exported.size} type exports, ` +
    `${EXPECTED_STATICS.length} statics, ${docBlocks} doc blocks`,
);
