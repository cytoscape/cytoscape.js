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
// **that the group reads back** — the schema also lists a set of cross-group
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
  // These entries require behaviour or a mid-transition checkpoint. Active
  // background and selection-box styles remain paintable because fixtures
  // can capture them while a pointer is held.
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

/** Keyword spellings whose public core read-back is an engine code. */
export const KEYWORD_READBACK = {
  'label-declutter': { none: 0, cull: 1 },
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
 * Walk a property schema for finite enum/const values, including enums
 * nested under `anyOf` and array `items`, and enums referenced from either
 * `keywords` or `kinds`.  This includes the yes/no kind and list-valued
 * image properties; those were invisible to the original enum-only scan.
 */
const enumValues = (schema, entry, seen = new Set()) => {
  if (entry == null || typeof entry !== 'object') return [];
  if (Array.isArray(entry.enum)) return entry.enum;
  if (Object.hasOwn(entry, 'const')) return [entry.const];

  if (typeof entry.$ref === 'string') {
    const match = /^#\/\$defs\/(keywords|kinds)\/([\w-]+)$/.exec(entry.$ref);

    if (match != null) {
      const key = `${match[1]}/${match[2]}`;

      if (seen.has(key)) return [];

      seen.add(key);
      return enumValues(schema, schema.$defs[match[1]][match[2]], seen);
    }
  }

  const values = ['anyOf', 'oneOf', 'allOf', 'items'].flatMap((key) => {
    const part = entry[key];

    if (Array.isArray(part)) {
      return part.flatMap((child) => enumValues(schema, child, seen));
    }

    return part == null ? [] : enumValues(schema, part, seen);
  });

  return values.filter(
    (value, index) =>
      values.findIndex((candidate) => String(candidate) === String(value)) ===
      index,
  );
};

/** A property's finite canonical vocabulary, or null when it has none. */
export const keywordsOf = (schema, prop) => {
  const values = enumValues(schema, schema.$defs.props[prop]);

  return values.length === 0 ? null : values;
};

/**
 * Split the string forms in style read-backs into individual canonical
 * values.  Multi-image properties resolve as whitespace-separated tokens;
 * some records can also contain JSON-encoded arrays from older captures.
 */
const keywordTokens = (raw) => {
  let value = raw;

  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      value = raw;
    }
  }

  if (Array.isArray(value)) {
    return value.flatMap(keywordTokens);
  }

  if (typeof value === 'string') {
    return value.trim().split(/\s+/).filter(Boolean);
  }

  return [String(value)];
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
          for (const token of keywordTokens(v)) {
            (seen[group][prop] ??= new Set()).add(token);
          }
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

    for (const prop of space.groups[group]) {
      const words = keywordsOf(schema, prop);

      if (words == null || prop in NO_STATIC_PIXELS) {
        continue;
      }

      const def = defaults[group]?.[prop];
      const defaultTokens = new Set(keywordTokens(def));
      const have = seen[group][prop] ?? new Set();
      const alias = ALIASES[prop] ?? {};
      const readback = KEYWORD_READBACK[prop] ?? {};
      const missing = words.filter((w) => {
        if (Object.hasOwn(alias, w)) return false;

        const value = Object.hasOwn(readback, w) ? readback[w] : w;
        const observed = String(value);
        const isDefault = Object.hasOwn(readback, w)
          ? defaultTokens.has(observed)
          : defaultTokens.has(w);

        return !isDefault && !have.has(observed);
      });

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

/** Element groups plus renderer-level core controls. */
export const DEGRADE_GROUPS = ['nodes', 'parents', 'edges', 'core'];

/** A capture's (group, property) pairs, as the degrade control keys them. */
export const pairsOf = (capture) =>
  DEGRADE_GROUPS.flatMap((group) =>
    Object.keys(capture[group] ?? {})
      .sort()
      .map((prop) => `${group}/${prop}`),
  );

/**
 * Pairs a reset cannot move, and why — a value is derived or folded,
 * shorthand authorship survives the per-side reset, or a collapsed
 * Float32 readback retains a rounding residue.  Audited by the gate:
 * every unmoved pair's property is here, and every entry is still
 * unmoved somewhere.
 */
export const UNMOVABLE = {
  'chart-colors':
    'reads back a derived chart palette (one colour per value); heat charts derive it from chart-scale, and the renderer rejects setting chart-colors on that chart kind',
  'border-dash-pattern':
    'feature-compounds-miniature has collapsed children with the default solid border, so the dash pattern is not sampled by the shader; its getter also divides the Float32Array by collapse scale and can retain a rounding residue (src/style/readers-nodes.mts:85-98; src/render/shaders/node.mts:238-250)',
  color:
    'feature-labels-edges reads edge label color after text-opacity has been folded into its alpha; resetting to default black leaves the same effective color at the fixture’s text-opacity 0.86 (src/style/engine-write.mts:923-936)',
  'text-justification':
    'feature-labels-font-keywords authors center while the reset value auto resolves against centered text-halign; the public getter reports the stylesheet declaration rather than the resolved sidecar, so both states have the same effective centered justification (src/style/engine-write.mts:966-975; src/style/readers-labels.mts:89)',
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
  'feature-arrows-scalars edges/mid-source-arrow-width':
    'This row’s match-line mid arrow is filled; mid-arrow width only strokes hollow heads, and v4 mid heads are always filled (src/README.md:8241-8250; PLAN.md item 21).',
  'feature-arrows-scalars edges/mid-target-arrow-width':
    'This row’s match-line mid arrow is filled; mid-arrow width only strokes hollow heads, and v4 mid heads are always filled (src/README.md:8241-8250; PLAN.md item 21).',
  'feature-arrows-shapes nodes/text-max-width':
    'The arrow-shape fixture captions are short, explicitly line-broken group/value labels; each rendered line is below the scene’s 115 px maximum (debug/feature-scenes-graph.js).',
  'feature-compounds-hulls-exclude nodes/text-max-width':
    'The hull labels are short captions; the long convex child label has its own no-wrap node style, so the 130 px parent-label limit does not change line breaks (debug/feature-scenes-compounds.js).',
  'feature-compounds-hulls-exclude nodes/text-wrap':
    'The three parent captions fit on one line and the long convex child label explicitly uses text-wrap none; changing the parent wrap setting changes no line breaks (debug/feature-scenes-compounds.js).',
  'feature-compounds-hulls nodes/text-max-width':
    'The hull labels are short captions; the long convex child label has its own no-wrap node style, so the 130 px parent-label limit does not change line breaks (debug/feature-scenes-compounds.js).',
  'feature-compounds-hulls nodes/text-wrap':
    'The three parent captions fit on one line and the long convex child label explicitly uses text-wrap none; changing the parent wrap setting changes no line breaks (debug/feature-scenes-compounds.js).',
  'feature-compounds-miniature nodes/text-max-width':
    'The expanded, miniature, child, and outside captions all fit within 140 px; the chart and image bodies carry no long text (debug/feature-scenes-compounds.js).',
  'feature-compounds-miniature nodes/text-wrap':
    'Every miniature-fixture caption fits on one line within its body or below its parent, so wrapping does not alter the labels (debug/feature-scenes-compounds.js).',
  'feature-compounds-minimums nodes/text-max-width':
    'The parent caption is explicitly split into “min-width 120” and “min-height 90”; both lines fit under 150 px (debug/feature-scenes-compounds.js).',
  'feature-compounds-padding-sides nodes/text-max-width':
    'The parent caption is explicitly split into two short lines, both below the 150 px limit (debug/feature-scenes-compounds.js).',
  'feature-compounds-padding-sides parents/padding':
    'The sides fixture authors padding: 0 and then supplies all four side values; resetting the shorthand to its default 10 leaves those explicit sides in place (debug/feature-scenes-compounds.js; src/README.md:4325).',
  'feature-compounds-padding-width-paddingRelativeTo-average nodes/text-max-width':
    'The parent’s “18% padding” and relative-to captions are explicitly split into short lines under 150 px (debug/feature-scenes-compounds.js).',
  'feature-compounds-padding-width-paddingRelativeTo-height nodes/text-max-width':
    'The parent’s “18% padding” and relative-to captions are explicitly split into short lines under 150 px (debug/feature-scenes-compounds.js).',
  'feature-compounds-padding-width-paddingRelativeTo-max nodes/text-max-width':
    'The parent’s “18% padding” and relative-to captions are explicitly split into short lines under 150 px (debug/feature-scenes-compounds.js).',
  'feature-compounds-padding-width-paddingRelativeTo-max parents/padding-relative-to':
    'This parent is wider than it is tall, so max selects the same width dimension as the default width mode; the authored 18% padding is unchanged (debug/feature-scenes-compounds.js).',
  'feature-compounds-padding-width-paddingRelativeTo-min nodes/text-max-width':
    'The parent’s “18% padding” and relative-to captions are explicitly split into short lines under 150 px (debug/feature-scenes-compounds.js).',
  'feature-compounds-padding-width nodes/text-max-width':
    'The parent’s “18% padding” and relative-to captions are explicitly split into short lines under 150 px (debug/feature-scenes-compounds.js).',
  'feature-edges-loops edges/curve-style':
    'Every edge in this fixture is a self-loop; v4 constructs loops as loops under every declared curve-style (src/README.md:3836-3844).',
  'feature-emphasis-declutter-dimOpacity-0 nodes/label-priority':
    'The overlapping pair is outside the emphasized neighborhood and dim-opacity 0 makes both labels transparent, so their priority cannot change this image (debug/feature-scenes-compounds.js).',
  'feature-emphasis-declutter-dimOpacity-0 nodes/text-max-width':
    'All visible focus/neighbour labels fit the 86 px limit; the overlapping pair is transparent at dim-opacity 0 (debug/feature-scenes-compounds.js).',
  'feature-emphasis-declutter-dimOpacity-0 core/label-declutter':
    'dim-opacity 0 makes every non-emphasized label fully transparent, so culling versus none has no visible ink to change in this state (debug/feature-scenes-compounds.js).',
  'feature-emphasis-declutter-dimOpacity-1 nodes/label-priority':
    'The overlapping pair is already culled in the fixture’s settled incumbent state; resetting its higher rank to a tie does not displace the incumbent because label-declutter retains incumbents within its hysteresis margin (src/render/label-declutter.mts:658-676).',
  'feature-emphasis-declutter-dimOpacity-1 nodes/text-max-width':
    'Each visible focus/neighbour label is at most two short lines within 86 px; resetting the limit does not change its wrapping (debug/feature-scenes-compounds.js).',
  'feature-emphasis-declutter-labelDeclutter-none nodes/label-priority':
    'This state disables decluttering, so label-priority is not consulted when drawing labels (src/render/label-declutter.mts:59-61).',
  'feature-emphasis-declutter-labelDeclutter-none nodes/text-max-width':
    'Every label in the emphasis fixture fits within the 86 px limit or has an explicit newline; the limit does not change its wrapping (debug/feature-scenes-compounds.js).',
  'feature-emphasis-declutter nodes/label-priority':
    'The overlapping pair keeps its settled high-priority incumbent when reset makes the ranks tie; label-declutter’s incumbent hysteresis prevents a pixel change (src/render/label-declutter.mts:658-676).',
  'feature-emphasis-declutter nodes/text-max-width':
    'Every emphasis caption fits within 86 px or uses an explicit newline, so removing the maximum does not change the rendered line breaks (debug/feature-scenes-compounds.js).',
  'feature-images-layers nodes/background-image-crossorigin':
    'The compared images are data URLs, so changing request credentials does not change decoded pixels; request-option behavior is covered by test/image-registry.mjs.',
  'feature-labels-font-keywords-fontStyle-italic nodes/font-weight':
    'This URL state selects Open Sans italic at weight 400; resetting weight to normal keeps the same weight-400 italic face among the four pinned font assets (debug/style.css:1-4).',
  'feature-labels-font-keywords-fontStyle-oblique nodes/font-weight':
    'This URL state selects Open Sans oblique at weight 400; resetting weight to normal keeps the same weight-400 oblique face among the four pinned font assets (debug/style.css:1-4).',
  'feature-labels-font-keywords-fontWeight-100 nodes/font-weight':
    'The pinned Open Sans assets provide weight 400 and 700; CSS font matching selects the same 400 face for requested weight 100 and reset value normal (debug/style.css:1-4).',
  'feature-labels-font-keywords-fontWeight-200 nodes/font-weight':
    'The pinned Open Sans assets provide weight 400 and 700; CSS font matching selects the same 400 face for requested weight 200 and reset value normal (debug/style.css:1-4).',
  'feature-labels-font-keywords-fontWeight-300 nodes/font-weight':
    'The pinned Open Sans assets provide weight 400 and 700; CSS font matching selects the same 400 face for requested weight 300 and reset value normal (debug/style.css:1-4).',
  'feature-labels-font-keywords-fontWeight-500 nodes/font-weight':
    'The pinned Open Sans assets provide weight 400 and 700; CSS font matching selects the same 400 face for requested weight 500 and reset value normal (debug/style.css:1-4).',
  'feature-labels-font-keywords-fontWeight-lighter nodes/font-weight':
    'The pinned Open Sans assets provide weight 400 and 700; relative lighter from the 400 base selects the same 400 face as reset value normal (debug/style.css:1-4).',
  'feature-labels-font-keywords nodes/font-weight':
    'The fixture authors weight 400, which selects the same pinned Open Sans regular face as the default keyword normal (debug/style.css:1-4).',
  'feature-labels-nodes nodes/events':
    'Pointer transparency changes pick answers, not pixels; the render pass still draws the labels (src/render/cull.mts:251-253,342; test/events-prop.mjs:33-38).',
  'feature-labels-nodes nodes/label-priority':
    'The six label samples occupy separate cells and their label rectangles do not overlap, so changing priority cannot alter culling order (debug/feature-scenes-labels.js).',
  'feature-labels-nodes nodes/min-zoomed-font-size':
    'The fitted screenshot stays above the authored 12 px floor, so resetting to 0 does not hide this label at the static capture zoom; zoom-out behavior is covered by playwright-tests/renderer.spec.js:9240 and test/min-zoomed-font-size.mjs (threshold: src/render/label-layer.mts:355-360).',
  'feature-labels-nodes nodes/text-events':
    'Label-box hit testing changes CPU pick routing, not pixels; the labels are still drawn (src/cpu-pick.mts:167-176; test/text-events.mjs:58-82).',
  'feature-paint-layers nodes/text-max-width':
    'The layer captions use explicit line breaks and each line fits inside the authored 138 px maximum (debug/feature-scenes-paint.js).',
  'feature-shapes-underlays nodes/text-max-width':
    'Each underlay sample has a short two-line shape caption that fits within the authored 125 px maximum (debug/feature-scenes-paint.js).',
  'label-border-styles edges/mid-source-arrow-width':
    'Mid heads are always filled and width only strokes hollow heads; v4 never renders a hollow mid head (src/README.md:8241-8250; PLAN.md item 21).',
  'label-border-styles edges/mid-target-arrow-width':
    'Mid heads are always filled and width only strokes hollow heads; v4 never renders a hollow mid head (src/README.md:8241-8250; PLAN.md item 21).',
  'self-loops edges/curve-style':
    'All edges are self-loops; v4 constructs loops as loops under every declared curve-style (src/README.md:3836-3844).',
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
  const keywordFailures = [];
  const keywordExceptions = [];
  const restoreLimitations = [];
  const staleKeywords = [];
  let keywordControls = 0;
  const seen = new Set();
  const exercised = new Set();

  const keywordId = (entry) =>
    JSON.stringify([
      entry.group,
      entry.property,
      entry.target,
      entry.targetIndex ?? null,
      entry.value,
      entry.alternate,
      entry.resolvedValue ?? null,
      entry.readbackLimitation ?? null,
      entry.controlMode ?? null,
      entry.exception ?? entry.reason ?? null,
    ]);

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

    const expectedKeywords = [
      ...(capture.featureCoverage?.keywords ?? []),
      ...(capture.featureCoverage?.exceptions ?? []),
    ];
    const actualKeywords = record.keywords ?? [];

    if (
      JSON.stringify(expectedKeywords.map(keywordId)) !==
      JSON.stringify(actualKeywords.map(keywordId))
    ) {
      staleKeywords.push(capture.golden);
    }

    for (const entry of actualKeywords) {
      if (entry.exception != null || entry.reason != null) {
        keywordExceptions.push(
          `${capture.golden} ${entry.property}=${entry.value}`,
        );
        continue;
      }

      keywordControls++;

      const restoreLimitation = (
        capture.featureCoverage?.restoreLimitations ?? []
      ).find(
        (row) =>
          row.group === entry.group &&
          row.property === entry.property &&
          row.target === entry.target &&
          row.value === entry.value &&
          row.alternate === entry.alternate,
      );
      const validRestoreLimitation =
        capture.golden === 'feature-labels-nodes' &&
        restoreLimitation != null &&
        restoreLimitation.group === 'nodes' &&
        restoreLimitation.property === 'font-style' &&
        restoreLimitation.target === 'label-left' &&
        restoreLimitation.value === 'normal' &&
        restoreLimitation.alternate === 'italic' &&
        Number.isFinite(restoreLimitation.observedResiduePixels) &&
        restoreLimitation.observedResiduePixels > 0 &&
        restoreLimitation.observedResiduePixels <= 256 &&
        restoreLimitation.route ===
          '?network=features&scene=labels&view=nodes' &&
        Array.isArray(restoreLimitation.sourceRefs) &&
        restoreLimitation.sourceRefs.some((ref) =>
          ref.includes('four pinned Open Sans faces loaded'),
        ) &&
        typeof restoreLimitation.reason === 'string' &&
        restoreLimitation.reason.length > 0;

      const scopedRestoreResidue =
        validRestoreLimitation &&
        Number.isInteger(entry.restoreMoved) &&
        entry.restoreMoved >= 0 &&
        entry.restoreMoved <= 256 &&
        (entry.residue ?? 0) === entry.restoreMoved;

      const validRestoreControl =
        validRestoreLimitation &&
        scopedRestoreResidue &&
        entry.matched === 1 &&
        entry.changed === 1 &&
        Number.isFinite(entry.moved) &&
        entry.moved > 0 &&
        (entry.unresettable?.length ?? 0) === 0 &&
        entry.unexpected == null &&
        entry.rejected == null &&
        (entry.lost?.length ?? 0) === 0;

      if (validRestoreControl && entry.restoreMoved > 0) {
        restoreLimitations.push({
          key: `${capture.golden} ${entry.group}/${entry.property}=${entry.value}`,
          pixels: entry.restoreMoved,
          maxPixels: 256,
          moved: entry.moved,
          matched: entry.matched,
          changed: entry.changed,
          route: restoreLimitation.route,
          reason: restoreLimitation.reason,
        });
      }

      const expectedMode =
        entry.controlMode === 'stylesheet'
          ? 'authored-declaration-and-stylesheet-readback'
          : entry.readbackLimitation != null
            ? 'authored-mapper-and-documented-getter-fallback'
            : entry.resolvedValue != null
              ? 'authored-declaration-and-resolved-getter'
              : null;
      const evidenceModeMismatch =
        expectedMode != null && entry.matchedBy !== expectedMode;
      const restoreMismatch =
        expectedMode != null &&
        entry.restoreMoved !== 0 &&
        !scopedRestoreResidue;
      const restoreLimitationMismatch =
        restoreLimitation != null &&
        (!validRestoreLimitation || !scopedRestoreResidue);

      if (
        entry.matched !== 1 ||
        entry.changed !== 1 ||
        !Number.isFinite(entry.moved) ||
        entry.moved < 1 ||
        evidenceModeMismatch ||
        restoreMismatch ||
        restoreLimitationMismatch ||
        (entry.unresettable?.length ?? 0) > 0 ||
        entry.unexpected != null ||
        entry.rejected != null ||
        (entry.lost?.length ?? 0) > 0 ||
        (entry.residue != null &&
          !scopedRestoreResidue &&
          restoreLimitation == null)
      ) {
        keywordFailures.push(
          `${capture.golden} ${entry.group}/${entry.property}=${entry.value}: ` +
            `matched ${entry.matched}, changed ${entry.changed}, moved ${entry.moved}` +
            (evidenceModeMismatch
              ? `, expected evidence mode ${expectedMode}, got ${entry.matchedBy ?? 'none'}`
              : '') +
            (restoreMismatch
              ? `, expected exact pixel restore, got ${entry.restoreMoved ?? 'no restore count'}`
              : '') +
            (restoreLimitationMismatch
              ? `, scoped restore residue must be 0–256 px with matching readback`
              : ''),
        );
      }
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
    staleKeywords,
    keywordFailures,
    keywordExceptions,
    restoreLimitations,
    counts: {
      pairs: moved.length + decoration.length + unmoved.length,
      moved: moved.length,
      decoration: decoration.length,
      unmoved: unmoved.length,
      exercised: exercised.size,
      seen: seen.size,
      unseen: unseen.length,
      keywordControls,
      keywordFailures: keywordFailures.length,
      keywordExceptions: keywordExceptions.length,
      restoreLimitations: restoreLimitations.length,
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
    core: Object.fromEntries(
      Object.entries(cy.style().core()).map(([key, value]) => [
        key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()),
        value,
      ]),
    ),
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
  console.log(
    `keyword controls: ${c.keywordControls} checked, ${c.keywordExceptions} ` +
      `explicit exceptions, ${c.restoreLimitations} scoped restore limitations, ` +
      `${c.keywordFailures} failed`,
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

    for (const r of report.restoreLimitations) {
      console.log(
        `    restore-limit ${r.key} — ${r.pixels}/${r.maxPixels} px; ${r.reason}`,
      );
    }
  }

  for (const [what, list] of [
    ['stale', report.stale],
    ['stale keyword coverage', report.staleKeywords],
    ['keyword failures', report.keywordFailures],
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
