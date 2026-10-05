import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { deserializeElements, serializeElements } from '../src/wire.mjs';
import { refreshCollapsedGeometry } from '../src/collection/hierarchy.mjs';

const sheet = (scale = 0.25, width = 40) => ({
  nodes: { width, height: 20 },
  parents: { 'collapse-scale': scale },
});

const graph = () => ({
  nodes: [
    { data: { id: 'p' } },
    { data: { id: 'a', parent: 'p' }, position: { x: 20, y: 10 } },
    { data: { id: 'b', parent: 'p' }, position: { x: 80, y: 30 } },
    { data: { id: 'outside' }, position: { x: 120, y: 90 } },
  ],
  edges: [
    { data: { id: 'ab', source: 'a', target: 'b' } },
    { data: { id: 'cross', source: 'a', target: 'outside' } },
  ],
});

const positions = (cy) =>
  Object.fromEntries(
    cy.nodes().map((node) => [node.id(), { ...node.position() }]),
  );

const stateOf = (cy, id) => {
  const ref = cy.$id(id)._refs[0];

  return {
    collapsed: cy._store.isCollapsed(ref.slot),
    appliedScale: cy._store.appliedCollapseScaleOf(ref.slot),
  };
};

const waitForPatch = (cy) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('follow sync did not run')),
      1000,
    );

    cy.one('patch', (event) => {
      clearTimeout(timer);
      resolve(event.diff);
    });
  });

