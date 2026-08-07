import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// round 13 D4: source-label/target-label — end-label streams anchored
// at arc distance *-text-offset from each end

describe('gpu/style: source/target labels (round 13 D4)', function () {
  var cy;

  var makeCy = (edgeStyle) =>
    cytoscape({
      elements: [
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'b' }, position: { x: 100, y: 0 } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
      ],
      style: { edges: edgeStyle },
    });

  it('parses and reads back the ten props', function () {
    cy = makeCy({
      'source-label': 'from',
      'source-text-offset': 20,
      'source-text-margin-x': 2,
      'source-text-margin-y': -3,
      'source-text-rotation': 'autorotate',
      'target-label': 'to',
      'target-text-offset': 30,
      'target-text-margin-x': -1,
      'target-text-margin-y': 4,
      'target-text-rotation': 'none',
    });

    var e = cy.$id('ab');

    expect(e.style('source-label')).to.equal('from');
    expect(e.style('source-text-offset')).to.equal(20);
    expect(e.style('source-text-margin-x')).to.equal(2);
    expect(e.style('source-text-margin-y')).to.equal(-3);
    expect(e.style('source-text-rotation')).to.equal('autorotate');
    expect(e.style('target-label')).to.equal('to');
    expect(e.style('target-text-offset')).to.equal(30);
    expect(e.style('target-text-margin-x')).to.equal(-1);
    expect(e.style('target-text-margin-y')).to.equal(4);
    expect(e.style('target-text-rotation')).to.equal('none');
  });

  it('defaults: empty labels, zero offsets, no rotation (v3)', function () {
    cy = makeCy({});

    var e = cy.$id('ab');

    expect(e.style('source-label')).to.equal('');
    expect(e.style('source-text-offset')).to.equal(0);
    expect(e.style('target-text-rotation')).to.equal('none');
  });

  it('writes the end streams: entries with endOffset, main stream untouched', function () {
    cy = makeCy({
      'source-label': 'S',
      'source-text-offset': 25,
      'target-label': 'T',
    });

    var store = cy._store;

    expect(store.labelAt(0, 'edgeSource').text).to.equal('S');
    expect(store.labelAt(0, 'edgeSource').endOffset).to.equal(25);
    expect(store.labelAt(0, 'edgeTarget').text).to.equal('T');
    expect(store.labelAt(0, 'edgeTarget').endOffset).to.equal(0);
    expect(store.labelAt(0, 'edges')).to.equal(undefined); // no main label
  });

  it('takes the data(key) passthrough and refreshes on data writes', function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'b' }, position: { x: 100, y: 0 } },
        { data: { id: 'ab', source: 'a', target: 'b', from: 'here' } },
      ],
      style: { edges: { 'source-label': { data: 'from' } } },
    });

    expect(cy._store.labelAt(0, 'edgeSource').text).to.equal('here');
    expect(cy.$id('ab').style('source-label')).to.equal('here');

    cy.$id('ab').data('from', 'there');

    expect(cy._store.labelAt(0, 'edgeSource').text).to.equal('there');
  });

  it('shares the text style channels with the main label', function () {
    cy = makeCy({
      'source-label': 'S',
      'font-size': 20,
      'text-background-color': '#fe0',
      'text-background-opacity': 1,
      'text-transform': 'uppercase',
      'source-text-margin-y': 6,
    });

    var entry = cy._store.labelAt(0, 'edgeSource');

    expect(entry.fontSize).to.equal(20);
    expect((entry.bgColor >>> 24) & 0xff).to.equal(255);
    expect(entry.text).to.equal('S'); // already uppercase
    expect(entry.anchorY).to.equal(-10 + 6); // -fontSize/2 + marginY
  });

  it('applies text-transform to end-label text', function () {
    cy = makeCy({ 'source-label': 'from', 'text-transform': 'uppercase' });

    expect(cy._store.labelAt(0, 'edgeSource').text).to.equal('FROM');
  });

  it('throws on the nodes group', function () {
    expect(() =>
      cytoscape({ style: { nodes: { 'source-label': 'x' } } }),
    ).to.throw(/edge style property/);
    expect(() =>
      cytoscape({ style: { nodes: { 'target-text-offset': 5 } } }),
    ).to.throw(/edge style property/);
  });

  it('offset takes mappers; edge removal clears the streams', function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'b' }, position: { x: 100, y: 0 } },
        { data: { id: 'ab', source: 'a', target: 'b', off: 40 } },
      ],
      style: {
        edges: {
          'source-label': 'S',
          'source-text-offset': {
            data: 'off',
            scale: 'linear',
            domain: [0, 40],
            range: [0, 40],
          },
        },
      },
    });

    expect(cy.$id('ab').style('source-text-offset')).to.be.closeTo(40, 1e-5);

    cy.$id('ab').remove();

    expect(cy._store.labelAt(0, 'edgeSource')).to.equal(undefined);
  });

  afterEach(function () {
    if (cy != null) {
      cy.destroy();
      cy = null;
    }
  });
});
