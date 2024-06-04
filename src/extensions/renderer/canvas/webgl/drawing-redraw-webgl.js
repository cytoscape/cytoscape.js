import * as mat from './matrix';
import * as eleTextureCache from '../ele-texture-cache';
import * as shaders from './shaders';

const CRp = {};

CRp.initWebgl = function(options) {
  const r = this;

  const gl = r.data.contexts[r.WEBGL];
  gl.clearColor(0, 0, 0, 0); // background color

  // enable alpha blending of textures
  gl.enable(gl.BLEND);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // enable z-coord across multiple draw calls.
  gl.enable(gl.DEPTH_TEST);
  
  // const atlasSize = Math.min(8192, gl.getParameter(gl.MAX_TEXTURE_SIZE));
  // In WebGL2 these don't have to be powers of two, but why not use powers of two anyway, they might have better performance.
  const atlasSize = 1024;
  const texSize = 256;
  const texPerRow = Math.floor(atlasSize / texSize);
  const texPerAtlas = texPerRow * texPerRow; // texture atlas is a square

  const nodeProgram = shaders.createNodeShaderProgram(gl);
  const edgeProgram = shaders.createEdgeShaderProgram(gl);

  r.data.webgl = { 
    nodeProgram,
    edgeProgram,
    needBuffer: true,
    texInfo: { atlasSize, texSize, texPerRow, texPerAtlas },
  };

  r.onUpdateEleCalcs(function invalidateBuffer(willDraw, eles) {
    if(eles.length > 0) {
      // r.data.webgl.needBuffer = true;
      // console.log("elements changed: " + eles.length);
    }
  });
}

CRp.clearWebgl = function() {
  const r = this;
  const gl = r.data.contexts[r.WEBGL];
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
};


function createTextureCanvas(r, size) {
  const canvas = r.makeOffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  canvas.context = ctx;
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'blue';
  ctx.strokeRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  return canvas;
}

function createNodeData(r, eles) {
  // taken from canvas renderer constructor
  const getStyleKey = ele => ele[0]._private.nodeKey;
  const getLabelKey = ele => ele[0]._private.labelStyleKey;
  const getElementBox = ele => { ele.boundingBox(); return ele[0]._private.bodyBounds; };
  const getLabelBox   = ele => { ele.boundingBox(); return ele[0]._private.labelBounds.main || emptyBb; };

  const max = r.data.webgl.texInfo.texTotal;
  const { atlasSize, texSize, texPerRow, texPerAtlas } = r.data.webgl.texInfo;

  const bodyAtlas = createTextureCanvas(r, atlasSize);

  const vertexArray = [];
  const texArray = [];
  let z = -90;
  let nodeCount = 0;
  let texCount = 0;

  for(let i = 0; i < eles.length && texCount < texPerAtlas; i++) { // This will create one batch, and bail out if we run out of nodes or fill the atlas
    const ele = eles[i];
    if(ele.isNode()) {
      const node = ele;

      const row = Math.floor(texCount / texPerRow);
      const col = texCount % texPerRow;

      const bb = getElementBox(node);
      const { x1, x2, y1, y2, w, h } = bb;
      const scale = Math.min(texSize / w, texSize / h);
      // console.log(bb);
      // console.log('scale', scale);

      vertexArray.push(
        x1, y2, z,
        x2, y2, z,
        x2, y1, z,
        x1, y2, z,
        x2, y1, z,
        x1, y1, z,
      );

      const xOffset = col * texSize;
      const yOffset = row * texSize;
      const d = atlasSize - 1;
      const tx1 = xOffset / d;
      const tx2 = (xOffset + (w * scale)) / d;
      const ty1 = yOffset / d;
      const ty2 = (yOffset + (h * scale)) / d;
      // console.log('texcoords', tx1, tx2, ty1, ty2);

      texArray.push(
        tx1, ty2,
        tx2, ty2,
        tx2, ty1,
        tx1, ty2,
        tx2, ty1,
        tx1, ty1,
      );

      // Draw to the texture using the canvas renderer
      const context = bodyAtlas.context;
      context.save();
      context.translate(xOffset, yOffset);
      context.strokeStyle = 'red';
      context.strokeRect(0, 0, texSize, texSize);
      context.scale(scale, scale);
      r.drawNode(context, node, bb, false, false, true);
      context.restore();

      texCount++;
      nodeCount++;
      z++;
    }
  }

  return {
    bodyAtlas,
    atlasSize,
    vertexArray,
    texArray,
    nodeCount,
  }
}