describe('gpu/compounds: miniature persistence (round 148)', function () {
  it('wire snapshots carry current positions, collapsed flags, and applied factors', function () {
    const source = cytoscape({ elements: graph(), style: sheet() });

    source.$id('p').collapse();
    const currentPositions = positions(source);
    const payload = deserializeElements(source.serialize());

    expect(Array.from(payload.nodes.collapsed)).to.deep.equal([1, 0, 0, 0]);
    expect(Array.from(payload.nodes.appliedCollapseScale)).to.deep.equal([
      0.25, 1, 1, 1,
    ]);
    expect(Array.from(payload.nodes.positions)).to.deep.equal(
      Object.values(currentPositions).flatMap(({ x, y }) => [x, y]),
    );

    const loaded = cytoscape({ elements: source.serialize(), style: sheet() });

    expect(positions(loaded)).to.deep.equal(currentPositions);
    expect(stateOf(loaded, 'p')).to.deep.equal({
      collapsed: true,
      appliedScale: 0.25,
    });
    expect(loaded.$id('a').width()).to.equal(source.$id('a').width());

    const clone = source.clone();

    expect(positions(clone)).to.deep.equal(currentPositions);
    expect(stateOf(clone, 'p')).to.deep.equal(stateOf(source, 'p'));

    for (const cy of [source, loaded, clone]) {
      cy.destroy();
    }
  });

  it('definition wire state resolves an omitted factor from the configured style', function () {
    const wire = serializeElements({
      nodes: [
        { data: { id: 'p' }, collapsed: true },
        { data: { id: 'a', parent: 'p' }, position: { x: 10, y: 5 } },
      ],
    });
    const decoded = deserializeElements(wire);
    const loaded = cytoscape({ elements: wire, style: sheet(0.7) });

    expect(decoded.nodes.collapsed[0]).to.equal(1);
    expect(decoded.nodes.appliedCollapseScale[0]).to.equal(0);
    expect(loaded.$id('p').collapsed()).to.equal(true);
    expect(stateOf(loaded, 'p').appliedScale).to.equal(0.7);
    expect(loaded.$id('a').position()).to.deep.equal({ x: 10, y: 5 });
    expect(loaded.$id('a').width()).to.equal(28);

    loaded.destroy();
  });

  it('JSON preserves an intermediate factor even when the loaded sheet differs', function () {
    const source = cytoscape({
      elements: {
        nodes: [
          { data: { id: 'p' }, collapsed: true, appliedCollapseScale: 0.4 },
          { data: { id: 'a', parent: 'p' }, position: { x: 10, y: 5 } },
        ],
      },
      style: sheet(0.7),
    });
    const exported = source.json();
    const parent = exported.elements.nodes.find((node) => node.data.id === 'p');
    const child = exported.elements.nodes.find((node) => node.data.id === 'a');

    expect(parent.collapsed).to.equal(true);
    expect(parent.appliedCollapseScale).to.equal(0.4);
    expect(child.position).to.deep.equal({ x: 10, y: 5 });

    const restored = cytoscape({
      elements: exported.elements,
      style: exported.style,
    });

    expect(restored.$id('p').collapsed()).to.equal(true);
    expect(stateOf(restored, 'p').appliedScale).to.equal(0.4);
    expect(restored.$id('a').position()).to.deep.equal({ x: 10, y: 5 });
    expect(restored.$id('a').width()).to.equal(16);

    source.destroy();
    restored.destroy();
  });

  it('patch adopts factor and positions without applying the public rescale twice', function () {
    const source = cytoscape({ elements: graph(), style: sheet(0.25) });
    const follower = cytoscape({ elements: graph(), style: sheet(0.5) });

    source.$id('p').collapse();
    follower.$id('p').collapse();
    const sourcePositions = positions(source);
    const ownSheet = follower.style().json();

    follower.patch(source.serialize());

    expect(positions(follower)).to.deep.equal(sourcePositions);
    expect(stateOf(follower, 'p')).to.deep.equal(stateOf(source, 'p'));
    expect(follower.$id('a').width()).to.equal(10);
    expect(follower.style().json()).to.deep.equal(ownSheet);

    source.destroy();
    follower.destroy();
  });

  it('follow syncs scale-one state and reconciles local collapse on the next sync', async function () {
    const source = cytoscape({ elements: graph(), style: sheet(1) });
    const follower = source.clone({ follow: { throttle: 0 } });

    const collapsed = waitForPatch(follower);

    source.$id('p').collapse();
    await collapsed;
    expect(follower.$id('p').collapsed()).to.equal(true);
    expect(positions(follower)).to.deep.equal(positions(source));

    const parentSlot = source.$id('p')._refs[0].slot;
    const retargeted = waitForPatch(follower);

    source._store.setCollapsed(parentSlot, true, 0.5);
    refreshCollapsedGeometry(source.collection(), [parentSlot]);
    await retargeted;
    expect(stateOf(follower, 'p').appliedScale).to.equal(0.5);

    follower.$id('p').expand();
    expect(follower.$id('p').collapsed()).to.equal(false);

    const expanded = waitForPatch(follower);

    source.$id('p').data('version', 2);
    await expanded;
    expect(follower.$id('p').collapsed()).to.equal(true);
    expect(follower.$id('p').data('version')).to.equal(2);

    source.destroy();
    follower.destroy();
  });

  it('asserts public columnar-load miniature validation messages', function () {
    const cy = cytoscape();
    const emptyEdges = {
      count: 0,
      ids: [],
      sources: new Uint32Array(0),
      targets: new Uint32Array(0),
    };
    const load = (nodes) =>
      cy.add({
        columnar: true,
        nodes: { count: 1, ids: ['n'], ...nodes },
        edges: emptyEdges,
      });

    expect(() => load({ collapsed: new Uint8Array(0) })).to.throw(
      /Columnar node collapsed column must hold 1 entries/,
    );
    expect(() => load({ appliedCollapseScale: new Float64Array(0) })).to.throw(
      /Columnar node applied collapse scale column must hold 1 entries/,
    );
    expect(() => load({ collapsed: new Uint8Array([2]) })).to.throw(
      /Columnar node collapsed value at 0 must be 0 or 1/,
    );
    expect(() =>
      load({
        collapsed: new Uint8Array([1]),
        appliedCollapseScale: new Float64Array([2]),
      }),
    ).to.throw(/Invalid applied collapse scale at node 0/);
    expect(() =>
      load({
        collapsed: new Uint8Array([0]),
        appliedCollapseScale: new Float64Array([0.5]),
      }),
    ).to.throw(/Expanded node 0 must have applied collapse scale 1/);

    cy.destroy();
  });

  it('asserts public patch miniature column length messages', function () {
    const cy = cytoscape();
    const emptyEdges = {
      count: 0,
      ids: [],
      sources: new Uint32Array(0),
      targets: new Uint32Array(0),
    };
    const patch = (nodes) =>
      cy.patch({
        columnar: true,
        nodes: { count: 1, ids: ['n'], ...nodes },
        edges: emptyEdges,
      });

    expect(() => patch({ collapsed: new Uint8Array(0) })).to.throw(
      /Columnar node collapsed column must hold 1 entries; got 0/,
    );
    expect(() => patch({ appliedCollapseScale: new Float64Array(0) })).to.throw(
      /Columnar node applied collapse scale column must hold 1 entries; got 0/,
    );

    cy.destroy();
  });

  it('rejects miniature state on edge definitions', function () {
    const cy = cytoscape({ elements: graph(), style: sheet() });

    expect(() =>
      cy.patch([
        {
          data: { id: 'bad-edge', source: 'a', target: 'b' },
          collapsed: true,
        },
      ]),
    ).to.throw(/supported on nodes only/);

    cy.destroy();
  });

  it('keeps an unspecified merge state and rejects invalid factors before writes', function () {
    const cy = cytoscape({ elements: graph(), style: sheet() });

    cy.$id('p').collapse();
    cy.patch([{ data: { id: 'a', note: 'upsert' } }], { mode: 'merge' });
    expect(cy.$id('p').collapsed()).to.equal(true);

    const before = positions(cy);

    expect(() =>
      cy.patch([
        {
          data: { id: 'p' },
          collapsed: true,
          appliedCollapseScale: 0,
          position: { x: 999, y: 999 },
        },
      ]),
    ).to.throw(/representable value/);
    expect(positions(cy)).to.deep.equal(before);
    expect(cy.$id('p').collapsed()).to.equal(true);

    cy.destroy();
  });
});
