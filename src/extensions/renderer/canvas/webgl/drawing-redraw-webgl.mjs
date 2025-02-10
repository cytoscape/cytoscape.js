import { ElementDrawingWebGL } from './drawing-elements-webgl.mjs';
import { RENDER_TARGET, renderDefaults, atlasCollectionDefaults } from './defaults.mjs';
import { OverlayUnderlayRenderer } from './drawing-overlay.mjs';
import * as util from './webgl-util.mjs';
import * as eleTextureCache from '../ele-texture-cache.mjs';
import { debounce } from '../../../../util/index.mjs';
import { color2tuple } from '../../../../util/colors.mjs';
import { mat3 } from 'gl-matrix';


const CRp = {};


CRp.initWebgl = function(opts, fns) {
  const r = this;
  const gl = r.data.contexts[r.WEBGL];

  opts.bgColor = getBGColor(r);
  opts.webglTexSize = Math.min(opts.webglTexSize, gl.getParameter(gl.MAX_TEXTURE_SIZE));
  opts.webglTexRows = Math.min(opts.webglTexRows, 54);
  opts.webglTexRowsNodes = Math.min(opts.webglTexRowsNodes, 54);
  opts.webglBatchSize = Math.min(opts.webglBatchSize, 16384);
  opts.webglTexPerBatch = Math.min(opts.webglTexPerBatch, gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS));
  
  r.webglDebug = opts.webglDebug;
  r.webglDebugShowAtlases = opts.webglDebugShowAtlases;

  // for offscreen rendering when render target is PICKING
  r.pickingFrameBuffer = util.createPickingFrameBuffer(gl);
  r.pickingFrameBuffer.needsDraw = true;

  const getLabelRotation = (prop) => (ele) => r.getTextAngle(ele, prop);
  const isLabelVisible = (prop) => (ele) => {
    const label = ele.pstyle(prop);
    return label && label.value;
  };

  r.drawing = new ElementDrawingWebGL(r, gl, opts);
  const our = new OverlayUnderlayRenderer(r);

  r.drawing.addAtlasCollection('node', atlasCollectionDefaults({
    texRows: opts.webglTexRowsNodes
  }));

  r.drawing.addAtlasCollection('label', atlasCollectionDefaults({
    texRows: opts.webglTexRows
  }));

  r.drawing.addAtlasRenderType('node-body', renderDefaults({
    collection: 'node',
    getKey: fns.getStyleKey,
    getBoundingBox: fns.getElementBox,
    drawElement: fns.drawElement,
  }));

  r.drawing.addAtlasRenderType('label', renderDefaults({ // node label or edge mid label
    collection: 'label',
    getKey: fns.getLabelKey,
    getBoundingBox: fns.getLabelBox,
    drawElement: fns.drawLabel,
    getRotation: getLabelRotation(null),
    getRotationPoint: fns.getLabelRotationPoint,
    getRotationOffset: fns.getLabelRotationOffset,
    isVisible: isLabelVisible('label'),
  }));
  
  r.drawing.addAtlasRenderType('node-overlay', renderDefaults({
    collection: 'node',
    getBoundingBox: fns.getElementBox,
    getKey: ele => our.getStyleKey('overlay', ele),
    drawElement: (ctx, ele, bb) => our.draw('overlay', ctx, ele, bb),
    isVisible: ele => our.isVisible('overlay', ele),
    getPadding: ele => our.getPadding('overlay', ele),
  }));

  r.drawing.addAtlasRenderType('node-underlay', renderDefaults({
    collection: 'node',
    getBoundingBox: fns.getElementBox,
    getKey: ele => our.getStyleKey('underlay', ele),
    drawElement: (ctx, ele, bb) => our.draw('underlay', ctx, ele, bb),
    isVisible: ele => our.isVisible('underlay', ele),
    getPadding: ele => our.getPadding('underlay', ele),
  }));

  r.drawing.addAtlasRenderType('edge-source-label', renderDefaults({
    collection: 'label',
    getKey: fns.getSourceLabelKey,
    getBoundingBox: fns.getSourceLabelBox,
    drawElement: fns.drawSourceLabel,
    getRotation: getLabelRotation('source'),
    getRotationPoint: fns.getSourceLabelRotationPoint,
    getRotationOffset: fns.getSourceLabelRotationOffset,
    isVisible: isLabelVisible('source-label'),
  }));

  r.drawing.addAtlasRenderType('edge-target-label', renderDefaults({
    collection: 'label',
    getKey: fns.getTargetLabelKey,
    getBoundingBox: fns.getTargetLabelBox,
    drawElement: fns.drawTargetLabel,
    getRotation: getLabelRotation('target'),
    getRotationPoint: fns.getTargetLabelRotationPoint,
    getRotationOffset: fns.getTargetLabelRotationOffset,
    isVisible: isLabelVisible('target-label'),
  }));

  // this is a very simplistic way of triggering garbage collection
  const setGCFlag = debounce(() => {
    console.log('garbage collect flag set');
    r.data.gc = true;
  }, 10000);

  r.onUpdateEleCalcs((willDraw, eles) => {
    let gcNeeded = false;
    if(eles && eles.length > 0) {
      gcNeeded |= r.drawing.invalidate(eles);
    }
    if(gcNeeded) {
      setGCFlag();
    }
  });

  // "Override" certain functions in canvas and base renderer
  overrideCanvasRendererFunctions(r);
};


