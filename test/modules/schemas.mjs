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
