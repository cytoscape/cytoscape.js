// import * as mat from './matrix';
import { EdgeDrawing } from './drawing-edges-webgl';
import { NodeDrawing } from './drawing-nodes-webgl';
import { mat3 } from 'gl-matrix';
import { color2tuple } from '../../../../util/colors'


const CRp = {};

CRp.initWebgl = function(opts, fns) {
  const r = this;
  const gl = r.data.contexts[r.WEBGL];
  const container = opts.cy.container();

  opts.webglTexSize = Math.min(opts.webglTexSize, gl.getParameter(gl.MAX_TEXTURE_SIZE));
  opts.webglTexRows = Math.min(opts.webglTexRows, 54);
  opts.webglBatchSize = Math.min(opts.webglBatchSize, 16384);
  opts.webglTexPerBatch = Math.min(opts.webglTexPerBatch, gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS));
  r.webglDebug = opts.webglDebug;

  console.log('max texture units', gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS));
  console.log('max texture size' , gl.getParameter(gl.MAX_TEXTURE_SIZE));
  console.log('webgl options', opts);

  gl.clearColor(0, 0, 0, 0); // background color
  // enable alpha blending of textures
  gl.enable(gl.BLEND);
  // we are using premultiplied alpha
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const c = (container && container.style && container.style.backgroundColor) || 'white';
  const bgColor = color2tuple(c);

  const getZeroRotation = () => 0;
  const getLabelRotation = (ele) => r.getTextAngle(ele, null);
  const isNodeVisible = (ele) => ele.visible();
  const isLabelVisible = (ele) => {
    let label = ele.pstyle( 'label' );
    return label && label.value;
  }

  const getNodeOverlayUnderlayStyle = s => node => {
    const opacity = node.pstyle(`${s}-opacity`).value;
    const color   = node.pstyle(`${s}-color`).value;
    const shape   = node.pstyle(`${s}-shape`).value;
    const padding = node.pstyle(`${s}-padding` ).pfValue;
    return { opacity, color, shape, padding }; // TODO need to add radius at some point
  };

  const isNodeOverlayUnderlayVisible = s => node => {
    const opacity = node.pstyle(`${s}-opacity`).value;
    return opacity > 0;
  };

  
  r.edgeDrawing = new EdgeDrawing(r, gl, { ...opts, bgColor });
  r.nodeDrawing = new NodeDrawing(r, gl, opts);
  
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

  // TODO not called when deleting elements
  r.onUpdateEleCalcs((willDraw, eles) => {
    r.nodeDrawing.invalidate(eles);
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
  mat3.translate(transform, transform, [x, y]);
  mat3.scale(transform, transform, [zoom, zoom]);

  const projection = mat3.create();
  mat3.projection(projection, width, height);

  const product = mat3.create();
  mat3.multiply(product, projection, transform);

  return product;
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
  const context = r.data.contexts[r.NODE];
  context.save();
  setContextTransform(r, context);
  context.strokeStyle='rgba(0, 0, 0, 0.3)';
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

function drawAtlases(r) {
  const opts = r.nodeDrawing.getRenderType('node-body');
  const firstAtlas = opts.atlasControl.atlases[0];
  const canvas = firstAtlas.canvas;

  const context = r.data.contexts[r.NODE];
  context.save();
  context.scale(0.25, 0.25);
  context.drawImage(canvas, 0, 0);
  context.restore();
}

CRp.renderWebgl = function(options) {
  const r = this;

  let start;
  let debugInfo;
  if(r.webglDebug) {
    debugInfo = [];
    start = performance.now();
  }
  
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
        if(prevEle && prevEle.isEdge()) {
          edgeDrawing.endBatch();
        }
        nodeDrawing.draw(ele, 'node-underlay');
        nodeDrawing.draw(ele, 'node-body');
        nodeDrawing.draw(ele, 'node-label');
        nodeDrawing.draw(ele, 'node-overlay');
      } else {
        if(prevEle && prevEle.isNode()) {
          nodeDrawing.endBatch();
        }
        edgeDrawing.draw(ele);
      }
      prevEle = ele;
    }

    const panZoomMatrix = createPanZoomMatrix(r);
    const eles = r.getCachedZSortedEles();

    nodeDrawing.startFrame(panZoomMatrix, debugInfo);
    edgeDrawing.startFrame(panZoomMatrix, debugInfo);

    nodeDrawing.startBatch();
    edgeDrawing.startBatch();

    for(let i = 0; i < eles.nondrag.length; i++) {
      draw(eles.nondrag[i]);
    }
    for(let i = 0; i < eles.drag.length; i++) {
      draw(eles.drag[i]);
    }

    nodeDrawing.endBatch();
    edgeDrawing.endBatch();

    if(r.data.gc) {
      console.log("Garbage Collect!");
      r.data.gc = false;

      nodeDrawing.gc();
    }

    drawAtlases(r);

    r.data.canvasNeedsRedraw[r.NODE] = false;
    r.data.canvasNeedsRedraw[r.DRAG] = false;
  }

  if(r.webglDebug) {
    const end = performance.now();
    console.log(`WebGL render - frame time ${Math.ceil(end - start)}ms`);
    console.log(`Batches: ${debugInfo.length}`);

    for(const info of debugInfo) {
      if(info.type === 'node') {
        console.log(`Draw Nodes: ${info.count} nodes, ${info.atlasCount} atlases`);
      } else {
        console.log(`Draw Edges: ${info.count} edges`);
      }
    }
    
    console.log('Texture Atlases Used:');
    const atlasInfo = nodeDrawing.getAtlasDebugInfo();
    for(const info of atlasInfo) {
      console.log(`  ${info.type}: ${info.keyCount} keys, ${info.atlasCount} atlases`);
    }
    console.log('');
  }

}

export default CRp;
