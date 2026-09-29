import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import headless from '../src/headless.mjs';
import {
  COLUMN_SPECS,
  COL,
  FLAG_HOVERED,
  FLAG_SELECTED,
} from '../src/contract.mjs';

/*
Round 106: `cy.clone()` — a second view is a second instance.

Clone equivalence is asserted two ways, each with its control: every
element's `json()` equals the source's, and every `COLUMN_SPECS` column
equals the source's id by id (the round-46.5 columns-equal method) — the
control is a source changed after the clone, which both must reject.

The carriage table the plan asked to measure is a spec here, not a
sentence: what the wire form and the `json()` element form each carry of
an element's flags, and what a clone carries (both, plus the bypasses
through the sheet).

The follow specs drive `follow: { throttle: 0 }` and wait on the clone's
own `patch` event, which a sync is — so "no sync happened" is a count.
*/

const STYLE = {
  nodes: {
    label: 'data(label)',
    width: { data: 'w', domain: [0, 10], range: [10, 110] },
    'background-color': { data: 'w', domain: [0, 10], range: 'viridis' },
  },
  edges: { width: 2, 'line-color': 'gray' },
};

const graph = () => ({
  nodes: [
    { data: { id: 'p', label: 'P' } },
    {
      data: { id: 'a', w: 1, label: 'A', parent: 'p' },
      position: { x: 10, y: 10 },
    },
    {
      data: { id: 'b', w: 2, label: 'B', parent: 'p' },
      position: { x: 60, y: 20 },
      selected: true,
    },
    {
      data: { id: 'c', w: 3, label: 'C' },
      position: { x: 30, y: 90 },
      locked: true,
    },
    {
      data: { id: 'd', w: 4, label: 'D', tags: ['x', 'y'] },
      position: { x: 90, y: 80 },
      grabbable: false,
      pannable: true,
    },
  ],
  edges: [
    { data: { id: 'ab', source: 'a', target: 'b', kind: 'k1' } },
    { data: { id: 'bc', source: 'b', target: 'c' }, selectable: false },
    { data: { id: 'cd', source: 'c', target: 'd' }, pannable: false },
  ],
});

const make = (extra = {}) =>
  cytoscape({ elements: graph(), style: STYLE, ...extra });

const jsonsById = (cy) =>
  Object.fromEntries(
    cy
      .elements()
      .jsons()
      .map((j) => [j.data.id, j]),
  );

/** Every column equal, id by id (endpoints compared as ids). */
const columnDiffs = (a, b, { maskSelected = false } = {}) => {
  const diffs = [];

  // compound parents' bounds are derived lazily: settle both first
  a._store.flushDerived();
  b._store.flushDerived();

  for (const spec of COLUMN_SPECS) {
    const ca = a._store.column(spec.id);
    const cb = b._store.column(spec.id);
    const n = spec.components;
    const eles = spec.group === 'nodes' ? a.nodes() : a.edges();

    for (let i = 0; i < eles.length; i++) {
      const id = eles[i].id();
      const sa = a._store.lookup(id).slot;
      const ref = b._store.lookup(id);

      if (ref == null) {
        diffs.push(`${id} missing`);
        continue;
      }

      for (let k = 0; k < n; k++) {
        let va = ca[sa * n + k];
        let vb = cb[ref.slot * n + k];

        if (spec.id === COL.EDGE_ENDPOINTS) {
          va = a._store.idAt('nodes', va);
          vb = b._store.idAt('nodes', vb);
        }

        if (
          maskSelected &&
          (spec.id === COL.NODE_FLAGS || spec.id === COL.EDGE_FLAGS)
        ) {
          va &= ~FLAG_SELECTED;
          vb &= ~FLAG_SELECTED;
        }

        if (!Object.is(va, vb)) {
          diffs.push(`${spec.id}[${k}] of ${id}`);
        }
      }
    }
  }

  if (a.elements().length !== b.elements().length) {
    diffs.push('element count');
  }

  return diffs;
};

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

/** Resolve on the follower's next sync (its patch event); reject after 1 s,
 * so a sync that never comes fails the spec rather than hanging the tier. */
