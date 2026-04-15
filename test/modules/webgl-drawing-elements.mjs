import { describe, it } from 'mocha';
import { expect } from 'chai';
import { ElementDrawingWebGL, RENDER_TARGET } from '../../src/extensions/renderer/canvas/webgl/drawing-elements-webgl.mjs';

const createBuffer = (size) => ({
  view: new Float32Array(size),
  getView(){
    return this.view;
  }
});

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
      getMatrixView(){
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

});
