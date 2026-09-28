import { expect } from 'chai';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
Round 41.3, rewritten by round 42: what `src` imports from outside itself.

41.3 wrote this to stop the list of v4→v3 shared-module edges *growing* while
the restructure was still ahead.  It measured five (`math`, `types`,
`util/colors`, `util/position`, `util/sort`) after 41.2 severed the emitter —
correcting round 41's plan, which had asserted in advance that the emitter was
the only one.

Round 42 took the call the list was waiting on: **duplicate, don't share.**
v4 owns lean copies of those five (`src/math.mts` carries the seven functions
v4 actually calls, not v3's 1500-line geometry module), v3's originals moved
to `v3/src/`, and the allowlist is empty.  So the invariant this file pins is
now absolute rather than budgeted: **nothing under `src/` may import anything
outside `src/`.**  An edge to `v3/` would make the package depend on a
directory that is not published; an edge to a new shared root would recreate
exactly the coupling the restructure removed.

Note what the emptied allowlist does to the audit's own failure mode.  While
edges were expected, "found no outward edges" was evidence the scanner had
broken; now it is the passing answer, and a regex that stops matching reads
identical to a clean tree.  The controls below therefore moved: they count
*internal* edges and source files, both of which stay large, so a broken
walk still fails loudly.

Round 98.1 adds the clause this header always implied: **the set of
non-relative specifiers under `src/` is empty.**  Until then the scanner
classified a bare specifier as "a dependency, not a repo edge" and skipped
it, so a `node:fs` import added tomorrow would have passed the invariant
that reads as pinning runtime-cleanness.  One clause now forbids `node:*`,
`bun:*`, `deno:*` and bare packages alike — which is what "runs on any
standards-shaped runtime" rests on (the round-98 smoke tier is the
measurement; this is the gate).  The scanner strips comments first — with a
string-aware walk, not another regex — because `src/layout/contract.mts`
carries `from 'fcose-gpu'` inside a doc-comment example, and a `file:line`
allowlist for it would go stale by insertion (the round-37.1 lesson).
*/

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SRC = join(ROOT, 'src');

/**
 * Modules under `src` may import from outside `src`.  Empty, and meant to
 * stay that way — see the header.  Kept as a named, checked structure rather
 * than deleted so that adding an exemption is a deliberate edit with a reason
 * attached, on round 37.1's maintained-allowlist terms.
 *
 * @type {Record<string, string>}
 */
const SHARED = {};

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

/**
 * The source with comments removed, strings left intact.  A character walk
 * rather than a regex, because the failure modes differ: a regex comment
 * stripper eats `'//'` inside a string (and with it any import later on the
 * line), while this walk tracks whether it is inside a `'…'`/`"…"`/`` `…` ``
 * literal and only opens a comment outside one.  Escapes are honoured;
 * template interpolation is not parsed (a `${}` holding a comment would
 * survive), which no source here does and the edge counts below would catch
 * degrading.
 */
const stripComments = (src) => {
  let out = '';
  // '' = code; otherwise the active delimiter: ', ", `, //, /*
  let mode = '';

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const two = src.slice(i, i + 2);

    if (mode === '//') {
      if (ch === '\n') {
        mode = '';
        out += ch;
      }
      continue;
    }

    if (mode === '/*') {
      if (two === '*/') {
        mode = '';
        i++;
      } else if (ch === '\n') {
        out += ch; // keep line numbers meaningful for failure output
      }
      continue;
    }

    if (mode !== '') {
      // inside a string literal
      if (ch === '\\') {
        out += two;
        i++;
        continue;
      }
      if (ch === mode) {
        mode = '';
      }
      out += ch;
      continue;
    }

    if (two === '//' || two === '/*') {
      mode = two;
      i++;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      mode = ch;
    }

    out += ch;
  }

  return out;
};

/**
 * Every import specifier in comment-stripped src, classified.  `from '…'`
 * covers both `import` and `export … from`; `import( '…' )` would cover a
 * dynamic import if one ever appears (v4 has none today, and no require).
 */
const allEdges = () => {
  const outward = new Map();
  const bare = new Map();
  let internal = 0;

  for (const file of srcFiles()) {
    const src = stripComments(readFileSync(file, 'utf8'));

    // a side-effect `import '…'` is matched only at a line's start
    // (131.2): the headless build's rejection text names
    // `import 'cytoscape/headless-gpu'` inside a string, which is not an
    // edge
    for (const m of src.matchAll(
      /(?:from\s+|^\s*import\s+|import\s*\(\s*)'([^']+)'/gm,
    )) {
      const spec = m[1];

      if (!spec.startsWith('.')) {
        // round 98.1: a non-relative specifier is a runtime or package
        // dependency, and src has none — see the header
        if (!bare.has(spec)) {
          bare.set(spec, []);
        }

        bare.get(spec).push(relative(ROOT, file));
        continue;
      }

      const target = resolve(dirname(file), spec);

      if (target.startsWith(SRC + '/')) {
        internal++;
        continue;
      }

      const key = relative(ROOT, target);

      if (!outward.has(key)) {
        outward.set(key, []);
      }

      outward.get(key).push(relative(ROOT, file));
    }
  }

  return { outward, bare, internal };
};

