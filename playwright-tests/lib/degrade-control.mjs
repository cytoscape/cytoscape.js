import fs from 'node:fs';
import path from 'node:path';
import { decodePng } from './image-diff.mjs';

/*
Round 143 (item 30, tier 2): the degrade control.

Tier 1 (round 135) records which style properties each golden sets to a
non-default value, and counts the properties no golden sets.  "Set" is
an upper bound on "seen": a property can carry a non-default value and
still move no pixel — painted over, zero-sized, gated off by another
property.  The degrade control measures the difference.  For each
(scene, property) pair tier 1 recorded, it resets that one property to
its default on every element that set it, re-exports the scene, and
counts the pixels that moved.  A pair that moves none is decoration in
that scene: deleting the property from the sheet would leave the golden
passing.

It runs inside the golden pass, from `checkGolden`, when
`DEGRADE_CONTROL=1` is set — after the PNG and the coverage record have
both matched, on the same live scene — and writes one record per golden
to `playwright-tests/golden-degrade/<name>.json`.  The Node tier
(`scripts/golden-coverage.mjs`, gated by `test/modules/golden-coverage.mjs`)
reads them: a record that no longer covers exactly its golden's
exercised pairs is stale, and the counts are pinned.

**The reset.**  The property is bypassed, per element, to the value a
default-sheet element of the same kind reads back (a leaf, a compound
parent — v3's `:parent` defaults — or an edge, the references tier 1
judged "non-default" against), which is the resolved value the element
would have if the sheet never named the property.  Only elements whose
value differs are touched.  The read-back is checked, so a value the
bypass cannot take is reported, not silently measured as zero.

**The restore is checked too.**  The bypass is removed (and an element
whose own value came from a scene bypass gets it back), every value is
read back, and the scene is re-exported.  A value that did not come back
stops the scene there — every pair after it would measure a different
scene — and the record says so.  A frame that did not quite come back
with every value restored (a background image re-decodes into another
atlas slot) is recorded as the pair's `residue`, and the pairs after it
are measured against the restored frame.

**Counting.**  Raw RGBA bytes, not pixelmatch — its anti-aliasing
detection would drop exactly the one-pixel fringes a thin border or
outline change moves.  Each export is repeated until two consecutive
ones agree, since a label change re-rasters the glyph atlas a frame or
more later.
*/

/** Where the records live (cwd-anchored, as `style-coverage.mjs`). */
export const DEGRADE_DIR = path.resolve(
  process.cwd(),
  'playwright-tests',
  'golden-degrade',
);

/** Element groups plus the two renderer-level core controls. */
export const DEGRADE_GROUPS = ['nodes', 'parents', 'edges', 'core'];

/** Valid alternate values for required chart properties; deleting either
 * would make the chart sheet invalid before pixels could be compared. */
export const DEGRADE_ALTERNATES = {
  'background-gradient-stop-positions': '0% 23% 100%',
  'line-gradient-stop-positions': '0% 77% 100%',
  'chart-domain': [-8, 8],
  'chart-colors': ['#ff00ff', '#00ffff', '#ffff00', '#101010'],
  'chart-scale': {
    domain: [-2, 0, 4],
    range: ['#2166ac', '#f7f7f7', '#b2182b'],
  },
};

/** The (group, property) pairs a coverage record exercises. */
export const pairsOf = (coverage) =>
  DEGRADE_GROUPS.flatMap((group) =>
    Object.keys(coverage[group] ?? {})
      .sort()
      .map((prop) => `${group}/${prop}`),
  );

/** Pixels whose RGBA bytes differ between two decoded PNGs of one size. */
export const countMoved = (a, b) => {
  if (a.width !== b.width || a.height !== b.height) {
    return a.width * a.height;
  }

  let n = 0;

  for (let i = 0; i < a.data.length; i += 4) {
    if (
      a.data[i] !== b.data[i] ||
      a.data[i + 1] !== b.data[i + 1] ||
      a.data[i + 2] !== b.data[i + 2] ||
      a.data[i + 3] !== b.data[i + 3]
    ) {
      n++;
    }
  }

  return n;
};

