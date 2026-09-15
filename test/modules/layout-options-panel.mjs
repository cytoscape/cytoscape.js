import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import cytoscape from '../../src/index.mjs';

// Round 125.11: the debug page's options panel — every option a layout
// takes, on the page.  The gate here is the declaration: each layout
// option interface in src/public-types.mts is read as text, and every
// member has to be in the panel's table, owned by an existing control,
// or excluded with a reason — and nothing in the table may be unknown
// to the interface.  Defaults written in the table are checked against
// the library's resolved defaults where a layout exposes them.

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const DEBUG = join(ROOT, 'debug');

const loadGlobal = (name) => {
  const src = readFileSync(join(DEBUG, `${name}.js`), 'utf8');
  const ctx = createContext({ module: { exports: {} }, console, TextDecoder });

  runInContext(src, ctx);

  return ctx.module.exports;
};

const panel = loadGlobal('layout-options');
const layoutConfig = loadGlobal('layout-config');
const types = readFileSync(join(ROOT, 'src/public-types.mts'), 'utf8');

/** the member names of an exported interface, read as text */
const membersOf = (name) => {
  const at = types.indexOf(`export interface ${name}`);

  expect(at, name).to.be.at.least(0);

  const body = types.slice(at, types.indexOf('\n}', at));
  const names = [];

  for (const m of body.matchAll(/^\s{2}([a-zA-Z]+)\??:/gm)) {
    names.push(m[1]);
  }

  return names;
};

const INTERFACES = {
  grid: 'GridLayoutOptions',
  circle: 'CircleLayoutOptions',
  concentric: 'ConcentricLayoutOptions',
  breadthfirst: 'BreadthFirstLayoutOptions',
  radial: 'RadialLayoutOptions',
  flow: 'FlowLayoutOptions',
  force: 'ForceLayoutOptions',
  preset: 'PresetLayoutOptions',
  random: 'RandomLayoutOptions',
  pack: 'PackLayoutOptions',
};

/** which layouts extend ComponentPackingOptions, read from the source */
const packs = (name) =>
  new RegExp(
    `export interface ${INTERFACES[name]}\\s+extends[^{]*ComponentPackingOptions`,
  ).test(types);

const surfaceOf = (name) => {
  const own = membersOf(INTERFACES[name]);
  const base = membersOf('LayoutBaseOptions');
  const packing = packs(name) ? membersOf('ComponentPackingOptions') : [];

  return new Set([...own, ...base, ...packing]);
};

describe('debug/layout-options: the options panel (round 125.11)', function () {
  const html = readFileSync(join(DEBUG, 'index.html'), 'utf8');

  it('the page carries the panel, its readout and the script', function () {
    expect(html).to.include('id="layout-options"');
    expect(html).to.include('id="layout-call"');
    expect(html).to.include('<script src="layout-options.js">');
  });

  for (const name of Object.keys(INTERFACES)) {
    it(`${name}: every option is in the table, owned by a control, or excluded with a reason`, function () {
      const surface = surfaceOf(name);
      const inTable = new Set(panel.specsFor(name).map((s) => s.key));
      const missing = [...surface].filter(
        (k) =>
          !inTable.has(k) &&
          panel.OWNED[k] == null &&
          panel.EXCLUDED[k] == null,
      );
      const unknown = [...inTable].filter((k) => !surface.has(k));

      expect(missing, `${name}: not on the page`).to.deep.equal([]);
      expect(unknown, `${name}: not in the declaration`).to.deep.equal([]);
    });
  }

  it('control: an option struck from the table is reported missing', function () {
    const surface = surfaceOf('flow');
    const inTable = new Set(
      panel
        .specsFor('flow')
        .map((s) => s.key)
        .filter((k) => k !== 'nodeSep'),
    );
    const missing = [...surface].filter(
      (k) =>
        !inTable.has(k) && panel.OWNED[k] == null && panel.EXCLUDED[k] == null,
    );

    expect(missing).to.deep.equal(['nodeSep']);
  });

  it('every OWNED and EXCLUDED key names a real option somewhere', function () {
    const all = new Set();

    for (const name of Object.keys(INTERFACES)) {
      for (const k of surfaceOf(name)) {
        all.add(k);
      }
    }

    // the two the contract adds outside the built-ins' interfaces
    all.add('impl');
    all.add('tidyComponents');

    for (const k of [
      ...Object.keys(panel.OWNED),
      ...Object.keys(panel.EXCLUDED),
    ]) {
      expect(
        all.has(k),
        `${k} is owned or excluded but no layout takes it`,
      ).to.equal(true);
    }
  });

  it("the table's defaults are the library's, where a layout exposes them", function () {
    const cy = cytoscape({ headless: true, elements: [{ data: { id: 'a' } }] });

    for (const name of [
      'grid',
      'circle',
      'concentric',
      'breadthfirst',
      'radial',
      'random',
      'pack',
    ]) {
      const layout = cy.layout({ name });
      const resolved = layout.options;

      expect(resolved, `${name} exposes options`).to.be.an('object');

      for (const spec of panel.specsFor(name)) {
        if (spec.def === undefined || !(spec.key in resolved)) {
          continue;
        }

        expect(resolved[spec.key], `${name}.${spec.key}`).to.deep.equal(
          spec.def,
        );
      }
    }
  });

  describe('read()', function () {
    it('sends only the fields that differ from the default, parsed by type', function () {
      const out = panel.read('flow', {
        direction: 'rightward',
        nodeSep: '30',
        rankSep: '60', // the default: left out
        thoroughness: '',
        acyclic: true,
        minLength: '{"data":"w"}',
        fit: false,
        padding: '30',
      });

      expect(out).to.deep.equal({
        direction: 'rightward',
        nodeSep: 30,
        acyclic: true,
        minLength: { data: 'w' },
        fit: false,
      });
    });

    it('a boolean at its default is left out; an unset one sends nothing', function () {
      expect(panel.read('grid', { condense: false })).to.deep.equal({});
      expect(panel.read('grid', { condense: undefined })).to.deep.equal({});
      expect(panel.read('grid', { condense: true })).to.deep.equal({
        condense: true,
      });
    });

    it('a number field that is not a number, and json that is not json, throw naming the option', function () {
      // the page module runs in a vm context, so its TypeError is another
      // realm's: match the message, not the constructor
      expect(() => panel.read('flow', { nodeSep: 'wide' })).to.throw(
        /nodeSep: not a number/,
      );
      expect(() => panel.read('flow', { rankConstraints: '{min' })).to.throw(
        /rankConstraints: not JSON/,
      );
    });

    it("the force combo entry reads force's table", function () {
      expect(panel.specsFor('force-by-sign')).to.deep.equal(
        panel.specsFor('force'),
      );
    });
  });

  it('describe() spells the call, functions as a marker', function () {
    const text = panel.describe({
      name: 'flow',
      direction: 'rightward',
      componentOrder: () => 0,
    });

    expect(text).to.match(/^cy\.layout\(/);
    expect(text).to.include('"direction": "rightward"');
    expect(text).to.include('"[function]"');
  });

  it("the seed box drives random (125.8's sitting)", function () {
    expect(layoutConfig.layoutOptions('random', { seed: '7' }).seed).to.equal(
      7,
    );
    expect(layoutConfig.layoutOptions('random', {}).seed).to.equal(undefined);
    expect(layoutConfig.layoutOptions('random', { seed: '' }).seed).to.equal(
      undefined,
    );
  });
});
