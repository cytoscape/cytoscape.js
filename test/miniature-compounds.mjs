import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { COL } from '../src/contract.mjs';

const make = (style) =>
  cytoscape({
    elements: {
      nodes: [
        { data: { id: 'p' } },
        { data: { id: 'a', parent: 'p', scale: 0.4 } },
        { data: { id: 'b', parent: 'p' } },
        { data: { id: 'q' } },
      ],
      edges: [{ data: { id: 'ab', source: 'a', target: 'b' } }],
    },
    ...(style == null ? {} : { style }),
  });

const ids = (eles) => eles.map((ele) => ele.id()).sort();

describe('gpu/compounds: miniature compounds (round 148)', function () {
  it('styles and reads a validated parent collapse scale', function () {
    const cy = make({ parents: { collapseScale: 0.25 } });

    expect(cy.$id('p').style('collapse-scale')).to.equal(0.25);
    expect(cy.$id('p').numericStyle('collapse-scale')).to.equal(0.25);
    expect(make().$id('p').style('collapse-scale')).to.equal(0.1);
    expect(() => make({ parents: { 'collapse-scale': 0 } })).to.throw(
      /0 < scale <= 1/,
    );
    expect(() => make({ parents: { 'collapse-scale': 1.01 } })).to.throw(
      /0 < scale <= 1/,
    );
    expect(() => make({ nodes: { 'collapse-scale': 0.5 } })).to.throw(
      /parents group/,
    );

    const parent = cy.$id('p');

    parent.style('collapseScale', 0.4);
    expect(parent.numericStyle('collapse-scale')).to.equal(0.4);
    parent.removeStyle('collapse-scale');
    expect(parent.numericStyle('collapse-scale')).to.equal(0.25);
  });

  it('supports numeric mappers and re-applies their resolved scale', function () {
    const cy = make({
      parents: { 'collapse-scale': { data: 'scale', fallback: 0.6 } },
    });
    const p = cy.$id('p');

    expect(p.numericStyle('collapse-scale')).to.equal(0.6);
    cy.$id('p').data('scale', 0.3);
    expect(p.numericStyle('collapse-scale')).to.equal(0.3);
    expect(() => p.data('scale', 2)).to.throw(/0 < scale <= 1/);

    expect(() =>
      make({
        parents: {
          'collapse-scale': { data: 'scale', domain: [0, 1], range: [0, 2] },
        },
      }),
    ).to.throw(/0 < scale <= 1/);
  });

  it('queries collapsed state and refreshes conditional styles', function () {
    const cy = make({
      parents: {
        'background-color': {
          case: [{ when: { collapsed: true }, then: '#ff0000' }],
          else: '#0000ff',
        },
      },
    });
    const parent = cy.$id('p');
    const child = cy.$id('a');

    expect(parent.collapsed()).to.equal(false);
    expect(child.collapsed()).to.equal(false);
    cy._store.setCollapsed(parent._refs[0].slot, true, 0.25);

    expect(parent.collapsed()).to.equal(true);
    expect(child.collapsed()).to.equal(false);
    expect(parent.insideCollapsed()).to.equal(false);
    expect(child.insideCollapsed()).to.equal(true);
    expect(ids(cy.nodes({ collapsed: true }))).to.deep.equal(['p']);
    expect(ids(cy.nodes({ collapsed: false }))).to.deep.equal(['a', 'b', 'q']);
    expect(parent.style('background-color')).to.equal('rgb(255,0,0)');

    cy._store.setCollapsed(parent._refs[0].slot, false);
    expect(parent.collapsed()).to.equal(false);
    expect(parent.style('background-color')).to.equal('rgb(0,0,255)');
  });

  it('rejects invalid internal collapse state and scale writes', function () {
    const cy = make();
    const parent = cy.$id('p')._refs[0].slot;
    const leaf = cy.$id('q')._refs[0].slot;

    expect(() => cy._store.setCollapseScaleStyle(parent, 0)).to.throw(
      /0 < scale <= 1/,
    );
    expect(() => cy._store.setCollapsed(leaf, true)).to.throw(
      /compound parent/,
    );
    expect(() => cy._store.setCollapsed(parent, true, 1.1)).to.throw(
      /0 < scale <= 1/,
    );
  });

  it('keeps authored size readback separate from effective geometry', function () {
    const cy = make({ nodes: { width: 30, height: 20 } });
    const parent = cy.$id('p');
    const child = cy.$id('a');
    const childSlot = child._refs[0].slot;

    cy._store.setCollapsed(parent._refs[0].slot, true, 0.25);
    cy._store.setPair(COL.NODE_SIZE, childSlot, 80, 40);

    expect(child.style('width')).to.equal(80);
    expect(child.numericStyle('height')).to.equal(40);
    expect(child.width()).to.equal(20);
    expect(child.height()).to.equal(10);

    cy._store.setPair(COL.NODE_SIZE, childSlot, 60, 28);
    expect(child.style('width')).to.equal(60);
    expect(child.width()).to.equal(15);
    expect(child.height()).to.equal(7);

    cy._store.setLane(COL.NODE_SIZE, childSlot, 0, 32);
    expect(child.style('width')).to.equal(32);
    expect(child.style('height')).to.equal(28);
    expect(child.width()).to.equal(8);
    expect(child.height()).to.equal(7);
  });

  it('collapses descendants around the live parent centre and expands in place', function () {
    const cy = make({
      nodes: { width: 40, height: 20 },
      parents: { 'collapse-scale': 0.25 },
    });
    const parent = cy.$id('p');
    const a = cy.$id('a');
    const b = cy.$id('b');
    const events = [];

    parent.on('collapse expand', (event) => events.push(event.type));
    parent.position({ x: 100, y: 100 });
    a.position({ x: 120, y: 100 });
    b.position({ x: 80, y: 100 });
    a.hide();
    const collapseCenter = parent.position();
    const beforeA = a.position();
    const beforeB = b.position();

    parent.collapse();

    expect(parent.collapsed()).to.equal(true);
    expect(a.position().x).to.equal(
      collapseCenter.x + 0.25 * (beforeA.x - collapseCenter.x),
    );
    expect(b.position().x).to.equal(
      collapseCenter.x + 0.25 * (beforeB.x - collapseCenter.x),
    );
    expect(a.style('width')).to.equal(40);
    expect(a.width()).to.equal(10);
    expect(a.visible()).to.equal(false);

    const miniaturePosition = a.position();

    parent.collapse();
    expect(a.position()).to.deep.equal(miniaturePosition);
    expect(events).to.deep.equal(['collapse']);

    a.position({ x: 107 });
    const center = parent.position().x;
    const currentA = a.position().x;
    const currentB = b.position().x;

    parent.expand();

    expect(parent.collapsed()).to.equal(false);
    expect(a.position().x).to.equal(center + 4 * (currentA - center));
    expect(b.position().x).to.equal(center + 4 * (currentB - center));
    expect(a.width()).to.equal(40);
    expect(a.visible()).to.equal(false);
    expect(events).to.deep.equal(['collapse', 'expand']);
  });

  it('keeps locked subtrees still while shrinking their bodies', function () {
    const cy = make({
      nodes: { width: 40 },
      parents: { 'collapse-scale': 0.25 },
    });
    const parent = cy.$id('p');
    const a = cy.$id('a');
    const b = cy.$id('b');

    parent.position({ x: 100, y: 100 });
    a.position({ x: 120, y: 100 });
    b.position({ x: 80, y: 100 });
    a.lock();

    parent.collapse();

    expect(a.position()).to.deep.equal({ x: 120, y: 100 });
    expect(a.width()).to.equal(10);
    expect(b.position()).to.deep.equal({ x: 95, y: 100 });
    expect(b.width()).to.equal(10);
  });

  it('applies requested nested parent scales once in ancestor-first order', function () {
    const cy = cytoscape({
      elements: {
        nodes: [
          { data: { id: 'p' } },
          { data: { id: 'n', parent: 'p' } },
          { data: { id: 'a', parent: 'n' }, position: { x: 10, y: 0 } },
          { data: { id: 'b', parent: 'n' }, position: { x: -10, y: 0 } },
        ],
      },
      style: {
        nodes: { width: 40 },
        parents: { 'collapse-scale': 0.5 },
      },
    });
    const p = cy.$id('p');
    const n = cy.$id('n');
    const a = cy.$id('a');
    const b = cy.$id('b');

    n.union(p).collapse();

    expect(p.collapsed()).to.equal(true);
    expect(n.collapsed()).to.equal(true);
    expect(a.position().x).to.equal(2.5);
    expect(b.position().x).to.equal(-2.5);
    expect(a.style('width')).to.equal(40);
    expect(a.width()).to.equal(10);
  });

  it('allows an explicitly collapsed parent at scale one', function () {
    const cy = make({ parents: { 'collapse-scale': 1 } });
    const parent = cy.$id('p');
    const child = cy.$id('a');
    const before = child.position();

    parent.collapse();

    expect(parent.collapsed()).to.equal(true);
    expect(child.position()).to.deep.equal(before);
    expect(child.insideCollapsed()).to.equal(true);
  });

  it('validates all operation targets before changing any parent', function () {
    const cy = make();
    const parent = cy.$id('p');

    expect(() => parent.union(cy.$id('q')).collapse()).to.throw(
      /compound parents/,
    );
    expect(parent.collapsed()).to.equal(false);
    const empty = cy.collection();

    expect(empty.collapse()).to.equal(empty);
  });

  it('rejects unrepresentable expansion positions before changing state', function () {
    const cy = make({
      nodes: { width: 30 },
      parents: { 'collapse-scale': 0.01 },
    });
    const parent = cy.$id('p');
    const a = cy.$id('a');
    const b = cy.$id('b');

    parent.position({ x: 0, y: 0 });
    a.position({ x: 1, y: 0 });
    b.position({ x: -1, y: 0 });
    parent.collapse();
    a.position({ x: 3e37 });

    const beforeB = b.position();

    expect(() => parent.expand()).to.throw(/non-finite position/);
    expect(parent.collapsed()).to.equal(true);
    expect(b.position()).to.deep.equal(beforeB);
  });

  it('rejects a collapsed ancestor product that underflows Float32', function () {
    const depth = 24;
    const nodes = Array.from({ length: depth + 1 }, (_, i) => ({
      data: {
        id: `p${i}`,
        ...(i === 0 ? {} : { parent: `p${i - 1}` }),
      },
    }));

    nodes.push({ data: { id: 'leaf', parent: `p${depth}` } });

    const cy = cytoscape({
      elements: { nodes },
      style: { parents: { 'collapse-scale': 0.01 } },
    });
    let parents = cy.collection();

    for (let i = 0; i <= depth; i++) {
      parents = parents.union(cy.$id(`p${i}`));
    }

    expect(() => parents.collapse()).to.throw(/underflow effective geometry/);
    expect(cy.nodes({ collapsed: true })).to.have.length(0);
  });

  it('rejects effective dimensions that underflow after scaling', function () {
    const cy = make({
      nodes: { width: 1e-45 },
      parents: { 'collapse-scale': 0.1 },
    });
    const parent = cy.$id('p');
    const child = cy.$id('a');

    expect(child.style('width')).to.be.greaterThan(0);
    expect(() => parent.collapse()).to.throw(/underflow effective geometry/);
    expect(parent.collapsed()).to.equal(false);
  });

  it('rejects expansion when stored applied scale has no finite ratio', function () {
    const cy = make();
    const parent = cy.$id('p');

    cy._store.setCollapsed(parent._refs[0].slot, true, Number.MIN_VALUE);

    expect(() => parent.expand()).to.throw(/scale change is not representable/);
    expect(parent.collapsed()).to.equal(true);
  });

  it('transitions authored size lanes while geometry stays scaled', function () {
    const transition = {
      'transition-property': ['width', 'height'],
      'transition-duration': 100,
      'transition-timing-function': 'linear',
    };
    const cy = make({
      nodes: { width: 80, height: 40, ...transition },
    });
    const parent = cy.$id('p');
    const child = cy.$id('a');

    cy._store.setCollapsed(parent._refs[0].slot, true, 0.25);
    cy.style({
      nodes: { width: 60, height: 28, ...transition },
    });

    expect(child.width()).to.equal(20);
    expect(child.height()).to.equal(10);

    cy._animations.tick(0);
    cy._animations.tick(50);

    expect(child.style('width')).to.be.closeTo(70, 1e-4);
    expect(child.style('height')).to.be.closeTo(34, 1e-4);
    expect(child.width()).to.be.closeTo(17.5, 1e-4);
    expect(child.height()).to.be.closeTo(8.5, 1e-4);

    cy._animations.tick(100);

    expect(child.style('width')).to.equal(60);
    expect(child.style('height')).to.equal(28);
    expect(child.width()).to.equal(15);
    expect(child.height()).to.equal(7);
  });
});
