import { expect } from 'chai';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
Round 44.2: what `npm pack` ships, and whether the manifest points at files
the build actually produces.

Two failures this exists to catch, both of which ship silently:

1. **A dev tree escaping into the tarball.**  `.npmignore` is a denylist, so
   every directory added to the repo ships by default — the failure mode is
   additive and invisible until someone downloads 70 MB of v3 fixtures.

2. **A manifest path nothing produces.**  `package.json` names six files under
   `dist/` across `main`/`module`/`types`/`unpkg`/`jsdelivr` and nine `exports`
   subpaths.  Five of the six come from `dist:copy`, which copies them out of
   `build/` by an explicitly written list, and that list is a hand-maintained
   coupling to `rolldown.config.mjs`'s outputs.  Adding a bundle to the build
   and forgetting the copy — or renaming an output — leaves `exports` pointing
   at a file that never appears, and `npm publish` does not check.

So the chain this file pins end to end is
**rolldown outputs → `dist:copy` → the manifest → the tarball.**

What it deliberately does *not* check is that those files exist *right now*.
They do not, in a clean checkout: `dist/` holds only the committed declaration
until a release build runs, exactly as in v3, whose six `dist/` artifacts are
tracked and refreshed by `npm run release`.  Whether the release actually ran
before publish is release-workflow business (round 50), not a property of the
source tree — so this file proves that a `npm run dist` *would* produce every
path the manifest names, which is the part a source-tree gate can honestly
own.  See the round-44 record in PLAN.md.
*/

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

