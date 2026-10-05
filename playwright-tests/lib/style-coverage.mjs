import fs from 'node:fs';
import path from 'node:path';

/*
Round 135 (item 30, tier 1): which style properties each visual golden
exercises — the capture half of the golden-coverage enumerator.

A golden only measures what its scene sets, and nothing enumerated the
inverse: the properties no golden gives a non-default value at all.  So
every golden, at the moment it is exported, also records which style
properties carry a non-default value on at least one of its elements, and
which non-default values those are.  The record is checked in beside the
PNGs (`playwright-tests/golden-coverage/<name>.json`) and held to the
scene the same way the PNG is: `checkGolden` compares the live capture to
the file, and `UPDATE_GOLDENS=1` (or `UPDATE_GOLDEN_COVERAGE=1`, which
leaves the PNGs alone) rewrites it.  The enumerator itself — the universe,
the diff and the gated count — is `scripts/golden-coverage.mjs`, run by
the Node tier from these files, so the count needs no browser.

"Non-default" is judged against a default-sheet instance built from the
same bundle the scene rendered with: a leaf node, a compound parent (whose
defaults are v3's `:parent` ones) and an edge.  The capture reads the
*resolved* values through the public `style()` read — mappers, bypasses
and the parents overlay already applied — so a mapper that happens to
resolve every element to the default counts as not exercised, which is
what a pixel would say too.
*/

// cwd-anchored (Playwright's transpiler rejects import.meta in helpers);
// the test scripts always run from the repo root
export const COVERAGE_DIR = path.resolve(
  process.cwd(),
  'playwright-tests',
  'golden-coverage',
);

/**
 * Distinct values kept per property before the list is cut.  A mapped
 * colour or label can take one value per element; the enumerator only
 * needs to know the property moved, and keyword properties (the ones
 * whose values it does enumerate) never approach this.
 */
export const MAX_VALUES = 32;

/**
 * The compound-only properties: read on a parent, meaningless on a leaf
 * (which reads their zero defaults), so they are recorded under
 * `parents` and never under `nodes`.  Mirrors the schema's `parents`
 * block, which the Node gate holds this list to.
 */
export const COMPOUND_PROPS = [
  'collapse-scale',
  'compound-sizing-wrt-labels',
  'min-height',
  'min-width',
  'padding',
  'padding-bottom',
  'padding-left',
  'padding-relative-to',
  'padding-right',
  'padding-top',
];

/**
 * Collect the scene's exercised style properties.  **Runs in the page**
 * (passed to `page.evaluate`, so it must stay self-contained — no
 * closure over this module) against `window.cy`, with `window.cytoscape`
 * building the default-sheet reference; the Node gate runs the same
 * function against a headless instance by setting both names on its own
 * global.
 *
 * @param args — `{ compound, maxValues }`: the compound-only property
 *   names and the per-property value cap
 * @returns `{ elements, nodes, parents, edges, core }`, each group a map
 *   from property name to its sorted distinct non-default values (cut at
 *   `maxValues`, with a final `'…+N'` entry counting the rest)
 */
