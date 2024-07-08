// For rendering nodes
import * as util from './webgl-util';
import { defaults } from '../../../../util';
import { mat3 } from 'gl-matrix';

const initDefaults = defaults({
  getKey: null,
  drawElement: null,
  getBoundingBox: null,
  getRotation: null,
  getRotationPoint: null,
  getRotationOffset: null,
  isVisible: null,
  getOverlayUnderlayStyle: null
});

const atlasSize = 8192; // square atlas, each side has this many pixels, should be power of 2
const cols = 6;
const rows = 10;
const texPerAtlas = cols * rows;
const texWidth  = Math.floor(atlasSize / cols);
const texHeight = Math.floor(atlasSize / rows);

function getTexOffsets(texIndex) {
  const row = Math.floor(texIndex / cols);
  const col = texIndex % cols;
  const xOffset = col * texWidth;
  const yOffset = row * texHeight;
  return { xOffset, yOffset };
}


class Atlas {
  constructor() {
    this.texture = null;
    this.canvas = null;
    this.index = 0;
    this.buffered = false;
  }

  isFull() {
    return this.index >= texPerAtlas;
  }

  buffer(gl) {
    if(!this.buffered) {
      this.texture = util.bufferTexture(gl, this.canvas);
      if(this.isFull()) {
        this.canvas = null;
      }
      this.buffered = true;
    }
  }

  draw(r, doDrawing) {
    if(this.isFull())
      throw new Error("This Atlas is full!");

    if(this.canvas === null)
      this.canvas = util.createTextureCanvas(r, atlasSize);
    
    const { context } = this.canvas;
    const { xOffset, yOffset } = getTexOffsets(this.index);

    // for debugging
    // context.strokeStyle = 'red';
    // context.lineWidth = 4;
    // context.strokeRect(xOffset, yOffset, texWidth, texHeight);

    context.save();
    context.translate(xOffset, yOffset);
    doDrawing(context);
    context.restore();

    this.buffered = false;
    this.index++;
  }

  drawNode(r, node, opts) {
    this.draw(r, (context) => {
      const bb = opts.getBoundingBox(node);
      const scalew = texWidth  / bb.w;
      const scaleh = texHeight / bb.h;
      const scale = Math.min(scalew, scaleh);
      
      context.scale(scale, scale);
      opts.drawElement(context, node, bb, true, false);
    });
  }
}


export class NodeDrawing {

  /** 
   * @param {WebGLRenderingContext} gl 
   */
  constructor(r, gl) {
    this.r = r;
    this.gl = gl;

    this.maxInstances = 1000;
    this.maxAtlases = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);

    console.log('max texture units', this.maxAtlases);
    console.log('max texture size', gl.getParameter(gl.MAX_TEXTURE_SIZE));

    this.program = this.createShaderProgram();
    this.vao = this.createVAO();

    this.renderTypes = new Map(); // string -> object

    this.styleKeyToAtlas = new Map(); // need to know which texure atlas has the texture
    this.styleKeyToTexIndex = new Map(); // which texture in the atlas for a node