function getBGColor(r) {
  const container = r.cy.container();
  const cssColor = (container && container.style && container.style.backgroundColor) || 'white';
  return color2tuple(cssColor);
}

/**
 * Plug into the canvas renderer to use webgl for rendering.
 */
function overrideCanvasRendererFunctions(r) {
  { // Override the render function to call the webgl render function if the zoom level is appropriate
    const renderCanvas = r.render; 
    r.render = function(options) {
      options = options || {};
      const cy = r.cy; 
      if(r.webgl) {
        // if the zoom level is greater than the max zoom level, then disable webgl
        if(cy.zoom() > eleTextureCache.maxZoom) {
          clearWebgl(r);
          renderCanvas.call(r, options); 
        } else {
          clearCanvas(r);
          renderWebgl(r, options, RENDER_TARGET.SCREEN);
        }
      }
    };
  }

  { // Override the matchCanvasSize function to update the picking frame buffer size
    const baseFunc = r.matchCanvasSize;
    r.matchCanvasSize = function(container) {
      baseFunc.call(r, container);
      r.pickingFrameBuffer.setFramebufferAttachmentSizes(r.canvasWidth, r.canvasHeight);
      r.pickingFrameBuffer.needsDraw = true;
    };
  } 

  { // Override function to call the webgl version
    r.findNearestElements = function(x, y, interactiveElementsOnly, isTouch) {
      // the canvas version of this function is very slow on large graphs
      return findNearestElementsWebgl(r, x, y, interactiveElementsOnly, isTouch);
    };
  }

  // Don't override the selction box picking, its not accurate enough with webgl
  // { // Override function to call the webgl version
  //   r.getAllInBox = function(x1, y1, x2, y2) {
  //     return getAllInBoxWebgl(r, x1, y1, x2, y2);
  //   }
  // }

  { // need to know when the cached elements have changed so we can invalidate our caches
    const baseFunc = r.invalidateCachedZSortedEles;
    r.invalidateCachedZSortedEles = function() {
      baseFunc.call(r);
      r.pickingFrameBuffer.needsDraw = true;
    };
  }
  { // need to know when the cached elements have changed so we can invalidate our caches
    const baseFunc = r.notify;
    r.notify = function(eventName, eles) {
      baseFunc.call(r, eventName, eles);
      if(eventName === 'viewport' || eventName === 'bounds') {
        r.pickingFrameBuffer.needsDraw = true;
      } else if(eventName === 'background') { // background image finished loading, need to redraw
        r.drawing.invalidate(eles, { type: 'node-body' });
      }
    };
  }
}


function clearWebgl(r) {
  const gl = r.data.contexts[r.WEBGL];
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

function clearCanvas(r) {
  // the CRp.clearCanvas() function doesn't take the transform into account
  const clear = context => {
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, r.canvasWidth, r.canvasHeight);
    context.restore();
  };
  clear(r.data.contexts[r.NODE]);
  clear(r.data.contexts[r.DRAG]);
}


