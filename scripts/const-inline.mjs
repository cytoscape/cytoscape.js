/*
Build-time inlining of the spelled-once vocabularies and the shader
constants (round 126; PLAN.md item 63).

The problem it answers, measured by round 127: spelling every column id
and style property name once — `COL.NODE_POSITION`, `PROP.BACKGROUND_COLOR`
— cost 1.0% of the minified bundle and 1.2% gzipped, because a JS
minifier mangles `COL` but never `.NODE_POSITION`, so each reference
shipped longer than the literal it replaced, and the tables shipped
besides.  This transform puts the literal back in the *bundle* while the
source keeps the constant, so the gate that keeps the literals out of
`src/` (`test/modules/string-keys.mjs`) and the bundle size both hold.

Two rewrites, both on the module's AST (rolldown's oxc parser), never on
its text by pattern:

1. **Table members.**  `T.KEY`, where `T` is one of `TABLES` — imported
   from its defining module (re-exports followed) or referenced inside
   it — becomes the member's string literal.  The table's members are
   read from the defining module's own AST: an `as const` object literal
   whose members are plain keys with string-literal values.  Anything
   else there is a build error, as is a `T.KEY` whose key the table does
   not have, or a write to one.  Computed access (`T[k]`), a whole-table
   reference (`Object.values(T)`) and type positions are left alone — a
   table still referenced whole still ships, which is the correct
   outcome, not a failure.
2. **Shader constants.**  Inside a `wgsl`- or `glsl`-tagged template, an
   interpolation that is exactly one identifier naming a module-level
   numeric constant — `const WG = 256` in the module itself, or an
   `export const SHAPE_SHIFT = 8` imported from another (re-exports
   followed) — is spliced into the template text as `String(value)`,
   which is precisely what the runtime join would have produced.  The
   WGSL minifier then sees plain text there, so the whitespace an
   opaque interpolation forces (`scripts/wgsl-minify.mjs`) collapses
   too.  A non-finite value, an expression (`WG / 2`) or a call stays an
   interpolation.

Both are conservative about scope: a name is rewritten only when the
module declares no other binding of it anywhere — a parameter, a local,
a catch clause — so shadowing cannot redirect a reference.  (A shadowed
table is a build warning and is left as written.)

Measured at landing (2026-09-29): 1,520 table sites in the full build;
the full minified ESM 8,908 bytes smaller raw and 3,428 gzipped, more
than round 127's recorded cost (+8.8 KB / +2.7 KB), since the tables no
longer ship at all.  The shader-constant splice is measured on the round
record (`plan/rounds/*rnd0126*`).
*/

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAst } from 'rolldown/parseAst';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

/**
 * Apply non-overlapping replacements to a source string.
 *
 * @param {string} code — the source
 * @param {Array<[number, number, string]>} edits — [start, end, text]
 *   in UTF-16 offsets, as the parser reports them
 * @returns {string} the edited source
 */
export const splice = (code, edits) => {
  let out = '';
  let at = 0;

  for (const [start, end, text] of [...edits].sort((a, b) => a[0] - b[0])) {
    if (start < at) throw new Error('overlapping edits');
    out += code.slice(at, start) + text;
    at = end;
  }

  return out + code.slice(at);
};

/** The inlined tables: the defining module (from the root) and name. */
export const TABLES = [
  { file: 'src/contract.mts', name: 'COL' },
  { file: 'src/style-props.mts', name: 'PROP' },
  { file: 'src/animation/channels.mts', name: 'TWEEN_COL' },
];

/** The template tags whose interpolations carry shader constants. */
export const SHADER_TAGS = new Set(['wgsl', 'glsl']);

/**
 * Parse a TypeScript module.
 *
 * @param {string} code — the source
 * @param {string} id — its path, for error messages
 * @returns {object} the ESTree program (UTF-16 offsets)
 */
const parse = (code, id) => parseAst(code, { lang: 'ts' }, id);

/** The top-level `const` declarators of a program, exported or not. */
const topConsts = (ast) => {
  const out = [];

  for (const node of ast.body) {
    const decl =
      node.type === 'ExportNamedDeclaration' ? node.declaration : node;

    if (decl?.type === 'VariableDeclaration' && decl.kind === 'const') {
      for (const d of decl.declarations) {
        if (d.id.type === 'Identifier') {
          out.push({ d, exported: decl !== node });
        }
      }
    }
  }

  return out;
};

const unwrapTs = (node) =>
  node &&
  (node.type === 'TSAsExpression' || node.type === 'TSSatisfiesExpression')
    ? unwrapTs(node.expression)
    : node;

/**
 * A table's members, read from its defining module's AST.
 *
 * @param {object} ast — the defining module's program
 * @param {string} name — the table's exported name
 * @param {string} file — for error messages
 * @returns {Map<string, string>} key -> string value
 * @throws when the table is not an `as const` object literal of string
 *   literals under plain keys
 */
