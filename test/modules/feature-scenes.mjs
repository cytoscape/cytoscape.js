import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import cytoscape from '../../src/index.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sceneScript = readFileSync(join(ROOT, 'debug/feature-scenes.js'), 'utf8');
const styleSchema = JSON.parse(
  readFileSync(join(ROOT, 'schemas/stylesheet.schema.json'), 'utf8'),
);
const sceneParts = ['paint', 'graph', 'labels', 'charts', 'compounds'].map(
  (name) => readFileSync(join(ROOT, `debug/feature-scenes-${name}.js`), 'utf8'),
);

const loadScenes = (globals = {}) => {
  const context = createContext({
    URLSearchParams,
    ...globals,
    module: { exports: {} },
  });
  for (const part of sceneParts) runInContext(part, context);
  runInContext(sceneScript, context);
  expect(context.window).to.equal(undefined);
  return context.module.exports;
};

const loadDebugGlobal = (name) => {
  const context = createContext({
    module: { exports: {} },
    console,
    TextDecoder,
  });
  runInContext(readFileSync(join(ROOT, `debug/${name}.js`), 'utf8'), context);
  return context.module.exports;
};

const featureScenes = loadScenes();
const fixtures = loadDebugGlobal('fixtures');
const networks = loadDebugGlobal('networks');
const styles = loadDebugGlobal('styles');
const elementDefinitions = (scene) => [
  ...scene.elements.nodes,
  ...(scene.elements.edges ?? []),
];

const schemaProperty = (group, property) => {
  const definitions = styleSchema.$defs;
  if (group === 'nodes') return definitions.nodeProps.properties[property];
  if (group === 'edges') return definitions.edges.properties[property];
  if (group === 'parents')
    return (
      definitions.parents.properties[property] ??
      definitions.nodeProps.properties[property]
    );
  if (group === 'core') return definitions.core.properties[property];
  return undefined;
};

const enumValuesFor = (group, property) => {
  const values = new Set();
  const visitedRefs = new Set();
  const visit = (schema) => {
    if (schema == null || typeof schema !== 'object') return;
    if (Array.isArray(schema.enum))
      for (const value of schema.enum) values.add(value);
    if (Object.hasOwn(schema, 'const')) values.add(schema.const);
    if (typeof schema.$ref === 'string' && !visitedRefs.has(schema.$ref)) {
      visitedRefs.add(schema.$ref);
      const resolved = schema.$ref
        .slice(2)
        .split('/')
        .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))
        .reduce((current, part) => current?.[part], styleSchema);
      visit(resolved);
    }
    for (const key of ['anyOf', 'oneOf', 'allOf', 'prefixItems'])
      for (const child of schema[key] ?? []) visit(child);
    visit(schema.items);
  };
  visit(schemaProperty(group, property));
  return values;
};

const expectedFontWeightAlternate = (value) =>
  ['bold', 'bolder'].includes(String(value)) || Number(value) >= 600
    ? 400
    : 700;

const readback = (cy, row) => {
  if (row.group !== 'core') return cy.$id(row.target).style(row.property);

  const core = cy._styleEngine.core();
  return {
    'dim-opacity': core.dimOpacity,
    'label-declutter': core.labelDeclutter === 1 ? 'cull' : 'none',
  }[row.property];
};

