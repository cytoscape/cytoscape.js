import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

/*
Round 103: node references (`refs`) — the ids of nodes a columnar or wire
payload indexes past its own, resolved against the graph at ingest.  They
are how a chunk of a progressive load carries its cut edges without the
definition form: 103.1 measured the definition path at 0.9-1.5 s of a
chunked ndex-x-large load whose monolithic load is 0.58 s.

Every guard fires here with a message assertion; the wire section is
checked for the property item 43's experimental rule rests on — a new
trailing flag bit, the version still 4.
*/

describe('node references in the columnar and wire forms (round 103)', function () {
  const base = () =>
    cytoscape({
      elements: [
        { data: { id: 'a' }, position: { x: 1, y: 2 } },
        { data: { id: 'p' } },
      ],
    });

  it('toColumnarElements( defs, { refs: true } ) carries what the payload does not hold', function () {
    const cols = cytoscape.toColumnarElements(
      {
        nodes: [{ data: { id: 'c', parent: 'p' } }],
        edges: [
          { data: { id: 'ca', source: 'c', target: 'a' } },
          { data: { id: 'ac', source: 'a', target: 'c' } },
        ],
      },
      { refs: true },
    );

    expect(cols.refs).to.deep.equal(['p', 'a']);
    expect([...cols.nodes.parent]).to.deep.equal([1]);
    expect([...cols.edges.sources]).to.deep.equal([0, 2]);
    expect([...cols.edges.targets]).to.deep.equal([2, 0]);
    // self-contained payloads carry none
    expect(
      cytoscape.toColumnarElements([{ data: { id: 'x' } }], { refs: true }),
    ).to.not.have.property('refs');
  });

  it('still throws on a cut edge without the option, naming the option', function () {
    expect(() =>
      cytoscape.toColumnarElements([
        { data: { id: 'ca', source: 'c', target: 'a' } },
      ]),
    ).to.throw(/convert with \{ refs: true \}/);
    expect(() => cytoscape.toColumnarElements([], { ref: true })).to.throw(
      /Unknown toColumnarElements\(\) option 'ref'/,
    );
  });

  it('round-trips through the wire, packed, and resolves on cy.add()', function () {
    const cols = cytoscape.toColumnarElements(
      {
        nodes: [{ data: { id: 'c', parent: 'p' }, position: { x: 5, y: 5 } }],
        edges: [{ data: { id: 'ca', source: 'c', target: 'a' } }],
      },
      { refs: true },
    );
    const buffer = cytoscape.serializeElements(cols);
    const back = cytoscape.deserializeElements(buffer);

    expect(back.refs.offsets.length).to.equal(3);
    expect(new TextDecoder().decode(back.refs.blob)).to.equal('pa');

    for (const payload of [cols, buffer]) {
      const cy = base();
      const added = cy.add(payload);

      expect(added.map((e) => e.id())).to.deep.equal(['c', 'ca']);
      expect(cy.$id('ca').target().id()).to.equal('a');
      expect(cy.$id('c').parent().id()).to.equal('p');
    }
  });

  it('keeps a pre-reference buffer’s layout: the section is a trailing flag bit', function () {
    const plain = cytoscape.serializeElements([{ data: { id: 'x' } }]);
    const withRefs = cytoscape.serializeElements(
      cytoscape.toColumnarElements(
        [
          { data: { id: 'xa', source: 'x', target: 'a' } },
          { data: { id: 'x' } },
        ],
        { refs: true },
      ),
    );
    const dv = (b) => new DataView(b);

    expect(dv(withRefs).getUint32(4, true)).to.equal(4); // still version 4
    expect(dv(plain).getUint32(16, true) & 2048).to.equal(0);
    expect(dv(withRefs).getUint32(16, true) & 2048).to.equal(2048);
  });

  it('throws before adding anything when an endpoint reference names no node, or an edge', function () {
    const cy = base();

    cy.add([{ data: { id: 'ap', source: 'a', target: 'p' } }]);

    const bad = (target) =>
      cytoscape.toColumnarElements(
        {
          nodes: [{ data: { id: 'c' } }],
          edges: [{ data: { id: 'c2', source: 'c', target } }],
        },
        { refs: true },
      );

    expect(() => cy.add(bad('nope'))).to.throw(
      /Can not create edge 'c2': its node reference 'nope' is not a node in the graph/,
    );
    expect(() => cy.add(cytoscape.serializeElements(bad('ap')))).to.throw(
      /node reference 'ap' names an edge, not a node/,
    );
    expect(cy.$id('c').length).to.equal(0);
  });

  it('names an edge by its index when it has no id', function () {
    const cy = base();

    expect(() =>
      cy.add({
        columnar: true,
        nodes: { count: 0 },
        edges: {
          count: 1,
          sources: Uint32Array.of(0),
          targets: Uint32Array.of(1),
        },
        refs: ['a', 'nope'],
      }),
    ).to.throw(/Can not create edge #0: its node reference 'nope'/);
  });

  it('orphans, with a warning, a node whose parent reference names nothing', function () {
    const cy = base();
    const warnings = [];
    const warn = console.warn;

    console.warn = (msg) => warnings.push(msg);

    try {
      cy.add(
        cytoscape.toColumnarElements([{ data: { id: 'c', parent: 'ghost' } }], {
          refs: true,
        }),
      );
    } finally {
      console.warn = warn;
    }

    expect(cy.$id('c').parent().length).to.equal(0);
    expect(warnings.join()).to.match(/'c' has nonexistant parent/);
  });

  it('refuses a parent index past the payload and its refs', function () {
    expect(() =>
      base().add({
        columnar: true,
        nodes: { count: 1, ids: ['c'], parent: Uint32Array.of(5) },
      }),
    ).to.throw(
      /references parent index 5 but the payload has 1 nodes and 0 refs/,
    );
  });

  it('cannot load through options.elements, which starts empty', function () {
    expect(() =>
      cytoscape({
        elements: cytoscape.toColumnarElements(
          [
            { data: { id: 'xa', source: 'x', target: 'a' } },
            { data: { id: 'x' } },
          ],
          { refs: true },
        ),
      }),
    ).to.throw(/node reference 'a' is not a node in the graph/);
  });

  it('is refused by cy.patch()', function () {
    const cy = base();

    expect(() =>
      cy.patch(
        cytoscape.toColumnarElements(
          [
            { data: { id: 'xa', source: 'x', target: 'a' } },
            { data: { id: 'x' } },
          ],
          { refs: true },
        ),
        { mode: 'merge' },
      ),
    ).to.throw(/cy.patch\(\) does not take a payload with node references/);
  });
});