export const readTable = (ast, name, file) => {
  const hit = topConsts(ast).find((c) => c.exported && c.d.id.name === name);

  if (!hit) throw new Error(`${file}: no exported const ${name}`);

  if (hit.d.init?.type !== 'TSAsExpression') {
    throw new Error(`${file}: ${name} is not \`as const\``);
  }

  const obj = unwrapTs(hit.d.init);

  if (obj.type !== 'ObjectExpression') {
    throw new Error(`${file}: ${name} is not an object literal`);
  }

  const map = new Map();

  for (const p of obj.properties) {
    if (p.type !== 'Property' || p.computed || p.key.type !== 'Identifier') {
      throw new Error(`${file}: ${name} has a member that is not a plain key`);
    }

    if (p.value.type !== 'Literal' || typeof p.value.value !== 'string') {
      throw new Error(`${file}: ${name}.${p.key.name} is not a string literal`);
    }

    map.set(p.key.name, p.value.value);
  }

  return map;
};

/**
 * A top-level const's numeric value, when its initializer is a finite
 * number literal (optionally negated, optionally `as const`).
 *
 * @param {object} init — the declarator's initializer
 * @returns {number | undefined}
 */
const numericValue = (init) => {
  const n = unwrapTs(init);

  if (n?.type === 'Literal' && typeof n.value === 'number') {
    return Number.isFinite(n.value) ? n.value : undefined;
  }

  if (
    n?.type === 'UnaryExpression' &&
    n.operator === '-' &&
    n.argument.type === 'Literal' &&
    typeof n.argument.value === 'number' &&
    Number.isFinite(n.argument.value)
  ) {
    return -n.argument.value;
  }

  return undefined;
};

/** Every node, depth first, with its parent. */
const walk = (node, parent, visit) => {
  visit(node, parent);

  for (const key in node) {
    if (key === 'parent') continue;
    const v = node[key];

    if (Array.isArray(v)) {
      for (const c of v) {
        if (c && typeof c.type === 'string') walk(c, node, visit);
      }
    } else if (v && typeof v.type === 'string') {
      walk(v, node, visit);
    }
  }
};

/** The names a node binds (declarations, parameters, catch clauses). */
const boundNames = (node) => {
  const out = [];
  const pat = (p) => {
    if (!p) return;

    switch (p.type) {
      case 'Identifier':
        out.push(p.name);
        break;
      case 'ObjectPattern':
        for (const q of p.properties) {
          pat(q.type === 'RestElement' ? q.argument : q.value);
        }
        break;
      case 'ArrayPattern':
        p.elements.forEach(pat);
        break;
      case 'AssignmentPattern':
        pat(p.left);
        break;
      case 'RestElement':
        pat(p.argument);
        break;
      case 'TSParameterProperty':
        pat(p.parameter);
        break;
    }
  };

  switch (node.type) {
    case 'VariableDeclarator':
      pat(node.id);
      break;
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      pat(node.id);
      node.params.forEach(pat);
      break;
    case 'ClassDeclaration':
    case 'ClassExpression':
      pat(node.id);
      break;
    case 'CatchClause':
      pat(node.param);
      break;
  }

  return out;
};

/**
 * Inline one module's table members and shader constants.
 *
 * @param {string} code — the module's TypeScript source
 * @param {string} id — its absolute path
 * @param {object} env
 * @param {(source: string, importer: string) => Promise<string | null>}
 *   env.resolveId — an import specifier to an absolute module path
 * @param {(id: string) => object | null} env.astOf — a module's program
 *   (null when it is not a source module)
 * @param {Map<string, Map<string, Map<string, string>>>} env.tables —
 *   defining module -> table name -> members
 * @param {(msg: string) => void} [env.warn]
 * @returns {Promise<{ code: string, tables: number, scalars: number }
 *   | null>} null when nothing was rewritten
 */
