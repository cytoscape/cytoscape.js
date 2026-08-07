import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { toColumnarElements } from '../src/columnar.mjs';
import { deserializeElements, serializeElements } from '../src/wire.mjs';

// round 14.8: the parent hierarchy in the columnar bulk-load form and
// the binary wire format (u32 payload indices, 0xffffffff = orphan).

const NO_PARENT = 0xffffffff;

const DEFS = {
  nodes: [
    { data: { id: 'p' } },
    { data: { id: 'a', parent: 'p' }, position: { x: 1, y: 2 } },
    { data: { id: 'b', parent: 'p' }, position: { x: 100, y: 0 } },
    { data: { id: 'c' }, position: { x: 300, y: 0 } },
  ],
  edges: [{ data: { id: 'ab', source: 'a', target: 'b' } }],
};

describe('gpu/wire: compound parent sections (round 14.8)', function () {
  it('toColumnarElements lifts def parents into the parent column', function () {
    const columnar = toColumnarElements(DEFS);

    expect(Array.from(columnar.nodes.parent)).to.deep.equal([
      NO_PARENT,
      0,
      0,
      NO_PARENT,
    ]);
    expect(columnar.nodes.data?.parent).to.equal(undefined); // never sidecar data

    const cy = cytoscape({ elements: columnar });

    expect(cy.hasCompoundNodes()).to.equal(true);
    expect(cy.$id('a').data('parent')).to.equal('p');
    expect(cy.$id('p').isParent()).to.equal(true);
    expect(cy.$id('c').isOrphan()).to.equal(true);
  });

  it('ingests a hand-built columnar parent column', function () {
    const cy = cytoscape({
      elements: {
        columnar: true,
        nodes: {
          count: 3,
          ids: ['x', 'y', 'z'],
          parent: new Uint32Array([NO_PARENT, 0, 1]), // x > y > z
        },
      },
    });

    expect(cy.$id('y').data('parent')).to.equal('x');
    expect(cy.$id('z').data('parent')).to.equal('y');
    expect(cy.$id('x').children().length).to.equal(1);
  });

  it('throws on an out-of-range parent index', function () {
    expect(() =>
      cytoscape({
        elements: {
          columnar: true,
          nodes: {
            count: 2,
            ids: ['x', 'y'],
            parent: new Uint32Array([NO_PARENT, 7]),
          },
        },
      }),
    ).to.throw(/parent/);
  });

  it('warns and orphans on an in-payload parent cycle', function () {
    const warnings = [];
    const original = console.warn;

    console.warn = (msg) => warnings.push(String(msg));

    let cy;

    try {
      cy = cytoscape({
        elements: {
          columnar: true,
          nodes: { count: 2, ids: ['x', 'y'], parent: new Uint32Array([1, 0]) }, // x <-> y
        },
      });
    } finally {
      console.warn = original;
    }

    expect(warnings.length).to.equal(1);
    expect(cy.$id('x').data('parent')).to.equal('y'); // the first payload link holds
    expect(cy.$id('y').data('parent')).to.equal(undefined); // the closing link drops
  });

  it('round-trips parents through the wire format', function () {
    const buffer = serializeElements(DEFS);
    const decoded = deserializeElements(buffer);

    expect(Array.from(decoded.nodes.parent)).to.deep.equal([
      NO_PARENT,
      0,
      0,
      NO_PARENT,
    ]);

    const cy = cytoscape({ elements: buffer });

    expect(cy.$id('a').data('parent')).to.equal('p');
    expect(cy.$id('a').position()).to.deep.equal({ x: 1, y: 2 });
    expect(cy.$id('ab').source().id()).to.equal('a');
  });

  it('round-trips a live compound graph through cy.serialize()', function () {
    const cy = cytoscape({ elements: DEFS });

    cy.$id('c').move({ parent: 'p' });
    cy.$id('a').select();

    const cy2 = cytoscape({ elements: cy.serialize() });

    expect(cy2.$id('c').data('parent')).to.equal('p');
    expect(cy2.$id('a').data('parent')).to.equal('p');
    expect(cy2.$id('a').selected()).to.equal(true);
    expect(cy2.hasCompoundNodes()).to.equal(true);
    expect(cy2.$id('p').children().length).to.equal(3);
  });

  it('keeps compound-free buffers unchanged and readable as version 2', function () {
    const flat = {
      nodes: [{ data: { id: 'x' }, position: { x: 5, y: 6 } }],
      edges: [],
    };
    const buffer = serializeElements(flat);

    // a compound-free payload has no parent section; the layout matches
    // version 2, so a v2-stamped buffer still loads (back-compat)
    new DataView(buffer).setUint32(4, 2, true);

    const cy = cytoscape({ elements: buffer });

    expect(cy.$id('x').position()).to.deep.equal({ x: 5, y: 6 });
    expect(cy.hasCompoundNodes()).to.equal(false);
  });
});