/**
 * Reset one property to its default on the group's elements.  **Runs in
 * the page** (self-contained, against `window.cy` and
 * `window.cytoscape`), and leaves what it changed in `window.__degrade`
 * for {@link restoreInPage}.
 *
 * Per-element bypasses first.  A few properties refuse one — the label
 * font is global (one glyph atlas), and a default that reads back as
 * `''` (no gradient stops, no colour scheme) is not a value a bypass
 * accepts — and those are reset in the sheet instead: the property is
 * deleted from the group's block (every condition in it included) and
 * from the scene's bypasses, and the sheet is re-set.
 *
 * @returns `{ changed, via, unresettable }` — the elements touched (for
 *   the sheet path, those whose value moved), `'bypass'` or `'sheet'`,
 *   and the ids whose value the reset did not move
 */
export const resetInPage = ({ group, prop, alternates }) => {
  const cy = globalThis.cy;
  const text = (v) => (typeof v === 'string' ? v : JSON.stringify(v));

  // Core styles have no elements to bypass. Remove the selected entry
  // from the core sheet and compare the renderer's resolved scalar. This
  // also gives dim-opacity a real pixel control when emphasis is active
  // and label-declutter one when labels overlap.
  if (group === 'core') {
    const camel = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const before = cy.style().core()[camel];
    const sheet = cy.style().json();
    const next = {
      ...sheet,
      core: { ...(sheet.core ?? {}) },
    };
    const saved = {
      sheet,
      readbacks: [
        { group: 'core', property: prop, target: 'core', value: before },
      ],
    };

    delete next.core[prop];
    globalThis.__degrade = saved;

    try {
      cy.style(next);
    } catch (error) {
      return {
        changed: 0,
        via: 'sheet',
        unresettable: [],
        rejected: error instanceof Error ? error.message : String(error),
      };
    }

    const after = cy.style().core()[camel];

    return {
      changed: text(before) === text(after) ? 0 : 1,
      via: 'sheet',
      unresettable: text(before) !== text(after) ? [] : ['core'],
    };
  }

  const ref = globalThis.cytoscape({
    elements: [
      { data: { id: 'p' } },
      { data: { id: 'c', parent: 'p' } },
      { data: { id: 'n' } },
      { data: { id: 'e', source: 'c', target: 'n' } },
    ],
  });
  const read = (id) => {
    try {
      return ref.$id(id).style(prop);
    } catch {
      return undefined; // a property the kind does not read
    }
  };
  const defaults = { leaf: read('n'), parent: read('p'), edge: read('e') };

  ref.destroy();

  const eles =
    group === 'edges'
      ? cy.edges()
      : group === 'parents'
        ? cy.nodes().filter((n) => n.isParent())
        : cy.nodes();

  // Parent-only properties cannot be installed as per-element bypasses.
  // Change just the parent block in the live sheet and compare the exact
  // group readbacks; restoreInPage reinstalls the saved sheet afterwards.
  if (group === 'parents') {
    const sheet = cy.style().json();
    const before = new Map();
    eles.forEach((ele) => before.set(ele.id(), text(ele.style(prop))));
    const affected = [...before].filter(
      ([, value]) => value !== text(defaults.parent),
    );
    const parentStyle = { ...(sheet.parents ?? {}) };

    delete parentStyle[prop];
    globalThis.__degrade = {
      sheet,
      readbacks: [...before].map(([target, value]) => ({
        group,
        property: prop,
        target,
        value,
      })),
    };

    try {
      cy.style({ ...sheet, parents: parentStyle });
    } catch (error) {
      return {
        changed: affected.length,
        via: 'bypass',
        unresettable: affected.map(([id]) => id),
        rejected: error instanceof Error ? error.message : String(error),
      };
    }

    const changed = affected.filter(
      ([id, value]) => text(cy.$id(id).style(prop)) !== value,
    ).length;
    const unresettable = affected
      .filter(([id, value]) => text(cy.$id(id).style(prop)) === value)
      .map(([id]) => id);
    return { changed, via: 'sheet', unresettable };
  }

  // A heat chart's palette is resolved from chart-scale. It reads back as
  // chart-colors but the renderer correctly rejects setting chart-colors on
  // that chart kind; this readback is derived and cannot be reset directly.
  if (group === 'nodes' && prop === 'chart-colors') {
    const sheet = cy.style().json();
    const derived = eles.filter((ele) => {
      const chart = String(ele.style('chart'));
      return chart.includes('heat') && sheet.nodes?.['chart-colors'] == null;
    });

    if (derived.length > 0) {
      globalThis.__degrade = { prop, saved: [] };
      return {
        changed: derived.length,
        via: 'bypass',
        unresettable: derived.map((ele) => ele.id()),
        rejected:
          'heat chart palette is derived from chart-scale; chart-colors cannot be set on this chart kind',
      };
    }
  }

  if (prop in alternates) {
    const alternate = alternates[prop];
    const saved = [];
    const unresettable = [];

    eles.forEach((ele) => {
      const cur = ele.style(prop);

      if (cur == null || cur === '' || text(cur) === '[]') return;

      saved.push({ ele, cur });
      ele.style(prop, alternate);

      if (text(ele.style(prop)) === text(cur)) {
        unresettable.push(ele.id());
      }
    });

    globalThis.__degrade = { prop, saved };

    return {
      changed: saved.length,
      via: 'alternate',
      alternate,
      unresettable,
    };
  }

  const defOf = (ele) =>
    ele.isEdge()
      ? defaults.edge
      : ele.isParent()
        ? defaults.parent
        : defaults.leaf;
  const saved = [];
  const unresettable = [];

  try {
    eles.forEach((ele) => {
      const def = defOf(ele);
      const cur = ele.style(prop);

      if (text(cur) === text(def)) {
        return;
      }

      if (def === undefined) {
        // a property the default leaves unset (a straight edge's control
        // points): nothing to bypass it to, so the sheet path unsets it
        throw new Error(`no default value for '${prop}'`);
      }

      const authoredBypasses =
        globalThis.__goldenSourceScene?.style?.bypasses?.[ele.id()] ?? {};

      saved.push({
        ele,
        cur,
        hasAuthoredBypass: Object.hasOwn(authoredBypasses, prop),
        authoredBypass: authoredBypasses[prop],
      });
      ele.style(prop, def);

      // a reset that reads back unchanged did not take; the read-back is
      // not compared with the default, since some reads fold an opacity
      // in (a labelled element's label-box colours)
      if (text(ele.style(prop)) === text(cur)) {
        unresettable.push(ele.id());
      }
    });

    globalThis.__degrade = { prop, saved };

    return { changed: saved.length, via: 'bypass', unresettable };
  } catch {
    // the bypass refused: undo what it took, and reset in the sheet
    for (const { ele } of saved) {
      ele.removeStyle(prop);
    }
  }

  const before = new Map();

  eles.forEach((ele) => before.set(ele.id(), text(ele.style(prop))));

  const sheet = cy.style().json();
  const strip = (o) => {
    if (Array.isArray(o)) {
      return o.map(strip);
    }

    if (o != null && typeof o === 'object') {
      const out = {};

      for (const [k, v] of Object.entries(o)) {
        if (k !== prop) {
          out[k] = strip(v);
        }
      }

      return out;
    }

    return o;
  };
  const next = { ...sheet };

  for (const block of ['nodes', 'parents', 'edges', 'bypasses']) {
    if (sheet[block] != null) {
      next[block] = strip(sheet[block]);
    }
  }

  globalThis.__degrade = {
    sheet,
    readbacks: [...before].map(([target, value]) => ({
      group,
      property: prop,
      target,
      value,
    })),
  };

  try {
    cy.style(next);
  } catch (error) {
    // A required chart scale/domain has no valid reset value.  The compiler
    // rejects the stripped sheet atomically; record that contract and let the
    // normal restore path put the original sheet back before measuring next.
    const rejected = error instanceof Error ? error.message : String(error);

    return { changed: 0, via: 'sheet', unresettable, rejected };
  }

  let changed = 0;

  eles.forEach((ele) => {
    const was = before.get(ele.id());
    const now = text(ele.style(prop));

    if (now !== was) {
      changed++;
    } else if (was !== text(defOf(ele))) {
      unresettable.push(ele.id()); // it had a value and still has it
    }
  });

  return { changed, via: 'sheet', unresettable };
};