/**
 * The modules an entry reaches (round 131): every `import`/`export … from`
 * edge from `entry`, followed transitively.  **Type imports count** — the
 * walk has no type awareness by design, so a tier stays exact without a
 * type checker in the loop: the types a lower tier needs live in the lower
 * tier (131.1 moved `ForceHostLike` to `layout/force-host.mts`, the glyph
 * types to `label-types.mts`, `EDGE_PICK_BIT` to `contract.mts`).  Returns
 * a map from each reached file to the file that first imported it, so a
 * failure prints the chain.
 *
 * @param {string} entry — repo-relative, e.g. 'src/headless.mts'
 * @returns {Map<string, string | null>}
 */
const reach = (entry) => {
  const start = join(ROOT, entry);
  const seen = new Map([[start, null]]);
  const queue = [start];

  while (queue.length > 0) {
    const file = queue.shift();
    const src = stripComments(readFileSync(file, 'utf8'));

    for (const m of src.matchAll(
      /(?:from\s+|^\s*import\s+|import\s*\(\s*)'([^']+)'/gm,
    )) {
      if (!m[1].startsWith('.')) {
        continue;
      }

      const target = resolve(dirname(file), m[1]).replace(/\.mjs$/, '.mts');

      if (!seen.has(target)) {
        seen.set(target, file);
        queue.push(target);
      }
    }
  }

  return seen;
};

/** The import chain from the entry down to `file`, for a failure message. */
const chain = (seen, file) => {
  const out = [];

  for (let f = file; f != null; f = seen.get(f)) {
    out.unshift(relative(SRC, f));
  }

  return out.join(' → ');
};

describe('import graph: what src reaches outside itself (round 41.3, 42)', function () {
  const { outward, bare, internal } = allEdges();

  it('imports nothing outside src', function () {
    const unlisted = [...outward.keys()]
      .filter((k) => SHARED[k] == null)
      .sort();

    expect(
      unlisted,
      'dependencies out of src:\n  ' +
        unlisted
          .map((k) => `${k}  (from ${outward.get(k).join(', ')})`)
          .join('\n  '),
    ).to.deep.equal([]);
  });

  it('imports no runtime built-in and no bare package (round 98.1)', function () {
    // the runtime-clean invariant: no `node:*`, `bun:*`, `deno:*`, no bare
    // package — one clause, because they are one property: the bundles run
    // wherever the web-platform baseline exists, with nothing to resolve
    const specs = [...bare.keys()].sort();

    expect(
      specs,
      'non-relative imports in src:\n  ' +
        specs.map((s) => `${s}  (from ${bare.get(s).join(', ')})`).join('\n  '),
    ).to.deep.equal([]);
  });

  it('reaches into v3/ from nowhere', function () {
    // the restructure's own achievement, stated separately from the general
    // rule because this is the edge that would actually get written: a source
    // file borrowing a v3 helper rather than porting it
    const intoV3 = [...outward.keys()].filter((k) => k.startsWith('v3/'));

    expect(
      intoV3,
      `src imports v3 sources: ${intoV3.join(', ')}`,
    ).to.deep.equal([]);
  });

  it('lists no shared module that nothing imports any more', function () {
    // the allowlist half: an entry that has gone stale is one nobody would
    // notice had been fixed
    const stale = Object.keys(SHARED).filter((k) => !outward.has(k));

    expect(
      stale,
      `SHARED lists modules src no longer imports: ${stale.join(', ')}`,
    ).to.deep.equal([]);
  });

  it("no longer imports v3's emitter or event object (round 41.2)", function () {
    // the round-41 achievement, pinned: these two were the dependency the v4
    // Event and emitter were built to sever, and re-importing either would
    // restore v3's namespace parsing along with them.  Both spellings are
    // checked because round 42 moved the files under v3/.
    for (const k of [
      'src/emitter.mjs',
      'src/event.mjs',
      'v3/src/emitter.mjs',
      'v3/src/event.mjs',
    ]) {
      expect(outward.has(k), `src imports ${k} again`).to.equal(false);
    }
  });

  it('finds a non-trivial graph to check', function () {
    // The control, inverted by round 42.  While outward edges were expected,
    // "none found" was evidence the scanner had broken; now it is the passing
    // answer, so it can no longer double as that evidence — these two counts
    // do it instead.
    expect(
      internal,
      'the scanner found almost no edges at all; is it still parsing?',
    ).to.be.at.least(100);
    expect(
      srcFiles().length,
      'the file walk found too few sources',
    ).to.be.at.least(80);
  });

  it('strips a comment without eating the code around it', function () {
    // the stripper's own control, inline: the doc-comment specifier that
    // motivated stripping must vanish, and a string holding `//` must not
    // take the rest of its line with it
    const stripped = stripComments(
      "import { a } from './a.mjs';\n" +
        "// import { b } from 'node:fs';\n" +
        "/* from 'fcose-gpu' */ const u = 'http://x'; import 'left.mjs';\n",
    );

    expect(stripped).to.contain("from './a.mjs'");
    expect(stripped).to.not.contain('node:fs');
    expect(stripped).to.not.contain('fcose-gpu');
    expect(stripped).to.contain("'http://x'");
    expect(stripped).to.contain("import 'left.mjs'");
  });

  it('gives every shared module a reason, not just a name', function () {
    for (const [name, why] of Object.entries(SHARED)) {
      expect(why, `${name} has no reason recorded`).to.be.a('string');
      expect(why.trim().length, `${name}'s reason is empty`).to.be.at.least(20);
    }
  });
});

