import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { pickNodeAt } from '../src/render/cpu-pick.mjs';

// Round 22: the display/visibility split.  show()/hide() stays the
// structural display tier (no space); the 'visibility' style prop is
// paint-only — an invisible element draws nothing and is not
// interactive, but keeps its space (bb/fit, compound auto-bounds) and
// its bundle ranks.
describe('gpu/style: the visibility prop (round 22)', function () {
  var frame = { panXPx: 0, panYPx: 0, zoomDpr: 1, hidePx: 1, nodeLodPx: 3 };

  it('parses, reads back and defaults to visible on both groups', function () {
    var cy = cytoscape({
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'e', source: 'a', target: 'b' } },
      ],
    });

    expect(cy.$id('a').style('visibility')).to.equal('visible');
    expect(cy.$id('e').style('visibility')).to.equal('visible');

    var cy2 = cytoscape({
      elements: [{ data: { id: 'a' } }],
      style: { nodes: { visibility: 'hidden' } },
    });

    expect(cy2.$id('a').style('visibility')).to.equal('hidden');
    expect(() =>
      cytoscape({ style: { nodes: { visibility: 'translucent' } } }),
    ).to.throw();
  });

  it('visible()/hidden() fold visibility; takesUpSpace() stays the display tier', function () {
    var cy = cytoscape({
      elements: [
        { data: { id: 'a', kind: 'x' } },
        { data: { id: 'b', kind: 'y' } },
      ],
      style: {
        nodes: {
          visibility: {
            case: [{ when: { data: 'kind', eq: 'x' }, then: 'hidden' }],
            else: 'visible',
          },
        },
      },
    });

    var a = cy.$id('a');

    expect(a.visible()).to.equal(false); // invisible: not rendered
    expect(a.hidden()).to.equal(true);
    expect(a.takesUpSpace()).to.equal(true); // but it keeps its space
    expect(a.interactive()).to.equal(false);
    expect(cy.$id('b').visible()).to.equal(true);

    a.data('kind', 'y'); // the mapped key: the channel refreshes

    expect(a.visible()).to.equal(true);

    // display-tier hide: no draw AND no space
    a.hide();
    expect(a.visible()).to.equal(false);
    expect(a.takesUpSpace()).to.equal(false);
  });

  it('gates by ancestor: an invisible parent blanks its subtree', function () {
    var cy = cytoscape({
      elements: [
        { data: { id: 'p', kind: 'parent' } },
        { data: { id: 'c', parent: 'p' }, position: { x: 0, y: 0 } },
      ],
      style: {
        nodes: {
          visibility: {
            case: [{ when: { data: 'kind', eq: 'parent' }, then: 'hidden' }],
            else: 'visible',
          },
        },
      },
    });

    expect(cy.$id('c').style('visibility')).to.equal('visible'); // own state
    expect(cy.$id('c').visible()).to.equal(false); // effective: parent invisible
    expect(cy.$id('c').takesUpSpace()).to.equal(true);

    cy.$id('p').data('kind', 'plain'); // parent becomes visible again

    expect(cy.$id('c').visible()).to.equal(true);
  });

  it('an edge is invisible with an invisible endpoint (v3 fold)', function () {
    var cy = cytoscape({
      elements: [
        { data: { id: 'a', kind: 'ghosty' } },
        { data: { id: 'b' } },
        { data: { id: 'e', source: 'a', target: 'b' } },
      ],
      style: {
        nodes: {
          visibility: {
            case: [{ when: { data: 'kind', eq: 'ghosty' }, then: 'hidden' }],
            else: 'visible',
          },
        },
      },
    });

    expect(cy.$id('e').style('visibility')).to.equal('visible'); // own state
    expect(cy.$id('e').visible()).to.equal(false); // folded: endpoint invisible

    cy.$id('a').data('kind', 'plain');

    expect(cy.$id('e').visible()).to.equal(true);
  });

  it('invisible elements keep their space: bb/fit and compound auto-bounds', function () {
    var cy = cytoscape({
      elements: [
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'far', kind: 'ghosty' }, position: { x: 1000, y: 0 } },
      ],
      style: {
        nodes: {
          width: 30,
          height: 30,
          visibility: {
            case: [{ when: { data: 'kind', eq: 'ghosty' }, then: 'hidden' }],
            else: 'visible',
          },
        },
      },
    });

    expect(cy.elements().boundingBox().x2).to.be.greaterThan(1000); // invisible: in the bb

    cy.$id('far').hide();

    expect(cy.elements().boundingBox().x2).to.be.lessThan(100); // hidden: out of it

    // compound auto-bounds: an invisible child still sizes its parent
    var cy2 = cytoscape({
      elements: [
        { data: { id: 'p' } },
        { data: { id: 'c1', parent: 'p' }, position: { x: 0, y: 0 } },
        {
          data: { id: 'c2', parent: 'p', kind: 'ghosty' },
          position: { x: 200, y: 0 },
        },
      ],
      style: {
        nodes: {
          width: 30,
          height: 30,
          visibility: {
            case: [{ when: { data: 'kind', eq: 'ghosty' }, then: 'hidden' }],
            else: 'visible',
          },
        },
      },
    });

    expect(cy2.$id('p').width()).to.be.greaterThan(200); // spans both children

    cy2.$id('c2').hide(); // display tier: leaves the auto-bounds

    expect(cy2.$id('p').width()).to.be.lessThan(100);
  });

  it('the CPU pick skips invisible nodes', function () {
    var cy = cytoscape({
      elements: [
        { data: { id: 'a', kind: 'ghosty' }, position: { x: 0, y: 0 } },
      ],
      style: {
        nodes: {
          width: 30,
          height: 30,
          shape: 'rectangle',
          visibility: {
            case: [{ when: { data: 'kind', eq: 'ghosty' }, then: 'hidden' }],
            else: 'visible',
          },
        },
      },
    });

    expect(pickNodeAt(cy._store, frame, 0, 0)).to.equal(null);

    cy.$id('a').data('kind', 'plain');

    expect(pickNodeAt(cy._store, frame, 0, 0)).to.equal(0);
  });

  it('elementsInBox stays geometric: invisible elements are still inside', function () {
    var cy = cytoscape({
      elements: [
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'b' }, position: { x: 50, y: 0 } },
        { data: { id: 'e', source: 'a', target: 'b' } },
      ],
      style: {
        nodes: { width: 20, height: 20, visibility: 'hidden' },
        edges: { visibility: 'hidden' },
      },
    });

    expect(cy.elementsInBox(-100, -100, 100, 100).length).to.equal(3);
  });
});

