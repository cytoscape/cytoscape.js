// import * as mat from './matrix';
import { NodeDrawing } from './drawing-nodes-webgl';
import { mat3, vec2 } from 'gl-matrix';


const CRp = {};

CRp.initWebgl = function(options, fns) {
  const r = this;
  const gl = r.data.contexts[r.WEBGL];

  gl.clearColor(0, 0, 0, 0); // background color
  // enable alpha blending of textures
  gl.enable(gl.BLEND);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const getZeroRotation = () => 0;
  const getLabelRotation = (ele) => r.getTextAngle(ele, null);
  
  r.nodeDrawing = new NodeDrawing(r, gl, {
    getKey: fns.getStyleKey,
    getBoundingBox: fns.getElementBox,
    drawElement: fns.drawElement,
    getRotation: getZeroRotation,
    getRotationPoint: fns.getElementRotationPoint,
    getRotationOffset: fns.getElementRotationOffset
  });

  r.nodeLabelDrawing = new NodeDrawing(r, gl, {
    getKey: fns.getLabelKey,
    getBoundingBox: fns.getLabelBox,
    drawElement: fns.drawLabel,
    getRotation: getLabelRotation,
    getRotationPoint: fns.getLabelRotationPoint,
    getRotationOffset: fns.getLabelRotationOffset
  });
}

CRp.clearWebgl = function() {
  const r = this;
  const gl = r.data.contexts[r.WEBGL];
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
};

function createPanZoomMatrix(r) {
  const width = r.canvasWidth;
  const height = r.canvasHeight;
  const { x, y, zoom } = getEffectivePanZoom(r);

  const transform = mat3.create();
  mat3.translate(transform, transform, vec2.fromValues(x, y));
  mat3.scale(transform, transform, vec2.fromValues(zoom, zoom));

  const projection = mat3.create();
  mat3.projection(projection, width, height);

  const matrix = mat3.create();
  mat3.multiply(matrix, projection, transform);

  return matrix;
}

function getEffectivePanZoom(r) {
  const { pixelRatio } = r;
  const zoom = r.cy.zoom();
  const pan  = r.cy.pan();
  return {
    zoom: zoom * pixelRatio,
    x: pan.x * pixelRatio,
    y: pan.y * pixelRatio,
  };
}

function setContextTransform(r, context) {
  const w = r.canvasWidth;
  const h = r.canvasHeight;
  const panzoom = getEffectivePanZoom(r);

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, w, h);
  context.translate(panzoom.x, panzoom.y);
  context.scale(panzoom.zoom, panzoom.zoom);
}

function drawSelectionRectangle(r, options) {
  r.drawSelectionRectangle(options, context => setContextTransform(r, context));
}

function drawAxes(r) { // for debgging
  const context = r.data.contexts[ r.NODE ];
  context.save();
  setContextTransform(r, context);
  context.fillStyle='red';
  context.fillRect(-3, -3, 6, 6);
  context.strokeStyle='red';
  context.beginPath();
  context.moveTo(-1000, 0);
  context.lineTo(1000, 0);
  context.stroke();
  context.beginPath();
  context.moveTo(0, -1000);
  context.lineTo(0, 1000);
  context.stroke();
  context.restore();
}

CRp.renderWebgl = function(options) {
  const r = this;
  console.log('webgl render');
  const { nodeDrawing, nodeLabelDrawing } = r;

  if(r.data.canvasNeedsRedraw[r.SELECT_BOX]) {
    drawSelectionRectangle(r, options);
  }

  drawAxes(r);

  // from drawing-elements.js drawCachedElement()
  // r.drawElementUnderlay( context, ele );

  // r.drawCachedElementPortion( context, ele, eleTxrCache, pxRatio, lvl, reason, getZeroRotation, getOpacity );
  
  // if( !isEdge || !badLine ){
  //   r.drawCachedElementPortion( context, ele, lblTxrCache, pxRatio, lvl, reason, getLabelRotation, getTextOpacity );
  // }

  // if( isEdge && !badLine ){
  //   r.drawCachedElementPortion( context, ele, slbTxrCache, pxRatio, lvl, reason, getSourceLabelRotation, getTextOpacity );
  //   r.drawCachedElementPortion( context, ele, tlbTxrCache, pxRatio, lvl, reason, getTargetLabelRotation, getTextOpacity );
  // }

  // r.drawElementOverlay( context, ele );

  if(r.data.canvasNeedsRedraw[r.NODE]) {
    const gl = r.data.contexts[r.WEBGL];
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    const panZoomMatrix = createPanZoomMatrix(r);
    function draw(ele) {
      if(ele.isNode()) {
        const node = ele;
        nodeDrawing.draw(node, panZoomMatrix);
        nodeLabelDrawing.draw(node, panZoomMatrix);
      }
    }

    const eles = r.getCachedZSortedEles();
    for(let i = 0; i < eles.nondrag.length; i++) {
      draw(eles.nondrag[i]);
    }
    for(let i = 0; i < eles.drag.length; i++) {
      draw(eles.drag[i]);
    }
  }

};

export default CRp;