function createPanZoomMatrix(r) {
  const width  = r.canvasWidth;
  const height = r.canvasHeight;
  const { pan, zoom } = util.getEffectivePanZoom(r);

  const transform = mat3.create();
  mat3.translate(transform, transform, [pan.x, pan.y]);
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
  const { pan, zoom } = util.getEffectivePanZoom(r);

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height);
  context.translate(pan.x, pan.y);
  context.scale(zoom, zoom);
}


function drawSelectionRectangle(r, options) {
  r.drawSelectionRectangle(options, context => setContextTransform(r, context));
}


// eslint-disable-next-line no-unused-vars
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
  // For debugging the atlases
  const draw = (drawing, name, row) => {
    const collection = drawing.atlasManager.getAtlasCollection(name);
    const context = r.data.contexts[r.NODE];
    const scale = 0.125;
  
    const atlases = collection.atlases;
    for(let i = 0; i < atlases.length; i++) {
      const atlas = atlases[i];
      const canvas = atlas.canvas;
      if(canvas) {
        const w = canvas.width;
        const h = canvas.height;
        const x = w * i;
        const y = canvas.height * row;
    
        context.save();
        context.scale(scale, scale);
        context.drawImage(canvas, x, y);
        context.strokeStyle = 'black';
        context.rect(x, y, w, h);
        context.stroke();
        context.restore();
      }
    }
  };
  let i = 0;
  draw(r.drawing, 'node',  i++);
  draw(r.drawing, 'label', i++);
}


/**
 * Arguments are in model coordinates.
 * (x1, y1) is top left corner
 * (x2, y2) is bottom right corner (optional)
 * Returns a Set of indexes.
 */
function getPickingIndexes(r, mX1, mY1, mX2, mY2) {
  let x, y, w, h;
  const { pan, zoom } = util.getEffectivePanZoom(r);

  if(mX2 === undefined || mY2 === undefined) {
    const [ cX1, cY1 ] = util.modelToRenderedPosition(r, pan, zoom, mX1, mY1);
    const t = 6; // should be even
    x = cX1 - (t / 2);
    y = cY1 - (t / 2);
    w = t;
    h = t;
  } else {
    const [ cX1, cY1 ] = util.modelToRenderedPosition(r, pan, zoom, mX1, mY1);
    const [ cX2, cY2 ] = util.modelToRenderedPosition(r, pan, zoom, mX2, mY2);
    x = cX1; // (cX1, cY2) is the bottom left corner of the box
    y = cY2;
    w = Math.abs(cX2 - cX1);
    h = Math.abs(cY2 - cY1);
  }

  if(w === 0 || h === 0) {
    return [];
  }

  const gl = r.data.contexts[r.WEBGL];
  gl.bindFramebuffer(gl.FRAMEBUFFER, r.pickingFrameBuffer);

  if(r.pickingFrameBuffer.needsDraw) {
    // Draw element z-indexes to the picking framebuffer
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    renderWebgl(r, null, RENDER_TARGET.PICKING);
    r.pickingFrameBuffer.needsDraw = false;
  }

  const n = w * h; // number of pixels to read
  // eslint-disable-next-line no-undef
  const data = new Uint8Array(n * 4); // 4 bytes per pixel
  gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  const indexes = new Set();
  for(let i = 0; i < n; i++) {
    const pixel = data.slice(i*4, i*4 + 4);
    const index = util.vec4ToIndex(pixel) - 1; // The framebuffer is cleared with 0s, so z-indexes are offset by 1
    if(index >= 0) {
      indexes.add(index);
    }
  }
  return indexes;
}


/**
 * Cy.js: model coordinate y axis goes down
 */
function findNearestElementsWebgl(r, x, y) { // model coordinates
  const indexes = getPickingIndexes(r, x, y);
  const eles = r.getCachedZSortedEles();

  let node, edge;

  for(const index of indexes) {
    const ele = eles[index];
    if(!node && ele.isNode()) {
      node = ele;
    }
    if(!edge && ele.isEdge()) {
      edge = ele;
    }
    if(node && edge) {
      break;
    }
  }

  return [ node, edge ].filter(Boolean);
}


// eslint-disable-next-line no-unused-vars
function getAllInBoxWebgl(r, x1, y1, x2, y2) { // model coordinates
  let x1c = Math.min(x1, x2);
  let x2c = Math.max(x1, x2);
  let y1c = Math.min(y1, y2);
  let y2c = Math.max(y1, y2);

  x1 = x1c;
  x2 = x2c;
  y1 = y1c;
  y2 = y2c;

  const indexes = getPickingIndexes(r, x1, y1, x2, y2);
  const eles = r.getCachedZSortedEles();

  const box = new Set();
  for(const index of indexes) {
    if(index >= 0) {
      box.add(eles[index]);
    }
  }
  return Array.from(box);
}

