import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

describe('gpu/batch', function () {
  var cy;

  beforeEach(function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'a', weight: 1 } },
        { data: { id: 'b', weight: 2 } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
      ],
    });
  });

  it('reports batching state, including nesting', function () {
    expect(cy.batching()).to.be.false;

    cy.startBatch();
    expect(cy.batching()).to.be.true;

    cy.startBatch();
    cy.endBatch();
    expect(cy.batching()).to.be.true; // still inside the outer batch

    cy.endBatch();
    expect(cy.batching()).to.be.false;
  });

  it('endBatch without startBatch is a no-op', function () {
    expect(function () {
      cy.endBatch();
    }).to.not.throw();
    expect(cy.batching()).to.be.false;
  });

  it('defers the first style apply of added elements to endBatch', function () {
    cy.startBatch();
    cy.add({ data: { id: 'c' } });

    // style application is deferred, so the node still has zeroed channels
    expect(cy.$id('c').width()).to.equal(0);

    cy.endBatch();

    expect(cy.$id('c').width()).to.equal(30); // default node width
  });

  it('skips elements added then removed within the batch', function () {
    cy.startBatch();
    cy.add({ data: { id: 'c' } });
    cy.$id('c').remove();

    expect(function () {
      cy.endBatch();
    }).to.not.throw();
    expect(cy.hasElementWithId('c')).to.be.false;
  });

  it('defers sheet application to endBatch', function () {
    cy.startBatch();
    cy.style({ nodes: { width: 50, height: 50 } });

    expect(cy.$id('a').width()).to.equal(30); // not yet applied

    cy.endBatch();

    expect(cy.$id('a').width()).to.equal(50);
  });

  it('a sheet set during the batch also styles elements added during it', function () {
    cy.startBatch();
    cy.add({ data: { id: 'c' } });
    cy.style({ nodes: { width: 50, height: 50 } });
    cy.endBatch();

    expect(cy.$id('c').width()).to.equal(50);
  });

  it('still validates a sheet set during a batch', function () {
    cy.startBatch();

    expect(function () {
      cy.style({ nodes: { 'bogus-prop': 1 } });
    }).to.throw();

    cy.endBatch();
  });

  it('defers data-mapped label refresh to endBatch', function () {
    cy.style({ nodes: { label: 'data(name)' } });
    cy.$id('a').data('name', 'before');

    expect(cy.$id('a').label()).to.equal('before');

    cy.startBatch();
    cy.$id('a').data('name', 'after');

    expect(cy.$id('a').label()).to.equal('before'); // stale inside the batch

    cy.endBatch();

    expect(cy.$id('a').label()).to.equal('after');
  });

  it('still fires events during the batch, as in v3', function () {
    var events = [];

    cy.on('add', function (e) {
      events.push('add:' + e.target.id());
    });
    cy.on('data', function (e) {
      events.push('data:' + e.target.id());
    });

    cy.batch(function () {
      cy.add({ data: { id: 'c' } });
      cy.$id('a').data('weight', 3);
    });

    expect(events).to.deep.equal(['add:c', 'data:a']);
  });

  it('batch( fn ) ends the batch even when fn throws', function () {
    expect(function () {
      cy.batch(function () {
        throw new Error('boom');
      });
    }).to.throw('boom');

    expect(cy.batching()).to.be.false;
  });

  it('batchData is gone (round 90) — batch + data covers it', function () {
    // v3 marked batchData @internal and "for backwards compatibility";
    // the idiom is a plain batch over data() writes
    expect(cy.batchData).to.equal(undefined);

    cy.batch(() => {
      cy.$id('a').data({ weight: 10 });
      cy.$id('b').data({ weight: 20 });
    });

    expect(cy.$id('a').data('weight')).to.equal(10);
    expect(cy.$id('b').data('weight')).to.equal(20);
  });
});

