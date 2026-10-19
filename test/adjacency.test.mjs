import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { toColumnarElements } from '../src/columnar.mjs';
import { Adjacency } from '../src/store/adjacency.mjs';

const FIXTURE = {
  nodes: [{ data: { id: 'a' } }, { data: { id: 'b' } }, { data: { id: 'c' } }],
  edges: [
    { data: { id: 'ab', source: 'a', target: 'b' } },
    { data: { id: 'ac', source: 'a', target: 'c' } },
    { data: { id: 'bc', source: 'b', target: 'c' } },
    { data: { id: 'cc', source: 'c', target: 'c' } }, // loop
  ],
};

describe('gpu/store: adjacency (CSR + overlay)', function () {
  it('CSR build matches the incremental path query for query', function () {
    const bulk = cytoscape({ elements: toColumnarElements(FIXTURE) }); // CSR
    const inc = cytoscape();

    inc.add(FIXTURE.nodes);
    for (const e of FIXTURE.edges) {
      inc.add(e);
    } // one-by-one: overlay only

    for (const id of ['a', 'b', 'c']) {
      const b = bulk.getElementById(id);
      const i = inc.getElementById(id);

      expect(
        b.connectedEdges().map((e) => e.id()),
        id,
      ).to.deep.equal(i.connectedEdges().map((e) => e.id()));
      expect(
        b.outgoers({ group: 'edges' }).map((e) => e.id()),
        id,
      ).to.deep.equal(i.outgoers({ group: 'edges' }).map((e) => e.id()));
      expect(
        b.incomers({ group: 'edges' }).map((e) => e.id()),
        id,
      ).to.deep.equal(i.incomers({ group: 'edges' }).map((e) => e.id()));
      expect(b.degree(true), id).to.equal(i.degree(true));
    }
  });

  it('counts a loop edge once in connectedEdges on the CSR path', function () {
    const cy = cytoscape({ elements: toColumnarElements(FIXTURE) });

    expect(
      cy
        .getElementById('c')
        .connectedEdges()
        .map((e) => e.id())
        .sort(),
    ).to.deep.equal(['ac', 'bc', 'cc']);
  });

  it('overlays post-build edges on top of CSR', function () {
    const cy = cytoscape({ elements: toColumnarElements(FIXTURE) });

    cy.add({ data: { id: 'ab2', source: 'a', target: 'b' } });

    expect(
      cy
        .getElementById('a')
        .outgoers({ group: 'edges' })
        .map((e) => e.id()),
    ).to.deep.equal(['ab', 'ac', 'ab2']); // CSR first, then overlay, insertion order
    expect(
      cy
        .getElementById('b')
        .incomers({ group: 'edges' })
        .map((e) => e.id()),
    ).to.deep.equal(['ab', 'ab2']);
  });

  it('removes edges from the CSR run preserving order', function () {
    const cy = cytoscape({ elements: toColumnarElements(FIXTURE) });

    cy.getElementById('ab').remove();

    expect(
      cy
        .getElementById('a')
        .outgoers({ group: 'edges' })
        .map((e) => e.id()),
    ).to.deep.equal(['ac']);
    expect(cy.getElementById('b').degree(true)).to.equal(1);
  });

  it('cascades node removal through CSR-indexed edges', function () {
    const cy = cytoscape({ elements: toColumnarElements(FIXTURE) });

    cy.getElementById('c').remove(); // removes ac, bc, cc with it

    expect(cy.edges().map((e) => e.id())).to.deep.equal(['ab']);
    expect(cy.getElementById('a').degree(true)).to.equal(1);
  });

  it('a second bulk add on a built index overlays correctly', function () {
    const cy = cytoscape({ elements: toColumnarElements(FIXTURE) });

    cy.add(
      toColumnarElements({
        nodes: [{ data: { id: 'd' } }],
        edges: [{ data: { id: 'dd', source: 'd', target: 'd' } }],
      }),
    );

    expect(
      cy
        .getElementById('d')
        .connectedEdges()
        .map((e) => e.id()),
    ).to.deep.equal(['dd']);
    expect(cy.getElementById('a').outgoers({ group: 'edges' })).to.have.length(
      2,
    );
  });

  it('unit: bulk build + removal + re-add on raw slots', function () {
    const adj = new Adjacency();
    // edges 0..3 over nodes 0..2: 0->1, 0->2, 1->2, 2->2
    const endpoints = new Uint32Array([0, 1, 0, 2, 1, 2, 2, 2]);

    adj.addBulk(new Uint32Array([0, 1, 2, 3]), endpoints, 3);

    expect(Array.from(adj.outEdges(0))).to.deep.equal([0, 1]);
    expect(Array.from(adj.inEdges(2))).to.deep.equal([1, 2, 3]);
    expect(adj.outDegree(2)).to.equal(1);

    adj.removeEdge(1, 0, 2); // from the CSR runs

    expect(Array.from(adj.outEdges(0))).to.deep.equal([0]);
    expect(Array.from(adj.inEdges(2))).to.deep.equal([2, 3]);

    adj.addEdge(4, 0, 2); // overlay on a CSR node

    expect(Array.from(adj.outEdges(0))).to.deep.equal([0, 4]);
    expect(adj.inDegree(2)).to.equal(3);

    adj.removeEdge(4, 0, 2); // from the overlay

    expect(Array.from(adj.outEdges(0))).to.deep.equal([0]);

    adj.clearNode(2);

    expect(adj.inDegree(2)).to.equal(0);
    expect(adj.outDegree(2)).to.equal(0);
  });

  it('unit: rebuild folds the overlay into CSR and drops stranded entries, preserving order', function () {
    const adj = new Adjacency();
    // edges over nodes 0..2 — 0: 0->1, 1: 0->2, 2: 1->2, then post-build 3: 0->1, 4: 0->2
    const endpoints = new Uint32Array([0, 1, 0, 2, 1, 2, 0, 1, 0, 2]);

    adj.addBulk(new Uint32Array([0, 1, 2]), endpoints, 3);
    adj.addEdge(3, 0, 1); // overlay
    adj.addEdge(4, 0, 2); // overlay
    adj.removeEdge(1, 0, 2); // strands CSR space

    expect(adj.csrStranded).to.equal(2); // one out + one in entry
    expect(adj.overlayEntries).to.equal(4);

    const before = {
      out0: Array.from(adj.outEdges(0)),
      inn1: Array.from(adj.inEdges(1)),
      inn2: Array.from(adj.inEdges(2)),
    };

    adj.rebuild([0, 2, 3, 4], endpoints, 3); // live edges, insertion order

    expect(adj.csrStranded).to.equal(0);
    expect(adj.overlayEntries).to.equal(0);
    expect(Array.from(adj.outEdges(0))).to.deep.equal(before.out0); // [0, 3, 4]
    expect(Array.from(adj.inEdges(1))).to.deep.equal(before.inn1); // [0, 3]
    expect(Array.from(adj.inEdges(2))).to.deep.equal(before.inn2); // [2, 4]
    expect(adj.outDegree(0)).to.equal(3);
    expect(adj.inDegree(2)).to.equal(2);
  });

  it('unit: rebuild to empty resets the index for a fresh CSR build', function () {
    const adj = new Adjacency();
    const endpoints = new Uint32Array([0, 1, 1, 0]);

    adj.addBulk(new Uint32Array([0, 1]), endpoints, 2);
    adj.rebuild([], endpoints, 2);

    expect(adj.outDegree(0)).to.equal(0);
    expect(adj.inDegree(1)).to.equal(0);

    adj.addBulk(new Uint32Array([0]), endpoints, 2); // fresh CSR path again

    expect(Array.from(adj.outEdges(0))).to.deep.equal([0]);
    expect(adj.overlayEntries).to.equal(0); // CSR, not overlay
  });

  it('unit: bulk add after incremental add/remove keeps overlay edges ordered first', function () {
    const adj = new Adjacency();
    // edges 0 and 1 both 0->1, added incrementally (overlay only)
    const endpoints = new Uint32Array([0, 1, 0, 1, 0, 1]);

    adj.addEdge(0, 0, 1);
    adj.addEdge(1, 0, 1);
    adj.removeEdge(0, 0, 1);

    // edge 1 still lives in the overlay, so this bulk must overlay too —
    // a fresh CSR build here would draw the bulk edge ahead of edge 1
    adj.addBulk(new Uint32Array([2]), endpoints, 2);

    expect(Array.from(adj.outEdges(0))).to.deep.equal([1, 2]);
    expect(Array.from(adj.inEdges(1))).to.deep.equal([1, 2]);
  });
});
