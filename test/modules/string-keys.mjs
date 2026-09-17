import { expect } from 'chai';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COL,
  COLUMN_SPECS,
  DATA_ID,
  DATA_PARENT,
  DATA_SOURCE,
  DATA_TARGET,
  GROUP_EDGES,
  GROUP_NODES,
} from '../../src/contract.mjs';
import { TWEEN_COL } from '../../src/animation.mjs';
import { PROP } from '../../src/style-props.mjs';
import { normalizeProp } from '../../src/style.mjs';

/*
Round 127: the string vocabularies are spelled once.

Three families of key used to be written as literals at every use site —
column ids (`'node.position'`, ~700 sites), style property names
(`'background-color'`, ~800) and the reserved data keys (`'id'`,
`'source'`, …, 44).  Each was typed well enough that a typo failed to
compile, which is exactly why the repetition survived: nothing was
*wrong*, it was just spelled everywhere.  Round 127 gave each family one
declaration — `COL` and `DATA_*` in the contract, `TWEEN_COL` beside the
tween pseudo-columns, `PROP` in `style-props.mts` — and this file is what
keeps the literals from growing back.

It scans `src/` as text, so it inherits the rule every source-scanning
tool in this repo has learned (`docs/agents/testing.md`): the scanner
has to be shown finding the thing.  The walk below is comment-, string-
and regex-aware, and the regex clause is not decoration — the round's
own replacement tool lacked it at first, read `/['"]?/` on one line of
`style.mts` as an unterminated string, and silently skipped the
remaining 8,300 lines.  Each rule therefore runs on a planted line
before it runs on the tree, and one control plants the literal *after*
a regex containing a quote.

Round 127.6 added the group names (`'nodes'` / `'edges'`, 712 sites)
on the maintainer's call, and with them the walker learned template
expressions: three of those literals sat inside `${…}` in error
messages, which the first walker skipped along with the template text
around them.  A template's text is not code; the code inside its
braces is.

What is deliberately outside the gate: the single-word property names
(`width`, `color`, `opacity`, …) collide with channel kinds, write
kinds and layout options, so the rule covers the 162 hyphenated names
and the eleven others are the reviewer's; property *values*
(`'round-rectangle'`) are the user's vocabulary, not the engine's; and
`test/` keeps the literals on purpose, since a spec that spells
`'node.position'` is the pin on what `COL.NODE_POSITION` resolves to.
*/

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SRC = join(ROOT, 'src');

/** Every .mts under src, absolute. */
const srcFiles = (dir = SRC, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);

    if (statSync(p).isDirectory()) {
      srcFiles(p, out);
    } else if (name.endsWith('.mts')) {
      out.push(p);
    }
  }

  return out;
};

const REGEX_PREV_CHARS = '(,=:[!&|?{};+-*%<>~^';
const REGEX_PREV_WORDS = new Set([
  'return',
  'typeof',
  'case',
  'in',
  'of',
  'void',
  'delete',
  'throw',
]);

/**
 * Every single-quoted literal in code position — not in a comment, not
 * inside another string kind, not inside a regex literal — with its
 * line and the text of that line.
 *
 * @param {string} src
 * @returns {{ value: string, line: number, text: string }[]}
 */
export const codeLiterals = (src) => {
  const out = [];
  const lines = src.split('\n');
  // '' = code; otherwise the active delimiter: ", `, //, /*
  let mode = '';
  // one entry per open `${` — the brace depth inside that expression
  const templates = [];
  let line = 1;
  // the code emitted so far on the current statement, for the regex test
  let recent = '';

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const two = src.slice(i, i + 2);

    if (ch === '\n') {
      line++;
    }

    if (mode === '//') {
      if (ch === '\n') {
        mode = '';
      }
      continue;
    }

    if (mode === '/*') {
      if (two === '*/') {
        mode = '';
        i++;
      }
      continue;
    }

    if (mode !== '') {
      if (ch === '\\') {
        i++;
      } else if (mode === '`' && two === '${') {
        // into the expression: code until its closing brace
        templates.push(0);
        mode = '';
        i++;
      } else if (ch === mode) {
        mode = '';
      }
      continue;
    }

    if (templates.length > 0) {
      if (ch === '{') {
        templates[templates.length - 1]++;
      } else if (ch === '}') {
        if (templates[templates.length - 1] === 0) {
          // back into the template's text
          templates.pop();
          mode = '`';
          continue;
        }
        templates[templates.length - 1]--;
      }
    }

    if (two === '//' || two === '/*') {
      mode = two;
      i++;
      continue;
    }

    if (ch === '/') {
      const trimmed = recent.trimEnd();
      const prev = trimmed.slice(-1);
      const word = trimmed.match(/[A-Za-z_$][\w$]*$/)?.[0];
      const isRegex =
        prev === '' ||
        REGEX_PREV_CHARS.includes(prev) ||
        REGEX_PREV_WORDS.has(word);

      if (isRegex) {
        let j = i + 1;
        let cls = false;

        while (j < src.length && src[j] !== '\n') {
          if (src[j] === '\\') {
            j += 2;
            continue;
          }
          if (cls) {
            if (src[j] === ']') {
              cls = false;
            }
          } else if (src[j] === '[') {
            cls = true;
          } else if (src[j] === '/') {
            break;
          }
          j++;
        }

        i = j;
        recent += ' ';
        continue;
      }
    }

    if (ch === "'") {
      let j = i + 1;
      let value = '';

      while (j < src.length && src[j] !== "'" && src[j] !== '\n') {
        if (src[j] === '\\') {
          value += src[j] + src[j + 1];
          j += 2;
          continue;
        }
        value += src[j];
        j++;
      }

      if (src[j] === "'") {
        out.push({ value, line, text: lines[line - 1] });
        i = j;
        recent += ' ';
        continue;
      }

      mode = "'";
      continue;
    }

    if (ch === '"' || ch === '`') {
      mode = ch;
      continue;
    }

    recent = ch === '\n' || ch === ';' ? '' : recent + ch;
  }

  return out;
};

