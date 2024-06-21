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
  texSize: 1024,
});


export class NodeDrawing {

  /** 
   * @param {WebGLRenderingContext} gl 
   */
  constructor(r, gl) {
    this.r = r;
    this.gl = gl;

    this.maxInstances = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
    console.log('max texture units', this.maxInstances);

    this.program = this.createShaderProgram();
    this.vao = this.createVAO();

    this.styleKeyToTexture = new Map();
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

      in mat3 aNodeMatrix;

      in vec2 aPosition;
      in vec2 aTexCoord;

      out vec2 vTexCoord;
      flat out int vTexId;

      void main(void) {
        vTexCoord = aTexCoord;
        vTexId = gl_InstanceID;
        gl_Position = vec4(uPanZoomMatrix * aNodeMatrix * vec3(aPosition, 1.0), 1.0);
      }
    `;

    const idxs = Array.from({ length: this.maxInstances }, (v,i) => i);

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
    program.aNodeMatrix = gl.getAttribLocation(program, 'aNodeMatrix');
    program.aPosition = gl.getAttribLocation(program, 'aPosition');
    program.aTexCoord = gl.getAttribLocation(program, 'aTexCoord');

    // uniforms
    program.uPanZoomMatrix = gl.getUniformLocation(program, 'uPanZoomMatrix');

    program.uTextures = [];
    for(let i = 0; i < this.maxInstances; i++) {
      program.uTextures.push(gl.getUniformLocation(program, `uTexture${i}`));
    }

    return program;
  }

  createVAO() {
    const unitQuad = [
      0, 0,  0, 1,  1, 0,
      1, 0,  0, 1,  1, 1,
    ];
    const texQuad = [
      0, 0,  0, 1,  1, 0,
      1, 0,  0, 1,  1, 1,
    ];
  
    const { gl, program } = this;

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    util.createFloatBufferStaticDraw(gl, {
      attributeLoc: program.aPosition,
      dataArray: unitQuad,
      size: 2
    });

    util.createFloatBufferStaticDraw(gl, {
      attributeLoc: program.aTexCoord,
      dataArray: texQuad,
      size: 2
    });

    this.matrixBuffer = util.create3x3MatrixBufferDynamicDraw(gl, {
      attributeLoc: program.aNodeMatrix,
      maxInstances: this.maxInstances
    });

    gl.bindVertexArray(null);
    return vao;
  }

  createTexture(node, opts) {
    const { r, gl  } = this;
    const { texSize } = opts;

    function drawTextureCanvas() {
      const bb = opts.getBoundingBox(node);

      // This stretches the drawing to fill a square texture, not sure if best approach.
      const scalew = texSize / bb.w
      const scaleh = texSize / bb.h;
  
      const textureCanvas = util.createTextureCanvas(r, texSize);
  
      const { context } = textureCanvas;
      context.save();
      context.scale(scalew, scaleh);
      opts.drawElement(context, node, bb, true, false);
      context.restore();
  
      return textureCanvas;
    }

    const styleKey = opts.getKey(node);
    let texture = this.styleKeyToTexture.get(styleKey);
    if(!texture) {
      const canvas = drawTextureCanvas();
      texture = util.bufferTexture(gl, texSize, canvas);
      this.styleKeyToTexture.set(styleKey, texture);
      texture.styleKey = styleKey; // for debug
    }
    return texture;
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
    this.textures = [];
  }

  draw(node, type) {
    const opts = this.renderTypes.get(type);

    // pass the array view to setTransformMatrix
    const matrixView = this.matrixBuffer.getMatrixView(this.instanceCount);
    this.setTransformMatrix(node, opts, matrixView);

    // create the texture if needed
    const texture = this.createTexture(node, opts);
    this.textures.push(texture);

    this.instanceCount++;

    if(this.instanceCount >= this.maxInstances) {
      this.endBatch();
    }
  }

  endBatch() {
    const count = this.instanceCount;
    if(count === 0) 
      return;

    console.log('drawing nodes', count);
    const { gl, program, vao } = this;

    gl.useProgram(program);
    gl.bindVertexArray(vao);

    // upload the new matrix data
    this.matrixBuffer.bufferSubData();

    // Activate all the texture units that we need
    for(let i = 0; i < count; i++) {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, this.textures[i]);
      gl.uniform1i(program.uTextures[i], i);
    }

    // Set the projection matrix uniform
    gl.uniformMatrix3fv(program.uPanZoomMatrix, false, this.panZoomMatrix);

    // draw!
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count); // 6 verticies per node

    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null); // TODO is this right when having multiple texture units?

    // start another batch, even if not needed
    this.startBatch();
  }

}
