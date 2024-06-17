// For rendering nodes
import * as util from './webgl-util';
import { assign, defaults } from '../../../../util';
import { mat3, vec2 } from 'gl-matrix';

const initDefaults = defaults({
  getKey: null,
  drawElement: null,
  getBoundingBox: null,
  getTransformMatrix: null,
  getRotationPoint: null,
  getRotationOffset: null,
  texSize: 1024,
});


export class NodeDrawing {
  constructor(r, gl, options) {
    this.r = r;
    this.gl = gl;

    assign(this, initDefaults(options));

    this.program = this.createShaderProgram();
    this.vao = this.createUnitQuadVAO();

    this.styleKeyToTexture = new Map();
  }

  createShaderProgram() {
    const { gl } = this;

    const vertexShaderSource = `#version 300 es
      precision highp float;

      uniform mat3 uPanZoomMatrix;
      uniform mat3 uNodeMatrix;

      in vec2 aVertexPosition;
      in vec2 aTexCoord;

      out vec2 vTexCoord;

      void main(void) {
        vTexCoord = aTexCoord;
        gl_Position = vec4(uPanZoomMatrix * uNodeMatrix * vec3(aVertexPosition, 1.0), 1.0);
      }
    `;

    const fragmentShaderSource = `#version 300 es
      precision highp float;

      uniform sampler2D uEleTexture;

      in vec2 vTexCoord;

      out vec4 outColor;

      void main(void) {
        outColor = texture(uEleTexture, vTexCoord);
        // outColor = vec4(1.0, 0.0, 0.0, 1.0);
      }
    `;

    const program = util.createProgram(gl, vertexShaderSource, fragmentShaderSource);

    program.uPanZoomMatrix = gl.getUniformLocation(program, 'uPanZoomMatrix');
    program.uNodeMatrix = gl.getUniformLocation(program, 'uNodeMatrix');
    program.aVertexPosition = gl.getAttribLocation(program, 'aVertexPosition');
    program.aTexCoord = gl.getAttribLocation(program, 'aTexCoord');
    program.uEleTexture = gl.getUniformLocation(program, 'uEleTexture');

    return program;
  }

  createUnitQuadVAO(node) {
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
    {
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(unitQuad), gl.STATIC_DRAW);
      gl.vertexAttribPointer(program.aVertexPosition, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(program.aVertexPosition);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    {
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texQuad), gl.STATIC_DRAW);
      gl.vertexAttribPointer(program.aTexCoord, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(program.aTexCoord);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    gl.bindVertexArray(null);
    return vao;
  }

  getTexture(node) {
    const styleKey = this.getKey(node);
    let texture = this.styleKeyToTexture.get(styleKey);
    if(!texture) {
      const canvas = this.drawTextureCanvas(node);
      texture = this.bufferTexture(canvas);
      this.styleKeyToTexture.set(styleKey, texture);
    }
    return texture;
  }


  drawTextureCanvas(node) {
    // Don't apply rotation when creating a texture.
    // The same texture can be used with different rotations.
    const { r, texSize } = this;
    // This stretches the drawing to fill a square texture, not sure if best approach.
    // Not sure if using a square texture of a power of two is better performant.
    const bb = this.getBoundingBox(node);
    const scalew = texSize / bb.w
    const scaleh = texSize / bb.h;

    const textureCanvas = util.createTextureCanvas(r, texSize);

    const { context } = textureCanvas;
    context.save();
    context.scale(scalew, scaleh);
    this.drawElement(context, node, bb, true, false);
    context.restore();

    return textureCanvas;
  }

  bufferTexture(textureCanvas) {
    const { gl, texSize } = this;
    const texture = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, texSize, texSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, textureCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);

    return texture;
  }

  createTransformMatrix3x3(node) {
    const bb = this.getBoundingBox(node);
    const { x1, y1, w, h } = bb;

    const matrix = mat3.create();
    mat3.translate(matrix, matrix, vec2.fromValues(x1, y1));
    mat3.scale(matrix, matrix, vec2.fromValues(w, h));

    return matrix;
  }


  /**
   * Draws one node.
   */
  draw(node, panZoomMatrix) {
    console.log('NodeDrawing draw()', panZoomMatrix);
    const { gl, program, vao } = this;
    gl.useProgram(program);

    const nodeMatrix = this.createTransformMatrix3x3(node);
    const texture = this.getTexture(node);

    gl.bindVertexArray(vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(program.uEleTexture, 0);

    gl.uniformMatrix3fv(program.uPanZoomMatrix, false, panZoomMatrix);
    gl.uniformMatrix3fv(program.uNodeMatrix, false, nodeMatrix);

    gl.drawArrays(gl.TRIANGLES, 0, 6); // 6 verticies per node

    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

}
