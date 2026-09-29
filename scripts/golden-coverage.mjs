// Which style properties no visual golden exercises (round 135 — item 30,
// tier 1).  A sibling of the source audits:
//
//   node scripts/jsdoc-coverage.mjs                — which members are documented
//   node scripts/throw-coverage.mjs                — which throws the suite runs
//   node scripts/bench-coverage.mjs                — which members a benchmark calls
//   node --import tsx scripts/golden-coverage.mjs  — which style properties a golden sets
//
//   node --import tsx scripts/golden-coverage.mjs [--verbose]
//
// **What it counts.**  Each visual golden records, as it is exported, the
// style properties that carry a non-default value on at least one of its
// elements (`playwright-tests/golden-coverage/<name>.json`, written and
// held to the scene by `playwright-tests/lib/style-coverage.mjs`).  This
// reads those records and diffs them against the universe: every property
// the stylesheet schema enumerates for a group (round 79's
// `schemas/stylesheet.schema.json`, itself gated against the compiler)
// **that the group reads back** — the schema also lists 45 cross-group
// names the compiler accepts and nothing reads (`line-color` on a node,
// `shape` on an edge), which no scene could exercise, so they are reported
// as inert rather than counted.  The result is the count the item asked
// for: the style properties for which no golden scene sets a non-default
// value.  Keyword properties are enumerated one level further — which of
// their non-default keywords no golden shows — since `shape` being
// exercised says nothing about `concave-hexagon`.
//
// **What it cannot tell you.**  A property with a non-default value can
// still move no pixels — painted over, zero-sized, off-canvas.  That is
// tier 2's degrade control (reset one property, re-render, count moved
// pixels), which this round deliberately does not build.  So "exercised"
// here is an upper bound on what the goldens see, and the unexercised
// count a lower bound on what they miss.
//
// The Node gate (`test/modules/golden-coverage.mjs`) pins the counts, so
// a golden that adds coverage lowers a number consciously and a scene
// edit that drops coverage cannot pass quietly.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** The checked-in capture records, one per golden. */
export const COVERAGE_DIR = join(ROOT, 'playwright-tests', 'golden-coverage');

/** The golden PNGs the records must match one to one. */
export const GOLDENS_DIR = join(ROOT, 'playwright-tests', 'goldens');

/** The groups a capture carries, in report order. */
export const GROUPS = ['nodes', 'parents', 'edges', 'core'];

/**
 * Properties no static golden can show, whatever its sheet says — each
 * with the reason.  They stay in the universe (a golden that sets one is
 * still counted as exercising it) but are reported apart from the
 * paintable gaps, which are the list the SVG-export (77) and WebGL (73)
 * parity rounds are held to.  Audited by the gate: a key that is not in
 * the universe fails, so a renamed property cannot keep a stale entry.
 */
export const NO_STATIC_PIXELS = {
  events: 'pointer behaviour only — decides what a press picks, draws nothing',
  'text-events':
    'pointer behaviour only — whether the label box picks, draws nothing',
  'transition-property':
    'animation config — a golden is one settled frame, never mid-transition',
  'transition-duration':
    'animation config — a golden is one settled frame, never mid-transition',
  'transition-delay':
    'animation config — a golden is one settled frame, never mid-transition',
  'transition-timing-function':
    'animation config — a golden is one settled frame, never mid-transition',
  'active-bg-color':
    'press feedback — drawn only while a pointer is down on the background',
  'active-bg-opacity':
    'press feedback — drawn only while a pointer is down on the background',
  'active-bg-size':
    'press feedback — drawn only while a pointer is down on the background',
  'selection-box-color':
    'gesture chrome — drawn only during a box-selection drag',
  'selection-box-opacity':
    'gesture chrome — drawn only during a box-selection drag',
  'selection-box-border-color':
    'gesture chrome — drawn only during a box-selection drag',
  'selection-box-border-width':
    'gesture chrome — drawn only during a box-selection drag',
  'background-image-crossorigin':
    'a fetch mode — the goldens load same-origin images, where it moves nothing',
  'mid-source-arrow-width':
    'a hollow stroke width — mid heads are always filled (PLAN.md item 21), and v3 also strokes only a hollow head',
  'mid-target-arrow-width':
    'a hollow stroke width — mid heads are always filled (PLAN.md item 21), and v3 also strokes only a hollow head',
};

/**
 * Keywords that read back as another keyword — spellings of one drawing,
 * so a capture can never record them and they are not gaps.  Audited by
 * the gate: each must read back as its target when a sheet sets it.
 */