const COLUMN_ID = /^(node|edge)\.[A-Za-z]+$/;
/** A table member line: `  NAME: 'value',` — the one place a column id may be spelled. */
const TABLE_MEMBER = /^\s+[A-Z_]+: '[^']+',/;
const DATA_KEYS = new Set([DATA_ID, DATA_PARENT, DATA_SOURCE, DATA_TARGET]);
const GROUP_NAMES = new Set([GROUP_NODES, GROUP_EDGES]);
const HYPHENATED_PROPS = new Set(
  Object.values(PROP).filter((name) => name.includes('-')),
);

/**
 * The three rules, each over one file's text.  A finding is a
 * `line: value` string so a failure names the site.
 */
export const findings = {
  /** a column id spelled outside a `COL`/`TWEEN_COL` member line */
  columnIds: (src) =>
    codeLiterals(src)
      .filter((l) => COLUMN_ID.test(l.value) && !TABLE_MEMBER.test(l.text))
      .map((l) => `${l.line}: '${l.value}'`),
  /** a reserved data key compared against, or paired as `['source', 'target']` */
  dataKeys: (src) =>
    codeLiterals(src)
      .filter(
        (l) =>
          DATA_KEYS.has(l.value) &&
          (new RegExp(`(===|!==)\\s*'${l.value}'`).test(l.text) ||
            new RegExp(`'${l.value}'\\s*(===|!==)`).test(l.text) ||
            /\['source',\s*'target'\]/.test(l.text)),
      )
      .map((l) => `${l.line}: '${l.value}'`),
  /** a hyphenated style property name spelled outside `PROP` */
  styleProps: (src) =>
    codeLiterals(src)
      .filter((l) => HYPHENATED_PROPS.has(l.value))
      .map((l) => `${l.line}: '${l.value}'`),
  /** a group name spelled outside `GROUP_NODES` / `GROUP_EDGES` (127.6) */
  groupNames: (src) =>
    codeLiterals(src)
      .filter((l) => GROUP_NAMES.has(l.value))
      .map((l) => `${l.line}: '${l.value}'`),
};

/** Where each rule's declarations live — the only files it does not scan. */
const DECLARED_IN = {
  columnIds: [],
  dataKeys: ['contract.mts'],
  styleProps: ['style-props.mts'],
  groupNames: ['contract.mts'],
};

const screaming = (name) =>
  name
    .replace('.', '_')
    .replace(/([A-Z])/g, '_$1')
    .replace(/-/g, '_')
    .toUpperCase();