/**
 * Undo {@link resetInPage}: remove the bypass, and give back a scene
 * bypass the removal took with it — or re-set the sheet the sheet path
 * replaced.  **Runs in the page.**
 *
 * @returns the ids whose value could not be put back
 */
export const restoreInPage = () => {
  const state = globalThis.__degrade;
  const text = (v) => (typeof v === 'string' ? v : JSON.stringify(v));
  const lost = [];

  globalThis.__degrade = null;

  if (state.sheet != null) {
    globalThis.cy.style(state.sheet);

    for (const row of state.readbacks ?? []) {
      const actual =
        row.group === 'core'
          ? globalThis.cy.style().core()[
              row.property.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
            ]
          : globalThis.cy.$id(row.target).style(row.property);

      if (text(actual) !== text(row.value)) {
        lost.push(row.target);
      }
    }

    return lost;
  }

  const { prop, saved, readbackLimitation } = state;

  for (const { ele, cur, hasAuthoredBypass, authoredBypass } of saved) {
    ele.removeStyle(prop);

    if (hasAuthoredBypass) {
      ele.style(prop, authoredBypass);
    }

    if (text(ele.style(prop)) !== text(cur)) {
      lost.push(ele.id());
    }

    if (readbackLimitation?.target === ele.id()) {
      const sheet = globalThis.cy.style().json();
      const mapping = sheet[readbackLimitation.group]?.[prop];
      const actual =
        mapping != null &&
        typeof mapping === 'object' &&
        typeof mapping.data === 'string'
          ? ele.data(mapping.data)
          : undefined;
      const bypass = sheet.bypasses?.[ele.id()];

      if (
        mapping?.data !== readbackLimitation.dataKey ||
        text(actual) !== text(readbackLimitation.mappedValue) ||
        (bypass != null && Object.hasOwn(bypass, prop))
      ) {
        lost.push(ele.id());
      }
    }
  }

  return lost;
};

