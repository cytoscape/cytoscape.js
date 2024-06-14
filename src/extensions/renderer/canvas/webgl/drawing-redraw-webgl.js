import * as mat from './matrix';
import { NodeDrawing } from './drawing-nodes-webgl';

const CRp = {};

CRp.initWebgl = function(options) {
  const r = this;
  const gl = r.data.contexts[r.WEBGL];

  gl.clearColor(0, 0, 0, 0); // background color
  // enable alpha blending of textures
  gl.enable(gl.BLEND);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  
  // taken from canvas renderer constructor
  const getStyleKey = ele => ele[0]._private.nodeKey;
  const getLabelKey = ele => ele[0]._private.labelStyleKey;
  const getElementBox = ele => { ele.boundingBox(); return ele[0]._private.bodyBounds; };
  const getLabelBox   = ele => { ele.boundingBox(); return ele[0]._private.labelBounds.main || emptyBb; };

  const drawNode = (context, node, bb) => {
    r.drawNode(context, node, bb, false, false, false);
  };
  const drawLabel = (context, node, bb) => {
    r.drawElementText(context, node, bb, true, 'main', false);
  };

  r.nodeDrawing = new NodeDrawing(r, gl, {
    getKey: getStyleKey,
    getBoundingBox: getElementBox,
    drawElement: drawNode,
  });

  r.labelDrawing = new NodeDrawing(r, gl, {
    getKey: getLabelKey,
    getBoundingBox: getLabelBox,
    drawElement: drawLabel,
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
  const panzoom = getEffectivePanZoom(r);

  const transformMatrix  = mat.transformMatrix3x3(panzoom.x, panzoom.y, panzoom.zoom);
  const projectionMatrix = mat.projectionMatrix3x3(width, height);
  const matrix = mat.multiply3x3(projectionMatrix, transformMatrix);

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

function drawSelectionRectangle(r, options) {
  function setContextTransform(context) {
    const w = r.canvasWidth;
    const h = r.canvasHeight;
    const panzoom = getEffectivePanZoom(r);

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, w, h);
    context.translate(panzoom.x, panzoom.y);
    context.scale(panzoom.zoom, panzoom.zoom);
  }
  r.drawSelectionRectangle(options, setContextTransform);
}

CRp.renderWebgl = function(options) {
  const r = this;
  console.log('webgl render');
  const { nodeDrawing, labelDrawing } = r;

  if(r.data.canvasNeedsRedraw[r.SELECT_BOX]) {
    drawSelectionRectangle(r, options);
  }

  if(r.data.canvasNeedsRedraw[r.NODE]) {
    const gl = r.data.contexts[r.WEBGL];
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    const panZoomMatrix = createPanZoomMatrix(r);

    const eles = r.getCachedZSortedEles();
    for(let i = 0; i < eles.length; i++) {
      const ele = eles[i];
      if(ele.isNode()) {
        const node = ele;
        nodeDrawing.draw(node, panZoomMatrix);
        labelDrawing.draw(node, panZoomMatrix);
      }
    }
  }

};

export default CRp;
