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
// **What it cannot tell you, and tier 2.**  A property with a
// non-default value can still move no pixels — painted over, zero-sized,
// off-canvas.  Round 143's degrade control
// (`playwright-tests/lib/degrade-control.mjs`, run as
// `DEGRADE_CONTROL=1` on the golden pass) resets each exercised
// property of each golden to its default on the live scene and counts
// the pixels that move, into `playwright-tests/golden-degrade/`;
// `degradeReport` reads those records here.  A pair that moves nothing
// is decoration in its scene, or — when the reset could not move the
// value at all — a property that reads back a value derived from
// another (`UNMOVABLE`).
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

/** The degrade control's records, one per golden (round 143). */
export const DEGRADE_DIR = join(ROOT, 'playwright-tests', 'golden-degrade');

/** The groups a degrade pair can be in: core props are reset otherwise, and no golden sets one. */
export const DEGRADE_GROUPS = ['nodes', 'parents', 'edges'];

/** A capture's (group, property) pairs, as the degrade control keys them. */
export const pairsOf = (capture) =>
  DEGRADE_GROUPS.flatMap((group) =>
    Object.keys(capture[group] ?? {})
      .sort()
      .map((prop) => `${group}/${prop}`),
  );

/**
 * Pairs a reset cannot move, and why — the property reads back a value
 * derived from another one, so the capture counts it as set though the
 * sheet never names it (or names it through a shorthand a per-side reset
 * cannot undo).  Audited by the gate: every unmoved pair's property is
 * here, and every entry is still unmoved somewhere.
 */
export const UNMOVABLE = {
  'chart-colors':
    'reads back the palette its chart-values imply (one colour per value), set or not',
  'background-gradient-stop-positions':
    'reads back the even spread its stop colours imply, set or not',
  'line-gradient-stop-positions':
    'reads back the even spread its stop colours imply, set or not',
  'padding-bottom':
    'set through the `padding` shorthand, which the sheet reset leaves; compound props are parents-group constants, so no per-element bypass can name one',
  'padding-left':
    'set through the `padding` shorthand, which the sheet reset leaves; compound props are parents-group constants, so no per-element bypass can name one',
  'padding-right':
    'set through the `padding` shorthand, which the sheet reset leaves; compound props are parents-group constants, so no per-element bypass can name one',
  'padding-top':
    'set through the `padding` shorthand, which the sheet reset leaves; compound props are parents-group constants, so no per-element bypass can name one',
};

/**
 * Pairs that move no pixel by design — the scene sets the property to
 * pin that it changes nothing — each with its reason.  Audited like
 * `UNMOVABLE`: a decoration pair not listed here fails the gate, so a
 * new one is either fixed in its scene or argued for here.
 */
export const INTENDED_DECORATION = {
  'label-border-styles edges/mid-source-arrow-width':
    'mid heads are always filled and the width strokes only a hollow head (PLAN.md item 21, v3 too): set so the coverage record counts it',
  'label-border-styles edges/mid-target-arrow-width':
    'mid heads are always filled and the width strokes only a hollow head (PLAN.md item 21, v3 too): set so the coverage record counts it',
  'self-loops edges/curve-style':
    "the scene's claim: a straight-styled loop still draws as a loop (the v4 rule), so resetting the style must move nothing",
};

/** Every degrade record on disk, sorted by golden name. */
export const loadDegrades = (dir = DEGRADE_DIR) =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));

/**
 * Tier 2 (round 143): read the degrade control's records against the
 * captures.  Each exercised (group, property) pair was reset to its
 * default on the live scene and the moved pixels counted; a pair that
 * moved none either could not be moved at all (the reset left the value
 * — `unmoved`) or moved a value that draws nothing (`decoration`).
 *
 * @param captures — the tier-1 records
 * @param degrades — the degrade records
 * @returns `{ stale, missing, stopped, pairs, moved, decoration,
 *   unmoved, residue, seen, unseen, counts }` — `stale` names records
 *   whose pairs are not their capture's, `unseen` the properties some
 *   golden sets and no reset of which moved a pixel in any golden
 */
export const degradeReport = (captures, degrades) => {
  const byName = new Map(degrades.map((d) => [d.golden, d]));
  const stale = [];
  const missing = [];
  const stopped = [];
  const decoration = [];
  const unmoved = [];
  const residue = [];
  const moved = [];
  const seen = new Set();
  const exercised = new Set();

  for (const capture of captures) {
    const record = byName.get(capture.golden);

    if (record == null) {
      missing.push(capture.golden);
      continue;
    }

    const want = pairsOf(capture);

    if (JSON.stringify(Object.keys(record.pairs)) !== JSON.stringify(want)) {
      stale.push(capture.golden);
    }

    if (record.stopped != null) {
      stopped.push(`${capture.golden}: ${record.stopped}`);
    }

    for (const [pair, r] of Object.entries(record.pairs)) {
      const key = `${capture.golden} ${pair}`;
      const prop = pair.slice(pair.indexOf('/') + 1);
      const took =
        r.via === 'sheet'
          ? r.elements
          : r.elements - (r.unresettable ?? []).length;

      exercised.add(pair);

      if (r.residue != null) {
        residue.push(`${key} (${r.residue} px)`);
      }

      if (r.moved > 0) {
        moved.push(key);
        seen.add(pair);
      } else if (took === 0) {
        unmoved.push({ key, prop });
      } else {
        decoration.push(key);
      }
    }
  }

  const unseen = [...exercised].filter((p) => !seen.has(p)).sort();

  return {
    stale,
    missing,
    stopped,
    moved,
    decoration,
    unmoved,
    residue,
    unseen,
    counts: {
      pairs: moved.length + decoration.length + unmoved.length,
      moved: moved.length,
      decoration: decoration.length,
      unmoved: unmoved.length,
      exercised: exercised.size,
      seen: seen.size,
      unseen: unseen.length,
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

  // tier 2 (round 143): the degrade control's records
  const report = degradeReport(loadCaptures(), loadDegrades());
  const c = report.counts;

  console.log(
    `degrade control: ${c.pairs} (golden, property) pairs reset — ${c.moved} ` +
      `moved pixels, ${c.decoration} moved none (decoration), ${c.unmoved} ` +
      `could not be moved; ${c.seen}/${c.exercised} group-properties move ` +
      `pixels in some golden`,
  );

  if (verbose) {
    for (const key of report.decoration) {
      console.log(
        `    decoration   ${key}${key in INTENDED_DECORATION ? ` — ${INTENDED_DECORATION[key]}` : ''}`,
      );
    }

    for (const { key, prop } of report.unmoved) {
      console.log(`    unmovable    ${key} — ${UNMOVABLE[prop] ?? '?'}`);
    }

    for (const p of report.unseen) {
      console.log(`    unseen       ${p}`);
    }

    for (const r of report.residue) {
      console.log(`    residue      ${r}`);
    }
  }

  for (const [what, list] of [
    ['stale', report.stale],
    ['missing', report.missing],
    ['stopped', report.stopped],
  ]) {
    if (list.length > 0) {
      console.log(`  ${what}: ${list.join('; ')}`);
    }
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
