import { expect } from 'chai';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseAst } from 'rolldown/parseAst';

import {
  inlineConstants,
  readTable,
  splice,
  TABLES,
} from '../../scripts/const-inline.mjs';
import { COL } from '../../src/contract.mjs';
import { TWEEN_COL } from '../../src/animation.mjs';
import { PROP } from '../../src/style-props.mjs';

/*
Round 126.5 (PLAN.md item 63): the build-time inlining of the constant
tables and the shader constants, `scripts/const-inline.mjs`.

It is a transform between the source and every bundle, so it gets the
same three layers the WGSL minifier has (`wgsl-minify.mjs`):

1. The contract on fixtures — what is rewritten, what is left alone
   (computed access, type positions, shadowed names, untagged
   templates, expressions), and what is a build error.
2. The whole tree, with the count of what the walk touched pinned: a
   transform that silently stops matching reads exactly like one with
   nothing to do (`docs/agents/testing.md`).
3. **Equivalence on the real shaders**: every shader module is inlined,
   evaluated, and its exported strings compared with the original's —
   the splice claims to produce exactly what the runtime join would, and
   this is where that claim is checked, with a control that falsifies
   one constant and must be caught.

The browser half is the `renderer` and `visual` Playwright projects,
which draw from bundles built through this transform.
*/

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SRC = join(ROOT, 'src');

const parse = (code, id) => parseAst(code, { lang: 'ts' }, id);

/** Every .mts under src, absolute. */
const srcFiles = (dir = SRC, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);

    if (statSync(p).isDirectory()) srcFiles(p, out);
    else if (name.endsWith('.mts')) out.push(p);
  }

  return out;
};

/** The build's resolution for src: `./x.mjs` names `x.mts`. */
const resolveSrc = async (source, importer) => {
  if (!source.startsWith('.')) return null;
  const p = resolve(dirname(importer), source);
  const mts = p.replace(/\.mjs$/, '.mts');

  return existsSync(mts) ? mts : existsSync(p) ? p : null;
};

/** The real tables, as the plugin reads them. */
const realTables = (astOf) => {
  const tables = new Map();

  for (const t of TABLES) {
    const abs = join(ROOT, t.file);

    if (!tables.has(abs)) tables.set(abs, new Map());
    tables.get(abs).set(t.name, readTable(astOf(abs), t.name, t.file));
  }

  return tables;
};

/** An `astOf` over the real tree, with optional source overrides. */
const treeAsts = (overrides = {}) => {
  const cache = new Map();

  return (id) => {
    if (!id.endsWith('.mts')) return null;

    if (!cache.has(id)) {
      cache.set(id, parse(overrides[id] ?? readFileSync(id, 'utf8'), id));
    }

    return cache.get(id);
  };
};

/**
 * A fixture environment: an in-memory module map, `./x.mjs` resolving to
 * `/v/x.mts`.
 */
const fixture = (files) => {
  const warnings = [];
  const astOf = (id) => (files[id] == null ? null : parse(files[id], id));
  const tables = new Map();

  for (const [id, code] of Object.entries(files)) {
    for (const name of ['COL', 'PROP']) {
      if (code.includes(`export const ${name} = {`)) {
        if (!tables.has(id)) tables.set(id, new Map());
        tables.get(id).set(name, readTable(astOf(id), name, id));
      }
    }
  }

  return {
    warnings,
    src: (id) => files[id],
    env: {
      resolveId: async (source) =>
        '/v/' + basename(source).replace(/\.mjs$/, '.mts'),
      astOf,
      tables,
      warn: (msg) => warnings.push(msg),
    },
  };
};

const CONTRACT = `
export const COL = {
  NODE_POSITION: 'node.position',
  NODE_SIZE: 'node.size',
} as const;
export const SHIFT = 16;
export const NEG = -2;
export const LIMIT = 1.5e3;
`;