/** Capture the value and authored source for a restore attempt before it is undone. */
const restoreEvidenceInPage = ({ group, prop }) => {
  const state = globalThis.__degrade;
  const sourceStyle = globalThis.__goldenSourceScene?.style ?? {};
  const saved =
    state?.saved?.map(({ ele, cur }) => ({ target: ele.id(), value: cur })) ??
    state?.readbacks ??
    [];

  return {
    group,
    property: prop,
    saved: saved.map((row) => {
      const target = String(row.target);
      const authored = sourceStyle.bypasses?.[target]?.[prop];

      return {
        target,
        expected: row.value,
        authoredBypass: authored,
        authoredGroup: sourceStyle[group]?.[prop],
      };
    }),
  };
};

/** Read back the values that a restore attempt could not reinstate. */
const restoredEvidenceInPage = ({ group, property, targets }) =>
  targets.map((target) => {
    const actual =
      group === 'core'
        ? globalThis.cy.style().core()[
            property.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
          ]
        : globalThis.cy.$id(target).style(property);

    return { target, restored: actual };
  });

/** Reset one metadata-declared enum value without touching other cells. */
export const resetKeywordInPage = ({
  group,
  property,
  target,
  targetIndex,
  value,
  resolvedValue,
  readbackLimitation,
  controlMode,
  alternate,
}) => {
  const cy = globalThis.cy;
  const text = (v) => (typeof v === 'string' ? v : JSON.stringify(v));
  const coreCodes = { 'label-declutter': { none: 0, cull: 1 } };
  const coreValue = (keyword) => coreCodes[property]?.[keyword] ?? keyword;
  const expectedReadback = resolvedValue ?? value;
  const matchedBy =
    readbackLimitation != null
      ? 'authored-mapper-and-documented-getter-fallback'
      : resolvedValue != null
        ? 'authored-declaration-and-resolved-getter'
        : 'authored-value-and-style-getter';
  const currentSheet = cy.style().json();
  const sourceScene = globalThis.__goldenSourceScene;
  const authoredSheet = sourceScene?.style ?? currentSheet;
  const authoredBypass = authoredSheet.bypasses?.[String(target)];
  const declaration =
    group === 'core'
      ? authoredSheet.core?.[property]
      : authoredBypass != null && Object.hasOwn(authoredBypass, property)
        ? authoredBypass[property]
        : authoredSheet[group]?.[property];
  const declarationElement = group === 'core' ? null : cy.$id(String(target));
  const sourceElement = (sourceScene?.elements?.nodes ?? [])
    .concat(sourceScene?.elements?.edges ?? [])
    .find((element) => String(element.data?.id) === String(target));
  const authoredDeclaration =
    declaration != null &&
    typeof declaration === 'object' &&
    !Array.isArray(declaration) &&
    typeof declaration.data === 'string'
      ? sourceElement != null
        ? sourceElement.data?.[declaration.data]
        : declarationElement?.data(declaration.data)
      : declaration;
  const authoredTokens =
    targetIndex == null
      ? null
      : Array.isArray(authoredDeclaration)
        ? authoredDeclaration
        : String(authoredDeclaration ?? '')
            .trim()
            .split(/\s+/)
            .filter(Boolean);
  const selectedAuthoredDeclaration =
    targetIndex == null ? authoredDeclaration : authoredTokens?.[targetIndex];
  const authoredDeclarationMatches =
    selectedAuthoredDeclaration != null &&
    (targetIndex != null
      ? text(selectedAuthoredDeclaration) === text(value)
      : Array.isArray(selectedAuthoredDeclaration)
        ? selectedAuthoredDeclaration.some((part) => text(part) === text(value))
        : text(selectedAuthoredDeclaration) === text(value));
  const needsAuthoredDeclaration =
    resolvedValue !== undefined || readbackLimitation != null;

  if (controlMode === 'stylesheet') {
    const sheet = cy.style().json();
    const element = group === 'core' ? null : cy.$id(String(target));
    const before =
      group === 'core'
        ? cy.style().core()[
            property.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
          ]
        : element.length === 1
          ? element.style(property)
          : undefined;

    if (
      (needsAuthoredDeclaration && !authoredDeclarationMatches) ||
      text(before) !== text(expectedReadback)
    ) {
      globalThis.__degrade = { prop: property, saved: [] };
      return { matched: 0, changed: 0, unexpected: before, unresettable: [] };
    }

    const sourceGroup = sourceScene?.style?.[group] ?? sheet[group] ?? {};
    globalThis.__degrade = {
      sheet,
      readbacks: [
        {
          group,
          property,
          target: group === 'core' ? 'core' : String(target),
          value: before,
        },
      ],
    };

    try {
      cy.style({
        ...sheet,
        [group]: {
          ...(sheet[group] ?? {}),
          ...sourceGroup,
          [property]: alternate,
        },
      });
    } catch (error) {
      return {
        matched: 1,
        changed: 0,
        rejected: error instanceof Error ? error.message : String(error),
        unresettable: [String(target)],
      };
    }

    const installed = cy.style().json()[group]?.[property];
    const installedTokens = Array.isArray(installed)
      ? installed.map(String).join(' ')
      : installed;
    const alternateTokens = Array.isArray(alternate)
      ? alternate.map(String).join(' ')
      : alternate;
    const changed = text(installedTokens) === text(alternateTokens) ? 1 : 0;

    return {
      matched: 1,
      changed,
      ...(needsAuthoredDeclaration
        ? { matchedBy: 'authored-declaration-and-stylesheet-readback' }
        : {}),
      controlMode,
      scope: 'authored stylesheet replacement',
      unresettable: changed === 1 ? [] : [String(target)],
    };
  }

  if (group === 'core') {
    const sheet = cy.style().json();
    const camel = property.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const before = cy.style().core()[camel];

    if (
      (needsAuthoredDeclaration && !authoredDeclarationMatches) ||
      text(before) !== text(coreValue(expectedReadback))
    ) {
      globalThis.__degrade = { prop: property, saved: [] };

      return {
        matched: 0,
        changed: 0,
        unexpected: before,
        unresettable: [],
      };
    }

    const next = {
      ...sheet,
      core: { ...(sheet.core ?? {}), [property]: alternate },
    };

    globalThis.__degrade = {
      sheet,
      readbacks: [{ group, property, target: 'core', value: before }],
    };
    try {
      cy.style(next);
    } catch (error) {
      return {
        matched: 1,
        changed: 0,
        rejected: error instanceof Error ? error.message : String(error),
        unresettable: ['core'],
      };
    }

    const after = cy.style().core()[camel];
    const changed = text(after) === text(coreValue(alternate)) ? 1 : 0;

    return {
      matched: 1,
      changed,
      ...(needsAuthoredDeclaration ? { matchedBy } : {}),
      unresettable: changed === 1 ? [] : ['core'],
    };
  }

  // The glyph atlas has one font for the whole instance, so font-family,
  // font-style, and font-weight deliberately reject element bypasses. For
  // these properties reset the matching authored sheet values and restore
  // the full sheet after exporting the alternate frame.
  if (
    group !== 'edges' &&
    ['font-family', 'font-style', 'font-weight'].includes(property)
  ) {
    const sheet = cy.style().json();
    const ele = cy.$id(target);
    const before = ele.length === 1 ? ele.style(property) : undefined;

    if (
      (needsAuthoredDeclaration && !authoredDeclarationMatches) ||
      String(before) !== String(expectedReadback)
    ) {
      globalThis.__degrade = { prop: property, saved: [] };

      return {
        matched: 0,
        changed: 0,
        unexpected: before,
        unresettable: [],
      };
    }

    let changedRules = 0;
    const replace = (entry) => {
      if (Array.isArray(entry)) return entry.map(replace);
      if (entry == null || typeof entry !== 'object') return entry;

      const out = {};

      for (const [key, current] of Object.entries(entry)) {
        if (key === property && String(current) === String(value)) {
          out[key] = alternate;
          changedRules++;
        } else {
          out[key] = replace(current);
        }
      }

      return out;
    };

    const next = replace(sheet);
    globalThis.__degrade = {
      sheet,
      readbacks: [{ group, property, target, value: before }],
    };

    try {
      cy.style(next);
    } catch (error) {
      return {
        matched: 1,
        changed: 0,
        rejected: error instanceof Error ? error.message : String(error),
        unresettable: ['sheet'],
      };
    }

    const after = cy.$id(target).style(property);
    const changed = String(after) === String(alternate) ? 1 : 0;

    return {
      matched: 1,
      changed,
      ...(needsAuthoredDeclaration ? { matchedBy } : {}),
      changedRules,
      unresettable: changed === 1 ? [] : [target],
    };
  }

  const ele = cy.$id(target);
  const validGroup =
    ele.length === 1 &&
    (group === 'edges'
      ? ele.isEdge()
      : ele.isNode() && (group !== 'parents' || ele.isParent()));

  if (!validGroup) {
    globalThis.__degrade = { prop: property, saved: [] };

    return {
      matched: 0,
      changed: 0,
      unexpected: `target '${target}' is not a ${group} element`,
      unresettable: [],
    };
  }

  const parentOnly = new Set([
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
  ]);

  if (group === 'parents' && parentOnly.has(property)) {
    const sheet = cy.style().json();
    const before = ele.style(property);
    if (
      (needsAuthoredDeclaration && !authoredDeclarationMatches) ||
      text(before) !== text(expectedReadback)
    ) {
      globalThis.__degrade = { prop: property, saved: [] };
      return { matched: 0, changed: 0, unexpected: before, unresettable: [] };
    }

    globalThis.__degrade = {
      sheet,
      readbacks: [{ group, property, target, value: before }],
    };
    try {
      const parentStyle = sourceScene?.style?.parents ?? sheet.parents ?? {};
      cy.style({
        ...sheet,
        parents: { ...parentStyle, [property]: alternate },
      });
    } catch (error) {
      return {
        matched: 1,
        changed: 0,
        rejected: error instanceof Error ? error.message : String(error),
        unresettable: [target],
      };
    }

    const after = ele.style(property);
    const changed = text(after) === text(alternate) ? 1 : 0;
    return {
      matched: 1,
      changed,
      ...(needsAuthoredDeclaration ? { matchedBy } : {}),
      scope: 'parents stylesheet group',
      unresettable: changed === 1 ? [] : [target],
    };
  }

  const before = ele.style(property);
  const beforeTokens = String(before).trim().split(/\s+/).filter(Boolean);
  const index = Number.isInteger(targetIndex) ? targetIndex : null;
  const actual = index == null ? before : beforeTokens[index];
  let limitationIsValid = readbackLimitation == null;

  if (readbackLimitation != null) {
    const limitation = readbackLimitation;
    const sheetValue = cy.style().json()[group]?.[property];
    const mappedValue =
      sheetValue != null &&
      typeof sheetValue === 'object' &&
      typeof sheetValue.data === 'string'
        ? ele.data(sheetValue.data)
        : undefined;
    const documentedGetter = limitation.getterValue ?? limitation.resolvedValue;

    limitationIsValid =
      authoredDeclarationMatches &&
      limitation.property === property &&
      text(limitation.mappedValue) === text(value) &&
      text(mappedValue) === text(value) &&
      text(actual) === text(documentedGetter) &&
      (resolvedValue === undefined ||
        text(resolvedValue) === text(documentedGetter));
  }

  if (
    (needsAuthoredDeclaration && !authoredDeclarationMatches) ||
    !limitationIsValid ||
    (readbackLimitation == null && text(actual) !== text(expectedReadback))
  ) {
    globalThis.__degrade = { prop: property, saved: [] };

    return {
      matched: 0,
      changed: 0,
      unexpected:
        readbackLimitation == null
          ? actual
          : `authored mapper or documented fallback mismatch (getter: ${text(actual)})`,
      unresettable: [],
    };
  }

  let next = alternate;

  if (index != null) {
    const afterTokens = [...beforeTokens];

    afterTokens[index] = alternate;
    next = afterTokens.join(' ');
  }

  globalThis.__degrade = {
    prop: property,
    saved: [{ ele, cur: before }],
    ...(readbackLimitation == null
      ? {}
      : {
          readbackLimitation: {
            group,
            target,
            dataKey: declaration.data,
            mappedValue: value,
          },
        }),
  };
  ele.style(property, next);

  const after = ele.style(property);
  const afterTokens = String(after).trim().split(/\s+/).filter(Boolean);
  const resetValue = index == null ? after : afterTokens[index];
  const afterBypasses = cy.style().json().bypasses?.[String(target)];
  const changed =
    readbackLimitation != null
      ? text(afterBypasses?.[property]) === text(next)
        ? 1
        : 0
      : text(resetValue) === text(alternate)
        ? 1
        : 0;

  return {
    matched: 1,
    changed,
    matchedBy,
    ...(readbackLimitation == null ? {} : { readbackLimitation }),
    unresettable: changed === 1 ? [] : [target],
  };
};

