import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import {
  ARROW_SHIFT_HOLLOW_SOURCE,
  ARROW_SHIFT_HOLLOW_TARGET,
  ARROW_SHIFT_MID_SOURCE,
  ARROW_SHIFT_MID_TARGET,
  ARROW_SHIFT_SOURCE,
  ARROW_SHIFT_TARGET,
  ARROW_CIRCLE_TRIANGLE,
  ARROW_TEE,
  ARROW_TRIANGLE_TEE,
  COL,
  unpackArrowShape,
} from '../src/contract.mjs';
import {
  arrowAxialDepth,
  arrowBarBoundsModel,
  arrowBackModel,
  arrowBarThicknessModel,
  arrowGap,
  arrowSizeModel,
  arrowSpacing,
} from '../src/shape-points.mjs';

const ELEMENTS = [
  { data: { id: 'a' }, position: { x: 0, y: 0 } },
  { data: { id: 'b' }, position: { x: 100, y: 0 } },
  { data: { id: 'ab', source: 'a', target: 'b' } },
];

describe('round 146: arrow vocabulary and variable compound geometry', function () {
  const cores = [];
  const makeCy = (style = {}) => {
    const cy = cytoscape({
      elements: ELEMENTS,
      style: { edges: style },
    });

    cores.push(cy);

    return cy;
  };

  afterEach(function () {
    for (const cy of cores.splice(0)) {
      cy.destroy();
    }
  });

  it('rejects the removed spelling atomically and reads the arrow alias canonically', function () {
    const cy = makeCy({ 'target-arrow-shape': 'triangle' });
    const edge = cy.$id('ab');

    expect(() =>
      cy.style({ edges: { 'target-arrow-shape': 'triangle-cross' } }),
    ).to.throw(/unsupported/i);
    expect(edge.style('target-arrow-shape')).to.equal('triangle');

    cy.style({ edges: { 'target-arrow-shape': 'arrow' } });

    expect(edge.style('target-arrow-shape')).to.equal('triangle');
  });

  it('computes bar thickness and axial/back extents in model units', function () {
    // Independently spell the v3 arrow-size law and round-146 thickness
    // contract here so a helper cannot validate itself.
    for (const [width, scale] of [
      [1, 1],
      [4, 1],
      [12, 1],
      [1, 2],
      [4, 2],
      [12, 2],
    ]) {
      const expectedSize = Math.max(Math.pow(width * 13.37, 0.9), 29) * scale;
      const expectedBar = Math.max(0.1 * expectedSize, width);

      expect(arrowSizeModel(width, scale)).to.be.closeTo(expectedSize, 1e-10);
      expect(arrowBarThicknessModel(width, scale)).to.be.closeTo(
        expectedBar,
        1e-10,
      );
      expect(arrowBarBoundsModel(ARROW_TEE, width, scale)).to.deep.equal([
        -0.15 * expectedSize,
        0,
        0.15 * expectedSize,
        -expectedBar,
      ]);
      expect(arrowBackModel(ARROW_TEE, width, scale)).to.be.closeTo(
        expectedBar,
        1e-10,
      );
      expect(arrowAxialDepth(ARROW_TEE, width, scale)).to.be.closeTo(
        expectedBar / expectedSize,
        1e-10,
      );
      expect(arrowBackModel(ARROW_TRIANGLE_TEE, width, scale)).to.be.closeTo(
        0.4 * expectedSize + expectedBar,
        1e-10,
      );
      expect(
        arrowBarBoundsModel(ARROW_TRIANGLE_TEE, width, scale),
      ).to.deep.equal([
        -0.15 * expectedSize,
        -0.4 * expectedSize,
        0.15 * expectedSize,
        -0.4 * expectedSize - expectedBar,
      ]);
      expect(arrowAxialDepth(ARROW_TRIANGLE_TEE, width, scale)).to.be.closeTo(
        0.3,
        1e-10,
      );

      // Width-dependent bar ink does not silently change the established
      // node gap or arrow-tip spacing used by accessors and path anchors.
      expect(arrowGap(ARROW_TEE, width, scale)).to.equal(1);
      expect(arrowSpacing(ARROW_TEE, width, scale)).to.equal(1);
      expect(arrowGap(ARROW_TRIANGLE_TEE, width, scale)).to.equal(
        2 * width * scale,
      );
      expect(arrowSpacing(ARROW_TRIANGLE_TEE, width, scale)).to.equal(0);
    }
  });

  it('retains hollow compound ends and stores their widths independently', function () {
    const cy = makeCy({
      width: 12,
      'source-arrow-shape': 'circle-triangle',
      'source-arrow-fill': 'hollow',
      'source-arrow-width': 3,
      'target-arrow-shape': 'triangle-tee',
      'target-arrow-fill': 'hollow',
      'target-arrow-width': 8,
      'mid-source-arrow-shape': 'tee',
      'mid-target-arrow-shape': 'triangle-tee',
    });
    const edge = cy.$id('ab');
    const slot = edge._first().slot;
    const shapes = cy._store.column(COL.EDGE_ARROW_SHAPES)[slot];
    const widths = cy._store.column(COL.EDGE_ARROW_WIDTHS);

    expect(edge.style('source-arrow-shape')).to.equal('circle-triangle');
    expect(edge.style('target-arrow-shape')).to.equal('triangle-tee');
    expect(edge.style('source-arrow-fill')).to.equal('hollow');
    expect(edge.style('target-arrow-fill')).to.equal('hollow');
    expect(widths[slot * 2]).to.equal(3);
    expect(widths[slot * 2 + 1]).to.equal(8);

    expect(unpackArrowShape(shapes, ARROW_SHIFT_SOURCE)).to.equal(
      ARROW_CIRCLE_TRIANGLE,
    );
    expect(unpackArrowShape(shapes, ARROW_SHIFT_TARGET)).to.equal(
      ARROW_TRIANGLE_TEE,
    );
    expect(unpackArrowShape(shapes, ARROW_SHIFT_MID_SOURCE)).to.equal(
      ARROW_TEE,
    );
    expect(unpackArrowShape(shapes, ARROW_SHIFT_MID_TARGET)).to.equal(
      ARROW_TRIANGLE_TEE,
    );
    expect((shapes >>> ARROW_SHIFT_HOLLOW_SOURCE) & 1).to.equal(1);
    expect((shapes >>> ARROW_SHIFT_HOLLOW_TARGET) & 1).to.equal(1);
  });

  it('keeps gap/spacing accessors stable on straight, curved and loop paths', function () {
    const straight = makeCy({ width: 12, 'target-arrow-shape': 'tee' });

    // The tee tip remains one model px inside the circle boundary (r=15),
    // while its wider bar changes only ink reach behind that tip.
    expect(straight.$id('ab').targetEndpoint().x).to.be.closeTo(84, 1e-4);
    expect(straight.$id('ab').midpoint().x).to.be.closeTo(49.5, 1e-4);

    const curved = cytoscape({
      elements: [
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'b' }, position: { x: 100, y: 0 } },
        { data: { id: 'curve', source: 'a', target: 'b' } },
      ],
      style: {
        edges: {
          'curve-style': 'unbundled-bezier',
          'control-point-distances': [24],
          'target-arrow-shape': 'triangle-tee',
          width: 12,
        },
      },
    });
    cores.push(curved);

    const loopCy = cytoscape({
      elements: [
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'loop', source: 'a', target: 'a' } },
      ],
      style: {
        edges: {
          'curve-style': 'bezier',
          'target-arrow-shape': 'triangle-tee',
          width: 12,
        },
      },
    });
    cores.push(loopCy);

    const curve = curved.$id('curve');
    const curvePoints = curve.controlPoints();
    const loop = loopCy.$id('loop');
    const loopPoints = loop.controlPoints();

    expect(curvePoints).to.have.length(1);
    expect(loopPoints).to.have.length(2);
    for (const point of [
      curve.sourceEndpoint(),
      curve.targetEndpoint(),
      curve.midpoint(),
      loop.sourceEndpoint(),
      loop.targetEndpoint(),
      loop.midpoint(),
    ]) {
      expect(Number.isFinite(point.x)).to.equal(true);
      expect(Number.isFinite(point.y)).to.equal(true);
    }
  });
});