// TODO: Is constantly checking this slower than just rendering a texture?
// Maybe this should be cached as a flag on each node.
function isSimpleRectangle(node) {
  return (
    node.pstyle('shape').value === 'rectangle' &&
    node.pstyle('background-fill').value === 'solid' &&
    node.pstyle('border-width').pfValue === 0 &&
    node.pstyle('background-image').strValue === 'none'
  );
}

function drawEle(r, index, ele) {
  const { drawing } = r;
  index += 1; // 0 is used to clear the background, need to offset all z-indexes by one
  if(ele.isNode()) {
    drawing.drawTexture(ele, index, 'node-underlay');
    if(isSimpleRectangle(ele)) {
      drawing.drawSimpleRectangle(ele, index, 'node-body');
    } else {
      drawing.drawTexture(ele, index, 'node-body');
    }
    drawing.drawTexture(ele, index, 'label');
    drawing.drawTexture(ele, index, 'node-overlay');
  } else {
    drawing.drawEdgeLine(ele, index);
    drawing.drawEdgeArrow(ele, index, 'source');
    drawing.drawEdgeArrow(ele, index, 'target');
    drawing.drawTexture(ele, index, 'label');
    drawing.drawTexture(ele, index, 'edge-source-label');
    drawing.drawTexture(ele, index, 'edge-target-label');
  }
}


function renderWebgl(r, options, renderTarget) {
  let start;
  if(r.webglDebug) {
    start = performance.now(); // eslint-disable-line no-undef
  }
  
  const { drawing } = r;
  let eleCount = 0;

  if(renderTarget.screen) {
    if(r.data.canvasNeedsRedraw[r.SELECT_BOX]) {
      drawSelectionRectangle(r, options);
    }
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

    const panZoomMatrix = createPanZoomMatrix(r);
    const eles = r.getCachedZSortedEles();
    eleCount = eles.length;

    drawing.startFrame(panZoomMatrix, renderTarget);

    if(renderTarget.screen) {
      for(let i = 0; i < eles.nondrag.length; i++) {
        drawEle(r, i, eles.nondrag[i]);
      }
      for(let i = 0; i < eles.drag.length; i++) {
        drawEle(r, i, eles.drag[i]);
      }
    } else if(renderTarget.picking) {
      for(let i = 0; i < eles.length; i++) {
        drawEle(r, i, eles[i]);
      }
    }

    drawing.endFrame();

    if(renderTarget.screen && r.webglDebugShowAtlases) {
      drawAxes(r);
      drawAtlases(r);
    }

    r.data.canvasNeedsRedraw[r.NODE] = false;
    r.data.canvasNeedsRedraw[r.DRAG] = false;
  }

  if(r.webglDebug) {
    // eslint-disable-next-line no-undef
    const end = performance.now();
    const compact = false;

    const time = Math.ceil(end - start);
    const debugInfo = drawing.getDebugInfo();
    
    const report = [
      `${eleCount} elements`, 
      `${debugInfo.totalInstances} instances`,
      `${debugInfo.batchCount} batches`,
      `${debugInfo.totalAtlases} atlases`,
      `${debugInfo.wrappedCount} wrapped textures`,
      `${debugInfo.rectangleCount} simple rectangles`
    ].join(', ');

    if(compact) {
      console.log(`WebGL (${renderTarget.name}) - time ${time}ms, ${report}`);
    } else {
      console.log(`WebGL (${renderTarget.name}) - frame time ${time}ms`);
      console.log('Totals:');
      console.log(`  ${report}`);
      console.log('Texture Atlases Used:');
      const atlasInfo = debugInfo.atlasInfo;
      for(const info of atlasInfo) {
        console.log(`  ${info.type}: ${info.keyCount} keys, ${info.atlasCount} atlases`);
      }
      console.log('');
    }
  }

  if(r.data.gc) {
    console.log('Garbage Collect!');
    r.data.gc = false;
    drawing.gc();
  }
}

export default CRp;
