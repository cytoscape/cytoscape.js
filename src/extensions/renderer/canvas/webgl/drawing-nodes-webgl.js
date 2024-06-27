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
});

const atlasSize = 8192; // square atlas, each side has this many pixels, should be power of 2
const texPerRow = 10;

const texSize = Math.floor(atlasSize / texPerRow);
const texPerAtlas = texPerRow * texPerRow;

function getTexOffsets(texIndex) {
  const row = Math.floor(texIndex / texPerRow);
  const col = texIndex % texPerRow;
  const xOffset = col * texSize;
  const yOffset = row * texSize;
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
      this.texture = util.bufferTexture(gl, atlasSize, this.canvas);
      if(this.isFull()) {
        this.canvas = null;
      }
      this.buffered = true;
    }
  }

  draw(r, node, opts) {
    if(this.isFull())
      throw new Error("This Atlas is full!");

    if(this.canvas === null)
      this.canvas = util.createTextureCanvas(r, atlasSize);
    
    const { context } = this.canvas;
    const { xOffset, yOffset } = getTexOffsets(this.index);

    const bb = opts.getBoundingBox(node);
    // This stretches the drawing to fill a square, not sure if best approach.
    const scalew = texSize / bb.w;
    const scaleh = texSize / bb.h;

    context.save();
    context.translate(xOffset, yOffset);
    context.scale(scalew, scaleh);
    opts.drawElement(context, node, bb, true, false);
    context.restore();

    this.buffered = false;
    this.index++;
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

    this.styleKeyToAtlas = new Map(); // need to know which texure atlas has the texture
    this.styleKeyToTexIndex = new Map(); // which texture in the atlas for a node

    this.currentAtlas = new Atlas();

    this.renderTypes = new Map(); // string -> object
  }

  addRenderType(type, options) {
    this.renderTypes.set(type, initDefaults(options));
  }

  createShaderProgram() {
    const { gl } = this;

    const vertexShaderSource = `#version 300 es
      precision highp float;

      uniform mat3 uPanZoomMatrix;
      uniform int uAtlasSize;
      uniform int uTexPerRow; 
      
      in vec2 aPosition; // instanced
      in mat3 aNodeMatrix;
      in float aTexId;
      in float aTexIndex;

      out vec2 vTexCoord;
      flat out int vTexId;

      void main(void) {
        // compute texture coordinates here in the shader
        int texIndex = int(aTexIndex);
        int row = texIndex / uTexPerRow;
        int col = texIndex % uTexPerRow;
        int texSize = uAtlasSize / uTexPerRow;

        int tx = col * texSize;
        int ty = row * texSize;

        if(gl_VertexID == 2 || gl_VertexID == 3 || gl_VertexID == 5) {
          tx += texSize - 1;
        }
        if(gl_VertexID == 1 || gl_VertexID == 4 || gl_VertexID == 5) {
          ty += texSize - 1;
        }

        float d = float(uAtlasSize - 1);
        vTexCoord = vec2(float(tx)/d, float(ty)/d);

        vTexId = int(aTexId);

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

      out vec4 outColor;

      void main(void) {
        ${idxs.map(i => `if(vTexId == ${i}) outColor = texture(uTexture${i}, vTexCoord);`).join('\n\telse ')}
      }
    `;

    const program = util.createProgram(gl, vertexShaderSource, fragmentShaderSource);

    // attributes
    program.aPosition   = gl.getAttribLocation(program, 'aPosition');
    program.aNodeMatrix = gl.getAttribLocation(program, 'aNodeMatrix');
    program.aTexId      = gl.getAttribLocation(program, 'aTexId');
    program.aTexIndex   = gl.getAttribLocation(program, 'aTexIndex');

    // uniforms
    program.uPanZoomMatrix = gl.getUniformLocation(program, 'uPanZoomMatrix');
    program.uTexPerRow     = gl.getUniformLocation(program, 'uTexPerRow');
    program.uAtlasSize     = gl.getUniformLocation(program, 'uAtlasSize');

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

    util.createAttributeFloatBufferStaticDraw(gl, {
      attributeLoc: program.aPosition,
      dataArray: unitQuad,
      size: 2
    });

    this.texIdBuffer = util.createInstanceFloatBufferDynamicDraw(gl, {
      attributeLoc: program.aTexId,
      maxInstances: this.maxInstances,
      size: 1
    });

    this.texIndexBuffer = util.createInstanceFloatBufferDynamicDraw(gl, {
      attributeLoc: program.aTexIndex,
      maxInstances: this.maxInstances,
      size: 1
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
      atlas.draw(r, node, opts);

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

    const { atlas, texIndex } = this.getOrCreateTexture(node, opts);

    let texID = this.atlases.indexOf(atlas);
    if(texID < 0) {
      if(this.atlases.length === this.maxAtlases) {
        this.endBatch();
      }
      this.atlases.push(atlas);
      texID = this.atlases.length - 1;
    }

    this.texIndexBuffer.setDataAt([texIndex], this.instanceCount);
    this.texIdBuffer.setDataAt([texID], this.instanceCount);

    // pass the array view to setTransformMatrix
    const view = this.matrixBuffer.getMatrixView(this.instanceCount);
    this.setTransformMatrix(node, opts, view);

    this.instanceCount++;

    if(this.instanceCount >= this.maxInstances) {
      this.endBatch();
    }
  }

  endBatch() {
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
    gl.uniform1i(program.uTexPerRow, texPerRow);

    // draw!
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count); // 6 verticies per node

    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null); // TODO is this right when having multiple texture units?

    // start another batch, even if not needed
    this.startBatch();
  }

}