/*
Round 139 (PLAN.md item 41, the alpha part): the transaction events.
`batchstart` fires at the outermost open, `batchend` at the outermost
close after the flush — the transaction's last event, after a patch's
summary.  Each spec asserts an order or a count the emission decides, so
removing the emission (or swapping `patch` and `batchend`) fails it.
*/
describe('batch/transaction events (round 139)', function () {
  let cy;
  let log;

  const record = (types) => {
    for (const type of types) {
      cy.on(type, (evt) => {
        const id = evt.target === cy ? '' : ':' + evt.target.id();

        log.push(type + id);
      });
    }
  };

  beforeEach(function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'a', weight: 1 }, position: { x: 0, y: 0 } },
        { data: { id: 'b', weight: 2 }, position: { x: 10, y: 0 } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
      ],
    });
    log = [];
  });

  it('fires once per outermost pair, never for a nested one', function () {
    record(['batchstart', 'batchend']);

    cy.startBatch();
    cy.startBatch();
    cy.batch(() => {});
    cy.endBatch();
    expect(log).to.deep.equal(['batchstart']);
    cy.endBatch();

    expect(log).to.deep.equal(['batchstart', 'batchend']);

    cy.batch(() => {});
    expect(log).to.deep.equal([
      'batchstart',
      'batchend',
      'batchstart',
      'batchend',
    ]);
  });

  it('an unbalanced endBatch fires nothing', function () {
    record(['batchstart', 'batchend']);
    cy.endBatch();

    expect(log).to.deep.equal([]);
  });

  it('brackets the element events: batchstart before the first mutation, batchend after the flush', function () {
    record(['batchstart', 'batchend', 'add', 'data', 'remove']);

    let atStart = null;
    let atEnd = null;

    cy.on('batchstart', () => {
      // the pre-state: nothing of the batch has landed yet
      atStart = { batching: cy.batching(), count: cy.elements().length };
    });
    cy.on('batchend', () => {
      // after the flush: the added node carries its style
      atEnd = { batching: cy.batching(), width: cy.$id('c').width() };
    });

    cy.batch(() => {
      cy.add({ data: { id: 'c' } });
      cy.$id('a').data('weight', 5);
      cy.$id('ab').remove();
    });

    expect(log).to.deep.equal([
      'batchstart',
      'add:c',
      'data:a',
      'remove:ab',
      'batchend',
    ]);
    expect(atStart).to.deep.equal({ batching: true, count: 3 });
    expect(atEnd).to.deep.equal({ batching: false, width: 30 });
  });

  it('a sheet set inside the batch is applied before batchend', function () {
    let width = null;

    cy.on('batchend', () => {
      width = cy.$id('a').width();
    });

    cy.batch(() => {
      cy.style({ nodes: { width: 77 } });
      expect(cy.$id('a').width()).to.equal(30); // deferred to the flush
    });

    expect(width).to.equal(77);
  });

  it('batch( fn ) that throws still fires batchend, with what landed', function () {
    record(['batchstart', 'batchend', 'add']);

    expect(() =>
      cy.batch(() => {
        cy.add({ data: { id: 'c' } });
        throw new Error('app error');
      }),
    ).to.throw('app error');

    expect(log).to.deep.equal(['batchstart', 'add:c', 'batchend']);
    expect(cy.batching()).to.be.false;
    expect(cy.hasElementWithId('c')).to.be.true; // no rollback
  });

  it('a patch is one transaction: batchstart, element events, patch, then batchend', function () {
    record(['batchstart', 'batchend', 'patch', 'add', 'remove', 'data']);

    cy.patch({
      nodes: [{ data: { id: 'a', weight: 9 } }, { data: { id: 'c' } }],
      edges: [],
    });

    expect(log).to.deep.equal([
      'batchstart',
      'remove:ab',
      'remove:b',
      'add:c',
      'data:a',
      'patch',
      'batchend',
    ]);
  });

  it('a patch inside an app batch joins it: its summary fires inside, one pair around both', function () {
    record(['batchstart', 'batchend', 'patch', 'add']);

    let patchBatching = null;

    cy.on('patch', () => {
      patchBatching = cy.batching();
    });

    cy.batch(() => {
      cy.add({ data: { id: 'x' } });
      cy.patch({ nodes: [{ data: { id: 'y' } }] }, { mode: 'merge' });
    });

    expect(log).to.deep.equal([
      'batchstart',
      'add:x',
      'add:y',
      'patch',
      'batchend',
    ]);
    expect(patchBatching).to.be.true;
  });

  it('a patch refused by its planner opens no transaction', function () {
    record(['batchstart', 'batchend', 'patch']);

    expect(() =>
      cy.patch({ edges: [{ data: { id: 'e', source: 'a', target: 'nope' } }] }),
    ).to.throw();

    expect(log).to.deep.equal([]);
  });

  it('is enough for a snapshot undo: serialize at batchstart, patch back', function () {
    const undo = [];

    cy.on('batchstart', () => undo.push(cy.serialize()));

    cy.batch(() => {
      cy.$id('a').data('weight', 50).position({ x: 99, y: 99 });
      cy.$id('b').remove();
      cy.add({ data: { id: 'c', weight: 3 } });
    });

    expect(undo).to.have.length(1);
    expect(cy.hasElementWithId('b')).to.be.false;

    cy.patch(undo.pop()); // itself a transaction: it pushes a redo point

    expect(cy.nodes().map((n) => n.id())).to.have.members(['a', 'b']);
    expect(cy.$id('ab').source().id()).to.equal('a');
    expect(cy.$id('a').data('weight')).to.equal(1);
    expect(cy.$id('a').position()).to.deep.equal({ x: 0, y: 0 });
    expect(cy.hasElementWithId('c')).to.be.false;
    expect(undo).to.have.length(1);
  });
});
