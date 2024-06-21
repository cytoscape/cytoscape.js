import * as util from './webgl-util';
import { defaults } from '../../../../util';
import { mat3 } from 'gl-matrix';

const initDefaults = defaults({
});

export class EdgeDrawing {

  /** 
   * @param {WebGLRenderingContext} gl 
   */
  constructor(r, gl, options) {
    this.r = r;
    this.gl = gl;

    this.maxInstances = 100; // TODO how to decide the max instances?

    this.program = this.createShaderProgram();
    this.vao = this.createVAO();
  }

  createShaderProgram() {
    // see https://wwwtyro.net/2019/11/18/instanced-lines.html
    const { gl } = this;

    const vertexShaderSource = `#version 300 es
      precision highp float;

      uniform mat3 uPanZoomMatrix;

      in vec2 aPosition; // vertex
      in vec2 aSource;
      in vec2 aTarget;
      in float aWidth;
      in vec4 aColor;

      out vec4 vColor;

      void main(void) {
        vec2 xBasis = aTarget - aSource;
        vec2 yBasis = normalize(vec2(-xBasis.y, xBasis.x));
        vec2 point = aSource + xBasis * aPosition.x + yBasis * aWidth * aPosition.y;

        gl_Position = vec4(uPanZoomMatrix * vec3(point, 1.0), 1.0);
        vColor = aColor;
      }
    `;

    const fragmentShaderSource = `#version 300 es
      precision highp float;

      in vec4 vColor;

      out vec4 outColor;

      void main(void) {
        outColor = vColor;
      }
    `;

    const program = util.createProgram(gl, vertexShaderSource, fragmentShaderSource);

    program.uPanZoomMatrix = gl.getUniformLocation(program, 'uPanZoomMatrix');
    
    program.aPosition = gl.getAttribLocation(program, 'aPosition');
    program.aSource = gl.getAttribLocation(program, 'aSource');
    program.aTarget = gl.getAttribLocation(program, 'aTarget');
    program.aWidth = gl.getAttribLocation(program, 'aWidth');
    program.aColor = gl.getAttribLocation(program, 'aColor');

    return program;
  }

  createVAO() {
    const instanceGeometry = [
      0, -0.5,   1, -0.5,   1, 0.5,
      0, -0.5,   1,  0.5,   0, 0.5
    ];
  
    const { gl, program } = this;

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    { // vertices
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(instanceGeometry), gl.STATIC_DRAW);
      gl.vertexAttribPointer(program.aPosition, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(program.aPosition);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    const stride = 2 * 4; // 2 vertices * 4 bytes
    { // source points
      this.sourceData = new Float32Array(this.maxInstances * 2);
      this.sourceBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.sourceBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.maxInstances * stride, gl.DYNAMIC_DRAW); 
      gl.enableVertexAttribArray(program.aSource);
      gl.vertexAttribPointer(program.aSource, 2, gl.FLOAT, false, this.sourceBuffer.stride, 0);
      gl.vertexAttribDivisor(program.aSource, 1);
    }
    { // target points
      this.targetData = new Float32Array(this.maxInstances * 2);
      this.targetBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.targetBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.maxInstances * stride, gl.DYNAMIC_DRAW); 
      gl.enableVertexAttribArray(program.aTarget);
      gl.vertexAttribPointer(program.aTarget, 2, gl.FLOAT, false, stride, 0);
      gl.vertexAttribDivisor(program.aTarget, 1);
    }

    { // widths
      this.widthData = new Float32Array(this.maxInstances);
      this.widthBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.widthBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.maxInstances * 4, gl.DYNAMIC_DRAW); 
      gl.enableVertexAttribArray(program.aWidth);
      gl.vertexAttribPointer(program.aWidth, 1, gl.FLOAT, false, 4, 0);
      gl.vertexAttribDivisor(program.aWidth, 1);
    }

    // TODO allow different color for source and target
    { // colors 
      this.colorData = new Float32Array(this.maxInstances * 4);
      this.colorBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.maxInstances * 4 * 4, gl.DYNAMIC_DRAW); 
      gl.enableVertexAttribArray(program.aColor);
      gl.vertexAttribPointer(program.aColor, 4, gl.FLOAT, false, 4 * 4, 0);
      gl.vertexAttribDivisor(program.aColor, 1);
    }

    gl.bindVertexArray(null);
    return vao;
  }

  startBatch(panZoomMatrix) {
    if(panZoomMatrix) {
      this.panZoomMatrix = panZoomMatrix;
    }
    this.instanceCount = 0;
    this.sourcePoints = [];
    this.targetPoints = [];
  }


  draw(edge) {
    const sp = edge.source().position();
    const tp = edge.target().position();

    const opacity = edge.pstyle('opacity').value;
    const lineOpacity = edge.pstyle('line-opacity').value;
    const effectiveOpacity = opacity * lineOpacity;
    const color = edge.pstyle('line-color').value;
    const [ r, g, b, a ] = [ color[0]/256, color[1]/256, color[2]/256, effectiveOpacity ];

    const width = edge.pstyle('width').pfValue;

    this.sourceData.set([sp.x, sp.y], this.instanceCount * 2);
    this.targetData.set([tp.x, tp.y], this.instanceCount * 2);
    this.widthData.set([width], this.instanceCount);
    this.colorData.set([r, g, b, a], this.instanceCount * 4);

    this.instanceCount++;

    if(this.instanceCount >= this.maxInstances) {
      this.endBatch();
    }
  }


  endBatch() {
    if(this.instanceCount === 0) 
      return;

    console.log('drawing edges', this.instanceCount);
    const { gl, program, vao } = this;

    gl.useProgram(program);
    gl.bindVertexArray(vao);

    // TODO bufferSubData calls should only buffer this.instanceCount amount of data
    // source points
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sourceBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.sourceData); //, 0, this.instanceCount * 2);

    // target points
    gl.bindBuffer(gl.ARRAY_BUFFER, this.targetBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.targetData);

    // widths
    gl.bindBuffer(gl.ARRAY_BUFFER, this.widthBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.widthData);

    // colors
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.colorData);

    // Set the projection matrix uniform
    gl.uniformMatrix3fv(program.uPanZoomMatrix, false, this.panZoomMatrix);

    // draw!
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.instanceCount); // 6 verticies per edge

    gl.bindVertexArray(null);

    // start another batch, even if not needed
    this.startBatch();
  }

}
