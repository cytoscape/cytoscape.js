// Source-derived manual examples for Round 149's full feature audit.
//
// Run `node --import tsx scripts/demo-coverage.mjs --verbose` to compare the
// examples against the stylesheet schema.  The manifest is checked in at
// `docs/demo-coverage.json` and refreshed with `--write` after a scene changes.

import { readFileSync, writeFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import cytoscape from '../src/index.mjs';
import {
  ALIASES,
  INTENDED_DECORATION,
  KEYWORD_READBACK,
  NO_STATIC_PIXELS,
  UNMOVABLE,
  loadCaptures,
  loadDegrades,
  measure,
  keywordsOf,
} from './golden-coverage.mjs';

const ROOT = new URL('..', import.meta.url);
const require = createRequire(import.meta.url);
const GROUPS = ['nodes', 'parents', 'edges', 'core'];
const LEGACY = [
  'node-types',
  'edge-types',
  'edge-arrows',
  'labels',
  'v3-default',
];

const readSource = (path) => readFileSync(new URL(path, ROOT), 'utf8');

const loadGlobal = (name) => {
  const context = createContext({
    module: { exports: {} },
    console,
    TextDecoder,
    URL,
  });
  runInContext(readSource(`debug/${name}.js`), context);
  return context.module.exports;
};

const loadWorkflows = () => {
  const context = createContext({
    module: { exports: {} },
    cytoscape,
    console,
    TextDecoder,
    URL,
    clearInterval,
    clearTimeout,
    setInterval,
    setTimeout,
  });

  for (const name of [
    'workflow-ui',
    'workflow-algorithms',
    'workflow-panels',
    'workflow-visual-panels',
    'workflow-runtime-panels',
    'feature-workflows',
  ]) {
    runInContext(readSource(`debug/${name}.js`), context);
  }

  return context.module.exports;
};

const featureScenes = require('../debug/feature-scenes.js');
const fixtures = loadGlobal('fixtures');
const networks = loadGlobal('networks');
const styles = loadGlobal('styles');
const workflows = loadWorkflows();

const kebabToCamel = (name) =>
  name.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());

const jsonValue = (value) => {
  if (ArrayBuffer.isView(value)) return Array.from(value, jsonValue);
  if (Array.isArray(value)) return value.map(jsonValue);
  if (value != null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, jsonValue(value[key])]),
    );
  }
  return value;
};

const valueKey = (value) => JSON.stringify(jsonValue(value));

const sameValue = (actual, expected) => {
  if (actual == null || expected == null) return actual === expected;

  const a = Number(actual);
  const b = Number(expected);
  if (
    Number.isFinite(a) &&
    Number.isFinite(b) &&
    String(actual).trim() !== '' &&
    String(expected).trim() !== ''
  ) {
    return Math.abs(a - b) < 1e-8;
  }

  return valueKey(actual) === valueKey(expected);
};

const colorChannels = (value) => {
  const text = String(value).trim();
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(text);

  if (hex) {
    const chars =
      hex[1].length === 3
        ? [...hex[1]].map((char) => char + char)
        : hex[1].match(/../g);
    return chars.map((part) => Number.parseInt(part, 16));
  }

  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(text);
  return rgb ? rgb.slice(1, 4).map(Number) : null;
};

const colorValues = (value) => {
  if (Array.isArray(value)) return value.map(colorChannels);
  const matches = String(value).match(/rgba?\([^)]*\)|#[\da-f]{3,8}\b/gi);
  return matches == null ? [colorChannels(value)] : matches.map(colorChannels);
};

const numberParts = (value) => {
  if (Array.isArray(value)) return value.map(Number);
  if (typeof value === 'number') return [value];
  return (
    String(value)
      .match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi)
      ?.map(Number) ?? []
  );
};

