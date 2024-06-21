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

    util.createFloatBufferStaticDraw(gl, {
      attributeLoc: program.aPosition,
      dataArray: instanceGeometry,
      size: 2
    });

    this.sourceBuffer = util.createFloatBufferDynamicDraw(gl, {
      attributeLoc: program.aSource,
      maxInstances: this.maxInstances,
      size: 2
    });

    this.targetBuffer = util.createFloatBufferDynamicDraw(gl, {
      attributeLoc: program.aTarget,
      maxInstances: this.maxInstances,
      size: 2
    });

    this.widthBuffer = util.createFloatBufferDynamicDraw(gl, {
      attributeLoc: program.aWidth,
      maxInstances: this.maxInstances,
      size: 1
    });

    this.colorBuffer = util.createFloatBufferDynamicDraw(gl, {
      attributeLoc: program.aColor,
      maxInstances: this.maxInstances,
      size: 4
    });

    gl.bindVertexArray(null);
    return vao;
  }

  startBatch(panZoomMatrix) {
    if(panZoomMatrix) {
      this.panZoomMatrix = panZoomMatrix;
    }
    this.instanceCount = 0;
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

    const i = this.instanceCount;
    this.sourceBuffer.setDataAt([sp.x, sp.y], i);
    this.targetBuffer.setDataAt([tp.x, tp.y], i);
    this.widthBuffer.setDataAt([width], i);
    this.colorBuffer.setDataAt([r, g, b, a], i);

    this.instanceCount++;

    if(this.instanceCount >= this.maxInstances) {
      this.endBatch();
    }
  }


  endBatch() {
    const count = this.instanceCount;
    if(count === 0) 
      return;

    console.log('drawing edges', count);
    const { gl, program, vao } = this;

    gl.useProgram(program);
    gl.bindVertexArray(vao);

    // buffer the attribute data
    this.sourceBuffer.bufferSubData(count);
    this.targetBuffer.bufferSubData(count);
    this.widthBuffer.bufferSubData(count);
    this.colorBuffer.bufferSubData(count);

    // Set the projection matrix uniform
    gl.uniformMatrix3fv(program.uPanZoomMatrix, false, this.panZoomMatrix);

    // draw!
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count); // 6 verticies per edge

    gl.bindVertexArray(null);

    // start another batch, even if not needed
    this.startBatch();
  }

}
