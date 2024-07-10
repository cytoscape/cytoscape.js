// import * as mat from './matrix';
import { EdgeDrawing } from './drawing-edges-webgl';
import { NodeDrawing } from './drawing-nodes-webgl';
import { mat3, vec2 } from 'gl-matrix';


const CRp = {};

CRp.initWebgl = function(options, fns) {
  const r = this;
  const gl = r.data.contexts[r.WEBGL];

  gl.clearColor(0, 0, 0, 0); // background color
  // enable alpha blending of textures
  gl.enable(gl.BLEND);
  // we are using premultiplied alpha
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const getZeroRotation = () => 0;
  const getLabelRotation = (ele) => r.getTextAngle(ele, null);
  const isNodeVisible = (ele) => ele.visible();
  const isLabelVisible = (ele) => {
    let label = ele.pstyle( 'label' );
    return label && label.value;
  }

  const getNodeOverlayUnderlayStyle = overlayOrUnderlay => node => {
    const opacity = node.pstyle(`${overlayOrUnderlay}-opacity`).value;
    const color = node.pstyle(`${overlayOrUnderlay}-color`).value;
    const shape = node.pstyle(`${overlayOrUnderlay}-shape`).value;
    const padding = node.pstyle( `${overlayOrUnderlay}-padding` ).pfValue;
    return { opacity, color, shape, padding }; // TODO need to add radius at some point
  };

  const isNodeOverlayUnderlayVisible = overlayOrUnderlay => node => {
    const opacity = node.pstyle(`${overlayOrUnderlay}-opacity`).value;
    return opacity > 0;
  };

  
  r.edgeDrawing = new EdgeDrawing(r, gl);
  r.nodeDrawing = new NodeDrawing(r, gl);
  
  r.nodeDrawing.addRenderType('node-body', {
    getKey: fns.getStyleKey,
    getBoundingBox: fns.getElementBox,
    drawElement: fns.drawElement,
    getRotationPoint: fns.getElementRotationPoint,
    getRotationOffset: fns.getElementRotationOffset,
    getRotation: getZeroRotation,
    isVisible: isNodeVisible,
  })

  r.nodeDrawing.addRenderType('node-label', {
    getKey: fns.getLabelKey,
    getBoundingBox: fns.getLabelBox,
    drawElement: fns.drawLabel,
    getRotationPoint: fns.getLabelRotationPoint,
    getRotationOffset: fns.getLabelRotationOffset,
    getRotation: getLabelRotation,
    isVisible: isLabelVisible,
  });

  r.nodeDrawing.addRenderType('node-overlay', {
    isOverlayOrUnderlay: true,
    getBoundingBox: fns.getElementBox,
    getRotation: getZeroRotation,
    isVisible: isNodeOverlayUnderlayVisible('overlay'),
    getOverlayUnderlayStyle: getNodeOverlayUnderlayStyle('overlay'),
  });

  r.nodeDrawing.addRenderType('node-underlay', {
    isOverlayOrUnderlay: true,
    getBoundingBox: fns.getElementBox,
    getRotation: getZeroRotation,
    isVisible: isNodeOverlayUnderlayVisible('underlay'),
    getOverlayUnderlayStyle: getNodeOverlayUnderlayStyle('underlay'),
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
  const { nodeDrawing, edgeDrawing } = r;

  if(r.data.canvasNeedsRedraw[r.SELECT_BOX]) {
    drawSelectionRectangle(r, options);
  }

  drawAxes(r);

  // see drawing-elements.js drawCachedElement()

  if(r.data.canvasNeedsRedraw[r.NODE]) {
    const gl = r.data.contexts[r.WEBGL];
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    let prevEle;
    function draw(ele) {
      if(ele.isNode()) {
        if(prevEle?.isEdge()) {
          edgeDrawing.endBatch();
        }
        nodeDrawing.draw(ele, 'node-underlay');
        nodeDrawing.draw(ele, 'node-body');
        nodeDrawing.draw(ele, 'node-label');
        nodeDrawing.draw(ele, 'node-overlay');
      } else {
        if(prevEle?.isNode()) {
          nodeDrawing.endBatch();
        }
        edgeDrawing.draw(ele);
      }
      prevEle = ele;
    }

    const panZoomMatrix = createPanZoomMatrix(r);
    const eles = r.getCachedZSortedEles();

    nodeDrawing.startBatch(panZoomMatrix);
    edgeDrawing.startBatch(panZoomMatrix);

    for(let i = 0; i < eles.nondrag.length; i++) {
      draw(eles.nondrag[i]);
    }
    for(let i = 0; i < eles.drag.length; i++) {
      draw(eles.drag[i]);
    }

    nodeDrawing.endBatch();
    edgeDrawing.endBatch();
  }
};

export default CRp;
