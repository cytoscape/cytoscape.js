import * as util from './webgl-util';
import { defaults } from '../../../../util';
import { mat3 } from 'gl-matrix';

const initDefaults = defaults({
  // The canvas renderer uses a mask to remove the part of the edge line that's under
  // a translucent edge arrow (see the part of CRp.drawArrowhead that uses globalCompositeOperation). 
  // So even if an edge arrow is translucent you don't see anything under it except the canvas background.
  // To simulate this effect with WebGL we will blend edge arrow colors with the background
  // color value that's passed in. That means if there is a texture or image 
  // under the canvas it won't be blended propery with edge arrows, this is an 
  // acceptable limitation for now.
  bgColor: [255, 255, 255]
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

    this.opts = initDefaults(options);
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
      in vec2 aPosition;
      in int aVertType;

      // lines
      in vec4 aSourceTarget;
      in float aLineWidth;
      in vec4 aLineColor;

      // arrows
      in ivec2 aDrawArrows; // 's' for source, 't' for target
      in vec4 aSourceArrowColor;
      in vec4 aTargetArrowColor;
      in mat3 aSourceArrowTransform;
      in mat3 aTargetArrowTransform;

      out vec4 vColor;
      flat out int vVertType;

      void main(void) {
        if(aVertType == ${LINE}) {
          vec2 source = aSourceTarget.xy;
          vec2 target = aSourceTarget.zw;
          vec2 xBasis = target - source;
          vec2 yBasis = normalize(vec2(-xBasis.y, xBasis.x));
          vec2 point = source + xBasis * aPosition.x + yBasis * aLineWidth * aPosition.y;
          gl_Position = vec4(uPanZoomMatrix * vec3(point, 1.0), 1.0);
          vColor = aLineColor;
        } 
        else if(aVertType == ${SOURCE_ARROW} && aDrawArrows.s == 1) {
          gl_Position = vec4(uPanZoomMatrix * aSourceArrowTransform * vec3(aPosition, 1.0), 1.0);
          vColor = aSourceArrowColor;
        }
        else if(aVertType == ${TARGET_ARROW} && aDrawArrows.t == 1) {
          gl_Position = vec4(uPanZoomMatrix * aTargetArrowTransform * vec3(aPosition, 1.0), 1.0);
          vColor = aTargetArrowColor;
        } 
        else {
          gl_Position = vec4(2.0, 0.0, 0.0, 1.0); // discard vertex by putting it outside webgl clip space
          vColor = vec4(0.0, 0.0, 0.0, 0.0);
        }
        vVertType = aVertType;
      }
    `;

    const fragmentShaderSource = `#version 300 es
      precision highp float;

      uniform vec4 uBGColor;

      in vec4 vColor;
      flat in int vVertType;

      out vec4 outColor;

      void main(void) {
        if(vVertType == ${SOURCE_ARROW} || vVertType == ${TARGET_ARROW}) {
          // blend arrow color with background (using premultiplied alpha)
          outColor.rgb = vColor.rgb + (uBGColor.rgb * (1.0 - vColor.a)); 
          outColor.a = 1.0; // make opaque, masks out line under arrow
        } else {
          outColor = vColor;
        }
      }
    `;

    const program = util.createProgram(gl, vertexShaderSource, fragmentShaderSource);

    program.uPanZoomMatrix = gl.getUniformLocation(program, 'uPanZoomMatrix');
    program.uBGColor = gl.getUniformLocation(program, 'uBGColor');
    
    program.aPosition  = gl.getAttribLocation(program, 'aPosition');
    program.aVertType  = gl.getAttribLocation(program, 'aVertType');

    program.aSourceTarget = gl.getAttribLocation(program, 'aSourceTarget');
    program.aLineWidth    = gl.getAttribLocation(program, 'aLineWidth');
    program.aLineColor    = gl.getAttribLocation(program, 'aLineColor');

    program.aDrawArrows           = gl.getAttribLocation(program, 'aDrawArrows');
    program.aSourceArrowColor     = gl.getAttribLocation(program, 'aSourceArrowColor');
    program.aTargetArrowColor     = gl.getAttribLocation(program, 'aTargetArrowColor');
    program.aSourceArrowTransform = gl.getAttribLocation(program, 'aSourceArrowTransform');
    program.aTargetArrowTransform = gl.getAttribLocation(program, 'aTargetArrowTransform');

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
    const label = [ // same as NodeDrawing
      0, 0,  0, 1,  1, 0,
      1, 0,  0, 1,  1, 1,
    ];

    const instanceGeometry = [ // order matters, back to front
      ...line,  // edge line
      ...arrow, // source arrow
      ...arrow, // target arrow
    ];

    const typeOf = verts => ({ is: type => new Array(verts.length/2).fill(type) });
    const vertTypes = [
      ...typeOf(line).is(LINE),
      ...typeOf(arrow).is(SOURCE_ARROW),
      ...typeOf(arrow).is(TARGET_ARROW),
    ];

    this.vertexCount = instanceGeometry.length / 2;
  
    const { gl, program } = this;

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    util.createBufferStaticDraw(gl, 'vec2', program.aPosition, instanceGeometry);
    util.createBufferStaticDraw(gl, 'int',  program.aVertType, vertTypes);

    const n = this.maxInstances;
    this.sourceTargetBuffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aSourceTarget);
    this.lineWidthBuffer = util.createBufferDynamicDraw(gl, n, 'float', program.aLineWidth);
    this.lineColorBuffer = util.createBufferDynamicDraw(gl, n, 'vec4' , program.aLineColor);

    this.drawArrowsBuffer = util.createBufferDynamicDraw(gl, n, 'ivec2', program.aDrawArrows);
    this.sourceArrowColorBuffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aSourceArrowColor);
    this.targetArrowColorBuffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aTargetArrowColor);
    this.sourceArrowTransformBuffer = util.create3x3MatrixBufferDynamicDraw(gl, n, program.aSourceArrowTransform);
    this.targetArrowTransformBuffer = util.create3x3MatrixBufferDynamicDraw(gl, n, program.aTargetArrowTransform);

    gl.bindVertexArray(null);
    return vao;
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


  getArrowInfo(edge, prefix, edgeOpacity, edgeWidth) {
    const rs = edge._private.rscratch;
    if(rs.edgeType !== 'straight') { // only straight edges get arrows for now
      return;
    }

    let x, y, angle;
    if(prefix === 'source') {
      x = rs.arrowStartX;
      y = rs.arrowStartY;
      angle = rs.srcArrowAngle;
    } else {
      x = rs.arrowEndX;
      y = rs.arrowEndY;
      angle = rs.tgtArrowAngle;
    }

    // taken from CRp.drawArrowhead
    if(isNaN(x) || x == null || isNaN(y) || y == null || isNaN(angle) || angle == null) { 
      return; 
    }

    let color = edge.pstyle(prefix + '-arrow-color').value;
    let scale = edge.pstyle('arrow-scale').value;
    let size = this.r.getArrowWidth(edgeWidth, scale);

    let webglColor = util.toWebGLColor(color, edgeOpacity);

    const transform = mat3.create();
    mat3.translate(transform, transform, [x, y]);
    mat3.scale(transform, transform, [size, size]);
    mat3.rotate(transform, transform, angle);

    return {
      transform,
      webglColor
    }
  }


  startBatch(panZoomMatrix) {
    if(panZoomMatrix) {
      this.panZoomMatrix = panZoomMatrix;
    }
    this.instanceCount = 0;
  }


  draw(edge) {
    // edge points and arrow angles etc are calculated by the base renderer and cached in the rscratch object
    const rs = edge._private.rscratch;
    const i = this.instanceCount;

    // line
    const { opacity, width, color } = this.getLineStyle(edge);
    const [ sx, sy ] = rs.allpts;
    const [ tx, ty ] = rs.allpts.slice(-2);
    const lineColor = util.toWebGLColor(color, opacity); 
    
    this.sourceTargetBuffer.setData([sx, sy, tx, ty], i);
    this.lineWidthBuffer.setData([width], i);
    this.lineColorBuffer.setData(lineColor, i);

    // arrows
    let drawSource = false;
    let drawTarget = false;

    const sourceInfo = this.getArrowInfo(edge, 'source', opacity, width);
    if(sourceInfo) {
      this.sourceArrowColorBuffer.setData(sourceInfo.webglColor, i);
      this.sourceArrowTransformBuffer.setData(sourceInfo.transform, i);
      drawSource = true;
    }

    const targetInfo = this.getArrowInfo(edge, 'target', opacity, width);
    if(targetInfo) {
      this.targetArrowColorBuffer.setData(targetInfo.webglColor, i);
      this.targetArrowTransformBuffer.setData(targetInfo.transform, i);
      drawTarget = true;
    } 

    this.drawArrowsBuffer.setData([drawSource, drawTarget], i);

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
    this.sourceTargetBuffer.bufferSubData(instanceCount);
    this.lineWidthBuffer.bufferSubData(instanceCount);
    this.lineColorBuffer.bufferSubData(instanceCount);

    this.drawArrowsBuffer.bufferSubData(instanceCount);
    this.sourceArrowColorBuffer.bufferSubData(instanceCount);
    this.targetArrowColorBuffer.bufferSubData(instanceCount);
    this.sourceArrowTransformBuffer.bufferSubData(instanceCount);
    this.targetArrowTransformBuffer.bufferSubData(instanceCount);

    // Set the projection matrix uniform
    gl.uniformMatrix3fv(program.uPanZoomMatrix, false, this.panZoomMatrix);

    // set background color (this is a hack)
    const webglBgColor = util.toWebGLColor(this.opts.bgColor, 1);
    gl.uniform4fv(program.uBGColor, webglBgColor);

    // draw!
    gl.drawArraysInstanced(gl.TRIANGLES, 0, vertexCount, instanceCount);

    gl.bindVertexArray(null);

    // start another batch, even if not needed
    this.startBatch();
  }

}