/**
 * Export until two consecutive exports agree (a label change re-rasters
 * the atlas a frame or more later), and decode it.
 */
export const captureSurface = async (page, opts) => {
  const gesture = opts.captureGesture;

  if (gesture == null) {
    return await page.locator(opts.captureSelector).screenshot();
  }

  // Core gesture styles are painted by short-lived DOM overlays. Replaying
  // the input for each baseline/degraded/restored frame makes the screenshot
  // exercise the currently installed core sheet, rather than the inline
  // style captured when a previous press began.
  await page.mouse.up();
  await page.keyboard.up('Shift');

  try {
    if (gesture.type === 'active-bg') {
      await page.mouse.move(gesture.x, gesture.y);
      await page.mouse.down();
    } else if (gesture.type === 'selection-box') {
      await page.keyboard.down('Shift');
      await page.mouse.move(gesture.x1, gesture.y1);
      await page.mouse.down();
      await page.mouse.move(gesture.x2, gesture.y2, { steps: 8 });
    } else {
      throw new Error(`Unknown screenshot gesture '${gesture.type}'`);
    }

    await page.waitForFunction(
      ({ selector, type }) => {
        const root = document.querySelector(selector);

        if (root == null) return false;

        return [...root.children].some((element) => {
          const style = element.style;

          if (style.display !== 'block') return false;

          return type === 'active-bg'
            ? style.borderRadius === '50%'
            : style.border.includes('solid');
        });
      },
      { selector: opts.captureSelector, type: gesture.type },
      { timeout: 5000 },
    );

    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => resolve())),
    );

    return await page.locator(opts.captureSelector).screenshot();
  } finally {
    await page.mouse.up();

    if (gesture.type === 'selection-box') {
      await page.keyboard.up('Shift');
    }
  }
};

