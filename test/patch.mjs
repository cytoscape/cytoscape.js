import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { COLUMN_SPECS, COL, FLAG_SELECTED } from '../src/contract.mjs';

/*
Round 107: `cy.patch()`, the id-keyed reconcile of a fresh payload.

The three controls the plan names each carry their own control, run in
the same file: the identity patch (an empty diff, zero element events,
zero net dirty spans) against the same payload with one data value
perturbed; the listener census (each event once, inside one batch)
against a payload that changes each class once; and end-state
equivalence (patch A→B leaves the columns a fresh load of B has, id by
id) against a fresh load of a B with one value moved — which the
comparison must reject, or it compares nothing.
*/

const STYLE = {
  nodes: {
    label: 'data(label)',
    width: { data: 'w', domain: [0, 10], range: [10, 110] },
    'background-color': { data: 'w', domain: [0, 10], range: 'viridis' },
  },
  edges: { width: { data: 'ew', domain: [0, 10], range: [1, 5] } },
};

const graphA = () => ({
  nodes: [
    { data: { id: 'a', w: 1, label: 'A' }, position: { x: 10, y: 10 } },
    { data: { id: 'b', w: 2, label: 'B' }, position: { x: 20, y: 20 } },
    { data: { id: 'c', w: 3, label: 'C' }, position: { x: 30, y: 30 } },
    { data: { id: 'd', w: 4, label: 'D' }, position: { x: 40, y: 40 } },
  ],
  edges: [
    { data: { id: 'ab', source: 'a', target: 'b', ew: 1 } },
    { data: { id: 'bc', source: 'b', target: 'c', ew: 2 } },
    { data: { id: 'cd', source: 'c', target: 'd', ew: 3 } },
  ],
});

/** A's next state: d dropped, e new, b's weight changed, c moved, cd
 * gone with d, bc rewired to e, ce new. */
const graphB = () => ({
  nodes: [
    { data: { id: 'a', w: 1, label: 'A' }, position: { x: 10, y: 10 } },
    { data: { id: 'b', w: 7, label: 'B' }, position: { x: 20, y: 20 } },
    { data: { id: 'c', w: 3, label: 'C' }, position: { x: 33, y: 31 } },
    { data: { id: 'e', w: 5, label: 'E' }, position: { x: 50, y: 50 } },
  ],
  edges: [
    { data: { id: 'ab', source: 'a', target: 'b', ew: 1 } },
    { data: { id: 'bc', source: 'b', target: 'e', ew: 2 } },
    { data: { id: 'ce', source: 'c', target: 'e', ew: 4 } },
  ],
});

const load = (elements, opts = {}) =>
  cytoscape({ elements, style: STYLE, ...opts });

const ids = (eles) => eles.map((ele) => ele.id());

const FORMS = {
  definition: (defs) => defs,
  columnar: (defs) => cytoscape.toColumnarElements(defs),
  wire: (defs) => cytoscape.serializeElements(defs),
};

/** Drain the store's dirty state, as a frame would. */
const settle = (cy) => {
  cy._store.flushDerived();
  cy._store.takeDelta();
  cy._store.takeMapperSpans();
};

/** Every element event a census listener records, in order. */
const ELEMENT_EVENTS = ['add', 'remove', 'data', 'position', 'moveout', 'move'];

const census = (cy) => {
  const events = [];

  for (const type of ELEMENT_EVENTS) {
    cy.on(type, (evt) => {
      events.push({
        type,
        id: evt.target.id(),
        batching: cy.batching(),
      });
    });
  }

  return events;
};

/**
 * Compare two instances' columns id by id: every column of every
 * element, endpoints compared as ids, flags compared without the bits
 * a patch deliberately preserves (selection).
 */