const resolvedMatches = (cy, row, actual) => {
  if (row.readbackLimitation != null) {
    const limitation = row.readbackLimitation;
    if (
      limitation.property !== row.property ||
      !sameValue(limitation.mappedValue, row.value)
    )
      return false;

    const sheetValue = cy.style().json()[row.group]?.[row.property];
    const target = cy.$id(String(row.target));
    const mappedValue =
      sheetValue != null &&
      typeof sheetValue === 'object' &&
      typeof sheetValue.data === 'string'
        ? target.data(sheetValue.data)
        : sheetValue;
    if (!sameValue(mappedValue, limitation.mappedValue)) return false;
  }

  const readbackValue =
    row.resolvedValue ??
    row.readbackLimitation?.getterValue ??
    row.readbackLimitation?.resolvedValue;
  if (readbackValue !== undefined) {
    return sameValue(actual, readbackValue);
  }

  const alias = ALIASES[row.property]?.[String(row.value)];
  const readback = KEYWORD_READBACK[row.property]?.[String(row.value)];
  const expected = alias ?? readback ?? row.value;

  if (
    expected != null &&
    typeof expected === 'object' &&
    !Array.isArray(expected)
  ) {
    try {
      const parsed = typeof actual === 'string' ? JSON.parse(actual) : actual;
      return sameValue(parsed, expected);
    } catch {
      return false;
    }
  }

  if (String(row.property).includes('color')) {
    const expectedColors = colorValues(expected);
    const actualColors = colorValues(actual);
    return (
      expectedColors.length <= actualColors.length &&
      expectedColors.every((b, index) => {
        const a = actualColors[index];
        return a != null && b != null && a.every((part, i) => part === b[i]);
      })
    );
  }

  if (Array.isArray(expected)) {
    const a = numberParts(actual);
    const b = expected.map(Number);
    return (
      a.length === b.length &&
      a.every((value, i) => Math.abs(value - b[i]) < 0.004)
    );
  }

  if (typeof expected === 'number') {
    let targetExpected = expected;
    if (row.property === 'text-outline-opacity') {
      const opacityStyle = cy.style().json()[row.group]?.['text-opacity'];
      const opacity =
        typeof opacityStyle === 'number'
          ? opacityStyle
          : cy.$id(String(row.target)).style('text-opacity');
      targetExpected = Math.round(expected * Number(opacity) * 255) / 255;
    } else if (['text-opacity', 'outline-opacity'].includes(row.property)) {
      targetExpected = Math.round(expected * 255) / 255;
    }
    return Math.abs(Number(actual) - targetExpected) < 0.004;
  }

  if (
    typeof expected === 'string' &&
    expected.endsWith('deg') &&
    String(actual).endsWith('rad')
  ) {
    return (
      Math.abs(
        Number.parseFloat(actual) -
          (Number.parseFloat(expected) * Math.PI) / 180,
      ) < 1e-9
    );
  }

  if (
    typeof expected === 'string' &&
    expected.endsWith('deg') &&
    typeof actual === 'number'
  ) {
    return Math.abs(actual - Number.parseFloat(expected)) < 0.004;
  }

  if (
    typeof expected === 'string' &&
    expected.endsWith('%') &&
    /arrow-width$/.test(row.property)
  ) {
    const width = Number(cy.$id(String(row.target)).style('width'));
    return (
      Math.abs(Number(actual) - (width * Number.parseFloat(expected)) / 100) <
      0.004
    );
  }

  if (expected === 'match-line' && /arrow-width$/.test(row.property)) {
    return (
      Math.abs(
        Number(actual) - Number(cy.$id(String(row.target)).style('width')),
      ) < 0.004
    );
  }

  if (
    typeof expected === 'string' &&
    /^(?:source|target)-label$/.test(row.property)
  ) {
    const transform = cy.$id(String(row.target)).style('text-transform');
    if (transform === 'uppercase') return actual === expected.toUpperCase();
    if (transform === 'lowercase') return actual === expected.toLowerCase();
  }

  return sameValue(actual, expected);
};

const targetGroup = (element) => {
  if (element.isEdge()) return 'edges';
  return element.isParent() ? 'parents' : 'nodes';
};

const elementsOf = (elements) => [
  ...(elements.nodes ?? []),
  ...(elements.edges ?? []),
];

const coreReadback = (cy, property) => {
  const values = cy.style().core();
  return values[kebabToCamel(property)];
};

const readProperty = (cy, group, target, property) => {
  if (group === 'core') return coreReadback(cy, property);
  const element = cy.$id(String(target));
  if (element.empty()) return undefined;
  return element.style(property);
};

const readRowProperty = (cy, row) => {
  const value = readProperty(
    cy,
    row.group,
    row.group === 'core' ? 'core' : String(row.target),
    row.property,
  );
  if (value === undefined || row.targetIndex == null) return value;
  if (Array.isArray(value)) return value[row.targetIndex];
  return keywordTokens(value)[row.targetIndex];
};

const routeId = (name) => name;
const featureRoute = (familyId, viewId, params = {}) => {
  const query = new URLSearchParams({
    network: 'features',
    scene: familyId,
    view: viewId,
  });
  for (const [key, value] of Object.entries(params)) {
    query.set(key, String(value));
  }
  return `debug/index.html?${query}`;
};
const workflowRoute = (scene) =>
  `debug/index.html?network=workflows&scene=${encodeURIComponent(scene)}&layout=preset`;

const compareDefaults = (group, property, value, defaults) =>
  !sameValue(value, defaults[group]?.[property]);

const addRow = (map, key, row) => {
  const rows = map.get(key) ?? [];
  const signature = [
    row.route,
    row.target,
    valueKey(row.value),
    row.source,
  ].join('|');
  if (!rows.some((existing) => existing.signature === signature)) {
    rows.push({ ...row, signature });
    map.set(key, rows);
  }
};

