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

describe('gpu/compounds: miniature state and effective size seam (round 148.1)', function () {
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
