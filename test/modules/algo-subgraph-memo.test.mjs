import { expect } from 'chai';
import cytoscape from '../../src/index.mjs';
import { subgraph } from '../../src/algorithms/algo-shared.mjs';

/*
Round 62.1: the SubgraphView memo.  Every algorithm entry builds its
view through `subgraph(coll)`; before the memo each call paid an
O(V+E) Map/Set build, which made a single-root degreeCentrality —
an O(degree) question — ~47× slower than v3 through the built bundle,
and a per-node dc loop O(N·E).  The memo keys on the store's
structureEpoch: membership is `_refs` (immutable) minus dead refs, and
death moves the epoch, so a hit is sound by construction.

Controls run for this file (each by patching subgraph and re-running):
the memo removed outright fails the identity spec; the epoch check
removed (always hit) fails both invalidation specs.
*/

const make = () =>
  cytoscape({
    elements: [
      { data: { id: 'a' } },
      { data: { id: 'b' } },
      { data: { id: 'c' } },
      { data: { id: 'ab', source: 'a', target: 'b', w: 2 } },
      { data: { id: 'bc', source: 'b', target: 'c', w: 5 } },
    ],
  });

describe('modules/algo-subgraph-memo (round 62.1)', function () {
  it('answers the same view object for the same collection', function () {
    const cy = make();
    const eles = cy.elements();

    expect(subgraph(eles)).to.equal(subgraph(eles));
    // and per collection, not per graph — a different collection owns
    // a different membership and must not share the cache
    expect(subgraph(cy.nodes())).to.not.equal(subgraph(eles));
  });

  it('invalidates when an element is added', function () {
    const cy = make();
    const eles = cy.elements();
    const before = subgraph(eles);

    cy.add({ data: { id: 'd' } });

    const after = subgraph(eles);

    expect(after).to.not.equal(before);
    // the collection did not grow — the rebuild is about ref liveness
    // and slot stability, not membership
    expect(after.nodeSlots.length).to.equal(3);
  });

  it('invalidates when a member is removed, and drops the dead ref', function () {
    const cy = make();
    const eles = cy.elements();
    const before = subgraph(eles);

    expect(before.edgeSlots.length).to.equal(2);
    cy.$id('bc').remove();

    const after = subgraph(eles);

    expect(after).to.not.equal(before);
    expect(after.edgeSlots.length).to.equal(1);
    expect(after.nodeSlots.length).to.equal(3);
  });

  it('reads weights live through a cached view', function () {
    // the view holds structure only; a data write moves no epoch and
    // must not need to — weightAt binds per call and reads the sidecar
    const cy = make();
    const eles = cy.elements();
    const root = cy.$id('b');
    const weight = (e) => e.data('w');
    const dc = () => eles.degreeCentrality({ root, weight, alpha: 1 }).degree;

    expect(dc()).to.equal(7); // 2 + 5
    cy.$id('bc').data('w', 10);
    expect(dc()).to.equal(12); // 2 + 10, through the same cached view
    expect(subgraph(eles)).to.equal(subgraph(eles)); // still a hit
  });
});
