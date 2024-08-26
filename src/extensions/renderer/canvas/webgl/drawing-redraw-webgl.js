// import * as mat from './matrix';
import { EdgeDrawing } from './drawing-edges-webgl';
import { NodeDrawing } from './drawing-nodes-webgl';
import * as util from './webgl-util';
import { mat3 } from 'gl-matrix';
import { color2tuple } from '../../../../util/colors'
import * as eleTextureCache from '../ele-texture-cache';



export const RENDER_TARGET = {
  SCREEN:  { screen:  true },
  PICKING: { picking: true },
}

const CRp = {};

/**
 * TODO - webgl specific data should be in a sub object, or it should be prefixed with 'webgl'
 */
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

  // for offscreen rendering when render target is PICKING
  r.pickingFrameBuffer = util.createPickingFrameBuffer(gl);

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

  // "Override" certain functions in canvas and base renderer
  overrideCanvasRendererFunctions(r);
}


/**
 * Plug into the canvas renderer to use webgl for rendering.
 */
function overrideCanvasRendererFunctions(r) {
  // Override the matchCanvasSize function to update the picking frame buffer size
  const canvasMatchCanvasSize = r.matchCanvasSize;
  r.matchCanvasSize = function(container) {
    canvasMatchCanvasSize.call(r, container);
    r.pickingFrameBuffer.setFramebufferAttachmentSizes(r.canvasWidth, r.canvasHeight);
  };

  // Override the render function to call the webgl render function
  const canvasRender = r.render;
  r.render = function(options) {
    options = options || {};
    const cy = r.cy; 
    if(r.webgl) {
      if(cy.zoom() > eleTextureCache.maxZoom) {
        // if the zoom level is greater than the max zoom level, then disable webgl
        clearWebgl(r);
        canvasRender.call(r, options); 
      } else {
        r.clearCanvas();
        renderWebgl(r, options, RENDER_TARGET.SCREEN);
      }
    }
  }

  // Override function to call the webgl version
  // const canvasFindNearestElements = r.findNearestElements;
  r.findNearestElements = function(x, y, interactiveElementsOnly, isTouch) {
    // the canvas version of this function is very slow on large graphs
    return findNearestElementsWebgl(r, x, y, interactiveElementsOnly, isTouch);
  }

  // Override function to call the webgl version
  // const canvasGetAllInBox = r.getAllInBox;
  r.getAllInBox = function(x1, y1, x2, y2) {
    return getAllInBoxWebgl(r, x1, y1, x2, y2);
  }
}


function clearWebgl(r) {
  const gl = r.data.contexts[r.WEBGL];
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
};


function createPanZoomMatrix(r) {
  const width  = r.canvasWidth;
  const height = r.canvasHeight;
  const { x, y, zoom } = util.getEffectivePanZoom(r);

  const transform = mat3.create();
  mat3.translate(transform, transform, [x, y]);
  mat3.scale(transform, transform, [zoom, zoom]);

  const projection = mat3.create();
  mat3.projection(projection, width, height);

  const product = mat3.create();
  mat3.multiply(product, projection, transform);

  return product;
}


function setContextTransform(r, context) {
  const width  = r.canvasWidth;
  const height = r.canvasHeight;
  const { x, y, zoom } = util.getEffectivePanZoom(r);

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height);
  context.translate(x, y);
  context.scale(zoom, zoom);
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


/**
 * TODO: what if the coordinates are off the edge of the canvas?
 * (x1, y1) is top left corner
 * (x2, y2) is bottom right corner
 */