const expectColumnsEqualById = (patched, fresh) => {
  for (const spec of COLUMN_SPECS) {
    const group = spec.group;
    const a = patched._store.column(spec.id);
    const b = fresh._store.column(spec.id);
    const n = spec.components;

    const eles = group === 'nodes' ? fresh.nodes() : fresh.edges();

    for (let i = 0; i < eles.length; i++) {
      const id = eles[i].id();
      const sb = fresh._store.lookup(id).slot;
      const ref = patched._store.lookup(id);

      expect(ref, `${id} exists after the patch`).to.not.equal(undefined);

      const sa = ref.slot;

      for (let k = 0; k < n; k++) {
        let va = a[sa * n + k];
        let vb = b[sb * n + k];

        if (spec.id === COL.EDGE_ENDPOINTS) {
          va = patched._store.idAt('nodes', va);
          vb = fresh._store.idAt('nodes', vb);
        }
        if (spec.id === COL.NODE_FLAGS || spec.id === COL.EDGE_FLAGS) {
          va &= ~FLAG_SELECTED;
          vb &= ~FLAG_SELECTED;
        }

        expect(va, `${spec.id}[${k}] of '${id}'`).to.equal(vb);
      }
    }
  }

  expect(patched.nodes().length).to.equal(fresh.nodes().length);
  expect(patched.edges().length).to.equal(fresh.edges().length);
};