describe('import graph: the tiers (round 131)', function () {
  /*
  Round 100.1's capability ladder, shipped as entries by round 131: T0 the
  headless core, T1 + workers, T2 + WebGPU, T3 + DOM/canvas.  A tier is
  exact when walking every import from its entry reaches nothing of a
  higher tier — then a bundler building that entry *cannot* carry the
  higher tier, whatever it shakes.  The walk lands red before 131.1's
  moves (the control): `core/export.mts` reached `render/picking.mts` for
  the pick bit, `label-wrap.mts` the glyph atlas for two types, and the
  force layout `render/gpu-force.mts` for the host types.
  */

  const FORBIDDEN = (tiers) => new RegExp(`^src/(?:${tiers.join('|')})`);

  const offenders = (entry, forbidden) => {
    const seen = reach(entry);

    return {
      seen,
      bad: [...seen.keys()].filter((f) => forbidden.test(relative(ROOT, f))),
    };
  };

  it('the core reaches no renderer, pointer, device code or kernel (131.1, 131.2)', function () {
    const { seen, bad } = offenders(
      'src/core.mts',
      FORBIDDEN([
        'render/',
        'interact/',
        'gpu/',
        'algorithms/algo-gpu',
        'algorithms/gpu-lanes',
      ]),
    );

    expect(
      bad.map((f) => chain(seen, f)),
      'the core tier reaches the renderer tier',
    ).to.deep.equal([]);
    // the walk's own control: it followed the core's real graph
    expect(seen.size, 'the walk touched too few modules').to.be.at.least(150);
  });

  it('cytoscape/headless reaches T0 + T1 only (131.3)', function () {
    const { seen, bad } = offenders(
      'src/headless.mts',
      FORBIDDEN([
        'render/',
        'interact/',
        'gpu/',
        'algorithms/algo-gpu',
        'algorithms/gpu-lanes',
      ]),
    );

    expect(
      bad.map((f) => chain(seen, f)),
      'cytoscape/headless reaches a higher tier',
    ).to.deep.equal([]);
    // measured at landing: 179 modules
    expect(seen.size, 'the walk touched too few modules').to.be.at.least(170);
  });

  it('cytoscape/headless-gpu reaches T0 + T1 + T2 only (131.3)', function () {
    const { seen, bad } = offenders(
      'src/headless-gpu.mts',
      FORBIDDEN(['render/', 'interact/']),
    );

    expect(
      bad.map((f) => chain(seen, f)),
      'cytoscape/headless-gpu reaches the renderer tier',
    ).to.deep.equal([]);
    // it does carry the device tier: the kernels and the force host
    const rel = new Set([...seen.keys()].map((f) => relative(ROOT, f)));

    expect(rel.has('src/algorithms/gpu-lanes.mts')).to.equal(true);
    expect(seen.size, 'the walk touched too few modules').to.be.at.least(190);
  });

  it('control: the full entry reaches every tier', function () {
    // the rule's positive half: were the walk to stop following an
    // edge kind, the slim entries would pass vacuously — the full entry
    // must still be seen to reach the renderer, the pointer and the
    // kernels through the same walk
    const rel = new Set(
      [...reach('src/index.mts').keys()].map((f) => relative(ROOT, f)),
    );

    for (const f of [
      'src/render/renderer.mts',
      'src/interact/pointer.mts',
      'src/algorithms/gpu-lanes.mts',
      'src/gpu/gpu-force.mts',
    ]) {
      expect(rel.has(f), `the full entry does not reach ${f}`).to.equal(true);
    }
  });
});