function getPickingIndexesInBox(r, x1, y1, x2, y2) {
  const [ cX1, cY1, cX2, cY2 ] = util.modelCoordsToWebgl(r, x1, y1, x2, y2);
  const w = Math.abs(cX2 - cX1);
  const h = Math.abs(cY2 - cY1);

  const gl = r.data.contexts[r.WEBGL];
  gl.bindFramebuffer(gl.FRAMEBUFFER, r.pickingFrameBuffer);

  // Draw element z-indexes to the framebuffer
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  renderWebgl(r, null, RENDER_TARGET.PICKING);

  const data = new Uint8Array(w * h * 4);
  // (cX1, cY2) is the bottom left corner of the box
  gl.readPixels(cX1, cY2, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  const indexes = new Array(w * h);
  for(let i = 0; i < indexes.length; i++) {
    const pixel = data.slice(i*4, i*4 + 4);
    const index = util.vec4ToIndex(pixel) - 1; // The framebuffer is cleared with 0s, so z-indexes are offset by 1
    indexes[i] = index;
  }
  return indexes;
}


function getAllInBoxWebgl(r, x1, y1, x2, y2) { // model coordinates
  var x1c = Math.min( x1, x2 );
  var x2c = Math.max( x1, x2 );
  var y1c = Math.min( y1, y2 );
  var y2c = Math.max( y1, y2 );

  x1 = x1c;
  x2 = x2c;
  y1 = y1c;
  y2 = y2c;

  const indexes = getPickingIndexesInBox(r, x1, y1, x2, y2);

  const eles = r.getCachedZSortedEles();

  const box = new Set();
  for(const index of indexes) {
    if(index >= 0) {
      box.add(eles[index]);
    }
  }
  return Array.from(box);
}


function findNearestElementsWebgl(r, x, y) { // model coordinates
  const targetSize = 6; // This defines a square around the target point in model coordinates

  x -= targetSize / 2;
  y -= targetSize / 2;
  const w = targetSize;
  const h = targetSize;

  const indexes = getPickingIndexesInBox(r, x, y, x + w, y + h);

  const dim = Math.sqrt(indexes.length);
  const rows = dim;
  const cols = dim;
  const center = dim / 2;

  let nearestNode;
  let nearestNodeSquareDist = Infinity;
  let nearestEdge;
  let nearestEdgeSquareDist = Infinity;

  const eles = r.getCachedZSortedEles();

  for(let row = 0; row < rows; row++) {
    for(let col = 0; col < cols; col++) {
      const i = row * cols + col;
      const index = indexes[i];
      if(index >= 0) {
        const ele = eles[index];
        const dist = Math.pow(row - center, 2) + Math.pow(col - center, 2);
        if(ele.isNode() && dist < nearestNodeSquareDist) {
          nearestNode = ele;
          nearestNodeSquareDist = dist;
        } else if(ele.isEdge() && dist < nearestEdgeSquareDist) {
          nearestEdge = ele;
          nearestEdgeSquareDist = dist;
        }
      }
    }
  }

  if(nearestNode && nearestEdge) {
    return [ nearestNode, nearestEdge ]; // TODO do I have to sort by nearest?
  } else if(nearestNode) {
    return [ nearestNode ];
  } else if(nearestEdge) {
    return [ nearestEdge ];
  } else {
    return [];
  }
}


function renderWebgl(r, options, renderTarget) {
  let start;
  let debugInfo;
  if(r.webglDebug) {
    debugInfo = [];
    start = performance.now();
  }
  
  const { nodeDrawing, edgeDrawing } = r;

  if(renderTarget.screen) {
    if(r.data.canvasNeedsRedraw[r.SELECT_BOX]) {
      drawSelectionRectangle(r, options);
    }
    drawAxes(r);
  }

  // see drawing-elements.js drawCachedElement()
  if(r.data.canvasNeedsRedraw[r.NODE] || renderTarget.picking) {
    const gl = r.data.contexts[r.WEBGL];

    if(renderTarget.screen) {
      gl.clearColor(0, 0, 0, 0); // background color
      gl.enable(gl.BLEND); // enable alpha blending of textures
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // we are using premultiplied alpha
    } else {
      gl.disable(gl.BLEND);
    }

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    let prevEle;

    function draw(ele, index) {
      index += 1; // 0 is used to clear the background, need to offset all z-indexes by one
      if(ele.isNode()) {
        if(prevEle && prevEle.isEdge()) {
          edgeDrawing.endBatch();
        }
        nodeDrawing.draw(ele, index, 'node-underlay');
        nodeDrawing.draw(ele, index, 'node-body');
        nodeDrawing.draw(ele, index, 'node-label');
        nodeDrawing.draw(ele, index, 'node-overlay');
      } else {
        if(prevEle && prevEle.isNode()) {
          nodeDrawing.endBatch();
        }
        edgeDrawing.draw(ele, index);
      }
      prevEle = ele;
    }

    const panZoomMatrix = createPanZoomMatrix(r);
    const eles = r.getCachedZSortedEles();

    nodeDrawing.startFrame(panZoomMatrix, debugInfo, renderTarget);
    edgeDrawing.startFrame(panZoomMatrix, debugInfo, renderTarget);

    nodeDrawing.startBatch();
    edgeDrawing.startBatch();

    if(renderTarget.screen) {
      for(let i = 0; i < eles.nondrag.length; i++) {
        draw(eles.nondrag[i], i);
      }
      for(let i = 0; i < eles.drag.length; i++) {
        draw(eles.drag[i], -1);
      }
    } else if(renderTarget.picking) {
      for(let i = 0; i < eles.length; i++) {
        draw(eles[i], i);
      }
    }

    nodeDrawing.endBatch();
    edgeDrawing.endBatch();


    if(r.data.gc) {
      console.log("Garbage Collect!");
      r.data.gc = false;
      nodeDrawing.gc();
    }

    // if(renderTarget.screen) {
    //   drawAtlases(r);
    // }

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
