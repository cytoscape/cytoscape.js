import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { buildBatch } from '../src/render/worker-protocol.mjs';
import { RemoteModelView } from '../src/render/remote-view.mjs';

/*
Round 104: the two props label decluttering reads, headless.

- `label-priority` — a node prop, any number, mapper-able — rides the
  label entry, so a change re-queues exactly that label for the
  renderer (which re-ranks); it is rejected on edges, whose labels do
  not join the pass.
- `label-declutter` — a core prop, 'none' (the default) or 'cull' —
  travels as one store scalar, like round 102's dim-opacity, so a
  worker renderer receives it with every batch.

The pass itself is renderer-local and is covered by
test/modules/label-declutter.mjs (headless) and renderer.spec.js (the
pixels).
*/

describe('label decluttering: the props (round 104)', function () {
  let cy;

  afterEach(function () {
    cy?.destroy();
    cy = null;
  });

  const make = (style = {}, extra = {}) =>
    cytoscape({
      elements: [
        { data: { id: 'a', score: 3 }, position: { x: 0, y: 0 } },
        { data: { id: 'b', score: 9 }, position: { x: 10, y: 0 } },
        { data: { id: 'c' }, position: { x: 20, y: 0 } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
      ],
      style: {
        ...style,
        nodes: { label: 'data(id)', ...(style.nodes ?? {}) },
      },
      ...extra,
    });
  const slotOf = (id) => cy._store.lookup(id).slot;

  describe('label-priority', function () {
    it('defaults to 0 and reads back', function () {
      cy = make();

      expect(cy.$id('a').style('label-priority')).to.equal(0);
      expect(cy._store.labelAt(slotOf('a'), 'nodes').priority).to.equal(0);
    });

    it('takes a constant, and a data mapper with a fallback', function () {
      cy = make({ nodes: { 'label-priority': 4 } });

      expect(cy.$id('a').style('label-priority')).to.equal(4);

      cy.style({
        nodes: {
          label: 'data(id)',
          'label-priority': { data: 'score', fallback: -1 },
        },
      });

      expect(cy.$id('a').style('label-priority')).to.equal(3);
      expect(cy.$id('b').style('label-priority')).to.equal(9);
      expect(cy.$id('c').style('label-priority')).to.equal(-1);
      expect(cy._store.labelAt(slotOf('b'), 'nodes').priority).to.equal(9);
    });

    it('reads back from the sheet for a node with no label text', function () {
      cy = make({ nodes: { label: '', 'label-priority': 2 } });

      expect(cy._store.labelAt(slotOf('a'), 'nodes')).to.equal(undefined);
      expect(cy.$id('a').style('label-priority')).to.equal(2);
    });

    it('re-queues the label when its priority changes, and only then', function () {
      cy = make({
        nodes: { 'label-priority': { data: 'score', fallback: 0 } },
      });
      cy._store.takeLabelDirty('nodes');

      cy.$id('a').data('score', 5);

      expect(cy._store.takeLabelDirty('nodes')).to.deep.equal([slotOf('a')]);

      // the same value again is no change (the entry compares equal)
      cy.$id('a').data('score', 5);

      expect(cy._store.takeLabelDirty('nodes')).to.deep.equal([]);
    });

    it('is a node property: the edges group rejects it', function () {
      expect(() => make({ edges: { 'label-priority': 1 } })).to.throw(
        /'label-priority' is a node style property/,
      );
    });

    it('rejects a value that is not a number', function () {
      expect(() => make({ nodes: { 'label-priority': 'high' } })).to.throw();
    });

    it('leaves the edge label streams at priority 0', function () {
      cy = make({ edges: { label: 'e' }, nodes: { 'label-priority': 7 } });

      expect(cy._store.labelAt(slotOf('ab'), 'edges').priority).to.equal(0);
    });

    it('takes an id bypass', function () {
      cy = make({ bypasses: { c: { 'label-priority': 12 } } });

      expect(cy.$id('c').style('label-priority')).to.equal(12);
      expect(cy.$id('a').style('label-priority')).to.equal(0);
    });
  });

  describe('label-declutter', function () {
    it("defaults to 'none'", function () {
      cy = make();

      expect(cy._store.labelDeclutter()).to.equal(0);
    });

    it("'cull' reaches the store scalar, and a sheet without it resets it", function () {
      cy = make({ core: { 'label-declutter': 'cull' } });

      expect(cy._store.labelDeclutter()).to.equal(1);

      cy.style({ nodes: { label: 'data(id)' } });

      expect(cy._store.labelDeclutter()).to.equal(0);
    });

    it('schedules a frame when the mode changes (it marks no column)', function () {
      cy = make();
      cy._store.takeDelta();

      expect(cy._store.hasDirty()).to.equal(false);
      cy._store.setLabelDeclutter(1);
      expect(cy._store.hasDirty()).to.equal(true);
      cy._store.takeDelta();
      cy._store.setLabelDeclutter(1);
      expect(cy._store.hasDirty()).to.equal(false);
    });

    it('throws on an unknown mode, naming the two it takes', function () {
      expect(() => make({ core: { 'label-declutter': 'hide' } })).to.throw(
        /Invalid label-declutter 'hide': expected 'none' or 'cull'/,
      );
    });

    it('takes constants only', function () {
      expect(() =>
        make({ core: { 'label-declutter': { data: 'x' } } }),
      ).to.throw(/Core style props take constants only/);
    });

    it('crosses to a worker renderer as a batch scalar', function () {
      cy = make({ core: { 'label-declutter': 'cull' } });

      const remote = new RemoteModelView(() => {});

      cy._store.flushDerived();
      remote.applyBatch(
        structuredClone(
          buildBatch(
            cy._store,
            {
              ends: { source: false, target: false },
              mid: { source: false, target: false },
            },
            { panX: 0, panY: 0, zoom: 1 },
            { parentOrderRef: null },
            true,
          ),
        ),
      );

      expect(remote.labelDeclutter()).to.equal(1);
      // and the label entries carry their priority across, whole
      expect(remote.labelAt(slotOf('a'), 'nodes').priority).to.equal(0);
    });
  });
});