export const collectStyleCoverage = ({ compound, maxValues }) => {
  // globalThis is the page's window; the Node gate sets the same two
  // names on its own global
  const cy = globalThis.cy;
  // round 143: a labelled twin of each reference too.  A labelled
  // element's label colours read back from its label entry with their
  // opacity folded in (`text-background-color` of a default labelled
  // node reads `rgba(0,0,0,0)`), an unlabelled one's from the sheet
  // (`rgb(0,0,0)`), so judging a labelled element against an unlabelled
  // reference counted the label box's colours as set in every labelled
  // scene — which the degrade control exposed as pairs that moved
  // nothing because nothing had been set
  const ref = globalThis.cytoscape({
    elements: [
      { data: { id: 'p' } },
      { data: { id: 'c', parent: 'p' } },
      { data: { id: 'n' } },
      { data: { id: 'e', source: 'c', target: 'n' } },
      { data: { id: 'pl' } },
      { data: { id: 'cl', parent: 'pl' } },
      { data: { id: 'nl' } },
      { data: { id: 'el', source: 'cl', target: 'nl' } },
    ],
  });

  ref.$id('pl').style('label', 'x');
  ref.$id('nl').style('label', 'x');
  ref.$id('el').style('label', 'x');

  const defaults = {
    node: ref.$id('n').style(),
    parent: ref.$id('p').style(),
    edge: ref.$id('e').style(),
    labelled: {
      node: ref.$id('nl').style(),
      parent: ref.$id('pl').style(),
      edge: ref.$id('el').style(),
    },
    core: ref.style().core(),
  };

  ref.destroy();

  // a labelled element is judged against the labelled reference, except
  // for `label` itself, whose default is the unlabelled one's
  const refFor = (ele, kind) => {
    const plain = defaults[kind];

    if (ele.style('label') === plain.label) {
      return plain;
    }

    return { ...defaults.labelled[kind], label: plain.label };
  };

  const compoundSet = new Set(compound);
  const text = (v) => (typeof v === 'string' ? v : JSON.stringify(v));
  const groups = { nodes: {}, parents: {}, edges: {}, core: {} };
  const note = (group, prop, value) => {
    (groups[group][prop] ??= new Set()).add(text(value));
  };
  // a per-image list reads back one entry per layer, so a node with
  // four images reads `node node node node` for an untouched
  // background-clip — the default, once per layer (round 143: the
  // degrade control found eight image properties "set" that way that no
  // reset could move)
  const isDefault = (v, d) => {
    const dt = text(d);

    return (
      text(v) === dt ||
      (typeof v === 'string' &&
        typeof dt === 'string' &&
        dt !== '' &&
        !dt.includes(' ') &&
        v.split(' ').every((t) => t === dt))
    );
  };
  const sweep = (group, props, def, only) => {
    for (const prop of Object.keys(props)) {
      if (only != null && only(prop) === false) {
        continue;
      }

      if (!isDefault(props[prop], def[prop])) {
        note(group, prop, props[prop]);
      }
    }
  };
  const counts = { nodes: 0, parents: 0, edges: 0 };

  cy.nodes().forEach((node) => {
    const props = node.style();

    if (node.isParent()) {
      const def = refFor(node, 'parent');

      counts.parents++;
      // a parent's width and height read back its auto-sized box, which
      // no sheet sets (round 143: the degrade control reset them on the
      // compound goldens and moved nothing)
      sweep(
        'nodes',
        props,
        def,
        (p) => !compoundSet.has(p) && p !== 'width' && p !== 'height',
      );
      sweep('parents', props, def, (p) => compoundSet.has(p));
    } else {
      counts.nodes++;
      sweep('nodes', props, refFor(node, 'node'), (p) => !compoundSet.has(p));
    }
  });

  cy.edges().forEach((edge) => {
    counts.edges++;
    sweep('edges', edge.style(), refFor(edge, 'edge'));
  });

  // the core block reads back as the engine's camelCase record
  const kebab = (k) => k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
  const core = cy.style().core();

  for (const key of Object.keys(core)) {
    if (text(core[key]) !== text(defaults.core[key])) {
      note('core', kebab(key), core[key]);
    }
  }

  const out = { elements: counts };

  for (const [group, props] of Object.entries(groups)) {
    out[group] = {};

    for (const prop of Object.keys(props).sort()) {
      const values = [...props[prop]].sort();

      out[group][prop] =
        values.length > maxValues
          ? [...values.slice(0, maxValues), `…+${values.length - maxValues}`]
          : values;
    }
  }

  return out;
};

/** JSON with object keys sorted, so key order never reads as a change. */
const canonical = (value) =>
  JSON.stringify(value, (_, v) =>
    v != null && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  );

/**
 * Hold one golden's capture to its checked-in record, or write the record
 * under `UPDATE_GOLDENS=1` / `UPDATE_GOLDEN_COVERAGE=1`.  Compared
 * structurally, so the file's layout is free.
 *
 * @param name — the golden's name (the PNG's basename)
 * @param capture — `collectStyleCoverage`'s result for the scene
 * @throws when the record is missing or differs, naming what moved
 */
export const compareToCoverage = (name, capture) => {
  const file = path.join(COVERAGE_DIR, `${name}.json`);
  const record = { golden: name, ...capture };

  if (process.env.UPDATE_GOLDENS || process.env.UPDATE_GOLDEN_COVERAGE) {
    fs.mkdirSync(COVERAGE_DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n');

    return { updated: true };
  }

  if (!fs.existsSync(file)) {
    throw new Error(
      `No style-coverage record for the golden '${name}'; run the visual ` +
        'specs with UPDATE_GOLDEN_COVERAGE=1 to create it (then commit ' +
        `${path.relative(process.cwd(), file)})`,
    );
  }

  const stored = JSON.parse(fs.readFileSync(file, 'utf8'));
  const moved = [];

  for (const key of new Set([...Object.keys(stored), ...Object.keys(record)])) {
    if (canonical(stored[key]) !== canonical(record[key])) {
      moved.push(key);
    }
  }

  if (moved.length > 0) {
    throw new Error(
      `The golden '${name}' exercises different style properties than its ` +
        `record says (${moved.join(', ')} moved).  If the scene changed on ` +
        'purpose, regenerate with UPDATE_GOLDEN_COVERAGE=1 and commit ' +
        `${path.relative(process.cwd(), file)}.`,
    );
  }

  return { updated: false };
};
