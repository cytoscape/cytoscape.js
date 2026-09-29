import { expect } from 'chai';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript-compiler-api';
import cytoscape from '../../src/index.mjs';
import {
  SCHEMA_BASE,
  SCHEMA_DIALECT,
  SCHEMA_DIR,
  debugNetworks,
  loadDebugGlobal,
  describeErrors,
  loadSchemas,
  makeValidator,
} from '../../scripts/schemas.mjs';

/*
Round 79: the official JSON schemas (issue #3487), gated against the running
library.

The schemas under `schemas/` are hand-written documents, not generated ones —
the types are vacuous exactly where a schema is valuable (a type-derived
stylesheet schema says "strings map to strings-or-numbers") — so this file is
what keeps them true.  It follows `migration-guide.mjs`'s design: a claim
about runtime behaviour verifies itself by probing the library.

**The gate's direction, stated once:**

1. **Accept what the library accepts.**  Every documented input the library
   takes must validate: every debug network's element definitions, every
   hand-authored sheet in `debug/styles.js`, `cy.json()`'s own output, and
   the layout options the harness runs.  A schema that rejects a working
   document is the worse failure, because it is the one a user meets first.
2. **Reject what the library rejects, where the library is strict.**  Where
   the runtime throws — `inferGroup`'s group check, an explicit edge without
   endpoints, an unknown style property or sheet key, a mapper on a channel
   that takes constants — the schema must reject too, and the paired probes
   below run the same payload through both and require the same answer.
   Where the runtime *ignores* (unknown keys on an element definition, a
   mapper object, layout options, the factory's options) the schema stays
   open, because the library is the authority and it does not refuse them.
3. **Where the library coerces a form the declaration does not name** (a
   string where the type says number, a numeric id), the declaration is the
   contract: the schema describes the documented forms, and the coercion is
   not a promise.
4. **Name drift fails here.**  Each schema's property names are held to the
   declaration they describe (`src/public-types.mts`, read through the
   TypeScript checker) and — for the stylesheet — to the style engine's own
   vocabulary (`PROP`) and compiler, in both directions, so a round that
   adds an option or a style property without touching the schema is red.

Value-space fidelity is a permanent partial: a sheet that validates is not
thereby a sheet that compiles (a CSS colour string, a scheme-name case, a
data key's existence are the library's to judge), and the schemas' own
descriptions say so.
*/

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// -- the declaration, read through the TypeScript checker --

const TYPES = join(ROOT, 'src/public-types.mts');

let checker;
let exportsByName;

/** The checker over `src/public-types.mts`, built once (~0.3 s). */
const declarations = () => {
  if (checker == null) {
    const program = ts.createProgram([TYPES], {
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      types: [],
      lib: ['lib.es2020.d.ts', 'lib.dom.d.ts'],
    });

    checker = program.getTypeChecker();

    const module = checker.getSymbolAtLocation(program.getSourceFile(TYPES));

    exportsByName = new Map(
      checker.getExportsOfModule(module).map((s) => [s.name, s]),
    );
  }

  return { checker, exportsByName };
};

const declaredType = (name) => {
  const { checker, exportsByName } = declarations();
  const symbol = exportsByName.get(name);

  expect(symbol, `${name} is not exported by public-types.mts`).to.not.equal(
    undefined,
  );

  return checker.getDeclaredTypeOfSymbol(symbol);
};

/** Every member name of a declared type, `extends` and `Omit` resolved. */
const declaredMembers = (name) =>
  declarations()
    .checker.getPropertiesOfType(declaredType(name))
    .map((p) => p.name)
    .sort();

// -- the schemas --

const SCHEMAS = loadSchemas();
const byFile = new Map(SCHEMAS.map((s) => [s.file, s.schema]));
const { validate } = makeValidator(SCHEMAS);

const accepts = (file, doc) => validate(file, doc).valid;

// every debug network, loaded once (ndex-x-large alone is 35 MB)
const NETWORKS = [...debugNetworks()];

/** Assert a document validates, naming the first errors when it does not. */
const expectValid = (file, doc, what) => {
  const { valid, errors } = validate(file, doc);

  expect(valid, `${what}: ${describeErrors(errors)}`).to.equal(true);
};

/** The property names a schema object declares, sorted. */
const schemaMembers = (node) => Object.keys(node.properties ?? {}).sort();

/** Whether the library accepts a payload as `options.elements`. */
const libraryAcceptsElements = (elements) => {
  try {
    cytoscape({ elements }).destroy();

    return true;
  } catch {
    return false;
  }
};

