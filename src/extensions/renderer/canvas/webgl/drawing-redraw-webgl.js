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
 * TODO - webgl specific data should be in a sub object, or it shoudl all be prefixed with webgl or something
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

  gl.clearColor(0, 0, 0, 0); // background color
  gl.enable(gl.BLEND); // enable alpha blending of textures
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // we are using premultiplied alpha

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

  r.pickingFrameBuffer = createPickingFrameBuffer(gl);

  // "Override" certain functions in canvas and base renderer
  overrideCanvasRendererFunctions(r);
}


/**
 * Plug into the canvas renderer to use webgl for rendering.
 */
function overrideCanvasRendererFunctions(r) {
  // Override the matchCanvasSize function to update the picking frame buffer size
  const matchCanvasSize = r.matchCanvasSize;
  r.matchCanvasSize = function(container) {
    matchCanvasSize.call(r, container);
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

  // // Override the findNearestElements function to call the webgl version
  r.findNearestElements = function(x, y, interactiveElementsOnly, isTouch) {
    // don't call the canvas version of this function, its very slow
    return findNearestElementsWebgl(r, x, y, interactiveElementsOnly, isTouch);
  }
}


function clearWebgl(r) {
  const gl = r.data.contexts[r.WEBGL];
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
};


function createPanZoomMatrix(r) {
  const gl = r.data.contexts[r.WEBGL];

  const width = r.canvasWidth;
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
  const w = r.canvasWidth;
  const h = r.canvasHeight;
  const panzoom = util.getEffectivePanZoom(r);

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


function createPickingFrameBuffer(gl) {
  // Create and bind the framebuffer
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

  // Create a texture to render to
  const targetTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, targetTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // attach the texture as the first color attachment
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, targetTexture, 0);
  
  function setFramebufferAttachmentSizes(width, height) {
    console.log('setFramebufferAttachmentSizes', width, height);
    gl.bindTexture(gl.TEXTURE_2D, targetTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }
  
  // setFramebufferAttachmentSizes(gl.canvas.width, gl.canvas.height);
  fb.setFramebufferAttachmentSizes = setFramebufferAttachmentSizes;

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return fb;
}


/**
 * This reverses what BRp.projectIntoViewport does, and convers to webgl coordinates.
 */
function modelCoordsToWebgl(r, x, y) {
  const [ offsetLeft, offsetTop, , , scale ] = r.findContainerClientCoords();
  const { x:panx, y:pany, zoom } = util.getEffectivePanZoom(r);

  var clientX = Math.round((x * zoom + panx) * scale + offsetLeft);
  var clientY = Math.round((y * zoom + pany) * scale + offsetTop);
  clientY = r.canvasHeight - clientY; // normal canvas has y=0 at top, webgl has y=0 at bottom
  
  return [ clientX, clientY ];
};


function findNearestElementsWebgl(r, x, y, interactiveElementsOnly, isTouch) {
  const gl = r.data.contexts[r.WEBGL];

  const [ clientX, clientY ] = modelCoordsToWebgl(r, x, y);
  console.log('findNearestElementsWebgl (x, y)', clientX, clientY, gl.canvas.width, gl.canvas.height);

  gl.bindFramebuffer(gl.FRAMEBUFFER, r.pickingFrameBuffer);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  // gl.clearColor(1, 0, 0, 0); // background color
  // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // gl.enable(gl.CULL_FACE);
  // gl.enable(gl.DEPTH_TEST);
  
  renderWebgl(r, null, RENDER_TARGET.PICKING);

  const data = new Uint8Array(4);
  gl.readPixels(
    clientX,            // x
    clientY,            // y
    1,                 // width
    1,                 // height
    gl.RGBA,           // format
    gl.UNSIGNED_BYTE,  // type
    data);             // typed array to hold result
  
  const index = util.vec4ToIndex(data);
  console.log('index', index, data);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return [];
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

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    let prevEle;

    function draw(ele, index) {
      if(ele.isNode()) {
        if(prevEle && prevEle.isEdge()) {
          // edgeDrawing.endBatch();
        }
        nodeDrawing.draw(ele, index, 'node-underlay');
        nodeDrawing.draw(ele, index, 'node-body');
        nodeDrawing.draw(ele, index, 'node-label');
        nodeDrawing.draw(ele, index, 'node-overlay');
      } else {
        if(prevEle && prevEle.isNode()) {
          nodeDrawing.endBatch();
        }
        // edgeDrawing.draw(ele);
      }
      prevEle = ele;
    }

    const panZoomMatrix = createPanZoomMatrix(r);
    const eles = r.getCachedZSortedEles();

    nodeDrawing.startFrame(panZoomMatrix, debugInfo, renderTarget);
    // edgeDrawing.startFrame(panZoomMatrix, debugInfo, renderTarget);

    nodeDrawing.startBatch();
    // edgeDrawing.startBatch();

    for(let i = 0; i < eles.nondrag.length; i++) {
      draw(eles.nondrag[i], i);
    }
    for(let i = 0; i < eles.drag.length; i++) {
      draw(eles.drag[i], -1);
    }

    nodeDrawing.endBatch();
    // edgeDrawing.endBatch();


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
