import * as mat from './matrix';
import * as eleTextureCache from '../ele-texture-cache';
import * as shaders from './shaders';
import { NodeDrawing } from './drawing-nodes-webgl';

const CRp = {};

CRp.initWebgl = function(options) {
  const r = this;
  const gl = r.data.contexts[r.WEBGL];

  gl.clearColor(0, 0, 0, 0); // background color
  // enable alpha blending of textures
  gl.enable(gl.BLEND);
  // gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  // enable z-coord across multiple draw calls.
  gl.enable(gl.DEPTH_TEST);
  
  // In WebGL2 these don't have to be powers of two, but why not use powers of two anyway, they might have better performance.
  // const atlasSize = Math.min(8192, gl.getParameter(gl.MAX_TEXTURE_SIZE));
  const atlasSize = 1024; //8192;
  const texSize = 256;

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
    atlasSize,
    texSize,
  });

  r.labelDrawing = new NodeDrawing(r, gl, {
    getKey: getLabelKey,
    getBoundingBox: getLabelBox,
    drawElement: drawLabel,
    zBoost: 0.5,
    atlasSize,
    texSize,
  });
}

CRp.clearWebgl = function() {
  const r = this;
  const gl = r.data.contexts[r.WEBGL];
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
};

function createMatrix(r) {
  const width = r.canvasWidth;
  const height = r.canvasHeight;
  const panzoom = getEffectivePanZoom(r);

  const transformMatrix  = mat.transformMatrix4x4(panzoom.x, panzoom.y, panzoom.zoom);
  const projectionMatrix = mat.projectionMatrix4x4(width, height);
  const matrix = mat.multiply4x4(projectionMatrix, transformMatrix);

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
  const { nodeDrawing, labelDrawing } = r;

  console.log('webgl render');
  if(!nodeDrawing.isInitialized()) {
    nodeDrawing.initialize();
  }
  if(!labelDrawing.isInitialized()) {
    labelDrawing.initialize();
  }
  
  if(r.data.canvasNeedsRedraw[r.SELECT_BOX]) {
    drawSelectionRectangle(r, options);
  }

  if(r.data.canvasNeedsRedraw[r.NODE]) {
    const gl = r.data.contexts[r.WEBGL];
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    const matrix = createMatrix(r);
    
    labelDrawing.draw(matrix);
    nodeDrawing.draw(matrix);
  }

  const nodeContext = r.data.contexts[r.NODE];
  const firstAtlas = labelDrawing.styleKeyToAtlas.values().next().value;
  nodeContext.drawImage(firstAtlas.textureCanvas, 0, 0);

  console.log("")
};

export default CRp;