describe('schemas: the documents (round 79)', () => {
  it('finds the schema documents', () => {
    // the guard every sweep here needs: a loader that stops finding files
    // must not read as "every schema fine"
    expect(SCHEMAS.map((s) => s.file)).to.include.members([
      'element.schema.json',
      'elements.schema.json',
    ]);
  });

  it('every document declares draft 2020-12 and an $id under the one base', () => {
    for (const { file, schema } of SCHEMAS) {
      expect(schema.$schema, file).to.equal(SCHEMA_DIALECT);
      expect(schema.$id, file).to.equal(SCHEMA_BASE + file);
      expect(schema.title, `${file}: no title`).to.be.a('string');
      expect(schema.description, `${file}: no description`).to.be.a('string');
    }
  });

  it('the base is the marked placeholder round 46 replaces', () => {
    // `.invalid` is reserved (RFC 2606): no tool can fetch it by accident,
    // and a reader sees at once that the location is undecided
    expect(new URL(SCHEMA_BASE).hostname).to.match(/\.invalid$/);

    for (const { file, schema } of SCHEMAS) {
      expect(JSON.stringify(schema), file).to.include('round 46');
    }
  });

  it('every document compiles under ajv strict mode', () => {
    // makeValidator compiled them all at load; strict mode makes an unknown
    // keyword an error, so a typo such as `requried` cannot pass as an
    // annotation.  Compile each explicitly for a per-file message.
    const { ajv } = makeValidator(SCHEMAS);

    for (const { file } of SCHEMAS) {
      expect(() => ajv.getSchema(SCHEMA_BASE + file), file).to.not.throw();
      expect(ajv.getSchema(SCHEMA_BASE + file), file).to.be.a('function');
    }
  });

  it('references between documents are relative, so the base moves in one place', () => {
    const refs = [];
    const walk = (node) => {
      if (Array.isArray(node)) {
        node.forEach(walk);
      } else if (node != null && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) {
          if (k === '$ref') refs.push(v);
          else walk(v);
        }
      }
    };

    SCHEMAS.forEach((s) => walk(s.schema));
    expect(refs.length).to.be.greaterThan(0);

    for (const ref of refs) {
      expect(ref, ref).to.not.match(/^[a-z]+:/);
    }
  });

  it('ships nothing but schema documents in schemas/', () => {
    // the directory ships in the package whole (see packaging.mjs)
    for (const f of readdirSync(SCHEMA_DIR)) {
      expect(f).to.match(/\.schema\.json$/);
      expect(() =>
        JSON.parse(readFileSync(join(SCHEMA_DIR, f), 'utf8')),
      ).to.not.throw();
    }
  });
});