describe('string keys are spelled once (round 127)', () => {
  const files = srcFiles();
  const sources = new Map(
    files.map((f) => [relative(SRC, f), readFileSync(f, 'utf8')]),
  );

  describe('the scanner (controls)', () => {
    it('finds a planted column-id literal in code', () => {
      expect(
        findings.columnIds(`const p = store.column('node.position');`),
      ).to.deep.equal([`1: 'node.position'`]);
    });

    it('does not read a comment, a template or a double-quoted string as code', () => {
      const src = [
        `// store.column('node.position')`,
        `/* 'edge.flags' */`,
        '`${x} node.size ${"\'node.size\'"}`',
        `"'node.opacity'"`,
      ].join('\n');

      expect(findings.columnIds(src)).to.deep.equal([]);
    });

    it('is not swallowed by a regex literal holding a quote (the 127.1 tool bug)', () => {
      const src = [
        `const wrapped = /^url\\s*\\(\\s*['"]?(.*?)['"]?\\s*\\)$/.exec(s);`,
        `const a = x.replace(/'/g, '');`,
        `const p = store.column('node.position');`,
      ].join('\n');

      expect(findings.columnIds(src)).to.deep.equal([`3: 'node.position'`]);
    });

    it('reads the code inside a template expression, and not the text around it (127.6)', () => {
      const src = [
        "`Node ${store.idAt('nodes', slot)} has no parent`",
        "`${a ? `${b} nodes` : 'edges'} ${{ x: 1 }.x}`",
        '`nodes edges`',
        '`${"nodes"}`',
      ].join('\n');

      expect(findings.groupNames(src)).to.deep.equal([
        `1: 'nodes'`,
        `2: 'edges'`,
      ]);
      expect(
        findings.columnIds("`${`${store.column('node.size')}`}`"),
      ).to.deep.equal([`1: 'node.size'`]);
    });

    it('still reads a division as code', () => {
      const src = [
        `const r = a / b;`,
        `const p = store.column('node.position');`,
      ].join('\n');

      expect(findings.columnIds(src)).to.deep.equal([`2: 'node.position'`]);
    });

    it('allows a table member line and nothing else', () => {
      expect(
        findings.columnIds(`  NODE_POSITION: 'node.position', // x`),
      ).to.deep.equal([]);
      expect(findings.columnIds(`  position: 'node.position',`)).to.deep.equal([
        `1: 'node.position'`,
      ]);
    });

    it('finds a planted data-key comparison, and only a comparison', () => {
      expect(findings.dataKeys(`if (key === 'id') {`)).to.deep.equal([
        `1: 'id'`,
      ]);
      expect(
        findings.dataKeys(`for (const end of ['source', 'target'] as const) {`),
      ).to.deep.equal([`1: 'source'`, `1: 'target'`]);
      // a prefix test on a property name is not a data-key comparison
      expect(
        findings.dataKeys(`const src = prop.startsWith('source');`),
      ).to.deep.equal([]);
    });

    it('finds a planted group name anywhere in code', () => {
      expect(
        findings.groupNames(`if (group === 'nodes') return this.nodes;`),
      ).to.deep.equal([`1: 'nodes'`]);
      expect(
        findings.groupNames(`const t: Record<'nodes' | 'edges', number>`),
      ).to.deep.equal([`1: 'nodes'`, `1: 'edges'`]);
      // an error message names the groups in prose
      expect(
        findings.groupNames("throw new Error(`use 'nodes' or 'edges'`)"),
      ).to.deep.equal([]);
    });

    it('finds a planted hyphenated property literal in every position', () => {
      const src = [
        `case 'background-color':`,
        `  'border-color': { kind: 'color' },`,
        `defineReader(['font-size'], read);`,
        `set.has('line-color');`,
      ].join('\n');

      expect(findings.styleProps(src)).to.deep.equal([
        `1: 'background-color'`,
        `2: 'border-color'`,
        `3: 'font-size'`,
        `4: 'line-color'`,
      ]);
      // a property value that happens to be hyphenated is not a name
      expect(findings.styleProps(`shape: 'round-rectangle',`)).to.deep.equal(
        [],
      );
    });
  });

  describe('the tree', () => {
    it('scans a tree of the size it is meant to', () => {
      // a scanner that stopped matching would read as a clean tree, so
      // pin that the walk saw the sources and found the declarations
      expect(files.length).to.be.greaterThan(100);

      const members = findings.columnIds(sources.get('contract.mts'));

      expect(members).to.deep.equal([]);
      expect(
        codeLiterals(sources.get('contract.mts')).filter((l) =>
          COLUMN_ID.test(l.value),
        ).length,
      ).to.equal(Object.keys(COL).length);
    });

    for (const rule of Object.keys(findings)) {
      it(`has no ${rule} literal outside its declaration`, () => {
        const hits = [];

        for (const [file, src] of sources) {
          if (DECLARED_IN[rule].includes(file)) {
            continue;
          }

          for (const f of findings[rule](src)) {
            hits.push(`src/${file}:${f}`);
          }
        }

        expect(hits, `use the constant:\n  ${hits.join('\n  ')}`).to.deep.equal(
          [],
        );
      });
    }
  });

  describe('the tables', () => {
    it('COL and COLUMN_SPECS name the same columns', () => {
      expect([...Object.values(COL)].sort()).to.deep.equal(
        COLUMN_SPECS.map((s) => s.id).sort(),
      );
    });

    it('spells every COL and TWEEN_COL key from its value', () => {
      for (const table of [COL, TWEEN_COL]) {
        for (const [key, value] of Object.entries(table)) {
          expect(key).to.equal(screaming(value));
        }
      }
    });

    it('holds the tween pseudo-columns apart from the real ones', () => {
      const real = new Set(Object.values(COL));

      for (const value of Object.values(TWEEN_COL)) {
        expect(COLUMN_ID.test(value)).to.equal(true);
        expect(real.has(value), value).to.equal(false);
      }
    });

    it('derives GroupName from the two group constants', () => {
      // the constants are the type's members: a third group would have to
      // be declared here, and the walk's own table rule reads it
      expect([GROUP_NODES, GROUP_EDGES]).to.deep.equal(['nodes', 'edges']);
      expect(COLUMN_SPECS.every((s) => GROUP_NAMES.has(s.group))).to.equal(
        true,
      );
    });

    it('spells every PROP key from its value, with no duplicates', () => {
      const values = Object.values(PROP);

      expect(new Set(values).size).to.equal(values.length);

      for (const [key, value] of Object.entries(PROP)) {
        expect(key).to.equal(screaming(value));
      }
    });

    it("holds every PROP value in the engine's normalized spelling", () => {
      for (const value of Object.values(PROP)) {
        expect(normalizeProp(value)).to.equal(value);
      }
    });
  });
});