/** @param {WebGLRenderingContext} gl */
function bufferNodeData(r, gl, program, nodeData) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  { // positions
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nodeData.vertexArray), gl.STATIC_DRAW);
    gl.vertexAttribPointer(program.aVertexPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(program.aVertexPosition);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }
  { // textures coords
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nodeData.texArray), gl.STATIC_DRAW);
    gl.vertexAttribPointer(program.aTexCoord, 2, gl.FLOAT, true, 0, 0);
    gl.enableVertexAttribArray(program.aTexCoord);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }
  gl.bindVertexArray(null);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, nodeData.atlasSize, nodeData.atlasSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, nodeData.bodyAtlas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.bindTexture(gl.TEXTURE_2D, null);

  const bind = () => {
    gl.bindVertexArray(vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(program.uEleTexture, 0);  // texture unit
  };
  const unbind = () => {
    gl.bindVertexArray(null);
  };

  return { 
    vao, 
    count: nodeData.nodeCount * 6,
    bind,
    unbind
  };
}

// function getTextureForNode(r, node, layer) {
//   const { pixelRatio } = r;
//   const cache = layer === 0 ? r.data.eleTxrCache : r.data.lblTxrCache;
//   const reason = 'highQuality'; // what does this mean?
//   const lvl = eleTextureCache.maxLvl;
//   const bb = cache.getBoundingBox(node);
//   const eleCache = cache.getElement(node, bb, pixelRatio, lvl, reason);
//   return eleCache;  // may be null
// }


// function bufferEdgeData(gl, program, vertices) {
//   const vao = gl.createVertexArray();
//   gl.bindVertexArray(vao);
//   const buffer = gl.createBuffer();
//   gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
//   gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices.edgeVertexArray), gl.STATIC_DRAW);
//   gl.vertexAttribPointer(program.aVertexPosition, 2, gl.FLOAT, false, 0, 0);
//   gl.enableVertexAttribArray(program.aVertexPosition);
//   gl.bindBuffer(gl.ARRAY_BUFFER, null);
//   gl.bindVertexArray(null);

//   const bind = () => {
//     gl.bindVertexArray(vao);
//   };
//   const unbind = () => {
//     gl.bindVertexArray(null);
//   };

//   return { 
//     vao, 
//     count: vertices.edgeCount * 2,
//     bind,
//     unbind
//   };
// }

function createMatrices(r) {
  const width = r.canvasWidth;
  const height = r.canvasHeight;
  const panzoom = getEffectivePanZoom(r);

  const transformMatrix3  = mat.transformMatrix3x3(panzoom.x, panzoom.y, panzoom.zoom);
  const projectionMatrix3 = mat.projectionMatrix3x3(width, height);
  const matrix3 = mat.multiply3x3(projectionMatrix3, transformMatrix3);

  const transformMatrix  = mat.transformMatrix4x4(panzoom.x, panzoom.y, panzoom.zoom);
  const projectionMatrix = mat.projectionMatrix4x4(width, height);
  const matrix = mat.multiply4x4(projectionMatrix, transformMatrix);

  return {
    transformMatrix3,
    projectionMatrix3,
    matrix3,
    transformMatrix,
    projectionMatrix,
    matrix,
  };
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
  
  // const eles = r.getCachedZSortedEles(); 
  // const { bodyAtlas } = createNodeVertexArrays(r, eles);
  // var context = r.data.contexts[ r.NODE ];
  // context.drawImage(bodyAtlas, 0, 0);
  // return;

  if(r.data.canvasNeedsRedraw[r.SELECT_BOX]) {
    drawSelectionRectangle(r, options);
  }

  /** @type {WebGLRenderingContext} gl */
  const gl = r.data.contexts[r.WEBGL];
  const nodeProgram = r.data.webgl.nodeProgram;
  const edgeProgram = r.data.webgl.edgeProgram;

  if(r.data.webgl.needBuffer) {
    const eles = r.getCachedZSortedEles(); 
    const nodeData = createNodeData(r, eles);
    r.nodeBuffer = bufferNodeData(r, gl, nodeProgram, nodeData);
    // r.edgeBuffer = bufferEdgeData(gl, edgeProgram, vertices);
    r.data.webgl.needBuffer = false;
  }

  if(r.data.canvasNeedsRedraw[r.NODE]) {
    const matrices = createMatrices(r);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // { // EDGES
    //   gl.useProgram(edgeProgram);
    //   r.edgeBuffer.bind();
    //   gl.uniformMatrix3fv(edgeProgram.uMatrix, false, matrices.matrix3);
    //   gl.drawArrays(gl.LINES, 0, r.edgeBuffer.count);
    //   r.edgeBuffer.unbind();
    // }
    { // Nodes
      gl.useProgram(nodeProgram);
      r.nodeBuffer.bind();
      gl.uniformMatrix4fv(nodeProgram.uMatrix, false, matrices.matrix);
      gl.drawArrays(gl.TRIANGLES, 0, r.nodeBuffer.count);
      r.nodeBuffer.unbind();
    }
  }
};

export default CRp;