export const stableExport = async (page, opts) => {
  let last = null;

  for (let i = 0; i < 6; i++) {
    // A restored background image is re-decoded asynchronously. Wait for
    // that registry work to settle before comparing its frame; two equal
    // early exports can both miss the restored image.
    await page.waitForFunction(
      () => window.cy?._store?.images?.pendingCount?.() === 0,
      null,
      { timeout: 10000 },
    );

    let png;

    if (opts.captureSelector != null) {
      png = decodePng(await captureSurface(page, opts));
    } else {
      png = decodePng(
        await page.evaluate(async (opts) => {
          for (let k = 0; k < 2; k++) {
            await new Promise((resolve) => requestAnimationFrame(resolve));
          }

          return await window.cy.png(opts);
        }, opts),
      );
    }

    if (last != null && countMoved(last, png) === 0) {
      return png;
    }

    last = png;
  }

  return last;
};

/**
 * Run the degrade control over one golden's live scene and write its
 * record.
 *
 * @param page — the Playwright page, the golden's scene live on it
 * @param name — the golden's name
 * @param coverage — its tier-1 capture (`collectStyleCoverage`'s result)
 * @param opts — the export options the golden used
 * @returns the record written
 */
export const degradeScene = async (
  page,
  name,
  coverage,
  opts,
  sceneCoverage = null,
) => {
  let baseline = await stableExport(page, opts);
  const pairs = {};
  const keywordTargets = [];
  let stopped = null;

  for (const pair of pairsOf(coverage)) {
    const [group, prop] = pair.split('/');
    const { changed, via, unresettable, rejected, alternate } =
      await page.evaluate(resetInPage, {
        group,
        prop,
        alternates: DEGRADE_ALTERNATES,
      });
    const degraded = await stableExport(page, opts);
    const moved = countMoved(baseline, degraded);
    const restoreEvidence = await page.evaluate(restoreEvidenceInPage, {
      group,
      prop,
    });
    const lost = await page.evaluate(restoreInPage);
    // a restored image re-decodes asynchronously, so the scene may take
    // a moment to come back; poll, and give up only on a real residue
    const deadline = Date.now() + 5000;
    let back = countMoved(baseline, await stableExport(page, opts));

    while (back > 0 && Date.now() < deadline) {
      await page.waitForTimeout(100);
      back = countMoved(baseline, await stableExport(page, opts));
    }

    pairs[pair] = { moved, elements: changed };

    if (via !== 'bypass') {
      pairs[pair].via = via;
    }

    if (unresettable.length > 0) {
      pairs[pair].unresettable = unresettable;
    }

    if (rejected != null) {
      pairs[pair].rejected = rejected;
    }

    if (alternate != null) {
      pairs[pair].alternate = alternate;
    }

    if (lost.length > 0) {
      stopped = `${pair}: the restore lost ${lost.length} values`;
      pairs[pair].restoreFailure = {
        ...restoreEvidence,
        lost: await page.evaluate(restoredEvidenceInPage, {
          group,
          property: prop,
          targets: lost,
        }),
      };
      break;
    }

    if (back > 0) {
      // every value came back and the frame did not, quite (a restored
      // image re-decodes into another atlas slot): measure what follows
      // against the restored frame, and say so
      pairs[pair].residue = back;
      baseline = await stableExport(page, opts);
    }
  }

  const keywordEntries = [
    ...(sceneCoverage?.keywords ?? []),
    ...(sceneCoverage?.exceptions ?? []),
  ];

  for (const entry of keywordEntries) {
    const exception = entry.exception ?? entry.reason;

    if (exception != null) {
      keywordTargets.push({ ...entry, exception });
      continue;
    }

    const {
      matched,
      changed,
      matchedBy,
      readbackLimitation,
      controlMode,
      unresettable,
      unexpected,
      rejected,
      scope,
    } = await page.evaluate(resetKeywordInPage, entry);
    const degraded = await stableExport(page, opts);
    const moved = countMoved(baseline, degraded);
    const restoreEvidence = await page.evaluate(restoreEvidenceInPage, {
      group: entry.group,
      prop: entry.property,
    });
    const lost = await page.evaluate(restoreInPage);
    const deadline = Date.now() + 5000;
    let back = countMoved(baseline, await stableExport(page, opts));

    while (back > 0 && Date.now() < deadline) {
      await page.waitForTimeout(100);
      back = countMoved(baseline, await stableExport(page, opts));
    }

    keywordTargets.push({
      group: entry.group,
      property: entry.property,
      target: entry.target,
      ...(entry.targetIndex == null ? {} : { targetIndex: entry.targetIndex }),
      value: entry.value,
      alternate: entry.alternate,
      matched,
      changed,
      moved,
      ...(entry.resolvedValue == null
        ? {}
        : { resolvedValue: entry.resolvedValue }),
      ...(matchedBy == null ? {} : { matchedBy }),
      ...(readbackLimitation == null ? {} : { readbackLimitation }),
      ...(controlMode == null ? {} : { controlMode }),
      ...(entry.resolvedValue == null && readbackLimitation == null
        ? {}
        : { restoreMoved: back }),
      ...(unexpected == null ? {} : { unexpected }),
      ...(rejected == null ? {} : { rejected }),
      ...(scope == null ? {} : { scope }),
      ...(unresettable.length > 0 ? { unresettable } : {}),
      ...(lost.length > 0 ? { lost } : {}),
      ...(back > 0 ? { residue: back } : {}),
    });

    if (lost.length > 0) {
      stopped =
        `${entry.group}/${entry.property}=${String(entry.value)}: ` +
        `the keyword restore lost ${lost.length} values`;
      keywordTargets[keywordTargets.length - 1].restoreFailure = {
        ...restoreEvidence,
        lost: await page.evaluate(restoredEvidenceInPage, {
          group: entry.group,
          property: entry.property,
          targets: lost,
        }),
      };
      break;
    }

    if (back > 0) baseline = await stableExport(page, opts);
  }

  const record = {
    golden: name,
    pixels: baseline.width * baseline.height,
    pairs,
    keywords: keywordTargets,
    ...(stopped != null ? { stopped } : {}),
  };

  fs.mkdirSync(DEGRADE_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(DEGRADE_DIR, `${name}.json`),
    JSON.stringify(record, null, 2) + '\n',
  );

  return record;
};