const keywordTokens = (value) => {
  if (Array.isArray(value)) return value.flatMap(keywordTokens);
  if (value == null) return ['null'];
  if (typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)];
  }
  if (typeof value !== 'string') return [];
  return value.trim().split(/\s+/).filter(Boolean);
};

/**
 * Validate the one known renderer-wide font restore observation against its
 * captured keyword control. This is deliberately narrow: ordinary controls
 * still have to restore the frame exactly, and a zero-movement alternate or a
 * lost style value cannot be explained by this row. The 178-pixel value is a
 * controlled historical observation; the current capture may restore exactly
 * or show a small atlas re-rasterization residue.
 */
export const validateRestoreLimitation = (limitation, capture, degrade) => {
  const expected = {
    group: 'nodes',
    property: 'font-style',
    target: 'label-left',
    value: 'normal',
    alternate: 'italic',
    observedResiduePixels: 178,
    route: '?network=features&scene=labels&view=nodes',
  };
  for (const [key, value] of Object.entries(expected)) {
    if (!sameValue(limitation?.[key], value)) {
      throw new Error(
        `unsupported restore limitation ${key}: expected ${JSON.stringify(value)}, got ${JSON.stringify(limitation?.[key])}`,
      );
    }
  }

  if (
    !Array.isArray(limitation.sourceRefs) ||
    !limitation.sourceRefs.some(
      (source) =>
        source.includes('four pinned Open Sans faces loaded') &&
        source.includes('fonts.ready'),
    ) ||
    !String(limitation.reason).includes('17390 pixels') ||
    !String(limitation.reason).includes('178 differing pixels') ||
    !String(limitation.reason).includes('unlocalized')
  ) {
    throw new Error('font-style restore limitation lacks its measured witness');
  }

  const captureRow = capture?.featureCoverage?.keywords?.find(
    (row) =>
      row.group === expected.group &&
      row.property === expected.property &&
      row.target === expected.target &&
      row.value === expected.value &&
      row.alternate === expected.alternate,
  );
  const degradeRow = degrade?.keywords?.find(
    (row) =>
      row.group === expected.group &&
      row.property === expected.property &&
      row.target === expected.target &&
      row.value === expected.value &&
      row.alternate === expected.alternate,
  );

  if (captureRow == null || degradeRow == null) {
    throw new Error('font-style restore limitation has no captured control');
  }
  if (
    degradeRow.matched !== 1 ||
    degradeRow.changed !== 1 ||
    !Number.isInteger(degradeRow.moved) ||
    degradeRow.moved <= 0 ||
    !Number.isInteger(degradeRow.restoreMoved) ||
    degradeRow.restoreMoved < 0 ||
    degradeRow.restoreMoved > 256 ||
    (degradeRow.restoreMoved > 0
      ? degradeRow.residue !== degradeRow.restoreMoved
      : degradeRow.residue != null) ||
    degradeRow.restoreFailure != null ||
    degradeRow.lost != null ||
    (degradeRow.unresettable?.length ?? 0) > 0 ||
    degradeRow.unexpected != null ||
    degradeRow.rejected != null ||
    degrade.stopped != null
  ) {
    throw new Error(
      `font-style restore limitation control is outside the measured case: ${JSON.stringify(degradeRow)}`,
    );
  }

  return {
    ...jsonValue(limitation),
    golden: capture.golden,
    moved: degradeRow.moved,
    matched: degradeRow.matched,
    changed: degradeRow.changed,
    observedResiduePixels: limitation.observedResiduePixels,
    residuePixels: degradeRow.restoreMoved,
    kind:
      degradeRow.restoreMoved === 0
        ? 'exact restore in current capture'
        : 'measured font atlas restore residue',
  };
};

/**
 * Build actual manual evidence by reading every feature scene and five small
 * legacy debug fixtures through Cytoscape.js.  Scene metadata contributes
 * explicit source-level examples (including authored aliases and deliberate
 * defaults); the resolved style readback contributes every non-default
 * property and every canonical enum value actually present on an element.
 */