export const ALIASES = {
  shape: { circle: 'ellipse', square: 'rectangle' },
  'source-arrow-shape': { arrow: 'triangle' },
  'target-arrow-shape': { arrow: 'triangle' },
  'mid-source-arrow-shape': { arrow: 'triangle' },
  'mid-target-arrow-shape': { arrow: 'triangle' },
};

/** Kebab-case property names of one schema props block. */
const kebabNames = (block) =>
  Object.keys(block.properties)
    .filter((k) => !/[A-Z]/.test(k))
    .sort();

/**
 * The universe: per group, the schema's properties that the group reads
 * back, and the schema's properties it accepts but never reads.
 *
 * @param schema — the parsed stylesheet schema
 * @param readable — `{ nodes, edges }`, the property names a leaf node
 *   and an edge read back (`style()`'s keys); compound props are read on
 *   parents, core props through the core record
 * @returns `{ groups: { nodes, parents, edges, core }, inert: { nodes,
 *   edges } }`, each a sorted name list
 */
export const universe = (schema, readable) => {
  const nodeRead = new Set(readable.nodes);
  const edgeRead = new Set(readable.edges);
  const compound = kebabNames(schema.$defs.parents);
  const nodeAll = kebabNames(schema.$defs.nodeProps);
  const edgeAll = kebabNames(schema.$defs.edges);

  return {
    groups: {
      nodes: nodeAll.filter((p) => nodeRead.has(p)),
      parents: compound.filter((p) => nodeRead.has(p)),
      edges: edgeAll.filter((p) => edgeRead.has(p)),
      core: kebabNames(schema.$defs.core),
    },
    inert: {
      nodes: nodeAll.filter((p) => !nodeRead.has(p)),
      edges: edgeAll.filter((p) => !edgeRead.has(p)),
    },
  };
};

/**
 * A property's keyword vocabulary when it is a plain keyword property —
 * its schema entry a `$ref` to one `$defs/keywords` enum, or an inline
 * `enum` — else null.  List-valued forms (the multi-image `anyOf`s) and
 * the `yes`/`no` kinds are left to the property-level count.
 */
export const keywordsOf = (schema, prop) => {
  const entry = schema.$defs.props[prop];

  if (entry == null) {
    return null;
  }

  if (Array.isArray(entry.enum)) {
    return entry.enum;
  }

  const m = /^#\/\$defs\/keywords\/(\w+)$/.exec(entry.$ref ?? '');

  return m == null ? null : (schema.$defs.keywords[m[1]].enum ?? null);
};

/** Every capture record on disk, sorted by golden name. */
export const loadCaptures = (dir = COVERAGE_DIR) =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));

/** The golden names, from the PNGs on disk. */
export const goldenNames = (dir = GOLDENS_DIR) =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.png'))
    .map((f) => f.slice(0, -'.png'.length))
    .sort();

/**
 * Records against goldens, one to one: a golden with no record has no
 * coverage anyone counted, and a record with no golden is stale.
 *
 * @param captures — the records
 * @param names — the golden names (`goldenNames()`)
 * @returns `{ missing, orphans, misnamed }` — goldens without a record,
 *   records without a golden, and records whose `golden` field is absent
 */
export const pairing = (captures, names) => {
  const recorded = new Set(captures.map((c) => c.golden));
  const golden = new Set(names);

  return {
    missing: names.filter((n) => !recorded.has(n)),
    orphans: [...recorded].filter((n) => !golden.has(n)).sort(),
    misnamed: captures.filter((c) => typeof c.golden !== 'string').length,
  };
};

/**
 * The enumeration: which properties (and which non-default keywords) the
 * captures exercise, and which they do not.
 *
 * @param captures — the records (`loadCaptures()`)
 * @param space — `universe()`'s result
 * @param schema — the parsed stylesheet schema, for the keyword sets
 * @param defaults — `{ nodes, parents, edges }`: the default value of
 *   each property as a default-sheet leaf, parent and edge read it, so a
 *   keyword's default is not counted as a gap
 * @returns `{ exercised, unexercised, paintable, noStatic, unknown,
 *   keywordGaps, counts }` — `exercised[group]` maps a property to the
 *   goldens that set it; `unknown` lists captured properties outside the
 *   universe (a stale record, or a schema that lost a name)
 */
