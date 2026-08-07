import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { pickNodeAt } from '../src/render/cpu-pick.mjs';

// Round 20.3: 'text-events' — with 'yes' a node's label box is part of
// the node for picking (the exact laid block at its D3 anchor).  Node
// labels only in v4: the edges group throws, and edge labels stay
// unpickable (recorded).
describe('gpu/style: the text-events prop (round 20.3)', function () {
  var frame = { panXPx: 0, panYPx: 0, zoomDpr: 1, hidePx: 1, nodeLodPx: 3 };

  var makeCy = function (nodeStyle) {
    return cytoscape({
      elements: [{ data: { id: 'a', kind: 'ui' }, position: { x: 0, y: 0 } }],
      style: {
        nodes: Object.assign(
          {
            width: 30,
            height: 30,
            shape: 'rectangle',
            label: 'HELLO',
            'font-size': 12,
          },
          nodeStyle,
        ),
      },
    });
  };

  it('defaults to no and reads back stored truth', function () {
    var cy = makeCy();

    expect(cy.$id('a').style('text-events')).to.equal('no');

    var cy2 = makeCy({ 'text-events': 'yes' });

    expect(cy2.$id('a').style('text-events')).to.equal('yes');
  });

  it('rejects bad values and the edges group', function () {
    expect(() => makeCy({ 'text-events': 'sometimes' })).to.throw();
    expect(() =>
      cytoscape({ style: { edges: { 'text-events': 'yes' } } }),
    ).to.throw(/node style property/);
  });

  it('takes a case mapper', function () {
    var cy = makeCy({
      'text-events': {
        case: [{ when: { data: 'kind', eq: 'ui' }, then: 'yes' }],
        else: 'no',
      },
    });

    expect(cy.$id('a').style('text-events')).to.equal('yes');
  });

  it('the label box picks the node only under text-events: yes', function () {
    var cy = makeCy(); // default 'no'
    var store = cy._store;
    var box = store.nodeLabelBox(0); // node-local; the node sits at the origin

    expect(box).to.not.equal(null);
    expect(box.y1).to.be.greaterThan(15); // below the 30px node body (bottom valign)

    var lx = (box.x1 + box.x2) / 2;
    var ly = (box.y1 + box.y2) / 2;

    expect(pickNodeAt(store, frame, 0, 0)).to.equal(0); // the body always picks
    expect(pickNodeAt(store, frame, lx, ly)).to.equal(null); // label: transparent by default

    var cy2 = makeCy({ 'text-events': 'yes' });
    var store2 = cy2._store;
    var box2 = store2.nodeLabelBox(0);
    var lx2 = (box2.x1 + box2.x2) / 2;
    var ly2 = (box2.y1 + box2.y2) / 2;

    expect(pickNodeAt(store2, frame, lx2, ly2)).to.equal(0); // label picks the node
    expect(pickNodeAt(store2, frame, box2.x2 + 3, ly2)).to.equal(null); // just outside
  });

  it('an events: no node stays transparent even with text-events: yes', function () {
    var cy = makeCy({ events: 'no', 'text-events': 'yes' });
    var store = cy._store;
    var box = store.nodeLabelBox(0);

    expect(pickNodeAt(store, frame, 0, 0)).to.equal(null);
    expect(
      pickNodeAt(store, frame, (box.x1 + box.x2) / 2, (box.y1 + box.y2) / 2),
    ).to.equal(null);
  });
});