describe('const-inline (round 126.5, PLAN.md item 63)', () => {
  describe('readTable', () => {
    it('reads each real table exactly as the runtime has it', () => {
      const astOf = treeAsts();
      const runtime = { COL, PROP, TWEEN_COL };

      for (const t of TABLES) {
        const map = readTable(astOf(join(ROOT, t.file)), t.name, t.file);

        expect(Object.fromEntries(map), t.name).to.deep.equal({
          ...runtime[t.name],
        });
      }

      // the walk's size: the tables round 127 declared
      expect(Object.keys(COL).length + Object.keys(PROP).length).to.be.at.least(
        200,
      );
    });

    it('refuses a table that is not an `as const` literal of strings', () => {
      const bad = [
        'export const COL = { A: "a" };',
        'export const COL = { A: 1 } as const;',
        'export const COL = { [k]: "a" } as const;',
      ];

      for (const code of bad) {
        expect(() =>
          readTable(parse(code, 't.mts'), 'COL', 't.mts'),
        ).to.throw();
      }
    });
  });

  describe('inlineConstants: the tables', () => {
    it('inlines an imported member, and only in value positions', async () => {
      const { env, src } = fixture({
        '/v/contract.mts': CONTRACT,
        '/v/a.mts': `
import { COL } from './contract.mjs';
import type { ColumnId } from './contract.mjs';
type P = typeof COL.NODE_POSITION;
export const a = store.column(COL.NODE_POSITION);
export const b = COL[key];
export const c = Object.keys(COL);
export const d = { [COL.NODE_SIZE]: 1 };
`,
      });
      const out = await inlineConstants(src('/v/a.mts'), '/v/a.mts', env);

      expect(out.tables).to.equal(2);
      expect(out.code).to.include('store.column("node.position")');
      expect(out.code).to.include('{ ["node.size"]: 1 }');
      // the type position, the computed access and the whole-table
      // reference are left as written
      expect(out.code).to.include('type P = typeof COL.NODE_POSITION;');
      expect(out.code).to.include('COL[key]');
      expect(out.code).to.include('Object.keys(COL)');
    });

    it('follows a re-export to the defining module', async () => {
      const { env, src } = fixture({
        '/v/contract.mts': CONTRACT,
        '/v/barrel.mts': "export { COL as COLUMNS } from './contract.mjs';",
        '/v/a.mts':
          "import { COLUMNS } from './barrel.mjs';\nf(COLUMNS.NODE_SIZE);",
      });
      const out = await inlineConstants(src('/v/a.mts'), '/v/a.mts', env);

      expect(out.code).to.include('f("node.size");');
    });

    it('leaves a shadowed table alone, and says so', async () => {
      const { env, warnings, src } = fixture({
        '/v/contract.mts': CONTRACT,
        '/v/a.mts': `
import { COL } from './contract.mjs';
f(COL.NODE_SIZE);
function g(COL) { return COL.NODE_SIZE; }
`,
      });

      expect(await inlineConstants(src('/v/a.mts'), '/v/a.mts', env)).to.equal(
        null,
      );
      expect(warnings.join()).to.match(/COL is shadowed/);
    });

    it('a member the table lacks, or a write to one, is a build error', async () => {
      for (const body of ['f(COL.NODE_COLOUR);', 'COL.NODE_SIZE = "x";']) {
        const { env, src } = fixture({
          '/v/contract.mts': CONTRACT,
          '/v/a.mts': `import { COL } from './contract.mjs';\n${body}`,
        });

        let err = null;

        try {
          await inlineConstants(src('/v/a.mts'), '/v/a.mts', env);
        } catch (e) {
          err = e;
        }

        expect(err, body).to.be.an('error');
      }
    });

    it('does not read a string or a comment as a reference', async () => {
      // the round-127 lesson for source scanners: a quote inside a regex
      // desynced a text walker; on the AST none of these is a member
      const { env, src } = fixture({
        '/v/contract.mts': CONTRACT,
        '/v/a.mts': `
import { COL } from './contract.mjs';
const re = /['"]?COL.NODE_SIZE/;
const s = 'COL.NODE_SIZE';
// COL.NODE_SIZE
f(COL.NODE_SIZE);
`,
      });
      const out = await inlineConstants(src('/v/a.mts'), '/v/a.mts', env);

      expect(out.tables).to.equal(1);
      expect(out.code).to.include(`/['"]?COL.NODE_SIZE/`);
      expect(out.code).to.include("'COL.NODE_SIZE'");
      expect(out.code).to.include('f("node.size");');
    });
  });

  describe('inlineConstants: the shader constants', () => {
    it('splices a numeric constant into shader text as the runtime join would', async () => {
      const { env, src } = fixture({
        '/v/contract.mts': CONTRACT,
        '/v/a.mts': `
import { SHIFT, NEG, LIMIT } from './contract.mjs';
const WG = 64;
export const S = wgsl\`@workgroup_size(\${WG}) x >> \${SHIFT}u; \${NEG} \${LIMIT} \${WG / 2}\`;
export const G = glsl\`int a[\${WG}];\`;
export const T = \`plain \${WG}\`;
`,
      });
      const out = await inlineConstants(src('/v/a.mts'), '/v/a.mts', env);

      expect(out.scalars).to.equal(5);
      expect(out.code).to.include(
        'wgsl`@workgroup_size(64) x >> 16u; -2 1500 ${WG / 2}`',
      );
      expect(out.code).to.include('glsl`int a[64];`');
      // an untagged template is not shader text
      expect(out.code).to.include('`plain ${WG}`');
      expect(String(1.5e3)).to.equal('1500');
    });

    it('does not splice a name a function shadows', async () => {
      const { env, src } = fixture({
        '/v/a.mts': `
const n = 4;
export const f = (n) => wgsl\`array<f32, \${n}>\`;
`,
      });

      expect(await inlineConstants(src('/v/a.mts'), '/v/a.mts', env)).to.equal(
        null,
      );
    });
  });

  describe('the real tree', () => {
    it('rewrites the tree without error, and the walk touches what it should', async () => {
      const astOf = treeAsts();
      const tables = realTables(astOf);
      let nTables = 0;
      let nScalars = 0;
      let files = 0;

      for (const id of srcFiles()) {
        const out = await inlineConstants(readFileSync(id, 'utf8'), id, {
          resolveId: resolveSrc,
          astOf,
          tables,
        });

        if (out) {
          files++;
          nTables += out.tables;
          nScalars += out.scalars;
        }
      }

      // at landing: 1,520 table sites and 324 shader constants in the
      // full build's 99 modules (the tree has a few more than the build
      // reaches); a walk that stops early lands well under these
      expect(nTables).to.be.at.least(1_500);
      expect(nScalars).to.be.at.least(320);
      expect(files).to.be.at.least(99);
    });
  });

  describe('equivalence on the real shaders', function () {
    const SHADER_FILES = srcFiles().filter((f) =>
      /\bwgsl`/.test(readFileSync(f, 'utf8')),
    );

    /**
     * Inline a module, write it beside nothing (a temp dir) with its
     * relative imports pointed at the real tree, and import it.
     */
    const evalInlined = async (id, astOf, tables, dir) => {
      const out = await inlineConstants(readFileSync(id, 'utf8'), id, {
        resolveId: resolveSrc,
        astOf,
        tables,
      });

      if (!out) return null;
      const edits = [];

      for (const node of parse(out.code, id).body) {
        if (node.source && node.source.value.startsWith('.')) {
          const target = resolve(dirname(id), node.source.value);

          edits.push([
            node.source.start,
            node.source.end,
            JSON.stringify(pathToFileURL(target).href),
          ]);
        }
      }

      const file = join(dir, id.slice(SRC.length + 1).replaceAll('/', '__'));

      writeFileSync(file, splice(out.code, edits));

      return import(pathToFileURL(file).href);
    };

    /** Exported strings that differ between two module namespaces. */
    const differences = (a, b) =>
      Object.keys(a).filter((k) => typeof a[k] === 'string' && a[k] !== b[k]);

    const exportedStrings = (mod) =>
      Object.values(mod).filter((v) => typeof v === 'string').length;

    it('every exported shader string is unchanged by the inlining', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'cy-const-inline-'));
      const astOf = treeAsts();
      const tables = realTables(astOf);
      let compared = 0;
      let inlined = 0;

      try {
        for (const id of SHADER_FILES) {
          const after = await evalInlined(id, astOf, tables, dir);

          if (!after) continue;
          inlined++;
          const before = await import(pathToFileURL(id).href);

          expect(differences(before, after), id).to.deep.equal([]);
          compared += exportedStrings(before);
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }

      // the enumeration is the evidence: every tagged module, and the
      // complete shaders among their exports
      expect(SHADER_FILES).to.have.length.of.at.least(32);
      expect(inlined).to.be.at.least(25);
      expect(compared).to.be.at.least(25);
    });

    it('CONTROL: a falsified constant is caught', async () => {
      // SHAPE_SHIFT spliced as 17 instead of 16: the node shader must
      // differ, or the comparison above is not looking at the splices
      const contract = join(SRC, 'contract.mts');
      const code = readFileSync(contract, 'utf8');

      expect(code).to.include('export const SHAPE_SHIFT = 16;');
      const astOf = treeAsts({
        [contract]: code.replace(
          'export const SHAPE_SHIFT = 16;',
          'export const SHAPE_SHIFT = 17;',
        ),
      });
      const dir = mkdtempSync(join(tmpdir(), 'cy-const-inline-'));
      const id = join(SRC, 'render/shaders/node.mts');

      try {
        const after = await evalInlined(id, astOf, realTables(astOf), dir);
        const before = await import(pathToFileURL(id).href);

        expect(differences(before, after)).to.include('NODE_SHADER');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe('the built bundle (test:modules builds first)', () => {
    it('ships the literals, not the tables', () => {
      const code = readFileSync(
        join(ROOT, 'build/cytoscape.esm.min.mjs'),
        'utf8',
      );
      const source = readFileSync(join(SRC, 'style/sheet.mts'), 'utf8');

      // the source spells the constants...
      expect(source).to.include('PROP.BACKGROUND_COLOR');
      // ...and the bundle carries neither their member names nor the
      // tables, only the values
      for (const key of [
        'NODE_POSITION',
        'BACKGROUND_COLOR',
        'NODE_FONT_SIZE',
      ]) {
        expect(code, key).to.not.include(key);
      }

      expect(code).to.include('node.position');
      expect(code).to.include('background-color');
    });
  });
});
