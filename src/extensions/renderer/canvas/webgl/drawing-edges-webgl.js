import * as util from './webgl-util';
import { defaults } from '../../../../util';

const initDefaults = defaults({
});

// Vertex types
const LINE = 0;
const SOURCE_ARROW = 1;
const TARGET_ARROW = 2;


export class EdgeDrawing {

  /** 
   * @param {WebGLRenderingContext} gl 
   */
  constructor(r, gl, options) {
    this.r = r;
    this.gl = gl;

    this.maxInstances = 1000; // TODO how to decide the max instances?

    this.program = this.createShaderProgram();
    this.vao = this.createVAO();
  }

  createShaderProgram() {
    // see https://wwwtyro.net/2019/11/18/instanced-lines.html
    const { gl } = this;

    const vertexShaderSource = `#version 300 es
      precision highp float;

      uniform mat3 uPanZoomMatrix;

      // instanced
      in vec2 aPosition; // vertex
      in int aVertType;

      in vec2 aSource;
      in vec2 aTarget;

      in float aWidth;
      in vec4 aColor;

      out vec4 vColor;

      void main(void) {
        if(aVertType == ${LINE}) {
          vec2 xBasis = aTarget - aSource;
          vec2 yBasis = normalize(vec2(-xBasis.y, xBasis.x));
          vec2 point = aSource + xBasis * aPosition.x + yBasis * aWidth * aPosition.y;
          gl_Position = vec4(uPanZoomMatrix * vec3(point, 1.0), 1.0);
        } else {
          gl_Position = vec4(2.0, 0.0, 0.0, 1.0);
        }

        vColor = aColor;
      }
    `;

    const fragmentShaderSource = `#version 300 es
      precision highp float;

      in vec4 vColor;

      out vec4 outColor;

      void main(void) {
        outColor = vColor;
        outColor.rgb *= outColor.a; // webgl is expecting premultiplied alpha
      }
    `;

    const program = util.createProgram(gl, vertexShaderSource, fragmentShaderSource);

    program.uPanZoomMatrix = gl.getUniformLocation(program, 'uPanZoomMatrix');
    
    program.aPosition = gl.getAttribLocation(program, 'aPosition');
    program.aVertType = gl.getAttribLocation(program, 'aVertType');
    program.aSource   = gl.getAttribLocation(program, 'aSource');
    program.aTarget   = gl.getAttribLocation(program, 'aTarget');
    program.aWidth    = gl.getAttribLocation(program, 'aWidth');
    program.aColor    = gl.getAttribLocation(program, 'aColor');

    return program;
  }

  createVAO() {
    const line = [
      0, -0.5,   1, -0.5,   1, 0.5,
      0, -0.5,   1,  0.5,   0, 0.5
    ];
    const arrow = [ // same as the 'triangle' shape in the base renderer
      -0.15, -0.3,   0, 0,    0.15, -0.3
    ];

    const instanceGeometry = [
      ...line,  // edge line
      ...arrow, // source arrow
      ...arrow, // target arrow
    ];
    const vertexTypes = [
      ...new Array(line .length/2).fill(LINE),
      ...new Array(arrow.length/2).fill(SOURCE_ARROW),
      ...new Array(arrow.length/2).fill(TARGET_ARROW),
    ];

    this.vertexCount = instanceGeometry.length/2;
  
    const { gl, program } = this;

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    util.createAttributeBufferStaticDraw(gl, {
      attributeLoc: program.aPosition,
      dataArray: instanceGeometry,
      type: 'vec2'
    });

    util.createAttributeBufferStaticDraw(gl, {
      attributeLoc: program.aVertType,
      dataArray: vertexTypes,
      type: 'int'
    });

    this.sourceBuffer = util.createInstanceBufferDynamicDraw(gl, {
      attributeLoc: program.aSource,
      maxInstances: this.maxInstances,
      type: 'vec2'
    });

    this.targetBuffer = util.createInstanceBufferDynamicDraw(gl, {
      attributeLoc: program.aTarget,
      maxInstances: this.maxInstances,
      type: 'vec2'
    });

    this.widthBuffer = util.createInstanceBufferDynamicDraw(gl, {
      attributeLoc: program.aWidth,
      maxInstances: this.maxInstances,
      type: 'float'
    });

    this.colorBuffer = util.createInstanceBufferDynamicDraw(gl, {
      attributeLoc: program.aColor,
      maxInstances: this.maxInstances,
      type: 'vec4'
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


  // TODO Should I pass in a function that does this like with NodeDrawing?
  getLineStyle(edge) {
    const opacity = edge.pstyle('opacity').value;
    const lineOpacity = edge.pstyle('line-opacity').value;
    const width = edge.pstyle('width').pfValue;
    const color = edge.pstyle('line-color').value;
    const effectiveOpacity = opacity * lineOpacity;
    return { 
      opacity: effectiveOpacity,
      width,
      color
    };
  }


  draw(edge) {
    // edge points and arrow angles etc are calculated by the base renderer and cached in the rscratch object
    const rs = edge._private.rscratch;

    // all edges will be interpreted as 'straight' or 'haystack' edges
    const [ sx, sy ] = rs.allpts;
    const [ tx, ty ] = rs.allpts.slice(-2);

    // const isHaystack = rs.edgeType === 'haystack';
    // if( !isHaystack ){
    //   this.drawArrowhead( context, edge, 'source', rs.arrowStartX, rs.arrowStartY, rs.srcArrowAngle, opacity );
    // }
// if( isNaN( x ) || x == null || isNaN( y ) || y == null || isNaN( angle ) || angle == null ){ return; }

    const { opacity, width, color } = this.getLineStyle(edge);
    const webglColor = util.toWebGLColor(color, opacity); // why am I not premultiplying?

    const i = this.instanceCount;
    this.sourceBuffer.setDataAt([sx, sy], i);
    this.targetBuffer.setDataAt([tx, ty], i);
    this.widthBuffer.setDataAt([width], i);
    this.colorBuffer.setDataAt(webglColor, i);

    this.instanceCount++;

    if(this.instanceCount >= this.maxInstances) {
      this.endBatch();
    }
  }


  endBatch() {
    const { gl, program, vao, instanceCount, vertexCount } = this;
    if(instanceCount === 0) 
      return;

    gl.useProgram(program);
    gl.bindVertexArray(vao);

    // buffer the attribute data
    this.sourceBuffer.bufferSubData(instanceCount);
    this.targetBuffer.bufferSubData(instanceCount);
    this.widthBuffer.bufferSubData(instanceCount);
    this.colorBuffer.bufferSubData(instanceCount);

    // Set the projection matrix uniform
    gl.uniformMatrix3fv(program.uPanZoomMatrix, false, this.panZoomMatrix);

    // draw!
    gl.drawArraysInstanced(gl.TRIANGLES, 0, vertexCount, instanceCount);

    gl.bindVertexArray(null);

    // start another batch, even if not needed
    this.startBatch();
  }

}
