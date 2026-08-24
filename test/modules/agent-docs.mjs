/*
Round 108.1: `AGENTS.md` is loaded into every agent session before anyone
knows what the task is, so its size is a tax on every task.  It had reached
**62,818 bytes — ~15.7k tokens** — because it was where this repo wrote down
each defect it had paid for, which is a good habit that produced a bad file:
an agent fixing a typo in a benchmark comment read the golden-image tolerance
history, the SwiftShader worker ratio and a Fedora `libjpeg.so.8` recipe.

The lessons moved verbatim into `docs/agents/*.md` and the root file became a
routing table.  What this spec protects is the *shape* of that arrangement,
because all three ways it can rot are silent:

- the root file grows back (it is where everything was appended for a year);
- a note stops being linked, so nothing routes to it and it is invisible;
- a path or a script name in either goes stale — round 42's lesson, that a
  docs sweep by grep only fixes the spellings someone thought of, while
  extracting every rooted path and testing it finds the ones nobody did.
*/
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { expect } from 'chai';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const NOTES_DIR = join('docs', 'agents');

/** What a session pays to load `AGENTS.md`, in bytes. */
const BUDGET = 16 * 1024;

const agents = readFileSync(join(ROOT, 'AGENTS.md'), 'utf8');
const notes = readdirSync(join(ROOT, NOTES_DIR)).filter((f) =>
  f.endsWith('.md'),
);
const noteText = new Map(
  notes.map((f) => [f, readFileSync(join(ROOT, NOTES_DIR, f), 'utf8')]),
);

/**
 * Every rooted repo path in a code span.  The repo's own prescription after
 * round 42's sweep missed four spellings by grepping for expected ones.
 */
function pathsIn(md) {
  const out = new Set();

  for (const [, span] of md.matchAll(/`([^`\n]+)`/g)) {
    const path = span.trim().replace(/[,.;:]$/, '');

    if (!/^[a-zA-Z0-9._-]+\//.test(path) && !/^[A-Z_]+\.md$/.test(path)) {
      continue;
    }

    // globs and wildcards are patterns, not paths
    if (/[*?<>|]/.test(path) || path.includes(' ')) {
      continue;
    }

    out.add(path);
  }

  return [...out];
}

/**
 * Spellings that are **quoted rather than pointed at** and so can never
 * resolve: the round-42 rename lesson in `documentation.md` is *about* paths
 * that stopped existing, and a note about a gitignored output directory names
 * one that is absent until a run happens.  Same terms as the status site's
 * `HISTORICAL_PATHS` — checked in both directions below, because an
 * exemption that outlives its reason hands itself to the next typo of the
 * same spelling.
 */
const EXEMPT = {
  'src/gpu/': 'round 42 renamed it to src/ — quoted as the lesson',
  'typescript/tests/gpu.test-d.ts': 'round 42: a spelling the sweep missed',
  'test/modules/gpu-import-graph.mjs': 'round 42: a spelling the sweep missed',
  'test/gpu-': 'round 42: the grep pattern that did not match it',
  'typescript/tests/gpu': 'round 42: the grep pattern that did not match it',
  'dist/\\ncytoscape-gpu.d.ts': 'round 42: the line-wrapped spelling',
  'benchmark/results/': 'gitignored — absent until a benchmark run',
};

/** `.mjs` specifiers resolve to `.mts` files — the repo's convention. */
function resolves(path) {
  const full = join(ROOT, path.replace(/\/$/, ''));

  return (
    existsSync(full) ||
    (path.endsWith('.mjs') && existsSync(full.replace(/\.mjs$/, '.mts')))
  );
}

describe('the agent docs', () => {
  it('has notes to route to', () => {
    // The control for the link checks below: with no notes, "every note is
    // linked" and "every link resolves" both pass while nothing exists.
    expect(notes.length).to.be.greaterThan(3);
  });

  it('keeps AGENTS.md inside its budget', () => {
    // The whole point of the split.  Left ungated it grows back — 62,818
    // bytes is where it got to last time, unnoticed, one good paragraph at
    // a time.  A lesson belongs in docs/agents/, which costs nothing until
    // an agent is told to read it.
    expect(
      Buffer.byteLength(agents),
      `AGENTS.md is ${Buffer.byteLength(agents)} bytes; put lessons in ${NOTES_DIR}/`,
    ).to.be.lessThan(BUDGET);
  });

  it('links every note from AGENTS.md', () => {
    for (const file of notes) {
      expect(agents, `${file} is not linked from AGENTS.md`).to.contain(
        `${NOTES_DIR}/${file}`,
      );
    }
  });

  it('links no note that does not exist', () => {
    const linked = new Set(
      [...agents.matchAll(/docs\/agents\/([a-z-]+\.md)/g)].map((m) => m[1]),
    );

    expect([...linked].filter((f) => !notes.includes(f))).to.eql([]);
  });

  it('names only paths that resolve', () => {
    const bad = [];

    for (const [file, md] of [['AGENTS.md', agents], ...noteText]) {
      for (const path of pathsIn(md)) {
        if (!resolves(path) && !(path in EXEMPT)) {
          bad.push(`${file}: ${path}`);
        }
      }
    }

    expect(bad, `unresolved paths:\n  ${bad.join('\n  ')}`).to.eql([]);
  });

  it('exempts only spellings the notes still quote', () => {
    const quoted = new Set(
      [...noteText.values(), agents].flatMap((md) => pathsIn(md)),
    );

    expect(Object.keys(EXEMPT).filter((k) => !quoted.has(k))).to.eql([]);
  });

  it('exempts no spelling that resolves — one that does is a live pointer', () => {
    expect(Object.keys(EXEMPT).filter((k) => resolves(k))).to.eql([]);
  });

  it('names only npm scripts that exist', () => {
    // The routing table is only useful if its commands run.  A renamed
    // script leaves a table that reads fine and fails on the first attempt.
    const { scripts } = JSON.parse(
      readFileSync(join(ROOT, 'package.json'), 'utf8'),
    );
    const named = new Set();

    for (const md of [agents, ...noteText.values()]) {
      for (const [, name] of md.matchAll(/`npm run (?:-s )?(?!-)([\w:.-]+)/g)) {
        named.add(name);
      }
    }

    expect([...named].filter((n) => !(n in scripts)).sort()).to.eql([]);
  });

  it('routes the verification scripts an agent is meant to run', () => {
    // The reverse direction: a tier nothing points at is a tier nobody runs.
    for (const script of [
      'verify',
      'test:node:quiet',
      'test:quiet',
      'test:soak:quiet',
      'test:playwright:quiet',
      'test:modules:quiet',
      'test:throws:quiet',
    ]) {
      expect(agents, `AGENTS.md never mentions ${script}`).to.contain(script);
    }
  });

  it('opens each note with a title and a reason to read it', () => {
    for (const [file, md] of noteText) {
      expect(md.startsWith('# '), `${file} has no title`).to.equal(true);
      expect(md.length, `${file} is a stub`).to.be.greaterThan(500);
    }
  });
});