export async function inlineConstants(code, id, env) {
  const { resolveId, astOf, tables, warn = () => {} } = env;
  const ast = parse(code, id);

  // what a module exports under a name, following `export { x } from`
  const exportAt = async (moduleId, name, depth = 0) => {
    const table = tables.get(moduleId)?.get(name);

    if (table) return { table };

    const mod = depth < 8 ? astOf(moduleId) : null;

    if (!mod) return null;

    for (const c of topConsts(mod)) {
      if (c.exported && c.d.id.name === name) {
        const value = numericValue(c.d.init);

        return value === undefined ? null : { value };
      }
    }

    for (const node of mod.body) {
      if (node.type !== 'ExportNamedDeclaration' || !node.source) continue;

      for (const s of node.specifiers) {
        if ((s.exported.name ?? s.exported.value) !== name) continue;
        const next = await resolveId(node.source.value, moduleId);

        return next
          ? exportAt(next, s.local.name ?? s.local.value, depth + 1)
          : null;
      }
    }

    return null;
  };

  // local name -> { table } | { value }
  const known = new Map();

  for (const node of ast.body) {
    if (node.type !== 'ImportDeclaration' || node.importKind === 'type') {
      continue;
    }

    let target = null;

    for (const s of node.specifiers) {
      if (s.type !== 'ImportSpecifier' || s.importKind === 'type') continue;
      target ??= await resolveId(node.source.value, id);

      if (!target) break;
      const hit = await exportAt(target, s.imported.name ?? s.imported.value);

      if (hit) known.set(s.local.name, hit);
    }
  }

  for (const [name, table] of tables.get(id) ?? []) {
    known.set(name, { table });
  }

  for (const c of topConsts(ast)) {
    const value = numericValue(c.d.init);

    if (value !== undefined) known.set(c.d.id.name, { value });
  }

  if (!known.size) return null;

  // a name bound anywhere besides its one top-level declaration (or its
  // import) is not rewritten: a parameter or local could shadow it
  const bindings = new Map();

  walk(ast, null, (node) => {
    for (const name of boundNames(node)) {
      bindings.set(name, (bindings.get(name) ?? 0) + 1);
    }
  });

  for (const [name, hit] of known) {
    const own = topConsts(ast).some((c) => c.d.id.name === name) ? 1 : 0;

    if ((bindings.get(name) ?? 0) > own) {
      if (hit.table) warn(`${id}: ${name} is shadowed; its members stay`);
      known.delete(name);
    }
  }

  const edits = [];
  let nTables = 0;
  let nScalars = 0;

  walk(ast, null, (node, parent) => {
    if (
      node.type === 'MemberExpression' &&
      !node.computed &&
      node.object.type === 'Identifier'
    ) {
      const table = known.get(node.object.name)?.table;

      if (!table) return;
      const where = `${id}: ${node.object.name}.${node.property.name}`;

      if (!table.has(node.property.name)) {
        throw new Error(`${where} is not a member of the table`);
      }

      if (
        (parent?.type === 'AssignmentExpression' && parent.left === node) ||
        parent?.type === 'UpdateExpression'
      ) {
        throw new Error(`${where} is written to`);
      }

      edits.push([
        node.start,
        node.end,
        JSON.stringify(table.get(node.property.name)),
      ]);
      nTables++;
      return;
    }

    if (
      node.type === 'TaggedTemplateExpression' &&
      node.tag.type === 'Identifier' &&
      SHADER_TAGS.has(node.tag.name)
    ) {
      const { quasis, expressions } = node.quasi;

      expressions.forEach((e, k) => {
        if (e.type !== 'Identifier') return;
        const value = known.get(e.name)?.value;

        if (value === undefined) return;
        // the element spans include their delimiters: quasis[k] ends
        // with '${', quasis[k + 1] starts with '}'
        edits.push([quasis[k].end - 2, quasis[k + 1].start + 1, String(value)]);
        nScalars++;
      });
    }
  });

  if (!nTables && !nScalars) return null;

  return { code: splice(code, edits), tables: nTables, scalars: nScalars };
}

/**
 * What every plugin instance shares within one `rolldown -c` run: the
 * parsed modules, the tables, and each module's result by its source.
 * The eleven bundle configs transform the same modules; sharing takes
 * the transform from ~3.3 s of the build to ~0.6 s (round 126).  A
 * watched file's change clears it all (`watchChange`), since a result
 * depends on the modules its imports name as well as its own source.
 */
const shared = { asts: new Map(), tables: null, results: new Map() };

const astOf = (id) => {
  if (!id.endsWith('.mts')) return null;

  if (!shared.asts.has(id)) {
    shared.asts.set(id, parse(readFileSync(id, 'utf8'), id));
  }

  return shared.asts.get(id);
};

const tablesOf = () => {
  if (!shared.tables) {
    shared.tables = new Map();

    for (const t of TABLES) {
      const abs = resolve(ROOT, t.file);

      if (!shared.tables.has(abs)) shared.tables.set(abs, new Map());
      shared.tables.get(abs).set(t.name, readTable(astOf(abs), t.name, t.file));
    }
  }

  return shared.tables;
};

const NAMES = TABLES.map((t) => t.name + '.');

/**
 * The rolldown plugin: `inlineConstants` over every source module that
 * names a table or tags a shader.  Runs before `wgslMinifyPlugin`, so
 * the spliced constants are plain shader text by the time it minifies.
 *
 * @returns a rolldown plugin object
 */
export function constInlinePlugin() {
  return {
    name: 'const-inline',
    watchChange() {
      shared.asts.clear();
      shared.tables = null;
      shared.results.clear();
    },
    async transform(code, id) {
      if (
        !id.endsWith('.mts') ||
        !(
          NAMES.some((n) => code.includes(n)) ||
          code.includes('wgsl`') ||
          code.includes('glsl`')
        )
      ) {
        return null;
      }

      let hit = shared.results.get(id);

      if (hit?.source !== code) {
        const warnings = [];
        const out = await inlineConstants(code, id, {
          resolveId: async (source, importer) =>
            (await this.resolve(source, importer))?.id ?? null,
          astOf,
          tables: tablesOf(),
          warn: (msg) => warnings.push(msg),
        });

        hit = { source: code, out, warnings };
        shared.results.set(id, hit);
      }

      for (const msg of hit.warnings) this.warn(msg);

      return hit.out && { code: hit.out.code, map: null };
    },
  };
}