describe('schemas: elements (79.1)', () => {
  const element = byFile.get('element.schema.json');

  it('names exactly the members of ElementDefinition', () => {
    expect(schemaMembers(element)).to.deep.equal(
      declaredMembers('ElementDefinition'),
    );
  });

  it('names exactly the declared members of ElementData', () => {
    expect(schemaMembers(element.$defs.data)).to.deep.equal(
      declaredMembers('ElementData'),
    );
  });

  it("the group enum is the declaration's", () => {
    const { checker } = declarations();
    const group = checker.getPropertyOfType(
      declaredType('ElementDefinition'),
      'group',
    );
    const type = checker.getNonNullableType(checker.getTypeOfSymbol(group));
    const literals = (type.isUnion() ? type.types : [type]).map((t) => t.value);

    expect([...element.properties.group.enum].sort()).to.deep.equal(
      literals.sort(),
    );
  });

  describe('accepts every debug network, as the page builds it', () => {
    for (const { id, elements } of NETWORKS) {
      it(id, () => {
        expect(elements.nodes.length, `${id}: no nodes`).to.be.at.least(1);

        // all three accepted shapes: the map, the flat array, one def
        expectValid('elements.schema.json', elements, `${id} as a map`);
        expectValid(
          'elements.schema.json',
          [...elements.nodes, ...elements.edges],
          `${id} as an array`,
        );
        expectValid('element.schema.json', elements.nodes[0], `${id} node`);

        if (elements.edges.length > 0) {
          expectValid('element.schema.json', elements.edges[0], `${id} edge`);
        }
      });
    }
  });

  describe("accepts cy.json()'s elements back", () => {
    // the export is v3's round-trip form; a consumer who stores it and
    // validates it later must not be told it is invalid
    for (const { id, elements } of NETWORKS) {
      if (elements.nodes.length + elements.edges.length > 20000) {
        continue; // the sweep above covers the large ones; this one loads
      }

      it(id, () => {
        const cy = cytoscape({ elements });

        try {
          expectValid(
            'elements.schema.json',
            cy.json().elements,
            `${id}: cy.json().elements`,
          );
          expectValid(
            'elements.schema.json',
            cy.json(true).elements,
            `${id}: cy.json( true ).elements`,
          );
        } finally {
          cy.destroy();
        }
      });
    }
  });

  describe('agrees with the library where the library is strict', () => {
    // Each payload runs through `cytoscape( { elements } )` and the schema;
    // the answers must match.  The rejecting rows are the library's own
    // throws: inferGroup's group check (element-defs.mts) and the edge
    // endpoint check.
    const node = (id, extra = {}) => ({ data: { id }, ...extra });
    const rows = [
      ['one inferred node', [node('a')]],
      ['an empty definition (a node, id generated)', {}],
      ['a single definition', node('a')],
      [
        'an inferred edge',
        [node('a'), node('b'), { data: { id: 'e', source: 'a', target: 'b' } }],
      ],
      [
        'an explicit edge',
        [
          node('a'),
          { group: 'edges', data: { id: 'e', source: 'a', target: 'a' } },
        ],
      ],
      ['a positioned node', [node('a', { position: { x: 1, y: 2 } })]],
      ['the map form', { nodes: [node('a')], edges: [] }],
      [
        'a half-edge is a node (group inferred)',
        [node('a'), { data: { id: 'e', source: 'a' } }],
      ],
      ["group 'foo'", [{ group: 'foo', data: { id: 'a' } }]],
      ["group 'node' (v3 never took it either)", [{ group: 'node' }]],
      [
        'an explicit edge without a target',
        [node('a'), { group: 'edges', data: { id: 'e', source: 'a' } }],
      ],
      ['an explicit edge without data', [node('a'), { group: 'edges' }]],
      [
        'an edge-bucket definition without endpoints',
        { nodes: [node('a')], edges: [{ data: { id: 'e' } }] },
      ],
    ];

    for (const [what, payload] of rows) {
      it(what, () => {
        const lib = libraryAcceptsElements(payload);

        expect(
          accepts('elements.schema.json', payload),
          `${what}: the library ${lib ? 'accepts' : 'rejects'} it`,
        ).to.equal(lib);
      });
    }

    it('rejects on both sides at least once (the table is not all green rows)', () => {
      const rejected = rows.filter(([, p]) => !libraryAcceptsElements(p));

      expect(rejected.length).to.be.at.least(4);
    });
  });

  describe('controls', () => {
    it('a corrupted fixture — an explicit edge without a target — is red', () => {
      const [first] = NETWORKS;
      const edges = first.elements.edges.map((e) => ({ ...e }));
      const { target: _dropped, ...data } = edges[0].data;

      edges[0] = { ...edges[0], group: 'edges', data };

      const doc = [...first.elements.nodes, ...edges];

      expect(accepts('elements.schema.json', doc)).to.equal(false);
      expect(libraryAcceptsElements(doc)).to.equal(false);
    });

    it('a schema property deleted fails the declaration half', () => {
      const mutated = structuredClone(element);

      delete mutated.properties.pannable;

      expect(schemaMembers(mutated)).to.not.deep.equal(
        declaredMembers('ElementDefinition'),
      );
    });

    it('a schema that dropped its edge rule accepts the corrupted fixture', () => {
      // the rejecting rows above are live only while the `if/then` exists
      const mutated = structuredClone(element);

      delete mutated.if;
      delete mutated.then;

      const { validate: loose } = makeValidator(
        SCHEMAS.map((s) =>
          s.file === 'element.schema.json' ? { ...s, schema: mutated } : s,
        ),
      );

      expect(
        loose('elements.schema.json', [
          { data: { id: 'a' } },
          { group: 'edges', data: { id: 'e', source: 'a' } },
        ]).valid,
      ).to.equal(true);
    });
  });
});

// -- the stylesheet (79.2) --

const SHEET = byFile.get('stylesheet.schema.json');
const GROUP_BLOCKS = {
  nodes: SHEET.$defs.nodeProps,
  edges: SHEET.$defs.edges,
  parents: {
    properties: {
      ...SHEET.$defs.nodeProps.properties,
      ...SHEET.$defs.parents.properties,
    },
  },
  core: SHEET.$defs.core,
};
const SHEET_GROUPS = Object.keys(GROUP_BLOCKS);