    this.currentAtlas = new Atlas();
    this.overlayUnderlay = this.initOverlayUnderlay(); // used for overlay/underlay shapes
  }


  addRenderType(type, options) {
    this.renderTypes.set(type, initDefaults(options));
  }


  initOverlayUnderlay() {
    const { r } = this;
    const size = Math.min(texWidth, texHeight);
    const center = size / 2;

    const atlas = new Atlas();

    // textures are white so that the overlay color is preserved when multiplying in the fragment shader
    atlas.draw(r, (context) => {
      context.fillStyle = '#FFF';
      r.drawRoundRectanglePath(context, center, center, size, size, 150); // TODO don't hardcode the radius
      context.fill();
    });
    
    atlas.draw(r, (context) => {
      context.fillStyle = '#FFF';
      r.drawEllipsePath(context, center, center, size, size)
      context.fill();
    });

    return {
      atlas,
      roundRectTexIndex: 0,
      ellipseTexIndex: 1
    };
  }


  createShaderProgram() {
    const { gl } = this;

    const vertexShaderSource = `#version 300 es
      precision highp float;

      uniform mat3 uPanZoomMatrix;
      uniform int uAtlasSize;
      uniform int uCols;
      uniform int uRows;
      
      in vec2 aPosition; // instanced
      in mat3 aNodeMatrix;
      in int aTexId; // which shader unit/atlas to use
      in int aTexIndex; // which texture in the atlas to use
      in vec4 aLayColor; // overlay/underlay color
      in vec2 aBBSize; // TEMP, better to pass scalew/scaleh

      out vec2 vTexCoord;
      flat out vec4 vLayColor;
      flat out int vTexId;

      void main(void) {
        // compute texture coordinates here in the shader
        // we have to do this here becase we are using instanced drawing

        int row = aTexIndex / uCols;
        int col = aTexIndex % uCols;

        float texWidth  = float(uAtlasSize) / float(uCols);
        float texHeight = float(uAtlasSize) / float(uRows);
        
        float xOffset = float(col) * texWidth;
        float yOffset = float(row) * texHeight;

        if(gl_VertexID != 0) {
          float scalew = texWidth  / aBBSize.x;
          float scaleh = texHeight / aBBSize.y;
          float scale = min(scalew, scaleh);

          if(gl_VertexID == 2 || gl_VertexID == 3 || gl_VertexID == 5) {
            xOffset += aBBSize.x * scale; // x is actually width
          }
          if(gl_VertexID == 1 || gl_VertexID == 4 || gl_VertexID == 5) {
            yOffset += aBBSize.y * scale; // y is actually height
          }
        }

        float d = float(uAtlasSize);
        vTexCoord = vec2(xOffset / d, yOffset / d);

        vTexId = aTexId;
        vLayColor = aLayColor;

        gl_Position = vec4(uPanZoomMatrix * aNodeMatrix * vec3(aPosition, 1.0), 1.0);
      }
    `;

    const idxs = Array.from({ length: this.maxAtlases }, (v,i) => i);

    const fragmentShaderSource = `#version 300 es
      precision highp float;

      // define texture unit for each node in the batch
      ${idxs.map(i => `uniform sampler2D uTexture${i};`).join('\t\n')}

      in vec2 vTexCoord;
      flat in int vTexId;
      flat in vec4 vLayColor;

      out vec4 outColor;

      void main(void) {
        vec4 texColor;
        ${idxs.map(i => `if(vTexId == ${i}) texColor = texture(uTexture${i}, vTexCoord);`).join('\n\telse ')}

        if(vLayColor.a == 0.0)
          outColor = texColor;
        else
          outColor = texColor * vLayColor;
      }
    `;

    const program = util.createProgram(gl, vertexShaderSource, fragmentShaderSource);

    // attributes
    program.aPosition   = gl.getAttribLocation(program, 'aPosition');
    program.aNodeMatrix = gl.getAttribLocation(program, 'aNodeMatrix');
    program.aTexId      = gl.getAttribLocation(program, 'aTexId');
    program.aTexIndex   = gl.getAttribLocation(program, 'aTexIndex');
    program.aLayColor   = gl.getAttribLocation(program, 'aLayColor');
    program.aBBSize     = gl.getAttribLocation(program, 'aBBSize');

    // uniforms
    program.uPanZoomMatrix = gl.getUniformLocation(program, 'uPanZoomMatrix');
    program.uAtlasSize     = gl.getUniformLocation(program, 'uAtlasSize');
    program.uCols          = gl.getUniformLocation(program, 'uCols');
    program.uRows          = gl.getUniformLocation(program, 'uRows');

    program.uTextures = [];
    for(let i = 0; i < this.maxAtlases; i++) {
      program.uTextures.push(gl.getUniformLocation(program, `uTexture${i}`));
    }

    return program;
  }


  createVAO() {
    // TODO switch to indexed drawing?
    const unitQuad = [
      0, 0,  0, 1,  1, 0,
      1, 0,  0, 1,  1, 1,
    ];
  
    const { gl, program } = this;

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    util.createAttributeBufferStaticDraw(gl, {
      attributeLoc: program.aPosition,
      dataArray: unitQuad,
      size: 2,
      type: gl.FLOAT
    });

    this.texIdBuffer = util.createInstanceBufferDynamicDraw(gl, {
      attributeLoc: program.aTexId,
      maxInstances: this.maxInstances,
      size: 1,
      type: gl.INT
    });

    this.texIndexBuffer = util.createInstanceBufferDynamicDraw(gl, {
      attributeLoc: program.aTexIndex,
      maxInstances: this.maxInstances,
      size: 1,
      type: gl.INT
    });

    this.layColorBuffer = util.createInstanceBufferDynamicDraw(gl, {
      attributeLoc: program.aLayColor,
      maxInstances: this.maxInstances,
      size: 4,
      type: gl.FLOAT
    });

    this.bbSizeBuffer = util.createInstanceBufferDynamicDraw(gl, {
      attributeLoc: program.aBBSize,
      maxInstances: this.maxInstances,
      size: 2,
      type: gl.FLOAT
    });

    this.matrixBuffer = util.create3x3MatrixBufferDynamicDraw(gl, {
      attributeLoc: program.aNodeMatrix,
      maxInstances: this.maxInstances
    });

    gl.bindVertexArray(null);
    return vao;
  }


  getOrCreateTexture(node, opts) {
    const { r } = this;
    const styleKey = opts.getKey(node);

    let atlas = this.styleKeyToAtlas.get(styleKey);
    let texIndex = this.styleKeyToTexIndex.get(styleKey);

    if(!atlas) {
      if(this.currentAtlas.isFull()) {
        this.currentAtlas = new Atlas();
      }

      atlas = this.currentAtlas;
      texIndex = this.currentAtlas.index;

      console.log('drawing texture for', styleKey);
      atlas.drawNode(r, node, opts);

      this.styleKeyToAtlas.set(styleKey, atlas);
      this.styleKeyToTexIndex.set(styleKey, texIndex);
    }

    return { atlas, texIndex };
  }


  setTransformMatrix(node, opts, matrix) {
    // matrix is expected to be a 9 element array
    // follows same pattern as CRp.drawCachedElementPortion(...)
    const bb = opts.getBoundingBox(node);
    let x, y;

    mat3.identity(matrix);

    const theta = opts.getRotation(node);
    if(theta !== 0) {
      const { x:sx, y:sy } = opts.getRotationPoint(node);
      mat3.translate(matrix, matrix, [sx, sy]);
      mat3.rotate(matrix, matrix, theta);

      const offset = opts.getRotationOffset(node);
      x = offset.x;
      y = offset.y;
    } else {
      x = bb.x1;
      y = bb.y1;
    }
    
    mat3.translate(matrix, matrix, [x, y]);
    mat3.scale(matrix, matrix, [bb.w, bb.h]);
  }


  startBatch(panZoomMatrix) {
    if(panZoomMatrix) {
      this.panZoomMatrix = panZoomMatrix;
    }
    this.instanceCount = 0;
    this.atlases = []; // up to 16 texture units for a draw call
  }


  draw(node, type) {
    const opts = this.renderTypes.get(type);
    if(!opts.isVisible(node))
      return;

    const bufferInstanceData = (texID, texIndex, layColor=[0, 0, 0, 0]) => {
      this.texIdBuffer.setDataAt([texID], this.instanceCount);
      this.texIndexBuffer.setDataAt([texIndex], this.instanceCount);
      this.layColorBuffer.setDataAt(layColor, this.instanceCount);
      
      const bb = opts.getBoundingBox(node);
      this.bbSizeBuffer.setDataAt([bb.w, bb.h], this.instanceCount);

      // pass the array view to setTransformMatrix
      const view = this.matrixBuffer.getMatrixView(this.instanceCount);
      this.setTransformMatrix(node, opts, view);

      this.instanceCount++;
    };

    const getTexIdForBatch = (atlas) => {
      let texID = this.atlases.indexOf(atlas);
      if(texID < 0) {
        if(this.atlases.length === this.maxAtlases) {
           // If we run out of space for textures in the current batch, then start a new batch
          this.endBatch();
        }
        this.atlases.push(atlas);
        texID = this.atlases.length - 1;
      }
      return texID;
    };

    const drawBody = () => {
      const { atlas, texIndex } = this.getOrCreateTexture(node, opts);
      const texID = getTexIdForBatch(atlas);
      bufferInstanceData(texID, texIndex);
    };

    const drawOverlayUnderlay = (overlayOrUnderlay) => {
      const style = opts.getOverlayUnderlayStyle(node, overlayOrUnderlay);
      if(!style || style.opacity === 0)
        return;

      // Ignore radius and padding for now
      const { opacity, color, shape } = style;

      let texIndex;
      if(shape === 'roundrectangle' || shape === 'round-rectangle') {
        texIndex = this.overlayUnderlay.roundRectTexIndex;
      } else if(shape === 'ellipse') {
        texIndex = this.overlayUnderlay.ellipseTexIndex;
      } else {
        return;
      }

      const webglColor = util.normalizeColor(color, opacity, { premultiplyAlpha: true });

      const atlas = this.overlayUnderlay.atlas;
      const texID = getTexIdForBatch(atlas);
      bufferInstanceData(texID, texIndex, webglColor);
    }

    drawOverlayUnderlay('underlay');
    drawBody();
    drawOverlayUnderlay('overlay')

    if(this.instanceCount >= this.maxInstances) {
      this.endBatch();
    }
  }


  endBatch() {
    // const nodeContext = this.r.data.contexts[this.r.NODE];
    // nodeContext.save();
    // nodeContext.scale(0.25, 0.25);
    // nodeContext.drawImage(this.atlases[0].canvas, 0, 0);
    // nodeContext.restore();

    const count = this.instanceCount;
    if(count === 0) 
      return;

    const { gl, program, vao } = this;

    gl.useProgram(program);
    gl.bindVertexArray(vao);

    // upload the new matrix data
    this.matrixBuffer.bufferSubData(count);
    this.texIdBuffer.bufferSubData(count);
    this.texIndexBuffer.bufferSubData(count);
    this.bbSizeBuffer.bufferSubData(count);
    this.layColorBuffer.bufferSubData(count);

    // Activate all the texture units that we need
    for(let i = 0; i < this.atlases.length; i++) {
      const atlas = this.atlases[i];
      atlas.buffer(gl); // if needed
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, atlas.texture);
      gl.uniform1i(program.uTextures[i], i);
    }

    // Set the uniforms
    gl.uniformMatrix3fv(program.uPanZoomMatrix, false, this.panZoomMatrix);
    gl.uniform1i(program.uAtlasSize, atlasSize);
    gl.uniform1i(program.uRows, rows);
    gl.uniform1i(program.uCols, cols);

    // draw!
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count); // 6 verticies per node

    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null); // TODO is this right when having multiple texture units?

    // start another batch, even if not needed
    this.startBatch();
  }

}
