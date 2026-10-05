import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

const make = () =>
  cytoscape({
    elements: {
      nodes: [
        { data: { id: 'p' } },
        { data: { id: 'a', parent: 'p' }, position: { x: -20, y: 0 } },
        { data: { id: 'b', parent: 'p' }, position: { x: 20, y: 0 } },
        { data: { id: 'q' }, position: { x: 100, y: 0 } },
        { data: { id: 'r' }, position: { x: 160, y: 0 } },
      ],
      edges: [
        { data: { id: 'ab', source: 'a', target: 'b' } },
        { data: { id: 'aq', source: 'a', target: 'q' } },
        { data: { id: 'qr', source: 'q', target: 'r' } },
      ],
    },
    style: {
      nodes: { width: 40, height: 20 },
      parents: { 'collapse-scale': 0.25 },
      edges: { width: 8 },
    },
  });

const position = (cy, id) => ({ ...cy.$id(id).position() });

const width = (cy, id) => cy.$id(id).width();

const livePositionSnapshot = (cy, ids) =>
  Object.fromEntries(ids.map((id) => [id, position(cy, id)]));

describe('gpu/compounds: miniature topology changes (round 148)', function () {
  it('keeps model positions and refreshes node and edge factors across add, reparent and remove', function () {
    const cy = make();
    const p = cy.$id('p');
    const a = cy.$id('a');
    const b = cy.$id('b');
    const q = cy.$id('q');

    p.collapse();

    expect(width(cy, 'a')).to.equal(10);
    expect(width(cy, 'ab')).to.equal(2);
    expect(width(cy, 'aq')).to.equal(8);
    expect(width(cy, 'qr')).to.equal(8);

    const beforeAdd = livePositionSnapshot(cy, ['a', 'b', 'q', 'r']);
    const c = cy.add({
      data: { id: 'c', parent: 'p' },
      position: { x: 70, y: 10 },
    });

    expect(position(cy, 'c')).to.deep.equal({ x: 70, y: 10 });
    expect(livePositionSnapshot(cy, ['a', 'b', 'q', 'r'])).to.deep.equal(
      beforeAdd,
    );
    expect(width(cy, 'c')).to.equal(10);

    cy.add([
      { data: { id: 'ac', source: 'a', target: 'c' } },
      { data: { id: 'cr', source: 'c', target: 'r' } },
    ]);

    expect(width(cy, 'ac')).to.equal(2);
    expect(width(cy, 'cr')).to.equal(8);
    expect(width(cy, 'aq')).to.equal(8);

    const beforeRemove = livePositionSnapshot(cy, ['a', 'b', 'q', 'r']);

    c.remove();

    expect(cy.$id('c')).to.have.length(0);
    expect(cy.$id('ac')).to.have.length(0);
    expect(cy.$id('cr')).to.have.length(0);
    expect(livePositionSnapshot(cy, ['a', 'b', 'q', 'r'])).to.deep.equal(
      beforeRemove,
    );
    expect(width(cy, 'ab')).to.equal(2);
    expect(width(cy, 'aq')).to.equal(8);

    const qBeforeReparent = position(cy, 'q');

    q.move({ parent: 'p' });

    expect(position(cy, 'q')).to.deep.equal(qBeforeReparent);
    expect(q.style('width')).to.equal(40);
    expect(q.width()).to.equal(10);
    expect(width(cy, 'aq')).to.equal(2);
    expect(width(cy, 'qr')).to.equal(8);
    expect(width(cy, 'ab')).to.equal(2);

    q.move({ parent: null });

    expect(position(cy, 'q')).to.deep.equal(qBeforeReparent);
    expect(q.width()).to.equal(40);
    expect(width(cy, 'aq')).to.equal(8);
    expect(width(cy, 'qr')).to.equal(8);

    cy.destroy();
  });
});