/** The kebab-case names a group block enumerates (camelCase aliases aside). */
const kebabNames = (block) =>
  Object.keys(block.properties)
    .filter((k) => !/[A-Z]/.test(k))
    .sort();

/** Whether the compiler takes `{ [group]: { [prop]: value } }`. */
const compileError = (cy, group, prop, value) => {
  try {
    cy.style({ [group]: { [prop]: value } });

    return null;
  } catch (e) {
    return e;
  }
};

/**
 * The compiler's *name-level* refusals: an unknown property, a property of
 * the other group or of the parents group, one the prototype does not
 * support at all.  Each is raised before the value is parsed, so it says
 * the name is not accepted whatever the value — a value error does not.
 */
const NAME_LEVEL =
  /style property '[^']+' (is unsupported|belongs to the parents group)|' is an? (edge|node) style property|is not supported in the GPU prototype/;

/** The example values a prop's schema carries (its `examples`). */
const examplesOf = (schema, prop) => schema.$defs.props[prop]?.examples ?? [];

/**
 * Direction (a) and (b) of the name gate, per group, as discrepancy lists
 * (empty when the schema and the compiler agree) — pure over the schema so
 * the controls can run it against a mutated copy.
 *
 * (a) every name the schema enumerates compiles, with every example the
 *     schema gives for it;
 * (b) every name in the engine's vocabulary (`PROP`) the schema leaves out
 *     of a group is refused there by name.
 */
const nameGate = (cy, schema, PROP) => {
  const blocks = {
    nodes: schema.$defs.nodeProps,
    edges: schema.$defs.edges,
    parents: {
      properties: {
        ...schema.$defs.nodeProps.properties,
        ...schema.$defs.parents.properties,
      },
    },
    core: schema.$defs.core,
  };
  const vocabulary = new Set(Object.values(PROP));
  const unknown = [];
  const refused = [];
  const accepted = [];

  for (const [group, block] of Object.entries(blocks)) {
    const names = new Set(kebabNames(block));

    for (const name of names) {
      if (!vocabulary.has(name)) {
        unknown.push(`${group}: ${name}`);
      }

      const examples = examplesOf(schema, name);

      if (examples.length === 0) {
        refused.push(`${group}: ${name} (no example to compile)`);
      }

      for (const value of examples) {
        const err = compileError(cy, group, name, value);

        if (err != null) {
          refused.push(`${group}: ${name} = ${JSON.stringify(value)}`);
        }
      }
    }

    for (const name of vocabulary) {
      if (names.has(name)) continue;

      const value = examplesOf(schema, name)[0] ?? 1;
      const err = compileError(cy, group, name, value);

      if (err == null || !NAME_LEVEL.test(err.message)) {
        accepted.push(
          `${group}: ${name}` +
            (err == null ? ' compiles' : ` (a value error: ${err.message})`),
        );
      }
    }
  }

  return { unknown, refused, accepted };
};

/** How a group entry takes mappers: 'mapper', 'passthrough' or null. */
const mapperKind = (entry) => {
  const refs = (entry.anyOf ?? []).map((e) => e.$ref);

  if (refs.includes('#/$defs/mapper')) return 'mapper';
  if (refs.includes('#/$defs/passthroughMapper')) return 'passthrough';

  return null;
};

/** How the compiler takes mappers on a (group, prop). */
const compilerMapperKind = (cy, schema, group, prop) => {
  const example = examplesOf(schema, prop).find(
    (v) => typeof v === 'string' || typeof v === 'number',
  );
  // a conditional counts when any plausible output compiles: the example
  // itself may be a keyword no mapper outputs ('auto' for a radius)
  const thens = [example ?? 1, 1, 'red'];
  const passthrough = compileError(cy, group, prop, { data: 'x' }) == null;
  const conditional = thens.some(
    (then) =>
      compileError(cy, group, prop, {
        case: [{ when: { data: 'x', eq: 1 }, then }],
        else: then,
      }) == null,
  );

  if (passthrough && conditional) return 'mapper';
  if (passthrough) return 'passthrough';
  if (conditional) return 'case only (no schema form)';

  return null;
};