const parseColor = (value) => {
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

const colorTokens = (value) => {
  if (Array.isArray(value)) return value.map(parseColor);
  const text = String(value);
  const tokens = text.match(/rgba?\([^)]*\)|#[\da-f]{3,8}\b/gi);
  return tokens?.map(parseColor) ?? [parseColor(value)];
};

const numberTokens = (value) => {
  if (Array.isArray(value)) return value.map(Number);
  if (typeof value === 'number') return [value];
  const tokens = String(value).match(
    /[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi,
  );
  return tokens?.map(Number) ?? [];
};

const closeNumber = (actual, expected, tolerance = 0.001) =>
  Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance;

const expectResolvedValue = (cy, row, sceneId) => {
  const actual = readback(cy, row);
  const expectedValue = Object.hasOwn(row, 'resolvedValue')
    ? row.resolvedValue
    : row.value;
  const message = `${sceneId}: ${row.property} on ${row.target} should resolve ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actual)}`;

  if (row.readbackLimitation != null) {
    const limitation = row.readbackLimitation;
    const authoredValue = limitation.mappedValue;
    const sheetValue = cy.style().json()[row.group]?.[row.property];
    const target = cy.$id(row.target);
    const observedGetter = limitation.getterValue ?? limitation.resolvedValue;

    expect(row.value, message).to.equal(authoredValue);
    expect(actual, message).to.equal(observedGetter);
    if (
      sheetValue != null &&
      typeof sheetValue === 'object' &&
      typeof sheetValue.data === 'string'
    ) {
      expect(target.data(sheetValue.data), message).to.equal(authoredValue);
    } else {
      expect(sheetValue, message).to.equal(authoredValue);
    }
    return;
  }

  if (String(row.property).includes('color')) {
    const expectedColors = colorTokens(expectedValue);
    const actualColors = colorTokens(actual);
    expect(actualColors.length, message).to.be.at.least(expectedColors.length);
    expectedColors.forEach((color, index) => {
      expect(color, message).to.not.equal(null);
      expect(actualColors[index], message).to.deep.equal(color);
    });
    return;
  }

  if (Array.isArray(expectedValue)) {
    const actualNumbers = numberTokens(actual);
    const expectedNumbers = expectedValue.map(Number);
    expect(actualNumbers, message).to.have.length(expectedNumbers.length);
    expectedNumbers.forEach((value, index) =>
      expect(closeNumber(actualNumbers[index], value), message).to.equal(true),
    );
    return;
  }

  if (expectedValue != null && typeof expectedValue === 'object') {
    const parsed = typeof actual === 'string' ? JSON.parse(actual) : actual;
    expect(parsed, message).to.deep.equal(expectedValue);
    return;
  }

  if (typeof expectedValue === 'number') {
    let expected = expectedValue;
    const target = row.group === 'core' ? null : cy.$id(row.target);

    if (row.property === 'text-outline-opacity') {
      const opacityStyle = cy.style().json()[row.group]?.['text-opacity'];
      expected *= Number(
        typeof opacityStyle === 'number'
          ? opacityStyle
          : target.style('text-opacity'),
      );
      expected = Math.round(expected * 255) / 255;
    } else if (['text-opacity', 'outline-opacity'].includes(row.property)) {
      expected = Math.round(expected * 255) / 255;
    }

    expect(closeNumber(Number(actual), expected, 0.004), message).to.equal(
      true,
    );
    return;
  }

  if (
    typeof row.value === 'string' &&
    /^(?:source|target)-label$/.test(row.property)
  ) {
    const stylesheet = cy.style().json();
    const transformValue = stylesheet[row.group]?.['text-transform'];
    const target = cy.$id(row.target);
    const transform =
      transformValue != null &&
      typeof transformValue === 'object' &&
      typeof transformValue.data === 'string'
        ? (target.data(transformValue.data) ??
          transformValue.fallback ??
          'none')
        : (transformValue ?? 'none');
    const expected =
      transform === 'uppercase'
        ? row.value.toUpperCase()
        : transform === 'lowercase'
          ? row.value.toLowerCase()
          : row.value;
    expect(actual, message).to.equal(expected);
    return;
  }

  if (
    typeof row.value === 'string' &&
    row.value.endsWith('deg') &&
    String(actual).endsWith('rad')
  ) {
    expect(
      closeNumber(
        Number.parseFloat(actual),
        (Number.parseFloat(row.value) * Math.PI) / 180,
        1e-9,
      ),
      message,
    ).to.equal(true);
    return;
  }

  if (
    typeof row.value === 'string' &&
    row.value.endsWith('%') &&
    /arrow-width$/.test(row.property)
  ) {
    const expected =
      (Number.parseFloat(cy.$id(row.target).style('width')) *
        Number.parseFloat(row.value)) /
      100;
    expect(closeNumber(Number(actual), expected), message).to.equal(true);
    return;
  }

  if (row.value === 'match-line' && /arrow-width$/.test(row.property)) {
    expect(
      closeNumber(Number(actual), Number(cy.$id(row.target).style('width'))),
      message,
    ).to.equal(true);
    return;
  }

  expect(actual, message).to.equal(expectedValue);
};

class TestElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.listeners = {};
    this.dataset = {};
    this.parentNode = null;
    this.value = '';
    this.textContent = '';
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    this.children.splice(this.children.indexOf(child), 1);
    child.parentNode = null;
    return child;
  }

  addEventListener(type, listener) {
    (this.listeners[type] ??= []).push(listener);
  }

  dispatch(type) {
    for (const listener of this.listeners[type] ?? [])
      listener({ target: this });
  }

  setAttribute() {}

  get firstChild() {
    return this.children[0] ?? null;
  }
}

const testDocument = {
  createElement: (tagName) => new TestElement(tagName),
  createTextNode: (textContent) => ({ textContent, parentNode: null }),
};

const testContainer = () => {
  const container = new TestElement('container');
  container.ownerDocument = testDocument;
  return container;
};

const descendants = (root, tagName) => {
  const found = [];
  const visit = (node) => {
    for (const child of node.children ?? []) {
      if (child.tagName === tagName) found.push(child);
      visit(child);
    }
  };
  visit(root);
  return found;
};