/** Every path in the manifest that names a shipped file. */
function manifestPaths() {
  const out = new Set();
  const add = (v) => {
    if (typeof v === 'string' && v.startsWith('dist/')) out.add(v);
  };

  add(pkg.main);
  add(pkg.module);
  add(pkg.types);
  add(pkg.unpkg);
  add(pkg.jsdelivr);

  // exports targets are './'-relative; every condition of every subpath
  const walk = (node) => {
    if (typeof node === 'string') {
      add(node.replace(/^\.\//, ''));
      return;
    }
    if (node && typeof node === 'object') {
      Object.values(node).forEach(walk);
    }
  };

  walk(pkg.exports);

  return out;
}

/**
 * The bundle files `dist:copy` copies out of `build/`.  Parsed from the script
 * rather than restated here, so the two cannot drift — the whole point of the
 * check is that this list is a hand-maintained coupling.
 */
function distCopyFiles() {
  const script = pkg.scripts['dist:copy'];

  return script
    .split(/\s+/)
    .filter((tok) => tok.startsWith('build/'))
    .map((tok) => tok.replace(/^build\//, ''));
}

/** The output file names `rolldown.config.mjs` declares, from the real config. */
async function rolldownOutputs() {
  // FILE filters the config down to one bundle; the full set is what we want.
  const prev = process.env.FILE;

  delete process.env.FILE;

  try {
    const mod = await import(pathToConfigUrl());
    const configs = mod.default;

    return configs.map((c) => c.output.file.replace(/^build\//, ''));
  } finally {
    if (prev !== undefined) process.env.FILE = prev;
  }
}

function pathToConfigUrl() {
  return new URL('../../rolldown.config.mjs', import.meta.url).href;
}

/** The file list `npm pack` would ship, from npm itself. */
function packedFiles() {
  const json = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  return JSON.parse(json)[0].files.map((f) => f.path);
}

describe('packaging: the tarball', () => {
  let files;

  before(() => {
    files = packedFiles();
  });

  it('ships the entry points a consumer resolves', () => {
    // The control for every exclusion below: a pack that shipped *nothing*
    // would satisfy all of them.
    expect(files).to.include('package.json');
    expect(files).to.include('README.md');
    expect(files).to.include('LICENSE');
    expect(files).to.include('dist/cytoscape.d.ts');

    // the sources ship for source-map resolution, as v3's do
    const src = files.filter((f) => f.startsWith('src/'));

    expect(src.length).to.be.greaterThan(50);
  });

  it('ships the two documents an upgrading consumer needs (round 47)', () => {
    // These are the other side of the exclusion below: `PLAN.md` and
    // `AGENTS.md` are the repo's record and must not ship, while the
    // migration guide and the changelog are exactly what someone who just
    // ran `npm install cytoscape@4` and found their selectors throwing needs
    // to have locally.
    expect(files).to.include('MIGRATING.md');
    expect(files).to.include('CHANGELOG.md');
  });

  it('ships no development tree', () => {
    const dev = [
      'test/',
      'test/modules/',
      'debug/',
      'benchmark/',
      'scripts/',
      'playwright-tests/',
      'playwright-page/',
      'typescript/',
      'v3/',
      '.github/',
      'build/',
      'status/',
    ];

    for (const prefix of dev) {
      const hits = files.filter((f) => f.startsWith(prefix));

      expect(
        hits,
        `${prefix} must not ship (${hits.slice(0, 3).join(', ')})`,
      ).to.have.lengthOf(0);
    }
  });

  it('ships nothing from an agent worktree (round 108)', () => {
    // Round 108's finding, measured on the maintainer's own checkout: a
    // Claude Code worktree left behind under `.claude/worktrees/` put **141
    // of 278** packed files into the tarball — a whole second copy of the
    // repo, on an abandoned branch, 352 MB on disk.  Nothing was wrong with
    // the tooling; `.npmignore` is a denylist and no one had thought of a
    // directory that did not exist when it was written.
    //
    // Git hides those worktrees through `.git/info/exclude`, which is local
    // to one clone and which `npm pack` does not read at all, so this is
    // exactly the class of exclusion that has to be asserted rather than
    // assumed.  The control is live: create a file under `.claude/` and
    // re-run pack — it fails without the `.npmignore` entry.
    const hits = files.filter((f) => f.startsWith('.claude'));

    expect(
      hits,
      `agent harness state must not ship (${hits.slice(0, 3).join(', ')})`,
    ).to.have.lengthOf(0);
  });

  it('ships exactly the markdown a consumer needs, and nothing else', () => {
    // An **allowlist**, deliberately, and the reason is round 46.5: this spec
    // used to name the documents that must *not* ship, so
    // `EXECUTIVE_SUMMARY.md` — a project record in the same category as
    // `PLAN.md` — shipped to npm the moment it was written, and this spec
    // stayed green because the new file was not on a list nobody thought to
    // extend.  `.npmignore` is a denylist too, so the default for any new
    // top-level document is to ship.
    //
    // Inverted: a document added at the root now fails here until someone
    // decides it belongs in the package.  That is the decision worth forcing.
    const shipped = files.filter((f) => f.endsWith('.md')).sort();

    expect(shipped).to.eql([
      'CHANGELOG.md', // what changed in 4.0
      'MIGRATING.md', // how to port a v3 app
      'README.md', // the package front page
      'src/README.md', // v4's scope and design decisions
    ]);
  });

  it("does not exclude dist/, so a release build's bundles ship", () => {
    // The declaration proves it positively (it is committed and packed), but
    // assert the rule too: an `.npmignore` line for `dist` would silently
    // empty the package of everything `main`/`module` point at.
    const ignore = readFileSync(join(ROOT, '.npmignore'), 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));

    expect(ignore).to.not.include('dist');
    expect(ignore).to.not.include('dist/');
    expect(ignore.length).to.be.greaterThan(10); // the parse found rules
  });
});

describe('packaging: the manifest resolves to build output', () => {
  it('names only paths under dist/', () => {
    const paths = manifestPaths();

    expect(paths.size).to.be.greaterThan(5);

    for (const p of paths) {
      expect(p, `${p} is outside dist/`).to.match(/^dist\//);
    }
  });

  it('names only files the build chain produces', async () => {
    const produced = new Set([
      // build:types -> rolldown.dts.config.mjs -> scripts/build-dts.mjs
      'cytoscape.d.ts',
      // dist:copy, out of build/
      ...distCopyFiles(),
    ]);

    for (const p of manifestPaths()) {
      const base = p.replace(/^dist\//, '');

      expect(
        produced.has(base),
        `${p} is named by package.json but no build script produces it`,
      ).to.equal(true);
    }
  });

  it('copies exactly the bundles rolldown builds', async () => {
    const outputs = (await rolldownOutputs()).sort();
    const copied = distCopyFiles().sort();

    expect(outputs.length).to.equal(5);
    // Both directions: a new bundle that dist:copy forgets never reaches the
    // package, and a copy of a file the build stopped emitting fails the copy.
    expect(copied).to.deep.equal(outputs);
  });
});

describe('packaging: the exports map', () => {
  /*
  Round 44.3.  `exports` is the only thing standing between a consumer's
  `import cytoscape from 'cytoscape'` and a resolution error, and none of its
  failure modes are loud: a subpath whose conditions disagree with `main`,
  a `require` pointing at ESM, or a `types` condition that is not first (the
  one ordering rule TypeScript actually enforces) all fail at the consumer
  rather than here.
  */

  const subpaths = () => Object.entries(pkg.exports);

  it('is a conditions map keyed by relative subpaths', () => {
    const entries = subpaths();

    expect(entries.length).to.be.greaterThan(2);

    for (const [key, value] of entries) {
      expect(key, `${key} is not a relative subpath`).to.match(/^\.(\/.+)?$/);
      expect(value, `${key} does not map to a conditions object`).to.be.an(
        'object',
      );

      for (const target of Object.values(value)) {
        expect(target, `${key} target is not a relative path`).to.match(
          /^\.\//,
        );
      }
    }
  });

  it('puts `types` first wherever it appears', () => {
    // TypeScript resolves the first matching condition, so a `types` listed
    // after `import`/`require` is silently never used.
    for (const [key, value] of subpaths()) {
      const conditions = Object.keys(value);

      if (conditions.includes('types')) {
        expect(
          conditions[0],
          `${key}: types must be the first condition`,
        ).to.equal('types');
      }
    }
  });

  it('matches import to ESM and require to CJS', () => {
    for (const [key, value] of subpaths()) {
      if (value.import)
        expect(value.import, `${key}.import`).to.match(/\.mjs$/);
      if (value.require)
        expect(value.require, `${key}.require`).to.match(/\.js$/);
      if (value.types) expect(value.types, `${key}.types`).to.match(/\.d\.ts$/);
    }
  });

  it('agrees with the legacy main/module/types fields', () => {
    // Old resolvers read these three; new ones read `exports`. When they
    // disagree the package behaves differently depending on the bundler,
    // which is the worst shape a packaging bug can take.
    const root = pkg.exports['.'];

    expect(root, 'no "." export').to.be.an('object');
    expect(`./${pkg.main}`).to.equal(root.require);
    expect(`./${pkg.module}`).to.equal(root.import);
    expect(`./${pkg.types}`).to.equal(root.types);
  });

  it('keeps ./gpu resolving to the same files as the root entry', () => {
    // The deprecated alias exists because v3's users type it (round 42.3).
    // An alias that drifts from its target is worse than no alias.
    expect(pkg.exports['./gpu']).to.deep.equal(pkg.exports['.']);
  });

  it('points the CDN fields at a real bundle the build produces', () => {
    for (const field of ['unpkg', 'jsdelivr']) {
      expect(pkg[field], `${field} is unset`).to.be.a('string');
      expect(
        distCopyFiles(),
        `${field} names a file dist:copy does not produce`,
      ).to.include(pkg[field].replace(/^dist\//, ''));
    }
  });
});
