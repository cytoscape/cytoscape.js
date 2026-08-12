import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { FLAG_CURVED, FLAG_CURVED_BOX } from '../src/contract.mjs';

/*
Round 67: the curve index's bulk-load window.

Every edge's style apply marks its endpoint pair for re-derivation,
because in isolation any one of them may change a bundle.  Over a whole
graph load that is one `Set` insert per edge and derives nothing that a
single pass over the finished pair map would not — at the end of a load
*every* pair is new, so the union of the marks is the whole map.  So
`_bulkAdd` holds a window in which `markPair` accumulates nothing, and
`endBulk` marks that union.

The claim is equivalence, so these specs compare the two routes that
exist into the same graph:

  * `cytoscape( { elements } )` — takes the window;
  * `cytoscape()` then `cy.add( elements )` — deliberately does not, since
    adding into a populated graph touches a small subset of the pairs.

Every derived curve param and every curve flag must agree, over a fixture
built to make them differ if the window loses anything: parallel bezier
bundles of two and three, both edge directions, self-loops (several on
one node, which stagger), a compound relation (which routes around the
outside under any style), and a blob-family edge (whose per-*slot* marks
the window does not touch).

The control that makes this spec worth having: with `endBulk` marking
nothing, 42 specs across the existing suite fail, and the first
assertion here fails on the bundle offsets.
*/

const ELEMENTS = () => ({
  nodes: [
    { data: { id: 'p' }, position: { x: 0, y: 0 } },
    { data: { id: 'a', parent: 'p' }, position: { x: 0, y: 0 } },
    { data: { id: 'b', parent: 'p' }, position: { x: 200, y: 0 } },
    { data: { id: 'c' }, position: { x: 100, y: 200 } },
    { data: { id: 'd' }, position: { x: 300, y: 200 } },
  ],
  edges: [
    // a three-member bundle, one of them reversed: the offsets depend on
    // membership *and* on the pair's canonical orientation
    { data: { id: 'ab1', source: 'a', target: 'b' } },
    { data: { id: 'ab2', source: 'a', target: 'b' } },
    { data: { id: 'ba1', source: 'b', target: 'a' } },
    // a two-member bundle elsewhere
    { data: { id: 'cd1', source: 'c', target: 'd' } },
    { data: { id: 'cd2', source: 'c', target: 'd' } },
    // a lone member: v3's rule says n === 1 renders straight
    { data: { id: 'ac', source: 'a', target: 'c' } },
    // three loops on one node, which stagger against each other
    { data: { id: 'l1', source: 'c', target: 'c' } },
    { data: { id: 'l2', source: 'c', target: 'c' } },
    { data: { id: 'l3', source: 'c', target: 'c' } },
    // a compound relation: parent → child routes around the outside
    // whatever its style, which is the case that forces the pair map to
    // exist even in a graph with no bezier at all
    { data: { id: 'pa', source: 'p', target: 'a' } },
    // a blob-family edge: derived per slot, not per pair
    { data: { id: 'bd', source: 'b', target: 'd' } },
  ],
});

const SHEET = {
  edges: {
    'curve-style': {
      case: [{ when: { data: 'blob', eq: 1 }, then: 'segments' }],
      else: 'bezier',
    },
    'segment-distances': '20 -20',
    'segment-weights': '0.3 0.7',
  },
};

/** Every derived curve number and flag for one edge, by id. */
const snapshot = (cy) => {
  const out = {};

  for (const id of cy.edges().map((e) => e.id())) {
    const slot = cy._store.lookup(id).slot;
    const params = Array.from(cy._store.curveParamsAt(slot));
    const flags = cy._store.flags('edges', slot);
    const kind = params[3];
    // a blob record's numbers live in the blob, not in the column
    const blob =
      kind >= 3
        ? Array.from(
            cy._store.curveBlob().subarray(params[0], params[0] + params[2]),
          )
        : [];

    out[id] = {
      params,
      blob,
      curved: (flags & FLAG_CURVED) !== 0,
      box: (flags & FLAG_CURVED_BOX) !== 0,
    };
  }

  return out;
};

/** The fixture with the one blob-family edge tagged. */
const withBlob = () => {
  const copy = ELEMENTS();

  copy.edges.find((e) => e.data.id === 'bd').data.blob = 1;

  return copy;
};

describe('gpu/curve bulk-load window (round 67)', function () {
  let bulk;
  let incremental;

  beforeEach(function () {
    bulk = cytoscape({
      headless: true,
      elements: withBlob(),
      style: SHEET,
      layout: { name: 'preset' },
    });

    incremental = cytoscape({ headless: true, style: SHEET });
    incremental.add(withBlob());
  });

  afterEach(function () {
    bulk.destroy();
    incremental.destroy();
  });

  it('derives every curve param exactly as the incremental route does', function () {
    expect(snapshot(bulk)).to.deep.equal(snapshot(incremental));
  });

  it('really did derive something — the fixture is not all defaults', function () {
    const snap = snapshot(bulk);

    // if this fixture derived nothing, the spec above would pass on two
    // sets of zeros.  Bundles, loops, the compound route and the blob
    // family must each show up.
    expect(snap.ab1.curved, 'a bundled bezier is curved').to.equal(true);
    expect(
      snap.ab2.params[0],
      'bundle members take different offsets',
    ).to.not.equal(snap.ab1.params[0]);
    expect(snap.ac.curved, 'a lone bezier renders straight (v3)').to.equal(
      false,
    );
    expect(
      new Set([snap.l1, snap.l2, snap.l3].map((s) => JSON.stringify(s.params)))
        .size,
      'the three loops stagger',
    ).to.equal(3);
    expect(snap.pa.curved, 'the compound relation routes around').to.equal(
      true,
    );
    expect(snap.bd.blob.length, 'the blob family carries a record').to.be.above(
      0,
    );
  });

  it('leaves the window closed after an ingest that throws', function () {
    const cy = cytoscape({ headless: true });

    expect(() => cy._bulkAdd({ edges: [{ data: { id: 'oops' } }] })).to.throw(
      /source and target/,
    );

    // the window must not still be open: a later add has to mark its own
    // pairs, since nothing will call endBulk for it
    cy.add({
      nodes: [{ data: { id: 'x' } }, { data: { id: 'y' } }],
      edges: [
        { data: { id: 'xy1', source: 'x', target: 'y' } },
        { data: { id: 'xy2', source: 'x', target: 'y' } },
      ],
    });
    cy.style({ edges: { 'curve-style': 'bezier' } });

    const off = (id) => cy._store.curveParamsAt(cy._store.lookup(id).slot)[0];

    expect(off('xy1')).to.not.equal(off('xy2'));
    cy.destroy();
  });
});