describe('schemas: the stylesheet (79.2)', () => {
  let cy;
  let PROP;
  let tables;

  before(async () => {
    cy = cytoscape({ elements: [] });
    ({ PROP } = await import('../../src/style-props.mjs'));

    const [styleTables, parse, parseEdge, sheet, easing, schemes, normalize] =
      await Promise.all([
        import('../../src/style/tables.mjs'),
        import('../../src/style/parse.mjs'),
        import('../../src/style/parse-edge.mjs'),
        import('../../src/style/sheet.mjs'),
        import('../../src/easing.mjs'),
        import('../../src/style-schemes.mjs'),
        import('../../src/style/normalize.mjs'),
      ]);

    tables = {
      styleTables,
      parse,
      parseEdge,
      sheet,
      easing,
      schemes,
      normalize,
    };
  });

  after(() => cy.destroy());

  it('has the sheet keys of the Stylesheet declaration and of the compiler', () => {
    const keys = schemaMembers(SHEET);

    expect(keys).to.deep.equal(declaredMembers('Stylesheet'));
    expect(keys).to.deep.equal([...tables.sheet.SHEET_KEYS].sort());
    expect(SHEET.additionalProperties).to.equal(false);
  });

  it('enumerates a non-trivial vocabulary per group', () => {
    // the guard for every sweep below: an empty block agrees with nothing
    expect(kebabNames(GROUP_BLOCKS.nodes).length).to.be.greaterThan(100);
    expect(kebabNames(GROUP_BLOCKS.edges).length).to.be.greaterThan(100);
    expect(kebabNames(GROUP_BLOCKS.core).length).to.equal(7);
  });

  it('(a) every property it enumerates compiles in that group, with every example it gives', () => {
    const { unknown, refused } = nameGate(cy, SHEET, PROP);

    expect(unknown, 'not in the engine vocabulary (PROP)').to.deep.equal([]);
    expect(refused, 'refused by the compiler').to.deep.equal([]);
  });

  it('(b) every property the compiler accepts is enumerated, group by group', () => {
    // PROP is the engine's own census (round 127: every name the style
    // engine accepts, spelled once), so a round that adds a property adds
    // it there — and this goes red until the schema has it too
    const { accepted } = nameGate(cy, SHEET, PROP);

    expect(accepted, 'accepted but not in the schema').to.deep.equal([]);
  });

  it('takes a mapper exactly where the compiler does', () => {
    const wrong = [];

    for (const group of ['nodes', 'edges', 'parents']) {
      const block = GROUP_BLOCKS[group];

      for (const prop of kebabNames(block)) {
        const schemaSays = mapperKind(block.properties[prop]);
        const compilerSays = compilerMapperKind(cy, SHEET, group, prop);

        if (schemaSays !== compilerSays) {
          wrong.push(
            `${group}: ${prop} schema ${schemaSays}, compiler ${compilerSays}`,
          );
        }
      }
    }

    expect(wrong).to.deep.equal([]);
  });

  it('spells every property in camelCase too, as the same entry', () => {
    const { normalizeProp } = tables.normalize;

    for (const [group, block] of Object.entries({
      nodes: SHEET.$defs.nodeProps,
      edges: SHEET.$defs.edges,
      parents: SHEET.$defs.parents,
      core: SHEET.$defs.core,
    })) {
      const all = Object.keys(block.properties);
      const kebab = all.filter((k) => !/[A-Z]/.test(k));
      const camel = all.filter((k) => /[A-Z]/.test(k));

      for (const name of camel) {
        const target = normalizeProp(name);

        expect(kebab, `${group}: ${name} aliases nothing`).to.include(target);
        expect(block.properties[name].$ref, `${group}: ${name}`).to.match(
          new RegExp(`/properties/${target}$`),
        );
      }

      const hyphenated = kebab.filter((k) => k.includes('-'));

      expect(camel.length, `${group}: a camelCase alias is missing`).to.equal(
        hyphenated.length,
      );
    }
  });

  it("pins its keyword sets to the engine's own tables", () => {
    const { styleTables, parse, parseEdge, sheet, easing, schemes } = tables;
    const keys = (t) => Object.keys(t).sort();
    const expected = {
      shape: keys(styleTables.SHAPES),
      arrowShape: keys(styleTables.ARROW_ENUM),
      curveStyle: keys(parseEdge.CURVE_STYLES),
      lineStyle: keys(parseEdge.LINE_STYLES),
      strokeStyle: keys(parse.STROKE_STYLES),
      textWrap: keys(parse.TEXT_WRAPS),
      overflowWrap: keys(parse.OFLOW_WRAPS),
      justification: keys(parse.JUSTIFICATIONS),
      textTransform: keys(parse.TEXT_TRANSFORMS),
      textBackgroundShape: keys(parse.TEXT_BG_SHAPES),
      arrowFill: keys(parse.ARROW_FILLS),
      lineCap: keys(parse.LINE_CAPS),
      fill: keys(parse.FILL_KINDS),
      gradientDirection: keys(parse.GRADIENT_DIRECTIONS),
      borderPosition: keys(parse.BORDER_POSITIONS),
      halign: keys(parse.HALIGNS),
      valign: keys(parse.VALIGNS),
      edgeDistances: keys(parseEdge.EDGE_DISTANCES),
      taxiDirection: keys(parseEdge.TAXI_DIRECTIONS),
      taxiTrack: keys(parseEdge.TAXI_TRACKS),
      radiusType: Object.values(parseEdge.RADIUS_TYPE_NAMES).sort(),
      backgroundFit: keys(parse.BG_FITS),
      backgroundRepeat: keys(parse.BG_REPEATS),
      backgroundClip: keys(parse.BG_CLIPS),
      backgroundImageContainment: keys(parse.BG_CONTAINMENTS),
      backgroundImageType: keys(parse.IMAGE_TYPES),
      backgroundImageCrossorigin: [...parse.BG_CROSSORIGINS].sort(),
      paddingRelativeTo: [...sheet.PADDING_RELATIVE_TO].sort(),
      easing: [...easing.EASING_NAMES].sort(),
      scheme: keys(schemes.SCHEMES),
    };

    for (const [name, want] of Object.entries(expected)) {
      const def = SHEET.$defs.keywords[name];

      expect(def, `keywords/${name}`).to.not.equal(undefined);
      expect([...def.enum].sort(), `keywords/${name}`).to.deep.equal(want);
    }
  });

  it('every keyword it lists compiles, for a property that takes it', () => {
    // the keyword sets with no exported engine table (layer shapes,
    // visibility, chart kinds, …) are held here instead; the ones inside a
    // value kind name their property explicitly
    const VIA = {
      endpointKeyword: ['edges', 'source-endpoint'],
      fontWeightKeyword: ['nodes', 'font-weight'],
      radiusType: ['edges', 'radius-type'],
      easing: ['nodes', 'transition-timing-function'],
      scheme: ['nodes', 'chart-colors'],
      backgroundImageCrossorigin: ['nodes', 'background-image-crossorigin'],
    };
    const refersTo = (node, target) =>
      JSON.stringify(node).includes(`"#/$defs/keywords/${target}"`);
    const failures = [];

    for (const [name, def] of Object.entries(SHEET.$defs.keywords)) {
      let via = VIA[name];

      if (via == null) {
        const prop = Object.keys(SHEET.$defs.props).find((p) =>
          refersTo(SHEET.$defs.props[p], name),
        );
        const group = SHEET_GROUPS.find((g) =>
          kebabNames(GROUP_BLOCKS[g]).includes(prop),
        );

        via = [group, prop];
      }

      expect(via[1], `keywords/${name} is used by no property`).to.be.a(
        'string',
      );

      for (const word of def.enum) {
        if (compileError(cy, via[0], via[1], word) != null) {
          failures.push(`${via[0]}: ${via[1]} = ${word}`);
        }
      }
    }

    expect(failures).to.deep.equal([]);
  });

  it('every example validates against its own group', () => {
    for (const group of SHEET_GROUPS) {
      for (const prop of kebabNames(GROUP_BLOCKS[group])) {
        for (const value of examplesOf(SHEET, prop)) {
          expectValid(
            'stylesheet.schema.json',
            { [group]: { [prop]: value } },
            `${group}: ${prop}`,
          );
        }
      }
    }
  });

  it('names the members of Mapper, CaseMapper, CaseClause and Condition', () => {
    const { $defs } = SHEET;

    expect(schemaMembers($defs.scaleMapper)).to.deep.equal(
      declaredMembers('Mapper'),
    );
    expect(schemaMembers($defs.caseMapper)).to.deep.equal(
      declaredMembers('CaseMapper'),
    );
    expect(schemaMembers($defs.caseClause)).to.deep.equal(
      declaredMembers('CaseClause'),
    );
    expect(
      [
        ...schemaMembers($defs.dataCondition),
        ...schemaMembers($defs.stateCondition),
      ].sort(),
    ).to.deep.equal(declaredMembers('Condition'));
  });

  it("takes the declaration's scale and interpolation names", () => {
    const literals = (type, member) => {
      const { checker } = declarations();
      const symbol = checker.getPropertyOfType(declaredType(type), member);
      const t = checker.getNonNullableType(checker.getTypeOfSymbol(symbol));

      return (t.isUnion() ? t.types : [t]).map((x) => x.value).sort();
    };
    const { properties } = SHEET.$defs.scaleMapper;

    expect([...properties.scale.enum].sort()).to.deep.equal(
      literals('Mapper', 'scale'),
    );
    expect([...properties.interpolate.enum].sort()).to.deep.equal(
      literals('Mapper', 'interpolate'),
    );
  });

  describe('accepts every hand-authored sheet in debug/styles.js', () => {
    const styles = loadDebugGlobal('styles');

    it('has sheets to check', () => {
      expect(styles.kinds.length).to.be.at.least(2);
      expect(NETWORKS.length).to.be.at.least(10);
    });

    for (const { id, def, elements } of NETWORKS) {
      it(id, () => {
        for (const kind of styles.kinds) {
          expectValid(
            'stylesheet.schema.json',
            styles.sheet(kind, id, elements, def),
            `${id}/${kind}`,
          );
        }
      });
    }
  });

  it("accepts v4's default sheet blocks", () => {
    const { NODE_DEFAULT_BLOCK, EDGE_DEFAULT_BLOCK, PARENT_CHANNEL_OVERLAY } =
      tables.sheet;

    expectValid(
      'stylesheet.schema.json',
      {
        nodes: NODE_DEFAULT_BLOCK,
        edges: EDGE_DEFAULT_BLOCK,
        parents: PARENT_CHANNEL_OVERLAY,
      },
      'the default sheet',
    );
  });

  it("accepts cy.json()'s style back", () => {
    const styles = loadDebugGlobal('styles');

    for (const { id, def, elements } of NETWORKS) {
      if (elements.nodes.length + elements.edges.length > 20000) continue;

      const cy2 = cytoscape({
        elements,
        style: styles.sheet('production', id, elements, def),
      });

      try {
        cy2.nodes().first().style('width', 40); // a bypass section too
        expectValid(
          'stylesheet.schema.json',
          cy2.json().style,
          `${id}: cy.json().style`,
        );
      } finally {
        cy2.destroy();
      }
    }
  });

  it("names none of the migration guide's rejected v3 properties", () => {
    const guide = readFileSync(join(ROOT, 'MIGRATING.md'), 'utf8');
    const start = guide.indexOf('## Style properties that moved');
    const rows = guide
      .slice(start, guide.indexOf('\n## ', start + 1))
      .split('\n')
      .filter((l) => l.startsWith('| `'));
    const names = rows.flatMap((row) =>
      [...row.split('|')[1].matchAll(/`([^`]+)`/g)]
        .map((m) => m[1])
        .filter((n) => /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(n)),
    );
    const everywhere = new Set(
      SHEET_GROUPS.flatMap((g) => kebabNames(GROUP_BLOCKS[g])),
    );

    expect(names.length).to.be.greaterThan(15);

    for (const name of names) {
      expect(everywhere.has(name), `${name} is in the schema`).to.equal(false);
    }
  });

  describe('agrees with the library where the library is strict', () => {
    const when = (cond) => ({ case: [{ when: cond, then: 'red' }] });
    const rows = [
      ['a constant', { nodes: { 'background-color': 'red' } }],
      ['camelCase', { nodes: { backgroundColor: 'red', textValign: 'top' } }],
      ['a scale mapper', { nodes: { width: { data: 'w', range: [10, 50] } } }],
      [
        'a scheme range',
        { nodes: { 'background-color': { data: 'w', range: 'viridis' } } },
      ],
      [
        'a case mapper',
        { edges: { 'line-color': when({ data: 't', eq: 'a' }) } },
      ],
      [
        'an AND of a state and a data condition',
        {
          nodes: {
            'background-color': when([
              { selected: true },
              { data: 'x', gt: 1 },
            ]),
          },
        },
      ],
      ['the label passthrough', { nodes: { label: { data: 'name' } } }],
      [
        'a bypass',
        { bypasses: { a: { width: 5, 'background-color': 'red' } } },
      ],
      ['core props', { core: { 'selection-box-color': '#ddd' } }],
      ['compound props', { parents: { padding: '10%', 'min-width': 20 } }],
      ['an unknown sheet key', { node: {} }],
      ['an unknown property', { nodes: { 'background-blacken': 0.5 } }],
      ['an edge property on nodes', { nodes: { 'curve-style': 'bezier' } }],
      ['a node property on edges', { edges: { 'text-halign': 'left' } }],
      ['a compound property on nodes', { nodes: { padding: 10 } }],
      [
        'a mapper on a constant-only channel',
        { nodes: { 'arrow-scale': { data: 'x', range: [1, 2] } } },
      ],
      [
        'a mapper on a core prop',
        { core: { 'selection-box-color': { data: 'x' } } },
      ],
      [
        'a mapper on a compound prop',
        { parents: { padding: { data: 'x', range: [1, 2] } } },
      ],
      [
        'a mapper on a global font prop',
        { nodes: { 'font-family': { data: 'x' } } },
      ],
      ['a scaled label', { nodes: { label: { data: 'x', range: [1, 2] } } }],
      ['a bypass mapper', { bypasses: { a: { width: { data: 'x' } } } }],
      ['a bypassed font', { bypasses: { a: { 'font-family': 'serif' } } }],
      [
        'a bypass mixing node-only and edge-only props',
        { bypasses: { a: { 'text-halign': 'left', 'source-label': 'x' } } },
      ],
      [
        'a data condition with two comparisons',
        { nodes: { 'background-color': when({ data: 'x', eq: 1, gt: 0 }) } },
      ],
      [
        'a data condition with none',
        { nodes: { 'background-color': when({ data: 'x' }) } },
      ],
      [
        'a structural condition beside data',
        { nodes: { 'background-color': when({ data: 'x', parent: true }) } },
      ],
      [
        'a state condition that is not a boolean',
        { nodes: { 'background-color': when({ selected: 'yes' }) } },
      ],
      ['an empty case list', { nodes: { 'background-color': { case: [] } } }],
      [
        'a clause without then',
        {
          nodes: {
            'background-color': { case: [{ when: { data: 'x', eq: 1 } }] },
          },
        },
      ],
      [
        'an unknown scale',
        { nodes: { width: { data: 'x', scale: 'nope', range: [1, 2] } } },
      ],
      ['an empty data key', { nodes: { width: { data: '', range: [1, 2] } } }],
      [
        "'in' with no values",
        { nodes: { 'background-color': when({ data: 'x', in: [] }) } },
      ],
      ['a keyword outside its set', { nodes: { shape: 'roundrectangle' } }],
      ['an opacity out of range', { nodes: { 'background-opacity': 2 } }],
      [
        'a negative transition duration',
        { nodes: { 'transition-duration': -1 } },
      ],
      [
        'an unknown easing',
        { nodes: { 'transition-timing-function': 'wobble' } },
      ],
      [
        "compound sizing 'include'",
        { parents: { 'compound-sizing-wrt-labels': 'include' } },
      ],
      ['a string min-width', { parents: { 'min-width': '10px' } }],
      ['a v3 selector array', [{ selector: 'node', style: {} }]],
    ];

    const libraryAccepts = (sheet) => {
      const c = cytoscape({ elements: [] });

      try {
        c.style(sheet);

        return true;
      } catch {
        return false;
      } finally {
        c.destroy();
      }
    };

    for (const [what, sheet] of rows) {
      it(what, () => {
        const lib = libraryAccepts(sheet);

        expect(
          accepts('stylesheet.schema.json', sheet),
          `${what}: the library ${lib ? 'accepts' : 'rejects'} it`,
        ).to.equal(lib);
      });
    }

    it('rejects on both sides for most rows (the table is not all green)', () => {
      expect(rows.filter(([, s]) => !libraryAccepts(s)).length).to.be.at.least(
        25,
      );
    });
  });

  describe('controls', () => {
    it('a fake property added to the schema fails (a)', () => {
      const mutated = structuredClone(SHEET);

      mutated.$defs.nodeProps.properties['background-blacken'] = {
        $ref: '#/$defs/props/background-blacken',
      };
      mutated.$defs.props['background-blacken'] = { examples: [0.5] };

      const { unknown, refused } = nameGate(cy, mutated, PROP);

      expect(unknown).to.include('nodes: background-blacken');
      expect(refused).to.include('nodes: background-blacken = 0.5');
    });

    it('a real property removed from the schema fails (b)', () => {
      const mutated = structuredClone(SHEET);

      delete mutated.$defs.edges.properties['taxi-turn'];

      const { accepted } = nameGate(cy, mutated, PROP);

      expect(accepted).to.deep.equal(['edges: taxi-turn compiles']);
    });

    it('a mapper allowance dropped from an entry is caught', () => {
      const entry = GROUP_BLOCKS.nodes.properties['background-color'];

      expect(mapperKind(entry)).to.equal('mapper');
      expect(mapperKind({ $ref: entry.anyOf[0].$ref })).to.equal(null);
      expect(
        compilerMapperKind(cy, SHEET, 'nodes', 'background-color'),
      ).to.equal('mapper');
    });
  });
});
