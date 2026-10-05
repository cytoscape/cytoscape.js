import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { COL } from '../src/contract.mjs';
import { refreshCollapsedGeometry } from '../src/collection/hierarchy.mjs';

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

  it('scales descendant decoration and only the shared geometry of internal edges', function () {
    const cy = cytoscape({
      elements: {
        nodes: [
          { data: { id: 'p' } },
          { data: { id: 'a', parent: 'p' }, position: { x: -30, y: 0 } },
          { data: { id: 'b', parent: 'p' }, position: { x: 30, y: 0 } },
          { data: { id: 'q' }, position: { x: 100, y: 0 } },
        ],
        edges: [
          { data: { id: 'ab', source: 'a', target: 'b' } },
          { data: { id: 'aq', source: 'a', target: 'q' } },
        ],
      },
      style: {
        nodes: {
          width: 40,
          height: 20,
          label: 'node',
          'font-size': 20,
          'text-outline-width': 2,
          'text-margin-x': 6,
          'border-width': 4,
          'border-style': 'dashed',
          'border-dash-pattern': '4 2',
          'border-dash-offset': 3,
          'corner-radius': 8,
          'outline-width': 2,
          'outline-offset': 3,
          'outline-color': '#000000',
          ghost: 'yes',
          'ghost-offset-x': 6,
          'ghost-offset-y': 2,
          'overlay-color': '#ff0000',
          'overlay-padding': 4,
          'overlay-shape': 'round-rectangle',
          'overlay-corner-radius': 8,
          'background-image': 'i.png',
          'background-width': 10,
          'background-height': 8,
        },
        parents: {
          padding: 10,
          'collapse-scale': 0.25,
        },
        edges: {
          width: 8,
          label: 'edge',
          'font-size': 20,
          'text-outline-width': 2,
          'text-margin-y': 6,
          'line-style': 'dashed',
          'line-dash-pattern': '6 2',
          'line-dash-offset': 4,
          'line-outline-width': 2,
          'line-outline-color': '#000000',
          'source-arrow-shape': 'triangle',
          'source-arrow-width': 12,
          'target-arrow-shape': 'triangle',
          'target-arrow-width': 16,
          'overlay-color': '#ff0000',
          'overlay-padding': 4,
        },
      },
    });
    const parent = cy.$id('p');
    const child = cy.$id('a');
    const internal = cy.$id('ab');
    const crossing = cy.$id('aq');
    const store = cy._store;
    const childSlot = child._refs[0].slot;
    const internalSlot = internal._refs[0].slot;
    const crossingSlot = crossing._refs[0].slot;

    parent.collapse();

    const borderWidth = store.column(COL.NODE_BORDER_WIDTH);
    const borderGeom = store.column(COL.NODE_BORDER_GEOM);
    const nodeDash = store.column(COL.NODE_BORDER_DASH);
    const nodeDashMeta = store.column(COL.NODE_BORDER_DASH_META);
    const ghost = store.column(COL.NODE_GHOST);
    const nodeOverlay = store.column(COL.NODE_OVERLAY);
    const edgeWidth = store.column(COL.EDGE_WIDTH);
    const arrowWidths = store.column(COL.EDGE_ARROW_WIDTHS);
    const edgeDash = store.column(COL.EDGE_DASH_PATTERN);
    const edgeDashMeta = store.column(COL.EDGE_DASH_META);
    const edgeCasing = store.column(COL.EDGE_CASING);
    const edgeOverlay = store.column(COL.EDGE_OVERLAY);
    const imagePool = store.imagePool.data();
    const imageOffset = store.imagePool.offsetOf(childSlot);
    const nodeLabel = store.labelAt(childSlot, 'nodes');
    const internalLabel = store.labelAt(internalSlot, 'edges');
    const crossingLabel = store.labelAt(crossingSlot, 'edges');

    expect(child.style('width')).to.equal(40);
    expect(child.width()).to.equal(10);
    expect(child.style('border-width')).to.equal(4);
    expect(child.outerWidth()).to.equal(11);
    expect(borderWidth[childSlot]).to.equal(1);
    expect(borderGeom[childSlot * 4]).to.equal(8 * 0.25 * 256);
    expect((borderGeom[childSlot * 4 + 3] & 0xffff) / 256).to.equal(0.5);
    expect((borderGeom[childSlot * 4 + 3] >>> 16) / 256).to.equal(0.75);
    expect(child.style('corner-radius')).to.equal(8);
    expect(child.style('outline-width')).to.equal(2);
    expect(child.style('outline-offset')).to.equal(3);
    expect(child.style('border-dash-pattern')).to.equal('4 2');
    expect(child.style('border-dash-offset')).to.equal(3);
    expect(nodeDash[childSlot * 4]).to.equal(1);
    expect(nodeDash[childSlot * 4 + 1]).to.equal(0.5);
    expect(nodeDashMeta[childSlot * 2]).to.equal(0.75);
    expect(child.style('ghost-offset-x')).to.equal(6);
    expect(child.style('ghost-offset-y')).to.equal(2);
    expect(ghost[childSlot * 4]).to.equal(1.5);
    expect(ghost[childSlot * 4 + 1]).to.equal(0.5);
    expect(child.style('overlay-padding')).to.equal(4);
    expect(child.style('overlay-corner-radius')).to.equal(8);
    expect(nodeOverlay[childSlot * 4 + 1]).to.equal(4 * 0.25 * 256);
    expect(nodeOverlay[childSlot * 4 + 3]).to.equal(8 * 0.25 * 256);
    expect(child.style('background-image')).to.equal('i.png');
    expect(child.style('background-width')).to.equal(10);
    expect(imagePool[imageOffset + 12]).to.equal(0.25);

    expect(internal.style('width')).to.equal(8);
    expect(internal.width()).to.equal(2);
    expect(crossing.style('width')).to.equal(8);
    expect(crossing.width()).to.equal(8);
    expect(edgeWidth[internalSlot * 2]).to.equal(2);
    expect(edgeWidth[crossingSlot * 2]).to.equal(8);
    expect(arrowWidths[internalSlot * 2]).to.equal(3);
    expect(arrowWidths[internalSlot * 2 + 1]).to.equal(4);
    expect(arrowWidths[crossingSlot * 2]).to.equal(12);
    expect(arrowWidths[crossingSlot * 2 + 1]).to.equal(16);
    expect(internal.style('source-arrow-width')).to.equal(12);
    expect(internal.style('target-arrow-width')).to.equal(16);
    expect(internal.style('line-outline-width')).to.equal(2);
    expect(edgeCasing[internalSlot * 4 + 1] / 256).to.equal(2.5);
    expect(edgeCasing[crossingSlot * 4 + 1] / 256).to.equal(10);
    expect(internal.style('line-dash-pattern')).to.equal('6 2');
    expect(internal.style('line-dash-offset')).to.equal(4);
    expect(edgeDash[internalSlot * 4]).to.equal(1.5);
    expect(edgeDash[internalSlot * 4 + 1]).to.equal(0.5);
    expect(edgeDashMeta[internalSlot * 2]).to.equal(1);
    expect(internal.style('overlay-padding')).to.equal(4);
    expect(edgeOverlay[internalSlot * 4 + 1] / 256).to.equal(4);

    expect(nodeLabel.fontSize).to.equal(5);
    expect(child.style('font-size')).to.equal(20);
    expect(child.style('text-outline-width')).to.equal(2);
    expect(child.style('text-margin-x')).to.equal(6);
    expect(internalLabel.fontSize).to.equal(5);
    expect(crossingLabel.fontSize).to.equal(20);
    expect(internal.style('font-size')).to.equal(20);
    expect(internal.style('text-outline-width')).to.equal(2);
    expect(internal.style('text-margin-y')).to.equal(6);
    expect(parent.paddedWidth()).to.equal(46);

    child.style('width', 60);
    child.style('border-width', 8);
    internal.style('width', 12);

    expect(child.style('width')).to.equal(60);
    expect(child.width()).to.equal(15);
    expect(child.style('border-width')).to.equal(8);
    expect(child.outerWidth()).to.equal(17);
    expect(internal.style('width')).to.equal(12);
    expect(internal.width()).to.equal(3);

    child.removeStyle('width');
    child.removeStyle('border-width');
    internal.removeStyle('width');

    expect(child.style('width')).to.equal(40);
    expect(child.width()).to.equal(10);
    expect(child.style('border-width')).to.equal(4);
    expect(child.outerWidth()).to.equal(11);
    expect(internal.style('width')).to.equal(8);
    expect(internal.width()).to.equal(2);
  });

  it('refreshes adopted factors without moving positions', function () {
    const cy = make({
      nodes: { width: 40, height: 20 },
      parents: { 'collapse-scale': 0.25 },
      edges: { width: 8 },
    });
    const parent = cy.$id('p');
    const child = cy.$id('a');
    const internal = cy.$id('ab');
    const crossing = cy.add({
      group: 'edges',
      data: { id: 'aq', source: 'a', target: 'q' },
    });
    const parentSlot = parent._refs[0].slot;
    const before = child.position();

    cy._store.setCollapsed(parentSlot, true, 0.25);
    refreshCollapsedGeometry(cy.collection(), [parentSlot]);

    expect(parent.collapsed()).to.equal(true);
    expect(child.position()).to.deep.equal(before);
    expect(child.width()).to.equal(10);
    expect(internal.width()).to.equal(2);
    expect(crossing.width()).to.equal(8);
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

  it('lays out a parent-only collapsed scope as one translated unit', async function () {
    const cy = cytoscape({
      elements: {
        nodes: [
          { data: { id: 'p' } },
          { data: { id: 'a', parent: 'p' }, position: { x: -20, y: 0 } },
          { data: { id: 'b', parent: 'p' }, position: { x: 20, y: 0 } },
          { data: { id: 'q' }, position: { x: 100, y: 0 } },
        ],
        edges: [
          { data: { id: 'ab', source: 'a', target: 'b' } },
          { data: { id: 'aq', source: 'a', target: 'q' } },
        ],
      },
      style: { parents: { 'collapse-scale': 0.25 } },
    });
    const parent = cy.$id('p');
    const a = cy.$id('a');
    const b = cy.$id('b');
    const q = cy.$id('q');

    parent.collapse();

    const beforeParent = parent.position();
    const beforeA = a.position();
    const beforeB = b.position();
    let slots;
    let edges;

    const layout = parent.layout({
      impl: {
        run(ctx) {
          slots = [...ctx.nodeSlots()];
          edges = [...ctx.edgeSlots()];
          ctx.setPositions(slots, [120, 60]);
        },
      },
      fit: false,
    });

    layout.run();
    await layout.promise();

    const dx = 120 - beforeParent.x;
    const dy = 60 - beforeParent.y;

    expect(slots).to.deep.equal([parent._refs[0].slot]);
    expect(edges).to.deep.equal([]);
    expect(parent.position()).to.deep.equal({ x: 120, y: 60 });
    expect(a.position()).to.deep.equal({
      x: beforeA.x + dx,
      y: beforeA.y + dy,
    });
    expect(b.position()).to.deep.equal({
      x: beforeB.x + dx,
      y: beforeB.y + dy,
    });
    expect(q.position()).to.deep.equal({ x: 100, y: 0 });
    expect(ids(cy.edges())).to.deep.equal(['ab', 'aq']);
    expect(cy.$id('aq').data('source')).to.equal('a');
    expect(cy.$id('aq').data('target')).to.equal('q');
  });

  it('uses descendant nodes instead of placing their collapsed parent too', async function () {
    const cy = cytoscape({
      elements: {
        nodes: [
          { data: { id: 'p' } },
          { data: { id: 'a', parent: 'p' }, position: { x: -20, y: 0 } },
          { data: { id: 'b', parent: 'p' }, position: { x: 20, y: 0 } },
        ],
      },
      style: { parents: { 'collapse-scale': 0.25 } },
    });
    const parent = cy.$id('p');
    const a = cy.$id('a');
    const b = cy.$id('b');

    parent.collapse();

    const beforeB = b.position();
    let slots;
    const layout = parent.union(a).layout({
      impl: {
        run(ctx) {
          slots = [...ctx.nodeSlots()];
          ctx.setPositions(slots, [80, 40]);
        },
      },
      fit: false,
    });

    layout.run();
    await layout.promise();

    expect(slots).to.deep.equal([a._refs[0].slot]);
    expect(a.position()).to.deep.equal({ x: 80, y: 40 });
    expect(b.position()).to.deep.equal(beforeB);
  });

  it('keeps parent-only built-in and preset layouts on the unit path', function () {
    const cy = make({ parents: { 'collapse-scale': 0.25 } });
    const parent = cy.$id('p');
    const a = cy.$id('a');

    parent.collapse();
    const beforeParent = parent.position();
    const beforeA = a.position();
    parent
      .layout({
        name: 'grid',
        fit: false,
        boundingBox: { x1: 120, y1: 80, w: 200, h: 120 },
      })
      .run();

    const afterParent = parent.position();
    const afterA = a.position();

    expect(afterParent.x).to.be.greaterThan(100);
    expect(afterA.x - afterParent.x).to.be.closeTo(
      beforeA.x - beforeParent.x,
      1e-4,
    );

    parent
      .layout({
        name: 'preset',
        fit: false,
        positions: { p: { x: 310, y: 170 } },
      })
      .run();

    expect(parent.position()).to.deep.equal({ x: 310, y: 170 });
  });
});