export const collectManualCoverage = async () => {
  const { schema, space, defaults } = await measure();
  const captures = loadCaptures();
  const degrades = loadDegrades();
  const degradeByName = new Map(degrades.map((row) => [row.golden, row]));
  const properties = new Map();
  const keywords = new Map();
  const defaultProperties = new Map();
  const defaultKeywords = new Map();
  const semanticExceptions = new Map();
  const restoreLimitations = [];
  const routes = [];

  for (const capture of captures) {
    const rows = capture.featureCoverage?.restoreLimitations ?? [];
    if (rows.length > 0) {
      const degrade = degradeByName.get(capture.golden);
      if (degrade == null) {
        throw new Error(
          `${capture.golden}: restore limitation has no degrade-control record`,
        );
      }
      for (const row of rows) {
        restoreLimitations.push(
          validateRestoreLimitation(row, capture, {
            ...degrade,
            golden: capture.golden,
          }),
        );
      }
    }
  }
  if (restoreLimitations.length > 1) {
    throw new Error(
      'only the measured node font-style restore residue is allowed',
    );
  }

  const indexReadbacks = (
    cy,
    elements,
    route,
    source,
    styleSheet,
    limitations = new Set(),
  ) => {
    for (const definition of elementsOf(elements)) {
      const target = String(definition.data.id);
      const element = cy.$id(target);
      if (element.empty()) continue;
      const group = targetGroup(element);
      const groupProperties =
        group === 'parents'
          ? [...space.groups[group], 'shape']
          : space.groups[group];
      const styleGroups =
        group === 'parents'
          ? [styleSheet?.nodes, styleSheet?.parents]
          : [styleSheet?.[group]];

      for (const property of groupProperties) {
        const coverageGroup =
          group === 'parents' && property === 'shape' ? 'nodes' : group;
        if (limitations.has(`${coverageGroup}/${target}/${property}`)) continue;
        const value = jsonValue(element.style(property));
        if (value === undefined) continue;

        const isDefault = !compareDefaults(
          coverageGroup,
          property,
          value,
          defaults,
        );
        if (space.groups[coverageGroup].includes(property)) {
          const destination = isDefault ? defaultProperties : properties;
          addRow(destination, `${coverageGroup}/${property}`, {
            group: coverageGroup,
            property,
            route,
            target,
            value,
            source,
            kind: isDefault
              ? 'incidental default readback'
              : 'resolved non-default example',
          });
        }

        const enumValues = keywordsOf(schema, property);
        if (enumValues == null) continue;
        const tokens = new Set(keywordTokens(value));

        for (const keyword of enumValues) {
          if (tokens.has(String(keyword))) {
            const destination = isDefault ? defaultKeywords : keywords;
            addRow(
              destination,
              `${coverageGroup}/${property}/${String(keyword)}`,
              {
                group: coverageGroup,
                property,
                keyword,
                route,
                target,
                value,
                source,
                kind: isDefault
                  ? 'incidental default readback'
                  : 'resolved non-default readback',
              },
            );
          }
        }

        // Hull shape keywords are valid on compound parents but the
        // renderer's semantic scope is the parent body. Keep the node
        // schema keyword row and bind it to the actual parent readback.
        if (element.isParent() && group === 'parents' && property === 'shape') {
          for (const keyword of enumValues) {
            if (tokens.has(String(keyword))) {
              addRow(keywords, `nodes/shape/${String(keyword)}`, {
                group: 'nodes',
                property: 'shape',
                keyword,
                route,
                target,
                value,
                source,
                kind: 'parent-scoped readback',
                semanticScope: 'compound parent body',
              });
            }
          }
        }
      }

      // A non-default computed value is sufficient evidence by itself. For
      // a deliberately authored default, require a source declaration on
      // this scene's applicable style group and the exact target readback.
      // This avoids treating an unrelated element's incidental default as
      // a manual example while still recording intentional baseline cells.
      for (const declarations of styleGroups) {
        if (declarations == null || typeof declarations !== 'object') continue;
        for (const property of Object.keys(declarations)) {
          const coverageGroup =
            group === 'parents' && property === 'shape' ? 'nodes' : group;
          if (limitations.has(`${coverageGroup}/${target}/${property}`))
            continue;
          if (!space.groups[coverageGroup]?.includes(property)) continue;
          const actual =
            coverageGroup === 'core'
              ? coreReadback(cy, property)
              : element.style(property);
          if (actual === undefined) continue;
          const candidate = {
            group: coverageGroup,
            property,
            route,
            target,
            value: jsonValue(actual),
            authoredValue: jsonValue(declarations[property]),
            source,
            kind: 'authored style declaration readback',
          };
          addRow(properties, `${coverageGroup}/${property}`, candidate);

          const enumValues = keywordsOf(schema, property);
          if (enumValues == null) continue;
          const tokens = new Set(keywordTokens(actual));
          for (const keyword of enumValues) {
            if (tokens.has(String(keyword))) {
              addRow(
                keywords,
                `${coverageGroup}/${property}/${String(keyword)}`,
                {
                  ...candidate,
                  keyword,
                  kind: 'authored style declaration readback',
                },
              );
            }
          }
        }
      }
    }

    for (const [property, authoredValue] of Object.entries(
      styleSheet?.core ?? {},
    )) {
      if (!space.groups.core.includes(property)) continue;
      const actual = jsonValue(coreReadback(cy, property));
      if (actual === undefined) continue;
      addRow(properties, `core/${property}`, {
        group: 'core',
        property,
        route,
        target: 'core',
        value: actual,
        authoredValue: jsonValue(authoredValue),
        source,
        kind: 'authored core declaration readback',
      });

      for (const keyword of keywordsOf(schema, property) ?? []) {
        const expected =
          KEYWORD_READBACK[property]?.[String(keyword)] ?? keyword;
        if (sameValue(actual, expected)) {
          addRow(keywords, `core/${property}/${String(keyword)}`, {
            group: 'core',
            property,
            keyword,
            route,
            target: 'core',
            value: actual,
            authoredValue: jsonValue(authoredValue),
            source,
            kind: 'authored core declaration readback',
          });
        }
      }
    }
  };

  const addAuthoredRows = (coverage, route, source, cy) => {
    for (const row of coverage?.properties ?? []) {
      const target = row.group === 'core' ? 'core' : String(row.target);
      const rawValue = readRowProperty(cy, row);
      if (rawValue === undefined) {
        throw new Error(
          `${route}: missing target '${target}' for ${row.group}/${row.property}`,
        );
      }
      if (!resolvedMatches(cy, row, rawValue)) {
        throw new Error(
          `${route}: ${row.group}/${row.property} on '${target}' expected ${JSON.stringify(row.value)}${Object.hasOwn(row, 'resolvedValue') ? ` (resolved ${JSON.stringify(row.resolvedValue)})` : ''}, read ${JSON.stringify(rawValue)}`,
        );
      }
      const value = jsonValue(rawValue);
      addRow(properties, `${row.group}/${row.property}`, {
        group: row.group,
        property: row.property,
        route,
        target,
        value,
        authoredValue: jsonValue(row.value),
        source,
        kind:
          row.readbackLimitation == null
            ? 'authored scene evidence'
            : 'authored mapped value with getter limitation',
        ...(row.readbackLimitation == null
          ? {}
          : { readbackLimitation: jsonValue(row.readbackLimitation) }),
      });

      const allowed = keywordsOf(schema, row.property);
      if (allowed?.some((keyword) => String(keyword) === String(row.value))) {
        addRow(keywords, `${row.group}/${row.property}/${String(row.value)}`, {
          group: row.group,
          property: row.property,
          keyword: row.value,
          route,
          target,
          value,
          authoredValue: jsonValue(row.value),
          source,
          kind:
            row.readbackLimitation == null
              ? 'authored scene evidence'
              : 'authored mapped value with getter limitation',
        });
      }
    }

    for (const row of coverage?.keywords ?? []) {
      const target = row.group === 'core' ? 'core' : String(row.target);
      const rawValue = readRowProperty(cy, row);
      if (rawValue === undefined) {
        throw new Error(
          `${route}: missing target '${target}' for keyword ${row.group}/${row.property}=${String(row.value)}`,
        );
      }
      const allowed = keywordsOf(schema, row.property) ?? [];
      if (!allowed.some((keyword) => String(keyword) === String(row.value))) {
        throw new Error(
          `${route}: ${row.group}/${row.property}=${String(row.value)} is not a canonical schema keyword`,
        );
      }
      if (!resolvedMatches(cy, row, rawValue)) {
        throw new Error(
          `${route}: keyword ${row.group}/${row.property}=${String(row.value)} on '${target}' resolved to ${JSON.stringify(rawValue)}${Object.hasOwn(row, 'resolvedValue') ? `, expected ${JSON.stringify(row.resolvedValue)}` : ''}`,
        );
      }
      const value = jsonValue(rawValue);
      addRow(keywords, `${row.group}/${row.property}/${String(row.value)}`, {
        group: row.group,
        property: row.property,
        keyword: row.value,
        route,
        target,
        value,
        authoredValue: jsonValue(row.value),
        alternate: jsonValue(row.alternate),
        source,
        kind: 'authored enum control',
        ...(row.readbackLimitation == null
          ? {}
          : { readbackLimitation: jsonValue(row.readbackLimitation) }),
      });
    }

    for (const row of coverage?.exceptions ?? []) {
      const target = row.group === 'core' ? 'core' : String(row.target);
      const rawValue = readRowProperty(cy, row);
      if (rawValue === undefined || !row.reason) {
        throw new Error(
          `${route}: incomplete exception evidence for ${row.group}/${row.property}`,
        );
      }
      if (!resolvedMatches(cy, row, rawValue)) {
        throw new Error(
          `${route}: exception ${row.group}/${row.property} on '${target}' did not resolve its documented value ${JSON.stringify(row.value)}`,
        );
      }
      const value = jsonValue(rawValue);
      addRow(properties, `${row.group}/${row.property}`, {
        group: row.group,
        property: row.property,
        route,
        target,
        value,
        authoredValue: jsonValue(row.value),
        source,
        kind: 'behavioral exception',
        reason: row.reason,
      });
      const allowed = keywordsOf(schema, row.property);
      if (allowed?.some((keyword) => String(keyword) === String(row.value))) {
        addRow(keywords, `${row.group}/${row.property}/${String(row.value)}`, {
          group: row.group,
          property: row.property,
          keyword: row.value,
          route,
          target,
          value,
          authoredValue: jsonValue(row.value),
          source,
          kind: 'behavioral exception',
          reason: row.reason,
        });
      }
    }

    for (const row of coverage?.semanticExceptions ?? []) {
      const key = `${row.group}/${row.property}/${String(row.keyword)}`;
      const allowed = keywordsOf(schema, row.property) ?? [];
      if (!space.groups[row.group]?.includes(row.property)) {
        throw new Error(
          `${route}: semantic exception uses unreadable ${row.group}/${row.property}`,
        );
      }
      if (!allowed.some((keyword) => String(keyword) === String(row.keyword))) {
        throw new Error(
          `${route}: semantic exception uses unknown ${row.group}/${row.property}=${String(row.keyword)}`,
        );
      }
      if (
        !row.reason ||
        !Array.isArray(row.sourceRefs) ||
        row.sourceRefs.length === 0 ||
        !row.rejectionTest ||
        !Array.isArray(row.validRoutes) ||
        row.validRoutes.length === 0
      ) {
        throw new Error(`${route}: incomplete semantic exception for ${key}`);
      }
      if (semanticExceptions.has(key)) {
        throw new Error(`${route}: duplicate semantic exception for ${key}`);
      }
      const rejectionPath = row.rejectionTest.split(' ')[0];
      const rejectionSource = readSource(rejectionPath);
      const sourceFiles = row.sourceRefs.map(
        (reference) => reference.split(':')[0],
      );
      for (const sourceFile of sourceFiles) readSource(sourceFile);
      if (
        !rejectionSource.includes(String(row.keyword)) ||
        !rejectionSource.includes('edge-only')
      ) {
        throw new Error(
          `${route}: rejection test does not assert ${String(row.keyword)} is edge-only`,
        );
      }
      semanticExceptions.set(key, {
        group: row.group,
        property: row.property,
        keyword: row.keyword,
        reason: row.reason,
        sourceRefs: row.sourceRefs,
        rejectionTest: row.rejectionTest,
        validRoutes: row.validRoutes,
        route,
        source: 'feature scene semantic exception',
        kind: 'unsupported group-value exception',
      });
    }
  };

  for (const sceneCase of featureScenes.goldenCases) {
    const scene = featureScenes.create(
      sceneCase.familyId,
      sceneCase.viewId,
      sceneCase.params,
    );
    const route = featureRoute(
      sceneCase.familyId,
      sceneCase.viewId,
      sceneCase.params,
    );
    let cy;
    try {
      cy = cytoscape({
        ...scene.options,
        headless: true,
        layout: { name: 'preset' },
        elements: scene.elements,
        style: scene.style,
      });
    } catch (error) {
      throw new Error(`${route}: scene construction failed: ${error.message}`, {
        cause: error,
      });
    }

    const limitations = new Set(
      [
        ...(scene.coverage?.properties ?? []),
        ...(scene.coverage?.keywords ?? []),
      ]
        .filter((row) => row.readbackLimitation != null)
        .map((row) => `${row.group}/${row.target}/${row.property}`),
    );
    indexReadbacks(
      cy,
      scene.elements,
      route,
      'feature scene',
      scene.style,
      limitations,
    );
    addAuthoredRows(scene.coverage, route, 'feature scene metadata', cy);
    routes.push({
      id: routeId(sceneCase.name),
      route,
      label: sceneCase.label,
      family: sceneCase.familyId,
      stateId: sceneCase.stateId ?? null,
      params: jsonValue(sceneCase.params),
      ...(sceneCase.goldenOmissionReason
        ? { goldenOmissionReason: sceneCase.goldenOmissionReason }
        : {}),
      source: 'feature scene',
    });
    cy.destroy();
  }

  for (const network of LEGACY) {
    const def = networks[network];
    if (def == null || def.generated == null) {
      throw new Error(`Expected small generated legacy route '${network}'`);
    }
    const generated = fixtures.generate(def.generated);
    const route = `debug/index.html?network=${encodeURIComponent(network)}`;
    const sheet = styles.sheet('production', network, generated, def);
    let cy;
    try {
      cy = cytoscape({
        headless: true,
        layout: { name: 'preset' },
        elements: { nodes: generated.nodes, edges: generated.edges },
        style: sheet,
      });
    } catch (error) {
      throw new Error(
        `${route}: legacy fixture construction failed: ${error.message}`,
        { cause: error },
      );
    }
    const routeMeta = featureScenes.legacyRoutes.find(
      (row) => row.network === network,
    );

    indexReadbacks(cy, generated, route, 'legacy fixture readback', sheet);
    addAuthoredRows(routeMeta?.coverage, route, 'legacy fixture metadata', cy);
    routes.push({
      id: network,
      route,
      label: def.desc,
      source: 'legacy fixture',
    });
    cy.destroy();
  }

  for (const row of workflows.propertyEvidence ?? []) {
    const route = row.route?.startsWith('?')
      ? `debug/index.html${row.route}`
      : row.route;
    if (!route || !row.widget || !row.behaviorSpec) {
      throw new Error(
        `incomplete workflow property evidence for ${row.group}/${row.property}`,
      );
    }
    const candidate = {
      group: row.group,
      property: row.property,
      route,
      target: row.target,
      values: jsonValue(row.values ?? []),
      source: 'workflow property evidence',
      widget: row.widget,
      behaviorSpec: row.behaviorSpec,
      kind: 'behavioral workflow evidence',
      evidence: row.evidence ?? undefined,
    };
    const exactValues =
      row.values ??
      (typeof row.value === 'number' ||
      (typeof row.value === 'string' &&
        /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(row.value))
        ? [row.value]
        : []);
    if (exactValues.length > 0) {
      candidate.values = jsonValue(exactValues);
      addRow(properties, `${row.group}/${row.property}`, candidate);
    }
  }

  for (const row of workflows.keywordEvidence ?? []) {
    const allowed = keywordsOf(schema, row.property) ?? [];
    const route = row.route?.startsWith('?')
      ? `debug/index.html${row.route}`
      : row.route;
    if (!allowed.some((value) => String(value) === String(row.value))) {
      throw new Error(
        `workflow keyword evidence uses unknown ${row.group}/${row.property}=${String(row.value)}`,
      );
    }
    if (!route || !row.widget || !row.behaviorSpec) {
      throw new Error(
        `incomplete workflow keyword evidence for ${row.group}/${row.property}=${String(row.value)}`,
      );
    }
    addRow(keywords, `${row.group}/${row.property}/${String(row.value)}`, {
      group: row.group,
      property: row.property,
      keyword: row.value,
      route,
      target: row.target,
      source: 'workflow keyword evidence',
      widget: row.widget,
      behaviorSpec: row.behaviorSpec,
      kind: 'behavioral keyword evidence',
    });
  }

  for (const row of workflows.coverage ?? []) {
    const route =
      row.scene == null ? (row.route ?? null) : workflowRoute(row.scene);
    routes.push({
      id: `workflow:${row.family}`,
      route,
      label: row.family,
      family: row.family,
      widget: row.widget,
      behaviorSpec: row.behavioral ?? row.behaviorSpec ?? row.evidence,
      evidence: row.evidence,
      source: 'workflow coverage',
      ...(route == null
        ? {
            manualRouteReason:
              'automated behavior or contract has no interactive renderer route',
          }
        : {}),
    });
  }

  const sourceRouteSet = new Set(
    routes.map((row) => row.route).filter(Boolean),
  );
  for (const [key, exception] of semanticExceptions) {
    for (const route of exception.validRoutes) {
      if (!sourceRouteSet.has(route)) {
        throw new Error(
          `${exception.route}: semantic exception ${key} references missing route '${route}'`,
        );
      }
    }
  }

  const capturedProperties = (group, property) =>
    captures
      .filter((capture) => Array.isArray(capture[group]?.[property]))
      .map((capture) => {
        const values = capture[group][property];
        return {
          golden: capture.golden,
          values: values.slice(0, 3),
          valueCount: values.length,
          moved:
            degradeByName.get(capture.golden)?.pairs?.[`${group}/${property}`]
              ?.moved ?? null,
        };
      })
      // The golden-specific records retain the full set. Link a bounded
      // sample here so common properties do not repeat every element/value
      // across dozens of captures in the coverage manifest.
      .slice(0, 3);

  const capturedKeywords = (group, property, keyword) =>
    captures
      .flatMap((capture) => {
        const values = capture[group]?.[property] ?? [];
        const readback = values.some((value) =>
          keywordTokens(value).includes(String(keyword)),
        );
        const featureRows = [
          ...(capture.featureCoverage?.keywords ?? []),
          ...(capture.featureCoverage?.exceptions ?? []),
        ].filter(
          (row) =>
            row.group === group &&
            row.property === property &&
            String(row.value) === String(keyword),
        );
        if (!readback && featureRows.length === 0) return [];

        const degradeRows = degradeByName.get(capture.golden)?.keywords ?? [];
        const targets = featureRows.slice(0, 4).map((row) => {
          const result = degradeRows.find(
            (entry) =>
              entry.group === group &&
              entry.property === property &&
              entry.target === row.target &&
              String(entry.value) === String(row.value),
          );
          return {
            target: row.target,
            value: row.value,
            ...(row.alternate == null ? {} : { alternate: row.alternate }),
            ...(row.reason == null ? {} : { exception: row.reason }),
            ...(result == null
              ? {}
              : { moved: result.moved, changed: result.changed }),
          };
        });

        return [{ golden: capture.golden, readback, targets }];
      })
      .slice(0, 3);

  const propertyRows = GROUPS.flatMap((group) =>
    space.groups[group].map((property) => {
      const candidates = properties.get(`${group}/${property}`) ?? [];
      return {
        group,
        property,
        manual: candidates[0] ?? null,
        defaultReadback:
          (defaultProperties.get(`${group}/${property}`) ?? [])[0] ?? null,
        goldens: capturedProperties(group, property),
      };
    }),
  );

  const keywordRows = GROUPS.flatMap((group) =>
    space.groups[group].flatMap((property) =>
      (keywordsOf(schema, property) ?? []).map((keyword) => {
        const candidates =
          keywords.get(`${group}/${property}/${String(keyword)}`) ?? [];
        return {
          group,
          property,
          keyword,
          manual: candidates[0] ?? null,
          semanticException:
            semanticExceptions.get(`${group}/${property}/${String(keyword)}`) ??
            null,
          defaultReadback:
            (defaultKeywords.get(`${group}/${property}/${String(keyword)}`) ??
              [])[0] ?? null,
          goldens: capturedKeywords(group, property, keyword),
        };
      }),
    ),
  );

  // Record the renderer's documented spelling aliases separately from a
  // direct keyword assignment. The linked route shows the canonical shape;
  // the alias map is the explicit reason both spellings share that output.
  for (const [property, aliases] of Object.entries(ALIASES)) {
    for (const group of GROUPS) {
      for (const [alias, canonical] of Object.entries(aliases)) {
        const row = keywordRows.find(
          (candidate) =>
            candidate.group === group &&
            candidate.property === property &&
            String(candidate.keyword) === alias,
        );
        if (row == null || row.manual != null) continue;
        const canonicalRow = keywordRows.find(
          (candidate) =>
            candidate.group === group &&
            candidate.property === property &&
            String(candidate.keyword) === canonical &&
            candidate.manual != null,
        );
        if (canonicalRow == null) continue;
        row.manual = {
          group,
          property,
          keyword: alias,
          route: canonicalRow.manual.route,
          target: canonicalRow.manual.target,
          value: canonicalRow.manual.value,
          source: 'documented canonical alias',
          kind: 'alias mapping',
          canonical,
          reason: `${alias} resolves to the same rendered value as ${canonical}`,
        };
      }
    }
  }

  const countKinds = (rows, key = 'manual') =>
    rows.reduce((counts, row) => {
      const value = row[key];
      const kind = value?.kind ?? row.semanticException?.kind ?? 'missing';
      counts[kind] = (counts[kind] ?? 0) + 1;
      return counts;
    }, {});

  return {
    schema: 'schemas/stylesheet.schema.json',
    sourceRoutes: routes,
    runnableRoutes: [
      ...new Set(routes.map((row) => row.route).filter(Boolean)),
    ].sort(),
    classifications: {
      inertGroupProperties: space.inert,
      noStaticPixelProperties: NO_STATIC_PIXELS,
      keywordAliases: ALIASES,
      unmovableGoldenProperties: UNMOVABLE,
      intendedNoPixelGoldenPairs: INTENDED_DECORATION,
    },
    properties: propertyRows,
    keywords: keywordRows,
    restorationLimitations: restoreLimitations,
    counts: {
      properties: propertyRows.length,
      propertiesCovered: propertyRows.filter((row) => row.manual != null)
        .length,
      keywords: keywordRows.length,
      keywordsCovered: keywordRows.filter((row) => row.manual != null).length,
      keywordSemanticExceptions: keywordRows.filter(
        (row) => row.semanticException != null,
      ).length,
      restorationLimitations: restoreLimitations.length,
      keywordsAccounted: keywordRows.filter(
        (row) => row.manual != null || row.semanticException != null,
      ).length,
      propertyKinds: countKinds(propertyRows),
      keywordKinds: countKinds(keywordRows),
    },
  };
};

export const manifestMatches = (actual, expected) =>
  JSON.stringify(actual) === JSON.stringify(expected);

const manifestPath = new URL('../docs/demo-coverage.json', import.meta.url);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = await collectManualCoverage();
  const missingProperties = report.properties.filter(
    (row) => row.manual == null,
  );
  const missingKeywords = report.keywords.filter(
    (row) => row.manual == null && row.semanticException == null,
  );

  if (process.argv.includes('--write')) {
    writeFileSync(manifestPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  console.log(
    `manual demo coverage: ${report.counts.propertiesCovered}/${report.counts.properties} properties; ` +
      `${report.counts.keywordsCovered}/${report.counts.keywords} supported enum values; ` +
      `${report.counts.keywordSemanticExceptions} semantic exceptions; ` +
      `${report.runnableRoutes.length} runnable routes`,
  );

  if (process.argv.includes('--verbose')) {
    for (const row of missingProperties) {
      console.log(`missing property ${row.group}/${row.property}`);
    }
    for (const row of missingKeywords) {
      console.log(
        `missing keyword ${row.group}/${row.property}=${String(row.keyword)}`,
      );
    }
  }
}