// 22.3: the bundle rule — display-tier hiding re-fans siblings,
// visibility keeps every rank stable.
describe('gpu/curves: bundles under display vs visibility (round 22.3)', function () {
  var makeBundle = function (style) {
    return cytoscape({
      elements: [
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'b' }, position: { x: 200, y: 0 } },
        { data: { id: 'e1', source: 'a', target: 'b' } },
        { data: { id: 'e2', source: 'a', target: 'b', kind: 'mid' } },
        { data: { id: 'e3', source: 'a', target: 'b' } },
      ],
      style: Object.assign({ edges: { 'curve-style': 'bezier' } }, style),
    });
  };

  it('hiding a bundle member re-fans the siblings (v3 display semantics)', function () {
    var cy = makeBundle();

    // a 3-bundle: the middle member is straight, the outer two curve
    expect(cy.$id('e2').controlPoints()).to.equal(undefined);

    var cp1Before = cy.$id('e1').controlPoints()[0];

    cy.$id('e2').hide();

    // now a 2-bundle: the remaining pair fans at the 2-member stagger
    var cp1After = cy.$id('e1').controlPoints()[0];

    expect(Math.abs(cp1After.y)).to.be.lessThan(Math.abs(cp1Before.y));
    expect(Math.abs(cp1After.y)).to.be.greaterThan(0);

    cy.$id('e2').show();

    var cp1Restored = cy.$id('e1').controlPoints()[0];

    expect(cp1Restored.y).to.be.closeTo(cp1Before.y, 1e-4);
  });

  it('an invisible bundle member keeps every rank stable', function () {
    var cy = makeBundle({
      edges: {
        'curve-style': 'bezier',
        visibility: {
          case: [{ when: { data: 'kind', eq: 'mid' }, then: 'hidden' }],
          else: 'visible',
        },
      },
    });
    var cyRef = makeBundle();

    // e2 is invisible but still occupies its bundle slot: the outer two
    // stagger exactly as a 3-bundle, and e2 stays the straight middle
    expect(cy.$id('e2').visible()).to.equal(false);
    expect(cy.$id('e1').controlPoints()[0].y).to.be.closeTo(
      cyRef.$id('e1').controlPoints()[0].y,
      1e-4,
    );
    expect(cy.$id('e2').controlPoints()).to.equal(undefined);
  });
});
