import { expect } from 'chai';
import cytoscape from '../../src/index.mjs';
import { nodeDims, nodeDimsOf, maxExtent } from '../../src/layout/dims.mjs';

// Round 114.1: the one reading of node dimensions every layout spaces by.
// The body is the store's own bounding-box term (size / 2 + border / 2);
// the label box joins by default and makes the box asymmetric; hidden
// sanitises to a point; padding splits half per side.  Headless label
// dimensions are the store's estimates, which is what these specs stand on.

const mk = (style, elements) =>
  cytoscape({
    elements: elements ?? [{ data: { id: 'a' }, position: { x: 0, y: 0 } }],
    style,
  });

const slotOf = (cy, id) => cy._store.lookup(id).slot;

describe('layout/dims: nodeDims (114.1)', () => {
  it('reads the body as size / 2 + border / 2, symmetric', () => {
    const cy = mk({ nodes: { width: 40, height: 20, 'border-width': 4 } });
    const d = nodeDims(cy._store, [slotOf(cy, 'a')], { includeLabels: false });

    expect(d.n).to.equal(1);
    expect([d.x1[0], d.y1[0], d.x2[0], d.y2[0]]).to.deep.equal([
      -22, -12, 22, 12,
    ]);
    expect(d.maxW).to.equal(44);
    expect(d.maxH).to.equal(24);
    // the same numbers the public measure reports
    expect(cy.$id('a').outerWidth()).to.equal(44);
    expect(cy.$id('a').outerHeight()).to.equal(24);
  });

  it('unions the label box by default, so a label below grows y2 only', () => {
    const cy = mk({
      nodes: { width: 30, height: 30, label: 'a wide label', 'font-size': 16 },
    });
    const slot = slotOf(cy, 'a');
    const bare = nodeDims(cy._store, [slot], { includeLabels: false });
    const labelled = nodeDims(cy._store, [slot]);
    const lb = cy._store.nodeLabelBox(slot);

    expect(lb).to.not.equal(null);
    expect(labelled.y1[0]).to.equal(bare.y1[0]); // nothing above
    expect(labelled.y2[0]).to.be.greaterThan(bare.y2[0]);
    expect(labelled.y2[0]).to.be.closeTo(lb.y2, 1e-6);
    expect(labelled.x2[0] - labelled.x1[0]).to.be.greaterThan(30);
    // the label term is what the public labelled box reports
    const bb = cy.$id('a').boundingBox();

    expect(labelled.x1[0]).to.be.closeTo(bb.x1, 1e-6);
    expect(labelled.x2[0]).to.be.closeTo(bb.x2, 1e-6);
    expect(labelled.y2[0]).to.be.closeTo(bb.y2, 1e-6);
  });

  it('control: includeLabels: false ignores the label', () => {
    const cy = mk({
      nodes: { width: 30, height: 30, label: 'a wide label', 'font-size': 16 },
    });
    const d = nodeDims(cy._store, [slotOf(cy, 'a')], { includeLabels: false });

    expect([d.x1[0], d.y1[0], d.x2[0], d.y2[0]]).to.deep.equal([
      -15, -15, 15, 15,
    ]);
  });

  it('sanitises a hidden node to a 1 x 1 box', () => {
    const cy = mk({ nodes: { width: 40, height: 40 } });

    cy.$id('a').hide();

    const d = nodeDims(cy._store, [slotOf(cy, 'a')]);

    expect([d.x1[0], d.y1[0], d.x2[0], d.y2[0]]).to.deep.equal([
      -0.5, -0.5, 0.5, 0.5,
    ]);
  });

  it('adds padding as half per side, so two padded boxes touch at padding', () => {
    const cy = mk({ nodes: { width: 30, height: 30 } });
    const d = nodeDims(cy._store, [slotOf(cy, 'a')], {
      includeLabels: false,
      padding: 10,
    });

    expect([d.x1[0], d.y1[0], d.x2[0], d.y2[0]]).to.deep.equal([
      -20, -20, 20, 20,
    ]);
    expect(maxExtent(d, 0)).to.equal(40);
  });

  it('follows the requested slot order and tracks the max extents', () => {
    const cy = mk(
      {
        nodes: {
          width: { data: 'w' },
          height: 10,
        },
      },
      [
        { data: { id: 'a', w: 10 }, position: { x: 0, y: 0 } },
        { data: { id: 'b', w: 50 }, position: { x: 0, y: 0 } },
        { data: { id: 'c', w: 30 }, position: { x: 0, y: 0 } },
      ],
    );
    const slots = ['c', 'a', 'b'].map((id) => slotOf(cy, id));
    const d = nodeDims(cy._store, slots, { includeLabels: false });

    expect(Array.from(d.x2)).to.deep.equal([15, 5, 25]);
    expect(d.maxW).to.equal(50);
    expect(d.maxH).to.equal(10);
  });

  it('nodeDimsOf measures a collection in its own order, nodes only', () => {
    const cy = mk({ nodes: { width: { data: 'w' }, height: 10 } }, [
      { data: { id: 'a', w: 10 }, position: { x: 0, y: 0 } },
      { data: { id: 'b', w: 50 }, position: { x: 0, y: 0 } },
      { data: { id: 'ab', source: 'a', target: 'b' } },
    ]);
    const d = nodeDimsOf(cy, cy.elements(), { includeLabels: false });

    expect(d.n).to.equal(2);
    expect(Array.from(d.x2)).to.deep.equal([5, 25]);
  });

  it('layoutDimensions is the same reading, labels on by default', () => {
    const cy = mk({
      nodes: { width: 30, height: 30, label: 'a wide label', 'font-size': 16 },
    });
    const a = cy.$id('a');
    const d = nodeDims(cy._store, [slotOf(cy, 'a')]);

    expect(a.layoutDimensions()).to.deep.equal({
      w: d.x2[0] - d.x1[0],
      h: d.y2[0] - d.y1[0],
    });
    expect(
      a.layoutDimensions({ nodeDimensionsIncludeLabels: false }),
    ).to.deep.equal({ w: 30, h: 30 });
    a.hide();
    expect(a.layoutDimensions()).to.deep.equal({ w: 1, h: 1 });
  });
});
