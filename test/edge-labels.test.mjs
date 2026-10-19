import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// edge labels (round 10, pass 1): the group-keyed label sidecar and style
// channels; rendering is covered by the webgpu Playwright specs
describe('gpu/edge labels: model + style', function () {
  var cy;

  beforeEach(function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'b' }, position: { x: 100, y: 0 } },
        { data: { id: 'ab', source: 'a', target: 'b', kind: 'likes' } },
        { data: { id: 'ba', source: 'b', target: 'a' } },
      ],
    });
  });

  var entryOf = (id) => cy._store.labelAt(cy._store.lookup(id).slot, 'edges');

  it('constant edge labels land in the edge sidecar', function () {
    cy.style({ edges: { label: 'hello' } });

    expect(entryOf('ab').text).to.equal('hello');
    expect(entryOf('ba').text).to.equal('hello');
    expect(cy.$id('ab').label()).to.equal('hello');

    // node sidecar untouched
    expect(cy._store.labelAt(cy._store.lookup('a').slot, 'nodes')).to.equal(
      undefined,
    );
  });

  it('the data passthrough mapper works for edges and refreshes on writes', function () {
    cy.style({ edges: { label: { data: 'kind' } } });

    expect(entryOf('ab').text).to.equal('likes');
    expect(entryOf('ba')).to.equal(undefined); // no data -> no label

    cy.$id('ba').data('kind', 'follows');

    expect(entryOf('ba').text).to.equal('follows');
  });

  it('edge label channels: font-size, color, margins, outline, background', function () {
    cy.style({
      edges: {
        label: 'x',
        'font-size': 20,
        color: 'red',
        'text-margin-x': 5,
        'text-margin-y': 7,
        'text-outline-width': 2,
        'text-outline-color': 'blue',
        'text-background-color': 'green',
        'text-background-opacity': 0.5,
      },
    });

    var entry = entryOf('ab');

    expect(entry.fontSize).to.equal(20);
    expect(entry.marginX).to.equal(5);
    // edges center on the midpoint: anchorY = -fontSize/2 + marginY
    expect(entry.anchorY).to.equal(-10 + 7);
    expect(entry.outlineWidth).to.equal(2);
    expect((entry.bgColor >>> 24) & 0xff).to.equal(128);

    expect(cy.$id('ab').style('font-size')).to.equal(20);
    expect(cy.$id('ab').style('color')).to.equal('rgb(255,0,0)');
    expect(cy.$id('ab').style('label')).to.equal('x');
    expect(cy.$id('ab').style('text-margin-y')).to.equal(7);
  });

  it('case mappers drive edge label channels', function () {
    cy.style({
      edges: {
        label: { data: 'id' },
        'font-size': {
          case: [{ when: { data: 'kind', eq: 'likes' }, then: 30 }],
          else: 10,
        },
      },
    });

    expect(entryOf('ab').fontSize).to.equal(30);
    expect(entryOf('ba').fontSize).to.equal(10);
  });

  it('font-family stays a node prop', function () {
    expect(() => cy.style({ edges: { 'font-family': 'serif' } })).to.throw(
      /node style property/,
    );
  });

  it('text-rotation: autorotate lands in the entry and reads back', function () {
    cy.style({ edges: { label: 'x', 'text-rotation': 'autorotate' } });

    expect(entryOf('ab').rotate).to.equal(true);
    expect(cy.$id('ab').style('text-rotation')).to.equal('autorotate');
  });

  it('text-rotation defaults to none (horizontal)', function () {
    cy.style({ edges: { label: 'x' } });

    expect(entryOf('ab').rotate).to.equal(false);
    expect(cy.$id('ab').style('text-rotation')).to.equal('none');

    // unlabelled edges resolve through the sheet
    cy.style({ edges: { 'text-rotation': 'autorotate' } });

    expect(entryOf('ab')).to.equal(undefined);
    expect(cy.$id('ab').style('text-rotation')).to.equal('autorotate');
  });

  it('text-rotation takes numbers (27.7) but rejects unknown keywords', function () {
    // round 27.7 made numeric rotations legal on every label; only
    // 'autorotate' stays edge-only, since it resolves from an edge slope
    cy.style({ edges: { 'text-rotation': 0.9 } });
    expect(cy.$id('ab').style('text-rotation')).to.equal(0.9);

    expect(() => cy.style({ edges: { 'text-rotation': 'sideways' } })).to.throw(
      /text-rotation/,
    );
    expect(() =>
      cy.style({ nodes: { 'text-rotation': 'autorotate' } }),
    ).to.throw(/edge-only/);
  });

  it('case mappers drive text-rotation', function () {
    cy.style({
      edges: {
        label: { data: 'id' },
        'text-rotation': {
          case: [{ when: { data: 'kind', eq: 'likes' }, then: 'autorotate' }],
          else: 'none',
        },
      },
    });

    expect(entryOf('ab').rotate).to.equal(true);
    expect(entryOf('ba').rotate).to.equal(false);
    expect(cy.$id('ab').style('text-rotation')).to.equal('autorotate');
    expect(cy.$id('ba').style('text-rotation')).to.equal('none');
  });

  it('node label entries never rotate', function () {
    cy.style({ nodes: { label: 'n' } });

    expect(
      cy._store.labelAt(cy._store.lookup('a').slot, 'nodes').rotate,
    ).to.equal(false);
  });

  it('removing an edge clears its label entry', function () {
    cy.style({ edges: { label: 'x' } });

    var slot = cy._store.lookup('ab').slot;

    cy.remove(cy.$id('ab'));

    expect(cy._store.labelAt(slot, 'edges')).to.equal(undefined);
  });

  it('markAllLabelsDirty covers both groups', function () {
    cy.style({
      nodes: { label: 'n' },
      edges: { label: 'e' },
    });

    cy._store.takeLabelDirty('nodes');
    cy._store.takeLabelDirty('edges');
    cy._store.markAllLabelsDirty();

    expect(cy._store.takeLabelDirty('nodes').length).to.equal(2);
    expect(cy._store.takeLabelDirty('edges').length).to.equal(2);
  });
});