const nextSync = (cy) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no sync came')), 1000);

    cy.one('patch', (e) => {
      clearTimeout(timer);
      resolve(e.diff);
    });
  });

describe('cy.clone() (round 106)', function () {
  describe('one-shot', function () {
    it('equals its source: every element json and every column', function () {
      const cy = make();

      cy.$id('a').style('background-color', 'red'); // a bypass
      cy.data({ title: 'graph' });

      const copy = cy.clone();

      expect(jsonsById(copy)).to.deep.equal(jsonsById(cy));
      expect(columnDiffs(cy, copy)).to.deep.equal([]);
      expect(copy.data()).to.deep.equal({ title: 'graph' });
      expect(copy.style().json()).to.deep.equal(cy.style().json());
      expect(copy.$id('a').style('background-color')).to.equal(
        cy.$id('a').style('background-color'),
      );

      cy.destroy();
      copy.destroy();
    });

    it('control: the comparisons reject a source changed after the clone', function () {
      const cy = make();
      const copy = cy.clone();

      cy.$id('c').unlock();
      cy.$id('c').position({ x: 999, y: 0 });
      cy.$id('d').data('w', 9);

      expect(jsonsById(copy)).to.not.deep.equal(jsonsById(cy));
      expect(columnDiffs(cy, copy)).to.include.members([
        'node.position[0] of c',
      ]);
      expect(columnDiffs(cy, copy).some((d) => d.endsWith(' of d'))).to.equal(
        true,
      );

      cy.destroy();
      copy.destroy();
    });

    it('measures what each source form carries of an element (the carriage table)', function () {
      const cy = make();
      const flags = (c) =>
        Object.fromEntries(
          c.elements().map((e) => [
            e.id(),
            {
              selected: e.selected(),
              selectable: e.selectable(),
              locked: e.locked(),
              grabbable: e.json().grabbable,
              pannable: e.pannable(),
            },
          ]),
        );
      const truth = flags(cy);
      const wire = cytoscape({ elements: cy.serialize() });
      const defs = cytoscape({ elements: cy.elements().jsons() });
      const copy = cy.clone();
      const lost = (c) =>
        Object.keys(truth).flatMap((id) =>
          Object.keys(truth[id])
            .filter((k) => flags(c)[id][k] !== truth[id][k])
            .map((k) => `${id}.${k}`),
        );

      // the wire carries selection state and nothing else of the flags
      expect(lost(wire)).to.have.members([
        'c.locked',
        'd.grabbable',
        'd.pannable',
        'cd.pannable',
      ]);
      // the definition form carries every flag
      expect(lost(defs)).to.deep.equal([]);
      // a clone is the wire plus the three flags copied slot for slot
      expect(lost(copy)).to.deep.equal([]);

      // bypasses ride neither element form: they are the sheet's
      cy.$id('a').style('width', 77);
      expect(
        cytoscape({ elements: cy.elements().jsons(), style: STYLE })
          .$id('a')
          .style('width'),
      ).to.not.equal(77);
      expect(cy.clone().$id('a').style('width')).to.equal(77);

      for (const c of [cy, wire, defs, copy]) {
        c.destroy();
      }
    });

    it('carries the viewport, the gating flags and the interaction settings', function () {
      const cy = make({ headlessWidth: 400, headlessHeight: 300 });

      cy.zoom(2);
      cy.pan({ x: 13, y: -7 });
      cy.minZoom(0.5);
      cy.maxZoom(8);
      cy.autoungrabify(true);
      cy.userZoomingEnabled(false);
      cy.boxSelectionEnabled(false);
      cy.selectionType('additive');
      cy.tapholdDuration(900);
      cy.desktopTapThreshold(9);

      const copy = cy.clone();

      expect(copy.zoom()).to.equal(2);
      expect(copy.pan()).to.deep.equal({ x: 13, y: -7 });
      expect(copy.minZoom()).to.equal(0.5);
      expect(copy.maxZoom()).to.equal(8);
      expect(copy.autoungrabify()).to.equal(true);
      expect(copy.userZoomingEnabled()).to.equal(false);
      expect(copy.boxSelectionEnabled()).to.equal(false);
      expect(copy.selectionType()).to.equal('additive');
      expect(copy.tapholdDuration()).to.equal(900);
      expect(copy.desktopTapThreshold()).to.equal(9);
      expect(copy.width()).to.equal(400);
      expect(copy.height()).to.equal(300);
      expect(copy.options().elements, 'the clone retained its payload').to.be
        .undefined;

      cy.destroy();
      copy.destroy();
    });

    it('takes overrides: a sheet (replacing the bypasses), a viewport, a layout', function () {
      const cy = make();

      cy.$id('a').style('background-color', 'red');

      const mini = { nodes: { 'background-color': 'black', width: 4 } };
      const copy = cy.clone({
        style: mini,
        zoom: 0.25,
        layout: { name: 'grid', cols: 2 },
      });

      expect(copy.style().json()).to.deep.equal(mini);
      expect(copy.$id('a').style('background-color')).to.equal('rgb(0,0,0)');
      expect(copy.$id('d').position()).to.not.deep.equal(
        cy.$id('d').position(),
      );
      // the layout ran on the copy only
      expect(cy.$id('d').position()).to.deep.equal({ x: 90, y: 80 });
      expect(cy.zoom()).to.equal(1);

      cy.destroy();
      copy.destroy();
    });

    it('leaves out scratch, listeners, animations and transient state', function () {
      const cy = make();
      let heard = 0;

      cy.$id('a').scratch('app', { k: 1 });
      cy.on('data', () => heard++);
      cy.$id('d').animate(
        { position: { x: 500, y: 500 } },
        { duration: 10000 },
      );
      cy._store.setFlag(
        'nodes',
        cy._store.lookup('b').slot,
        FLAG_HOVERED,
        true,
      );

      const copy = cy.clone();

      expect(copy.$id('a').scratch('app')).to.be.undefined;
      copy.$id('a').data('w', 5);
      expect(heard, 'a listener was carried').to.equal(0);
      expect(copy.$id('d').animated()).to.equal(false);
      expect(
        copy._store.column(COL.NODE_FLAGS)[copy._store.lookup('b').slot] &
          FLAG_HOVERED,
      ).to.equal(0);

      cy.destroy();
      copy.destroy();
    });

    it('is independent of its source', function () {
      const cy = make();
      const copy = cy.clone();

      copy.$id('a').data('w', 8);
      copy.remove(copy.$id('ab'));
      cy.$id('b').position({ x: 0, y: 0 });

      expect(cy.$id('a').data('w')).to.equal(1);
      expect(cy.$id('ab').length).to.equal(1);
      expect(copy.$id('b').position()).to.deep.equal({ x: 60, y: 20 });

      cy.destroy();
      copy.destroy();
    });

    it('is built by the same entry as its source', function () {
      const cy = headless({ elements: graph() });
      const copy = cy.clone();
      const fakeContainer = { clientWidth: 10, clientHeight: 10 };

      expect(copy.nodes().length).to.equal(5);
      expect(() => cy.clone({ container: fakeContainer })).to.throw(
        /this build has no renderer/,
      );
      expect(() => copy.mount(fakeContainer)).to.throw(
        /this build has no renderer/,
      );

      cy.destroy();
      copy.destroy();
    });

    it('refuses elements and a malformed follow', function () {
      const cy = make();

      expect(() => cy.clone({ elements: [] })).to.throw(/takes no 'elements'/);
      expect(() => cy.clone({ follow: 'yes' })).to.throw(
        /follow must be a boolean or/,
      );
      expect(() => cy.clone({ follow: { every: 5 } })).to.throw(
        /Unknown follow option 'every'/,
      );
      expect(() => cy.clone({ follow: { throttle: -1 } })).to.throw(
        /follow.throttle must be a non-negative/,
      );
      expect(cy._store.consumers, 'a refused clone registered').to.have.length(
        0,
      );

      cy.destroy();
    });
  });

  describe('follow', function () {
    let cy;
    let copy;

    beforeEach(function () {
      cy = make();
      copy = cy.clone({ follow: { throttle: 0 } });
    });

    afterEach(function () {
      cy.destroy();
      copy.destroy();
    });

    it('follows adds, removes, moves, data writes, rewires and reparents', async function () {
      const steps = [
        () => cy.add({ data: { id: 'e', w: 5 }, position: { x: 5, y: 5 } }),
        () => cy.add({ data: { id: 'de', source: 'd', target: 'e' } }),
        () => cy.remove(cy.$id('ab')),
        () => cy.$id('a').position({ x: 222, y: 111 }),
        () => cy.$id('d').data('w', 7), // a mapped key
        () => cy.$id('d').data('note', 'unwatched'),
        () => cy.$id('e').move({ parent: 'p' }),
        () => cy.$id('cd').move({ target: 'e' }),
        () => cy.remove(cy.$id('p')),
      ];

      for (const step of steps) {
        const synced = nextSync(copy);

        step();
        await synced;
        expect(columnDiffs(cy, copy, { maskSelected: true })).to.deep.equal([]);
      }

      const strip = (j) => ({ ...j, selected: undefined });

      expect(Object.values(jsonsById(copy)).map(strip)).to.deep.equal(
        Object.values(jsonsById(cy)).map(strip),
      );
    });

    it('owns its state: selection, hover and restyles on the source sync nothing', async function () {
      let syncs = 0;

      copy.on('patch', () => syncs++);

      cy.$id('a').select();
      cy.$id('b').unselect();
      cy.style({ nodes: { 'background-color': 'green' } });
      cy.$id('c').style('width', 50);
      await tick(5);

      expect(syncs, 'a view-state change on the source synced').to.equal(0);
      expect(copy.$id('a').selected()).to.equal(false);
      expect(copy.$id('b').selected()).to.equal(true);

      copy.$id('c').select();
      expect(cy.$id('c').selected()).to.equal(false);

      // the control: a data write does sync
      cy.$id('a').data('label', 'A2');
      await tick(5);
      expect(syncs).to.equal(1);
      expect(copy.$id('a').data('label')).to.equal('A2');
      expect(copy.$id('a').selected(), 'a sync selected').to.equal(false);
    });

    it('moves a node the clone locks: the source owns positions', async function () {
      const locked = cy.clone({ follow: { throttle: 0 }, autolock: true });

      locked.$id('a').lock();

      const synced = nextSync(locked);

      cy.$id('a').position({ x: -40, y: -40 });
      cy.$id('d').position({ x: -80, y: 40 });
      await synced;

      expect(locked.$id('a').position()).to.deep.equal({ x: -40, y: -40 });
      expect(locked.$id('d').position()).to.deep.equal({ x: -80, y: 40 });
      expect(locked.autolock()).to.equal(true);
      locked.destroy();
    });

    it('coalesces a burst into one sync, and throttles the next', async function () {
      const slow = cy.clone({ follow: { throttle: 40 } });
      const at = [];

      slow.on('patch', () => at.push(Date.now()));

      for (let i = 0; i < 50; i++) {
        cy.$id('a').position({ x: i, y: i });
      }

      await tick(10);
      expect(at).to.have.length(1);

      cy.$id('a').position({ x: 1000, y: 0 });
      await tick(10);
      expect(at, 'the second burst was not throttled').to.have.length(1);

      await tick(60);
      expect(at).to.have.length(2);
      expect(at[1] - at[0]).to.be.at.least(35);
      expect(slow.$id('a').position()).to.deep.equal({ x: 1000, y: 0 });
      slow.destroy();
    });

    it('stops when the source is destroyed', async function () {
      const source = make();
      const f = source.clone({ follow: { throttle: 0 } });
      let syncs = 0;

      f.on('patch', () => syncs++);
      source.$id('a').position({ x: 1, y: 1 });
      source.destroy();
      await tick(5);

      expect(syncs, 'a sync ran after the source was destroyed').to.equal(0);
      expect(source._store.consumers).to.have.length(0);
      expect(f._follows.size).to.equal(0);
      f.destroy();
    });

    it('stops when the clone is destroyed, releasing the source', async function () {
      expect(cy._store.consumers).to.have.length(1);

      copy.destroy();
      expect(cy._store.consumers).to.have.length(0);
      expect(cy._follows.size).to.equal(0);

      cy.$id('a').position({ x: 3, y: 3 });
      await tick(5);
      expect(copy.$id('a').position()).to.deep.equal({ x: 10, y: 10 });
    });
  });
});