describe('cy.patch() (round 107)', function () {
  describe('the identity patch', function () {
    for (const [form, make] of Object.entries(FORMS)) {
      it(`changes nothing from the ${form} form: an empty diff, no element event, no dirty span`, function () {
        const cy = load(graphA());
        const events = census(cy);

        settle(cy);

        const diff = cy.patch(make(graphA()));

        expect(diff.added.length).to.equal(0);
        expect(diff.removed.length).to.equal(0);
        expect(diff.updated.length).to.equal(0);
        expect(events).to.deep.equal([]);
        expect(cy._store.hasDirty()).to.equal(false);
        expect(cy._store.takeDelta().spans).to.deep.equal([]);
        expect(cy._store.takeMapperSpans()).to.deep.equal([]);
        cy.destroy();
      });
    }

    it('from its own serialize(): the clone-sync shape', function () {
      const cy = load(graphA());
      const events = census(cy);

      settle(cy);

      const diff = cy.patch(cy.serialize());

      expect(
        diff.updated.length + diff.added.length + diff.removed.length,
      ).to.equal(0);
      expect(events).to.deep.equal([]);
      expect(cy._store.hasDirty()).to.equal(false);
      cy.destroy();
    });

    it('control: one perturbed value makes every assertion bite', function () {
      const cy = load(graphA());
      const events = census(cy);

      settle(cy);

      const payload = graphA();

      payload.nodes[1].data.w = 9;

      const diff = cy.patch(payload);

      expect(ids(diff.updated)).to.deep.equal(['b']);
      expect(events.map((e) => `${e.type}:${e.id}`)).to.deep.equal(['data:b']);
      cy._store.flushDerived();
      expect(cy._store.takeDelta().spans.length).to.be.above(0);
      cy.destroy();
    });

    it('compares object values structurally, not by reference', function () {
      const cy = load([
        { data: { id: 'a', meta: { tags: ['x', 'y'], n: 1 } } },
      ]);

      settle(cy);

      const same = cy.patch([
        { data: { id: 'a', meta: { tags: ['x', 'y'], n: 1 } } },
      ]);

      expect(same.updated.length).to.equal(0);

      const changed = cy.patch([
        { data: { id: 'a', meta: { tags: ['x', 'z'], n: 1 } } },
      ]);

      expect(ids(changed.updated)).to.deep.equal(['a']);
      expect(cy.$id('a').data('meta')).to.deep.equal({
        tags: ['x', 'z'],
        n: 1,
      });
      cy.destroy();
    });
  });

  describe('the event contract', function () {
    it('fires each element event once, inside one batch, then one patch event with the diff', function () {
      const cy = load(graphA());
      const events = census(cy);
      const summaries = [];

      cy.on('patch', (evt) => {
        summaries.push({ evt, batching: cy.batching() });
      });

      const diff = cy.patch(graphB());
      const seen = events.map((e) => `${e.type}:${e.id}`);

      // removes first: d and its edge cd, and bc (rewired: remove + add)
      expect(seen.filter((s) => s.startsWith('remove:')).sort()).to.deep.equal([
        'remove:bc',
        'remove:cd',
        'remove:d',
      ]);
      expect(seen.filter((s) => s.startsWith('add:'))).to.deep.equal([
        'add:e',
        'add:bc',
        'add:ce',
      ]);
      expect(seen.filter((s) => s.startsWith('data:'))).to.deep.equal([
        'data:b',
      ]);
      expect(seen.filter((s) => s.startsWith('position:'))).to.deep.equal([
        'position:c',
      ]);
      expect(events.every((e) => e.batching)).to.equal(true);
      expect(new Set(seen).size).to.equal(seen.length);

      // the summary: once, after the batch, carrying the returned diff
      expect(summaries).to.have.length(1);
      expect(summaries[0].batching).to.equal(false);
      expect(summaries[0].evt.diff).to.equal(diff);
      expect(summaries[0].evt.target).to.equal(cy);
      cy.destroy();
    });

    it('control: a no-op payload fires the summary alone, with an empty diff', function () {
      const cy = load(graphB());
      const events = census(cy);
      let summary = null;

      cy.on('patch', (evt) => {
        summary = evt.diff;
      });
      cy.patch(graphB());

      expect(events).to.deep.equal([]);
      expect(
        summary.added.length + summary.removed.length + summary.updated.length,
      ).to.equal(0);
      cy.destroy();
    });

    it('returns the diff: added, removed (ids still readable) and updated', function () {
      const cy = load(graphA());
      const diff = cy.patch(graphB());

      expect(ids(diff.added)).to.deep.equal(['e', 'bc', 'ce']);
      expect(ids(diff.removed).sort()).to.deep.equal(['bc', 'cd', 'd']);
      expect(diff.removed.every((ele) => ele.removed())).to.equal(true);
      expect(ids(diff.updated)).to.deep.equal(['b', 'c']);
      cy.destroy();
    });
  });

  describe('end-state equivalence', function () {
    for (const [form, make] of Object.entries(FORMS)) {
      it(`patch A→B from the ${form} form leaves the columns of a fresh load of B`, function () {
        const patched = load(graphA());

        patched.patch(make(graphB()));

        const fresh = load(graphB());

        expectColumnsEqualById(patched, fresh);
        patched.destroy();
        fresh.destroy();
      });
    }

    it('control: against a fresh load of a B with one value moved, the comparison fails', function () {
      const patched = load(graphA());

      patched.patch(graphB());

      const other = graphB();

      other.nodes[1].data.w = 8;

      const fresh = load(other);

      expect(() => expectColumnsEqualById(patched, fresh)).to.throw(/of 'b'/);
      patched.destroy();
      fresh.destroy();
    });
  });

  describe('the semantics', function () {
    it("'reconcile' removes what the payload does not name; 'merge' keeps it", function () {
      const reconcile = load(graphA());

      reconcile.patch([{ data: { id: 'a', w: 1, label: 'A' } }]);
      expect(ids(reconcile.elements())).to.deep.equal(['a']);

      const merge = load(graphA());
      const diff = merge.patch([{ data: { id: 'a', w: 5, label: 'A' } }], {
        mode: 'merge',
      });

      expect(merge.elements().length).to.equal(7);
      expect(diff.removed.length).to.equal(0);
      expect(merge.$id('a').data('w')).to.equal(5);
      reconcile.destroy();
      merge.destroy();
    });

    it("'merge' lets a definition payload name kept nodes as endpoints and parents", function () {
      const cy = load(graphA());
      const diff = cy.patch(
        [
          { data: { id: 'x', parent: 'd' } },
          { data: { id: 'ax', source: 'a', target: 'x' } },
        ],
        { mode: 'merge' },
      );

      expect(ids(diff.added)).to.deep.equal(['x', 'ax']);
      expect(cy.$id('ax').source().id()).to.equal('a');
      expect(cy.$id('x').parent().id()).to.equal('d');
      cy.destroy();
    });

    it('replaces the data record rather than merging into it', function () {
      const cy = load([
        { data: { id: 'a', w: 1, keep: 'x', nested: { p: 1, q: 2 } } },
      ]);

      cy.patch([{ data: { id: 'a', w: 2, nested: { p: 1 } } }]);

      expect(cy.$id('a').data()).to.deep.equal({
        id: 'a',
        w: 2,
        nested: { p: 1 },
      });
      cy.destroy();
    });

    it('clears a key the columnar payload does not carry at all', function () {
      const cy = load([{ data: { id: 'a', w: 1, label: 'A' } }]);
      const diff = cy.patch(
        cytoscape.toColumnarElements([{ data: { id: 'a', w: 1 } }]),
      );

      expect(ids(diff.updated)).to.deep.equal(['a']);
      expect(cy.$id('a').data('label')).to.equal(undefined);
      cy.destroy();
    });

    it('writes a position the payload carries and keeps one it does not', function () {
      const cy = load(graphA());

      cy.patch([
        { data: { id: 'a', w: 1, label: 'A' } },
        { data: { id: 'b', w: 2, label: 'B' }, position: { x: 99, y: 98 } },
      ]);

      expect(cy.$id('a').position()).to.deep.equal({ x: 10, y: 10 });
      expect(cy.$id('b').position()).to.deep.equal({ x: 99, y: 98 });
      cy.destroy();
    });

    it('holds a locked node, and every node under autolock', function () {
      const cy = load(graphA());

      cy.$id('a').lock();

      const diff = cy.patch([
        { data: { id: 'a', w: 1, label: 'A' }, position: { x: 1, y: 1 } },
        { data: { id: 'b', w: 2, label: 'B' }, position: { x: 2, y: 2 } },
      ]);

      expect(cy.$id('a').position()).to.deep.equal({ x: 10, y: 10 });
      expect(cy.$id('b').position()).to.deep.equal({ x: 2, y: 2 });
      expect(ids(diff.updated)).to.deep.equal(['b']);

      cy.autolock(true);
      cy.patch([
        { data: { id: 'a', w: 1, label: 'A' }, position: { x: 1, y: 1 } },
        { data: { id: 'b', w: 2, label: 'B' }, position: { x: 3, y: 3 } },
      ]);
      expect(cy.$id('b').position()).to.deep.equal({ x: 2, y: 2 });
      cy.destroy();
    });

    it('turns a rewired edge into a remove and an add under the same id', function () {
      const cy = load(graphA());
      const before = cy.$id('bc');
      const diff = cy.patch(graphB());

      expect(ids(diff.removed)).to.include('bc');
      expect(ids(diff.added)).to.include('bc');
      expect(before.removed()).to.equal(true);
      expect(cy.$id('bc').target().id()).to.equal('e');
      cy.destroy();
    });

    it('treats a changed source like a changed target', function () {
      const cy = load(graphA());
      const payload = graphA();

      payload.edges[0].data.source = 'c'; // ab: a→b becomes c→b
      const diff = cy.patch(payload);

      expect(ids(diff.removed)).to.deep.equal(['ab']);
      expect(ids(diff.added)).to.deep.equal(['ab']);
      expect(cy.$id('ab').source().id()).to.equal('c');
      cy.destroy();
    });

    it('turns an id that changed group into a remove and an add', function () {
      const cy = load(graphA());
      const diff = cy.patch([
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'c' } },
        { data: { id: 'd' } },
        { data: { id: 'ab' } }, // was an edge, now a node
        { data: { id: 'x', source: 'a', target: 'b' } },
      ]);

      expect(cy.$id('ab').isNode()).to.equal(true);
      expect(ids(diff.removed)).to.include('ab');
      expect(ids(diff.added)).to.include('ab');
      cy.destroy();
    });

    it('adds a payload element with no id, as cy.add() would', function () {
      const cy = load([{ data: { id: 'a' } }]);
      const diff = cy.patch([{ data: { id: 'a' } }, { data: { w: 1 } }]);

      expect(diff.added.length).to.equal(1);
      expect(diff.added.id()).to.match(/^cy-/);
      expect(cy.nodes().length).to.equal(2);
      cy.destroy();
    });

    it('keeps what is attached to a survivor: handle, scratch, selection, listeners, animation', function () {
      const cy = load(graphA());
      const b = cy.$id('b');
      let taps = 0;

      b.scratch('app', { note: 1 });
      b.select();
      b.on('tap', () => taps++);
      cy.$id('a').animate(
        { position: { x: 500, y: 500 } },
        { duration: 60000 },
      );

      // a payload `selected: false` is not read for a survivor
      cy.patch(
        graphB().nodes.map((def) =>
          def.data.id === 'b' ? { ...def, selected: false } : def,
        ),
      );

      expect(cy.$id('b')).to.equal(b);
      expect(b.scratch('app')).to.deep.equal({ note: 1 });
      expect(b.selected()).to.equal(true);
      expect(cy.$id('a').animated()).to.equal(true);
      b.emit('tap');
      expect(taps).to.equal(1);
      cy.destroy();
    });

    it('applies the payload flags of an added element', function () {
      const cy = load([{ data: { id: 'a' } }]);

      cy.patch([
        { data: { id: 'a' } },
        { data: { id: 'b' }, selected: true, locked: true },
      ]);

      expect(cy.$id('b').selected()).to.equal(true);
      expect(cy.$id('b').locked()).to.equal(true);
      cy.destroy();
    });

    it('never touches the sheet, the viewport or graph data', function () {
      const cy = load(graphA());

      cy.zoom(2);
      cy.pan({ x: 5, y: 7 });
      cy.data('graphKey', 1);

      const sheet = cy.style().json();
      const wire = cytoscape.serializeElements({
        ...graphB(),
      });

      cy.patch(wire);

      expect(cy.zoom()).to.equal(2);
      expect(cy.pan()).to.deep.equal({ x: 5, y: 7 });
      expect(cy.data()).to.deep.equal({ graphKey: 1 });
      expect(cy.style().json()).to.deep.equal(sheet);
      cy.destroy();
    });

    it('reparents a survivor, orphans one whose payload names no parent, and parents an added node', function () {
      const cy = load([
        { data: { id: 'p' } },
        { data: { id: 'q' } },
        { data: { id: 'a', parent: 'p' } },
        { data: { id: 'b', parent: 'p' } },
      ]);
      const moves = [];

      cy.on('move', (evt) => moves.push(evt.target.id()));

      const diff = cy.patch([
        { data: { id: 'p' } },
        { data: { id: 'q' } },
        { data: { id: 'a', parent: 'q' } },
        { data: { id: 'b' } },
        { data: { id: 'c', parent: 'p' } },
      ]);

      expect(cy.$id('a').parent().id()).to.equal('q');
      expect(cy.$id('b').parent().length).to.equal(0);
      expect(cy.$id('c').parent().id()).to.equal('p');
      expect(moves.sort()).to.deep.equal(['a', 'b']);
      expect(ids(diff.updated)).to.deep.equal(['a', 'b']);
      cy.destroy();
    });

    it('rescues a survivor from a removed parent instead of cascading it away', function () {
      const cy = load([
        { data: { id: 'p' } },
        { data: { id: 'a', parent: 'p' } },
      ]);
      const diff = cy.patch([{ data: { id: 'a' } }]);

      expect(ids(diff.removed)).to.deep.equal(['p']);
      expect(cy.$id('a').removed()).to.equal(false);
      cy.destroy();
    });

    it("derives a compound parent's position from its children, as at load", function () {
      const payload = [
        { data: { id: 'p' }, position: { x: 999, y: 999 } },
        { data: { id: 'a', parent: 'p' }, position: { x: 0, y: 0 } },
        { data: { id: 'b', parent: 'p' }, position: { x: 100, y: 0 } },
      ];
      const cy = load(payload);

      // the parent listed after its children: a write of its payload
      // position would shift the subtree they just landed in
      cy.patch([
        { data: { id: 'a', parent: 'p' }, position: { x: 0, y: 10 } },
        { data: { id: 'b', parent: 'p' }, position: { x: 100, y: 10 } },
        { data: { id: 'p' }, position: { x: -500, y: -500 } },
      ]);

      expect(cy.$id('a').position()).to.deep.equal({ x: 0, y: 10 });

      expect(cy.$id('p').position()).to.deep.equal({ x: 50, y: 10 });
      cy.destroy();
    });

    it('warns and orphans a parent it cannot find, as the load path does', function () {
      const cy = load([{ data: { id: 'a' } }]);
      const warn = console.warn;
      const warnings = [];

      console.warn = (msg) => warnings.push(msg);

      try {
        cy.patch([{ data: { id: 'a', parent: 'nope' } }]);
      } finally {
        console.warn = warn;
      }

      expect(warnings.join()).to.match(/nonexistant parent 'nope'/);
      expect(cy.$id('a').parent().length).to.equal(0);
      cy.destroy();
    });
  });

  describe('following another instance (the round-106 clone-sync shape)', function () {
    it('keeps a follower equal to its master through serialize() + patch(), its own selection kept', function () {
      const master = load(graphA());
      const follower = load(master.serialize());

      follower.$id('c').select(); // the follower's own state

      // a burst of master edits of every kind
      master.$id('a').position({ x: -5, y: 6 });
      master.$id('b').data('w', 9);
      master.$id('d').remove();
      master.add([
        { data: { id: 'f', w: 2, label: 'F' }, position: { x: 1, y: 2 } },
        { data: { id: 'af', source: 'a', target: 'f', ew: 5 } },
      ]);
      master.$id('ab').move({ target: 'c' });
      master.$id('a').select(); // master's selection is not the follower's

      const diff = follower.patch(master.serialize());

      expect(ids(diff.added)).to.deep.equal(['f', 'ab', 'af']);
      expect(ids(diff.removed).sort()).to.deep.equal(['ab', 'cd', 'd']);
      expect(ids(diff.updated)).to.deep.equal(['a', 'b']);
      expectColumnsEqualById(follower, master);
      expect(ids(follower.elements({ selected: true }))).to.deep.equal(['c']);

      // and the next burst with nothing new is free
      const idle = follower.patch(master.serialize());

      expect(
        idle.added.length + idle.removed.length + idle.updated.length,
      ).to.equal(0);
      master.destroy();
      follower.destroy();
    });
  });

  describe('what it refuses, before mutating anything', function () {
    const untouched = (payload, options, pattern) => {
      const cy = load(graphA());
      const before = cy.json();

      expect(() => cy.patch(payload, options)).to.throw(pattern);
      expect(cy.json()).to.deep.equal(before);
      cy.destroy();
    };

    it('an id the payload names twice', function () {
      untouched(
        [{ data: { id: 'a' } }, { data: { id: 'a' } }],
        undefined,
        /names the id 'a' more than once/,
      );
      untouched(
        [{ data: { id: 'n' } }, { data: { id: 'n' } }],
        undefined,
        /names the id 'n' more than once/,
      );
      // across groups: a node and an edge under one id
      untouched(
        [
          { data: { id: 'a' } },
          { data: { id: 'b' } },
          { data: { id: 'a', source: 'a', target: 'b' } },
        ],
        undefined,
        /names the id 'a' more than once/,
      );
      untouched(
        [
          { data: { id: 'b' } },
          { data: { id: 'c' } },
          { data: { id: 'ab' } },
          { data: { id: 'ab', source: 'b', target: 'c' } },
        ],
        undefined,
        /names the id 'ab' more than once/,
      );
      untouched(
        [
          { data: { id: 'b' } },
          { data: { id: 'c' } },
          { data: { id: 'bc', source: 'b', target: 'c' } },
          { data: { id: 'bc', source: 'b', target: 'c' } },
        ],
        undefined,
        /names the id 'bc' more than once/,
      );
      untouched(
        cytoscape.serializeElements([
          { data: { id: 'z' } },
          { data: { id: 'z' } },
        ]),
        undefined,
        /names the id 'z' more than once/,
      );
    });

    it("an edge whose endpoint 'reconcile' would remove, naming 'merge' as the way", function () {
      untouched(
        [
          { data: { id: 'a' } },
          { data: { id: 'ax', source: 'a', target: 'b' } },
        ],
        undefined,
        /source|target 'b' of edge 'ax' is not a node in this payload.*mode 'merge'/,
      );
    });

    it("an edge naming a node neither the payload nor the graph holds, in 'merge'", function () {
      untouched(
        [{ data: { id: 'ax', source: 'a', target: 'nope' } }],
        { mode: 'merge' },
        /The target 'nope' of edge 'ax' is not a node in this payload or the graph/,
      );
    });

    it('an edge definition without a source and target', function () {
      untouched(
        [{ group: 'edges', data: { id: 'ax', source: 'a' } }],
        undefined,
        /Can not create edge 'ax' without a source and target/,
      );
    });

    it('an unknown option, or an unknown mode', function () {
      untouched(
        graphB(),
        { keepPositions: true },
        /Unknown patch option 'keepPositions'/,
      );
      untouched(graphB(), { mode: 'upsert' }, /Unknown patch mode 'upsert'/);
    });

    it('a columnar payload whose columns do not fit its counts', function () {
      const nodes = { count: 2, ids: ['a', 'b'] };

      untouched(
        {
          columnar: true,
          nodes,
          edges: {
            count: 1,
            sources: new Uint32Array(0),
            targets: new Uint32Array(0),
          },
        },
        undefined,
        /must provide 1 sources and targets/,
      );
      untouched(
        { columnar: true, nodes: { ...nodes, positions: new Float32Array(2) } },
        undefined,
        /positions must hold 4 floats; got 2/,
      );
      untouched(
        { columnar: true, nodes: { ...nodes, parent: new Uint32Array(1) } },
        undefined,
        /parent column must hold 2 entries; got 1/,
      );
      untouched(
        {
          columnar: true,
          nodes: { ...nodes, parent: Uint32Array.of(5, 0xffffffff) },
        },
        undefined,
        /node 0 references parent index 5 but the payload has 2 nodes/,
      );
      untouched(
        {
          columnar: true,
          nodes,
          edges: {
            count: 1,
            ids: ['ab'],
            sources: Uint32Array.of(0),
            targets: Uint32Array.of(9),
          },
        },
        undefined,
        /edge 0 references node index 9 but the payload has 2 nodes/,
      );
      untouched(
        {
          columnar: true,
          nodes: {
            ...nodes,
            data: { k: { dict: ['x'], indices: Uint32Array.of(1, 4) } },
          },
        },
        undefined,
        /'k' entry 1 indexes past its 1-entry dictionary/,
      );
    });

    it('a packed id section that does not fit its blob', function () {
      untouched(
        {
          columnar: true,
          nodes: {
            count: 1,
            ids: { offsets: Uint32Array.of(0, 40), blob: new Uint8Array(4) },
          },
        },
        undefined,
        /Packed node ids do not fit their blob/,
      );
      untouched(
        {
          columnar: true,
          nodes: {
            count: 2,
            ids: { offsets: Uint32Array.of(0, 9, 1), blob: new Uint8Array(4) },
          },
        },
        undefined,
        /Packed node id 0 ends past its blob/,
      );
    });
  });
});