export const enumerate = (captures, space, schema, defaults) => {
  const exercised = {};
  const unexercised = {};
  const paintable = {};
  const noStatic = {};
  const keywordGaps = {};
  const unknown = [];
  const seen = {};

  for (const group of GROUPS) {
    const names = new Set(space.groups[group]);

    exercised[group] = {};
    seen[group] = {};

    for (const capture of captures) {
      for (const [prop, values] of Object.entries(capture[group] ?? {})) {
        if (!names.has(prop)) {
          unknown.push(`${capture.golden}: ${group} ${prop}`);
          continue;
        }

        (exercised[group][prop] ??= []).push(capture.golden);

        for (const v of values) {
          (seen[group][prop] ??= new Set()).add(v);
        }
      }
    }

    unexercised[group] = space.groups[group].filter(
      (p) => !(p in exercised[group]),
    );
    paintable[group] = unexercised[group].filter(
      (p) => !(p in NO_STATIC_PIXELS),
    );
    noStatic[group] = unexercised[group].filter((p) => p in NO_STATIC_PIXELS);

    keywordGaps[group] = {};

    if (group === 'core') {
      // the core record reads back engine codes, not keywords; its one
      // keyword property (label-declutter) is two-valued, so the
      // property-level count already says it
      continue;
    }

    for (const prop of space.groups[group]) {
      const words = keywordsOf(schema, prop);

      if (words == null || prop in NO_STATIC_PIXELS) {
        continue;
      }

      const def = defaults[group]?.[prop];
      const have = seen[group][prop] ?? new Set();
      const alias = ALIASES[prop] ?? {};
      const missing = words.filter(
        (w) => w !== def && !(w in alias) && !have.has(w),
      );

      if (missing.length > 0) {
        keywordGaps[group][prop] = missing;
      }
    }
  }

  const sum = (per) =>
    GROUPS.reduce(
      (n, g) =>
        n +
        (Array.isArray(per[g]) ? per[g].length : Object.keys(per[g]).length),
      0,
    );
  const keywordTotal = GROUPS.reduce(
    (n, g) =>
      n + Object.values(keywordGaps[g]).reduce((m, list) => m + list.length, 0),
    0,
  );

  return {
    exercised,
    unexercised,
    paintable,
    noStatic,
    unknown,
    keywordGaps,
    counts: {
      universe: sum(space.groups),
      exercised: sum(exercised),
      unexercised: sum(unexercised),
      paintable: sum(paintable),
      noStatic: sum(noStatic),
      inert: space.inert.nodes.length + space.inert.edges.length,
      keywordGaps: keywordTotal,
      goldens: captures.length,
    },
  };
};

/**
 * Build everything the enumeration needs from the live library — the
 * readable sets and the defaults come from a default-sheet headless
 * instance, the same reference the capture judged "non-default" against.
 * Needs the tsx loader (it imports `src/`).
 */
export const measure = async () => {
  const { default: cytoscape } = await import('../src/index.mjs');
  const schema = JSON.parse(
    readFileSync(join(ROOT, 'schemas', 'stylesheet.schema.json'), 'utf8'),
  );
  const cy = cytoscape({
    elements: [
      { data: { id: 'p' } },
      { data: { id: 'c', parent: 'p' } },
      { data: { id: 'n' } },
      { data: { id: 'e', source: 'c', target: 'n' } },
    ],
  });
  const defaults = {
    nodes: cy.$id('n').style(),
    parents: cy.$id('p').style(),
    edges: cy.$id('e').style(),
  };

  cy.destroy();

  const space = universe(schema, {
    nodes: Object.keys(defaults.nodes),
    edges: Object.keys(defaults.edges),
  });

  return {
    schema,
    space,
    defaults,
    result: enumerate(loadCaptures(), space, schema, defaults),
  };
};

const main = async () => {
  const verbose = process.argv.includes('--verbose');
  const { space, result } = await measure();
  const { counts } = result;

  console.log(
    `golden coverage: ${counts.exercised}/${counts.universe} style properties ` +
      `exercised by ${counts.goldens} goldens — ${counts.unexercised} never set ` +
      `to a non-default value (${counts.paintable} paintable, ` +
      `${counts.noStatic} no static golden can show); ` +
      `${counts.keywordGaps} non-default keywords never shown; ` +
      `${counts.inert} schema names inert in their group`,
  );

  for (const group of GROUPS) {
    const n = space.groups[group].length;
    const e = Object.keys(result.exercised[group]).length;

    console.log(`  ${group.padEnd(8)} ${e}/${n}`);

    if (verbose) {
      for (const p of result.paintable[group]) {
        console.log(`    unexercised  ${p}`);
      }

      for (const p of result.noStatic[group]) {
        console.log(`    no-static    ${p} — ${NO_STATIC_PIXELS[p]}`);
      }

      for (const [p, words] of Object.entries(result.keywordGaps[group])) {
        console.log(`    keywords     ${p}: ${words.join(', ')}`);
      }
    }
  }

  if (verbose) {
    console.log(
      `  inert (accepted, never read): nodes ${space.inert.nodes.join(', ')}; ` +
        `edges ${space.inert.edges.join(', ')}`,
    );
  }

  if (result.unknown.length > 0) {
    console.log(`  outside the universe: ${result.unknown.join('; ')}`);
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