describe('round 149 visual feature scenes', function () {
  it('loads as a DOM-free CommonJS browser global with stable family/view ids', function () {
    expect(featureScenes).to.have.keys(
      'catalog',
      'create',
      'goldenCases',
      'legacyRoutes',
      'mountControls',
    );
    const ids = [];

    for (const family of featureScenes.catalog) {
      expect(family.views).to.be.an('array').that.is.not.empty;
      for (const view of family.views) {
        const id = `${family.id}/${view.id}`;
        ids.push(id);
        const scene = featureScenes.create(family.id, view.id);
        expect(scene.id).to.equal(id);
        expect(scene.familyId).to.equal(family.id);
        expect(scene.viewId).to.equal(view.id);
      }
    }

    const caseNames = featureScenes.goldenCases.map((entry) => entry.name);
    expect(new Set(caseNames).size).to.equal(caseNames.length);
    for (const candidate of featureScenes.goldenCases) {
      const scene = featureScenes.create(
        candidate.familyId,
        candidate.viewId,
        candidate.params,
      );
      const view = featureScenes.catalog
        .find((family) => family.id === candidate.familyId)
        .views.find((entry) => entry.id === candidate.viewId);
      for (const [param, value] of Object.entries(candidate.params)) {
        const selector = Object.values(view.controlOptions ?? {}).find(
          (entry) => entry.param === param,
        );
        expect(selector, `${candidate.name}: selector for ${param}`).to.exist;
        const rows = [...scene.coverage.properties, ...scene.coverage.keywords];
        expect(
          rows.some(
            (row) => row.property === selector.property && row.value === value,
          ),
          `${candidate.name}: ${selector.property} coverage follows selected state`,
        ).to.equal(true);
      }
      for (const row of scene.coverage.keywords) {
        const canonical = enumValuesFor(row.group, row.property);
        expect(
          canonical.size,
          `${candidate.name}: ${row.group}/${row.property} has schema keywords`,
        ).to.be.greaterThan(0);
        expect(
          canonical.has(row.value),
          `${candidate.name}: ${row.group}/${row.property}=${JSON.stringify(row.value)} is a schema keyword`,
        ).to.equal(true);
      }
    }
    for (const family of featureScenes.catalog) {
      for (const view of family.views) {
        expect(
          featureScenes.goldenCases.some(
            (entry) =>
              entry.familyId === family.id &&
              entry.viewId === view.id &&
              Object.keys(entry.params).length === 0,
          ),
        ).to.equal(true);
      }
    }
    const fontWeightCases = featureScenes.goldenCases.filter(
      (entry) => entry.familyId === 'labels' && entry.params.fontWeight != null,
    );
    expect(
      fontWeightCases.map((entry) => String(entry.params.fontWeight)),
    ).to.have.members([
      'normal',
      'bold',
      'bolder',
      'lighter',
      '100',
      '200',
      '300',
      '500',
      '600',
      '700',
      '800',
      '900',
    ]);
    expect(
      featureScenes.goldenCases
        .filter(
          (entry) =>
            entry.familyId === 'labels' && entry.params.fontFamily != null,
        )
        .filter((entry) => entry.goldenOmissionReason),
    ).to.have.length(3);

    for (const candidate of fontWeightCases) {
      const scene = featureScenes.create(
        candidate.familyId,
        candidate.viewId,
        new URLSearchParams(
          Object.entries(candidate.params).map(([key, value]) => [
            key,
            String(value),
          ]),
        ),
      );
      expect(scene.style.nodes['font-weight'], candidate.name).to.equal(
        candidate.params.fontWeight,
      );
      for (const row of [
        ...scene.coverage.properties,
        ...scene.coverage.keywords,
      ].filter((entry) => entry.property === 'font-weight')) {
        expect(row.alternate, candidate.name).to.equal(
          expectedFontWeightAlternate(candidate.params.fontWeight),
        );
      }
    }

    for (const candidate of featureScenes.goldenCases.filter(
      (entry) =>
        entry.familyId === 'compounds' && entry.params.paddingRelativeTo,
    )) {
      const scene = featureScenes.create(
        candidate.familyId,
        candidate.viewId,
        candidate.params,
      );
      expect(
        scene.style.parents['padding-relative-to'],
        candidate.name,
      ).to.equal(candidate.params.paddingRelativeTo);
    }

    for (const candidate of featureScenes.goldenCases.filter(
      (entry) =>
        entry.familyId === 'emphasis' && entry.params.dimOpacity != null,
    )) {
      const scene = featureScenes.create(
        candidate.familyId,
        candidate.viewId,
        candidate.params,
      );
      expect(scene.style.core['dim-opacity'], candidate.name).to.equal(
        candidate.params.dimOpacity,
      );
    }

    expect(new Set(ids).size).to.equal(ids.length);
    expect(ids.length).to.be.at.least(30);

    expect(
      featureScenes.legacyRoutes.map((route) => route.network),
    ).to.deep.equal(['node-types', 'edge-types', 'edge-arrows', 'labels']);
    for (const route of featureScenes.legacyRoutes) {
      expect(route.query).to.equal(`?network=${route.network}`);
      expect(route.label).to.be.a('string').that.is.not.empty;
      expect(route.coverage).to.have.keys(
        'properties',
        'keywords',
        'exceptions',
      );
      expect(
        route.coverage.keywords.every(
          (row) => row.target && row.value != null && row.alternate,
        ),
        route.network,
      ).to.equal(true);
    }
  });

  it('compiles every direct stylesheet and resolves each claimed target/property', function () {
    let checkedRows = 0;

    for (const family of featureScenes.catalog) {
      for (const view of family.views) {
        const scene = featureScenes.create(family.id, view.id);
        const cy = cytoscape({
          ...scene.options,
          elements: scene.elements,
          style: scene.style,
        });
        const definitions = elementDefinitions(scene);
        const byId = new Map(
          definitions.map((element) => [element.data.id, element]),
        );

        expect(cy.nodes().length, scene.id).to.be.greaterThan(0);
        expect(Object.keys(scene.coverage).sort()).to.deep.equal(
          [
            'properties',
            'keywords',
            'exceptions',
            ...(scene.coverage.semanticExceptions?.length > 0
              ? ['semanticExceptions']
              : []),
          ].sort(),
        );

        for (const groupName of ['properties', 'keywords', 'exceptions']) {
          for (const row of scene.coverage[groupName]) {
            checkedRows++;
            expect(row.group, `${scene.id} ${groupName}`).to.be.a('string');
            expect(row.property, `${scene.id} ${groupName}`).to.be.a('string');

            if (row.group === 'core') {
              expect(row.target).to.equal('core');
              expect(scene.style.core).to.have.property(row.property);
            } else {
              expect(
                byId.has(row.target),
                `${scene.id}: missing ${row.target}`,
              ).to.equal(true);
              const element = byId.get(row.target);
              const authored = scene.style[row.group]?.[row.property];
              const bypass = scene.style.bypasses?.[row.target]?.[row.property];
              expect(
                authored !== undefined || bypass !== undefined,
                `${scene.id}: ${row.property} is not authored for ${row.target}`,
              ).to.equal(true);

              if (authored && typeof authored === 'object' && authored.data) {
                expect(
                  Object.hasOwn(element.data, authored.data) ||
                    Object.hasOwn(authored, 'fallback'),
                  `${scene.id}: ${authored.data} is absent without a mapper fallback`,
                ).to.equal(true);
              }

              expect(
                cy.$id(row.target).length,
                `${scene.id}: target absent after load`,
              ).to.equal(1);
            }

            expectResolvedValue(cy, row, scene.id);

            if (row.resolvedExtent != null) {
              const record = cy._store.chartAt(
                cy.$id(row.target)._first().slot,
              );
              expect(
                record?.barDomain,
                `${scene.id}: resolved chart extent on ${row.target}`,
              ).to.deep.equal(row.resolvedExtent);
            }

            if (groupName === 'keywords') {
              expect(
                row.value,
                `${scene.id}: missing keyword value`,
              ).to.not.equal(undefined);
              expect(
                row.alternate,
                `${scene.id}: missing alternate for ${row.property}`,
              ).to.satisfy(
                (value) =>
                  typeof value === 'string' || typeof value === 'number',
              );
              expect(row.alternate).to.not.equal(row.value);
            }

            if (groupName === 'exceptions') {
              expect(
                row.reason,
                `${scene.id}: exception needs a precise reason`,
              ).to.be.a('string').that.is.not.empty;
            }

            if (row.targetIndex != null) {
              expect(row.targetIndex).to.be.a('number');
              expect(byId.get(row.target).data.url).to.match(/^data:image\//);
            }
          }
        }

        cy.destroy();
      }
    }

    expect(checkedRows).to.be.greaterThan(100);
  });

  it('records node autorotate as a semantic exception, with an edge route', function () {
    const nodeScene = featureScenes.create('labels', 'nodes');
    const [semanticException] = nodeScene.coverage.semanticExceptions ?? [];

    expect(semanticException).to.include({
      group: 'nodes',
      property: 'text-rotation',
      keyword: 'autorotate',
    });
    expect(semanticException.reason).to.be.a('string').that.is.not.empty;
    expect(semanticException.sourceRefs).to.include(
      'src/style/apply-prop.mts:832-840',
    );
    expect(semanticException.rejectionTest).to.include(
      'test/modules/feature-scenes.mjs',
    );
    expect(semanticException.validRoutes).to.include.members([
      'debug/index.html?network=features&scene=labels&view=nodes',
      'debug/index.html?network=features&scene=labels&view=edges',
    ]);

    const nodeCy = cytoscape({
      elements: nodeScene.elements,
      style: nodeScene.style,
    });
    expect(() =>
      nodeCy.style({ nodes: { 'text-rotation': 'autorotate' } }),
    ).to.throw(/edge-only/);
    nodeCy.destroy();

    const edgeScene = featureScenes.create('labels', 'edges');
    const edgeCy = cytoscape({
      elements: edgeScene.elements,
      style: edgeScene.style,
    });
    edgeCy.style({ edges: { 'text-rotation': 'autorotate' } });
    expect(edgeCy.edges().first().style('text-rotation')).to.equal(
      'autorotate',
    );
    edgeCy.destroy();
  });

  it('resolves every legacy route claim against its actual fixture and stylesheet', function () {
    let checkedRows = 0;

    for (const route of featureScenes.legacyRoutes) {
      const definition = networks[route.network];
      const elements = fixtures.generate(definition.generated, '200x400');
      const style = styles.sheet(
        'production',
        route.network,
        elements,
        definition,
      );
      const cy = cytoscape({
        elements: { nodes: elements.nodes, edges: elements.edges },
        style,
      });

      for (const group of ['properties', 'keywords', 'exceptions']) {
        for (const row of route.coverage[group]) {
          checkedRows++;
          expect(
            cy.$id(row.target).length,
            `${route.network}: missing ${row.target}`,
          ).to.equal(1);
          expectResolvedValue(cy, row, route.network);
        }
      }

      cy.destroy();
    }

    expect(checkedRows).to.be.greaterThan(100);
  });

  it('keeps gradient directions, chart kinds, directions and domains on visible authored targets', function () {
    const paint = featureScenes.create('paint', 'nodes');
    const paintCy = cytoscape({ elements: paint.elements, style: paint.style });
    expect(paintCy.$id('paint-0').style('background-fill')).to.equal('solid');
    for (let i = 1; i < 9; i++) {
      expect(paintCy.$id(`paint-${i}`).style('background-fill')).to.equal(
        'linear-gradient',
      );
      expect(
        paintCy.$id(`paint-${i}`).style('background-gradient-direction'),
      ).to.equal(paint.elements.nodes[i].data.direction);
    }
    paintCy.destroy();

    const heat = featureScenes.create('charts', 'heat');
    const heatCy = cytoscape({ elements: heat.elements, style: heat.style });
    expect(heatCy.$id('chart-heat').style('chart')).to.equal('heat-strip');
    expect(heatCy.$id('chart-radial-heat').style('chart')).to.equal(
      'radial-heat',
    );
    expect(heatCy.$id('chart-radial-heat').data('values')).to.have.length(3);
    heatCy.destroy();

    const bars = featureScenes.create('charts', 'bars');
    const barsCy = cytoscape({ elements: bars.elements, style: bars.style });
    expect(barsCy.$id('chart-bar-negative').style('chart-direction')).to.equal(
      'vertical',
    );
    expect(
      barsCy.$id('chart-bar-horizontal').style('chart-direction'),
    ).to.equal('horizontal');
    expect(barsCy.$id('chart-bar-negative').style('chart-domain')).to.equal(
      'auto auto',
    );
    const barRecord = barsCy._store.chartAt(
      barsCy.$id('chart-bar-negative')._first().slot,
    );
    expect(barRecord.barDomain).to.deep.equal([-4, 5]);
    barsCy.destroy();

    const palette = featureScenes.create('charts', 'palette');
    const paletteCy = cytoscape({
      elements: palette.elements,
      style: palette.style,
    });
    const maximumRecord = paletteCy._store.chartAt(
      paletteCy.$id('chart-stripes-255')._first().slot,
    );
    expect(maximumRecord.values).to.have.length(255);
    expect(maximumRecord.values.every((value) => value > 0)).to.equal(true);
    expect(
      maximumRecord.values.reduce((sum, value) => sum + value, 0),
    ).to.be.closeTo(1, 0.0002);
    paletteCy.destroy();
  });

  it('fails when a coverage row declares a value that the target does not resolve', function () {
    const scene = featureScenes.create('paint', 'nodes');
    const cy = cytoscape({ elements: scene.elements, style: scene.style });
    const row = scene.coverage.properties.find(
      (entry) => entry.property === 'background-color',
    );

    expect(row).to.exist;
    expect(() =>
      expectResolvedValue(cy, { ...row, value: '#ffffff' }, scene.id),
    ).to.throw();
    cy.destroy();

    const labelScene = featureScenes.create('labels', 'edges');
    const labelCy = cytoscape({
      elements: labelScene.elements,
      style: labelScene.style,
    });
    const mappedRow = labelScene.coverage.keywords.find(
      (entry) => entry.readbackLimitation?.property === 'text-transform',
    );
    expect(mappedRow).to.exist;
    expect(() =>
      expectResolvedValue(
        labelCy,
        {
          ...mappedRow,
          value: 'lowercase',
          readbackLimitation: {
            ...mappedRow.readbackLimitation,
            mappedValue: 'lowercase',
          },
        },
        labelScene.id,
      ),
    ).to.throw();
    labelCy.destroy();
  });

  it('shows the configured collapse factor in effective child size and position', function () {
    const scene = featureScenes.create('compounds', 'miniature');
    const cy = cytoscape({ elements: scene.elements, style: scene.style });
    const expandedParent = cy.$id('parent-expanded');
    const expandedChild = cy.$id('expanded-child-a');
    const miniatureParent = cy.$id('parent-mini');
    const miniatureChild = cy.$id('mini-child-a');
    const factor = miniatureParent.style('collapse-scale');
    const referenceBox = expandedChild.boundingBox({ includeLabels: false });
    const referencePosition = {
      x: expandedChild.position('x') - expandedParent.position('x'),
      y: expandedChild.position('y') - expandedParent.position('y'),
    };

    expect(miniatureParent.collapsed()).to.equal(true);
    const miniatureBox = miniatureChild.boundingBox({ includeLabels: false });
    expect(miniatureBox.w).to.be.closeTo(referenceBox.w * factor, 0.001);
    expect(miniatureBox.h).to.be.closeTo(referenceBox.h * factor, 0.001);
    expect(
      miniatureChild.position('x') - miniatureParent.position('x'),
    ).to.be.closeTo(referencePosition.x * factor, 0.001);
    expect(
      miniatureChild.position('y') - miniatureParent.position('y'),
    ).to.be.closeTo(referencePosition.y * factor, 0.001);

    miniatureParent.expand();
    const restoredBox = miniatureChild.boundingBox({ includeLabels: false });
    expect(restoredBox.w).to.be.closeTo(referenceBox.w, 0.001);
    expect(restoredBox.h).to.be.closeTo(referenceBox.h, 0.001);
    cy.destroy();
  });

  it('restores feature control values from shareable query parameters', function () {
    const bars = featureScenes.create(
      'charts',
      'bars',
      new URLSearchParams([
        ['chartKind', 'bar'],
        ['chartDirection', 'vertical'],
        ['chartSize', '0.55'],
        ['chartOpacity', '0.6'],
        ['chartDomain', '-2 8'],
        ['chartExtreme', '1'],
      ]),
    );
    const barsCy = cytoscape({ elements: bars.elements, style: bars.style });
    const chart = barsCy.$id('chart-bar-horizontal');
    expect(chart.style('chart')).to.equal('bar');
    expect(chart.style('chart-direction')).to.equal('vertical');
    expect(chart.style('chart-size')).to.equal(0.55);
    expect(chart.style('chart-opacity')).to.equal(0.6);
    expect(chart.style('chart-domain')).to.equal('-2 8');
    expect(barsCy.$id('chart-bar-negative').data('values').at(-1)).to.equal(12);
    barsCy.destroy();

    const heat = featureScenes.create(
      'charts',
      'heat',
      new URLSearchParams([
        ['chartKind', 'heat-strip'],
        ['chartHole', '0.35'],
        ['chartAngle', '1.2'],
      ]),
    );
    const heatCy = cytoscape({ elements: heat.elements, style: heat.style });
    expect(heatCy.$id('chart-radial-heat').style('chart')).to.equal(
      'heat-strip',
    );
    expect(heatCy.$id('chart-radial-heat').style('chart-hole')).to.equal(0.35);
    expect(
      heatCy.$id('chart-radial-heat').style('chart-start-angle'),
    ).to.be.closeTo(1.2, 0.000001);
    heatCy.destroy();

    const mapper = featureScenes.create(
      'mappers',
      'scales',
      new URLSearchParams([
        ['mapperScore', '8'],
        ['mapperBypass', '1'],
      ]),
    );
    const mapperCy = cytoscape({
      elements: mapper.elements,
      style: mapper.style,
    });
    expect(mapperCy.$id('map-mid').data('score')).to.equal(8);
    expect(mapperCy.$id('map-mid').style('background-color')).to.equal(
      'rgb(255,0,255)',
    );
    mapperCy.destroy();

    const miniature = featureScenes.create(
      'compounds',
      'miniature',
      new URLSearchParams([
        ['collapseFactor', '0.6'],
        ['collapseExpanded', '1'],
      ]),
    );
    expect(miniature.style.parents['collapse-scale']).to.equal(0.6);

    const padding = featureScenes.create(
      'compounds',
      'padding-width',
      new URLSearchParams([['paddingRelativeTo', 'max']]),
    );
    expect(padding.style.parents['padding-relative-to']).to.equal('max');
    expect(
      padding.coverage.keywords.find(
        (row) => row.property === 'padding-relative-to',
      ).value,
    ).to.equal('max');
    expect(
      padding.elements.nodes.find((entry) => entry.data.id === 'parent-padding')
        .data.label,
    ).to.equal('padding 18% relative to max');

    const emphasized = featureScenes.create('emphasis', 'declutter');
    expect(emphasized.initialState).to.deep.equal({
      emphasize: [
        'focus',
        'neighbor-a',
        'neighbor-b',
        'neighbor-c',
        'neighbor-d',
        'focus-a',
        'focus-b',
        'focus-c',
        'focus-d',
      ],
    });
    expect(emphasized.style.core['dim-opacity']).to.equal(0.52);
    const emphasisCy = cytoscape({
      elements: emphasized.elements,
      style: emphasized.style,
    });
    const closedNeighborhoodIds = [];
    emphasisCy
      .$id('focus')
      .closedNeighborhood()
      .forEach((element) => {
        closedNeighborhoodIds.push(element.id());
      });
    expect([...emphasized.initialState.emphasize].sort()).to.deep.equal(
      closedNeighborhoodIds.sort(),
    );
    emphasisCy.destroy();
  });

  it('mounts font, padding and emphasis controls with URL-backed reset state', function () {
    const makeLocation = (query) => ({
      pathname: '/debug/index.html',
      search: query,
      hash: '',
    });
    const savedUrls = [];
    const location = makeLocation(
      '?network=features&scene=labels&view=font-keywords',
    );
    const history = {
      replaceState(_state, _title, url) {
        savedUrls.push(url);
        const parsed = new URL(url, 'http://localhost');
        location.pathname = parsed.pathname;
        location.search = parsed.search;
        location.hash = parsed.hash;
      },
    };
    const urlScenes = loadScenes({ location, history });

    const font = urlScenes.create('labels', 'font-keywords');
    const fontCy = cytoscape({ elements: font.elements, style: font.style });
    const fontContainer = testContainer();
    const fontPanel = urlScenes.mountControls({
      container: fontContainer,
      sceneId: 'labels',
      viewId: 'font-keywords',
      cy: fontCy,
      params: new URLSearchParams(),
    });
    const fontSelects = descendants(fontPanel.root, 'select');
    const weight = fontSelects.find(
      (select) => select.dataset.control === 'fontWeight',
    );
    const style = fontSelects.find(
      (select) => select.dataset.control === 'fontStyle',
    );
    const family = fontSelects.find(
      (select) => select.dataset.control === 'fontFamily',
    );
    for (const option of font.controlOptions.fontWeight.values) {
      expect(
        option.alternate,
        `font-weight alternate ${option.value}`,
      ).to.equal(expectedFontWeightAlternate(option.value));
      weight.value = String(option.value);
      weight.dispatch('change');
      expect(
        fontCy.$id('label-weight-sample').style('font-weight'),
        `font-weight ${option.value}`,
      ).to.equal(String(option.value));
    }
    weight.value = '700';
    weight.dispatch('change');
    style.value = 'oblique';
    style.dispatch('change');
    family.value = 'serif';
    family.dispatch('change');
    const sample = fontCy.$id('label-weight-sample');
    expect(sample.style('font-weight')).to.equal('700');
    expect(sample.style('font-style')).to.equal('oblique');
    expect(sample.style('font-family')).to.equal('serif');
    expect(new URLSearchParams(location.search).get('fontWeight')).to.equal(
      '700',
    );
    expect(new URLSearchParams(location.search).get('fontStyle')).to.equal(
      'oblique',
    );
    expect(new URLSearchParams(location.search).get('fontFamily')).to.equal(
      'serif',
    );
    descendants(fontPanel.root, 'button')
      .find((button) => button.textContent === 'Reset font controls')
      .dispatch('click');
    expect(sample.style('font-weight')).to.equal('400');
    expect(sample.style('font-style')).to.equal('normal');
    expect(sample.style('font-family')).to.equal('Open Sans');
    expect(new URLSearchParams(location.search).has('fontWeight')).to.equal(
      false,
    );
    fontCy.destroy();

    location.search = '?network=features&scene=compounds&view=padding-width';
    const padding = urlScenes.create('compounds', 'padding-width');
    const paddingCy = cytoscape({
      elements: padding.elements,
      style: padding.style,
    });
    const paddingPanel = urlScenes.mountControls({
      container: testContainer(),
      sceneId: 'compounds',
      viewId: 'padding-width',
      cy: paddingCy,
      params: new URLSearchParams(),
    });
    const reference = descendants(paddingPanel.root, 'select').find(
      (select) => select.dataset.control === 'paddingRelativeTo',
    );
    reference.value = 'max';
    reference.dispatch('change');
    expect(
      paddingCy.$id('parent-padding').style('padding-relative-to'),
    ).to.equal('max');
    expect(paddingCy.$id('parent-padding').data('label')).to.equal(
      'padding 18% relative to max',
    );
    expect(
      new URLSearchParams(location.search).get('paddingRelativeTo'),
    ).to.equal('max');
    descendants(paddingPanel.root, 'button')
      .find((button) => button.textContent === 'Reset padding reference')
      .dispatch('click');
    expect(
      paddingCy.$id('parent-padding').style('padding-relative-to'),
    ).to.equal('width');
    expect(
      new URLSearchParams(location.search).has('paddingRelativeTo'),
    ).to.equal(false);
    paddingCy.destroy();

    location.search = '?network=features&scene=emphasis&view=declutter';
    const emphasis = urlScenes.create('emphasis', 'declutter');
    const emphasisCy = cytoscape({
      elements: emphasis.elements,
      style: emphasis.style,
    });
    const emphasisPanel = urlScenes.mountControls({
      container: testContainer(),
      sceneId: 'emphasis',
      viewId: 'declutter',
      cy: emphasisCy,
      params: new URLSearchParams(),
    });
    const declutter = descendants(emphasisPanel.root, 'select').find(
      (select) => select.dataset.control === 'labelDeclutter',
    );
    const dim = descendants(emphasisPanel.root, 'input').find(
      (input) => input.type === 'range',
    );
    expect(dim.step).to.equal('0.01');
    expect(dim.value).to.equal('0.52');
    expect(Number(emphasisCy._styleEngine.core().dimOpacity)).to.equal(
      Number(dim.value),
    );
    declutter.value = 'none';
    declutter.dispatch('change');
    dim.value = '0.3';
    dim.dispatch('input');
    expect(emphasisCy._styleEngine.core().labelDeclutter).to.equal(0);
    expect(emphasisCy._styleEngine.core().dimOpacity).to.equal(0.3);
    expect(new URLSearchParams(location.search).get('labelDeclutter')).to.equal(
      'none',
    );
    expect(new URLSearchParams(location.search).get('dimOpacity')).to.equal(
      '0.3',
    );
    descendants(emphasisPanel.root, 'button')
      .find((button) => button.textContent === 'Reset declutter controls')
      .dispatch('click');
    expect(emphasisCy._styleEngine.core().labelDeclutter).to.equal(1);
    expect(emphasisCy._styleEngine.core().dimOpacity).to.equal(0.52);
    expect(new URLSearchParams(location.search).has('labelDeclutter')).to.equal(
      false,
    );
    emphasisCy.destroy();
    expect(savedUrls.length).to.be.greaterThan(0);
  });

  it('mounts chart controls against each view target and restores through the view callback', function () {
    const targets = {
      palette: {
        id: 'chart-pie-16',
        extremeId: 'chart-stripes-255',
        alternateKind: 'stripes',
      },
      heat: {
        id: 'chart-radial-heat',
        extremeId: 'chart-heat',
        alternateKind: 'heat-strip',
      },
      bars: {
        id: 'chart-bar-horizontal',
        extremeId: 'chart-bar-negative',
        alternateKind: null,
      },
    };

    for (const [viewId, expected] of Object.entries(targets)) {
      const scene = featureScenes.create('charts', viewId);
      const cy = cytoscape({ elements: scene.elements, style: scene.style });
      const container = testContainer();
      const changes = [];
      const mounted = featureScenes.mountControls({
        container,
        sceneId: 'charts',
        viewId,
        cy,
        onViewChange: (...args) => changes.push(args),
      });
      const selects = descendants(mounted.root, 'select');
      const rangeInputs = descendants(mounted.root, 'input').filter(
        (input) => input.type === 'range',
      );
      const chartSize = rangeInputs[viewId === 'bars' ? 0 : 2];
      expect(chartSize.step, `${viewId}: chart-size step`).to.equal('0.01');
      expect(
        Number(chartSize.value),
        `${viewId}: initial chart-size control matches the target`,
      ).to.equal(Number(cy.$id(expected.id).style('chart-size')));
      if (expected.alternateKind != null) {
        const kind = selects[2];
        const values = kind.children.map((option) => option.value);
        kind.value = expected.alternateKind;
        kind.dispatch('change');
        expect(cy.$id(expected.id).style('chart')).to.equal(
          expected.alternateKind,
        );
        expect(values).to.include(expected.alternateKind);
      }

      const extremeValues = cy.$id(expected.extremeId).data('values').slice();
      const addExtreme = descendants(mounted.root, 'button').find(
        (button) => button.textContent === 'Add chart extreme',
      );
      addExtreme.dispatch('click');
      expect(cy.$id(expected.extremeId).data('values')).to.not.deep.equal(
        extremeValues,
      );

      const reset = descendants(mounted.root, 'button').find(
        (button) => button.textContent === 'Reset scene values',
      );
      reset.dispatch('click');
      expect(changes).to.deep.equal([['charts', viewId]]);
      expect(cy.$id(expected.extremeId).data('values')).to.deep.equal(
        extremeValues,
      );
      if (viewId === 'bars' || viewId === 'palette') {
        const direction = viewId === 'bars' ? selects[2] : selects[3];
        direction.value = 'vertical';
        direction.dispatch('change');
        const directionTarget =
          viewId === 'palette'
            ? cy.$id('chart-stripes-18')
            : cy.$id(expected.id);
        expect(directionTarget.style('chart-direction')).to.equal('vertical');
      }

      if (viewId === 'bars') {
        const domain = descendants(mounted.root, 'input').find(
          (input) => input.type === 'text',
        );
        domain.value = '0 100';
        domain.dispatch('change');
        expect(cy.$id(expected.id).style('chart-domain')).to.equal('0 100');
      }

      mounted.destroy();
      expect(container.children).to.be.empty;
      cy.destroy();
    }
  });
});
