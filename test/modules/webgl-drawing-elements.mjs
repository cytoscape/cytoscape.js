import { describe, it } from 'mocha';
import { expect } from 'chai';
import { ElementDrawingWebGL, RENDER_TARGET } from '../../src/extensions/renderer/canvas/webgl/drawing-elements-webgl.mjs';

const createBuffer = (size) => ({
  view: new Float32Array(size),
  getView() {
    return this.view;
  }
});

// one Float32Array per instance, so per-segment values can be checked
const createInstanceBuffer = (size) => {
  const views = [];
  return {
    views,
    getView(i) {
      if(!views[i]) {
        views[i] = new Float32Array(size);
      }
      return views[i];
    }
  };
};

const createDrawing = (points) => ({
  _getEdgePoints: () => points,
  _getLineDash: ElementDrawingWebGL.prototype._getLineDash,
  vertTypeBuffer: createInstanceBuffer(1),
  indexBuffer: createInstanceBuffer(4),
  colorBuffer: createInstanceBuffer(4),
  lineWidthBuffer: createInstanceBuffer(2),
  dashBuffer: createInstanceBuffer(4),
  pointAPointBBuffer: createInstanceBuffer(4),
  pointCPointDBuffer: createInstanceBuffer(4),
  renderTarget: RENDER_TARGET.SCREEN,
  instanceCount: 0,
  maxInstances: 100,
  endBatch(){}
});

const createEdge = (lineStyle, pattern = [6, 3], offset = 0) => {
  const styles = {
    'opacity': { value: 1 },
    'line-opacity': { value: 1 },
    'width': { pfValue: 2 },
    'line-color': { value: [0, 0, 0] },
    'line-style': { value: lineStyle },
    'line-dash-pattern': { pfValue: pattern },
    'line-dash-offset': { pfValue: offset }
  };
  return {
    visible: () => true,
    pstyle: (name) => styles[name]
  };
};

const dashOf = (drawing, i) => Array.from(drawing.dashBuffer.getView(i));

describe('webgl-drawing-elements', function(){

  it('drawNode() uses effective opacity for simple-shape node body and border', function(){
    const colorBuffer = createBuffer(4);
    const borderColorBuffer = createBuffer(4);
    const lineWidthBuffer = createBuffer(2);
    const vertTypeBuffer = createBuffer(1);
    const indexBuffer = createBuffer(4);
    const cornerRadiusBuffer = createBuffer(4);
    const transformMatrix = new Float32Array(9);
    const transformBuffer = {
      getMatrixView() {
        return transformMatrix;
      }
    };

    const drawing = {
      simpleShapeOptions: new Map([[
        'node-body',
        {
          shapeProps: {
            shape: 'shape',
            color: 'background-color',
            opacity: 'background-opacity',
            radius: 'corner-radius',
            border: true
          },
          getBoundingBox: () => ({ x1: 0, y1: 0, w: 10, h: 10 })
        }
      ]]),
      _isVisible: () => true,
      _getVertTypeForShape: () => 4,
      colorBuffer,
      borderColorBuffer,
      lineWidthBuffer,
      vertTypeBuffer,
      indexBuffer,
      cornerRadiusBuffer,
      transformBuffer,
      renderTarget: RENDER_TARGET.SCREEN,
      instanceCount: 0,
      simpleCount: 0,
      maxInstances: 10,
      endBatch(){},
      setTransformMatrix(){}
    };

    const styles = {
      shape: { value: 'rectangle' },
      'background-color': { value: [255, 0, 0] },
      'background-opacity': { value: 0.5 },
      'corner-radius': { value: 'auto', pfValue: 0 },
      'border-width': { value: 4 },
      'border-color': { value: [0, 0, 255] },
      'border-opacity': { value: 0.25 },
      'border-position': { value: 'center' }
    };

    const node = {
      visible: () => true,
      effectiveOpacity: () => 0.4,
      pstyle: (name) => styles[name]
    };

    ElementDrawingWebGL.prototype.drawNode.call(drawing, node, 7, 'node-body');

    expect(colorBuffer.view[3]).to.be.closeTo(0.2, 0.000001);
    expect(borderColorBuffer.view[3]).to.be.closeTo(0.1, 0.000001);
    expect(lineWidthBuffer.view[0]).to.equal(2);
    expect(lineWidthBuffer.view[1]).to.equal(-2);
    expect(drawing.simpleCount).to.equal(1);
    expect(drawing.instanceCount).to.equal(1);
  });

  const straight = [ 0, 0, 100, 0 ];

  it('drawEdgeLine() writes zeros for a solid edge', function(){
    const drawing = createDrawing(straight);
    ElementDrawingWebGL.prototype.drawEdgeLine.call(drawing, createEdge('solid'), 1);
    expect(drawing.instanceCount).to.equal(1);
    expect(dashOf(drawing, 0)).to.deep.equal([ 0, 0, 0, 0 ]);
  });

  it('drawEdgeLine() writes a 1-1 pattern for a dotted edge', function(){
    const drawing = createDrawing(straight);
    ElementDrawingWebGL.prototype.drawEdgeLine.call(drawing, createEdge('dotted', [6, 3], 24), 1);
    expect(dashOf(drawing, 0)).to.deep.equal([ 1, 1, 0, 0 ]);
  });

  it('drawEdgeLine() writes line-dash-pattern and line-dash-offset for a dashed edge', function(){
    const drawing = createDrawing(straight);
    ElementDrawingWebGL.prototype.drawEdgeLine.call(drawing, createEdge('dashed', [6, 3], 24), 1);
    expect(dashOf(drawing, 0)).to.deep.equal([ 6, 3, 0, 24 ]);
  });

  it('drawEdgeLine() carries the length before each curve segment', function(){
    const curve = [ 0, 0, 3, 4, 6, 8, 9, 12 ]; // three segments of length 5
    const drawing = createDrawing(curve);
    ElementDrawingWebGL.prototype.drawEdgeLine.call(drawing, createEdge('dashed', [6, 3], 24), 1);
    expect(drawing.instanceCount).to.equal(3);
    expect(dashOf(drawing, 0)).to.deep.equal([ 6, 3, 0, 24 ]);
    expect(dashOf(drawing, 1)).to.deep.equal([ 6, 3, 5, 24 ]);
    expect(dashOf(drawing, 2)).to.deep.equal([ 6, 3, 10, 24 ]);
  });

  it('_getLineDash() repeats a single-entry pattern as the gap', function(){
    const dash = ElementDrawingWebGL.prototype._getLineDash(createEdge('dashed', [4], 0));
    expect(dash).to.deep.equal([ 4, 4, 0 ]);
  });

  it('_getLineDash() uses the first two entries of a longer pattern', function(){
    const dash = ElementDrawingWebGL.prototype._getLineDash(createEdge('dashed', [8, 2, 1, 2], 3));
    expect(dash).to.deep.equal([ 8, 2, 3 ]);
  });

  it('_getLineDash() treats a dashed edge with an empty pattern as solid', function(){
    const dash = ElementDrawingWebGL.prototype._getLineDash(createEdge('dashed', [], 0));
    expect(dash).to.deep.equal([ 0, 0, 0 ]);
  });

});
