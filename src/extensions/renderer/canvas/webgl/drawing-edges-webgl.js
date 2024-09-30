import { RENDER_TARGET } from './drawing-redraw-webgl';
import * as util from './webgl-util';
import { mat3 } from 'gl-matrix';

// The canvas renderer uses a mask to remove the part of the edge line that's under
// a translucent edge arrow (see the part of CRp.drawArrowhead that uses globalCompositeOperation). 
// So even if an edge arrow is translucent you don't see anything under it except the canvas background.
// To simulate this effect with WebGL we will blend edge arrow colors with the background
// color value that's passed in. That means if there is a texture or image 
// under the canvas it won't be blended propery with edge arrows, this is an 
// acceptable limitation for now.

// Vertex types
const LINE = 0;
const SOURCE_ARROW = 1;
const TARGET_ARROW = 2;


export class EdgeDrawing {

  /** 
   * @param {WebGLRenderingContext} gl 
   */
  constructor(r, gl, opts) {
    this.r = r;
    this.gl = gl;

    this.maxInstances = opts.webglBatchSize;
    this.bgColor = opts.bgColor;

    this.program = this.createShaderProgram(RENDER_TARGET.SCREEN);
    this.pickingProgram = this.createShaderProgram(RENDER_TARGET.PICKING);

    this.vao = this.createVAO();
  }

  createShaderProgram(renderTarget) {
    // see https://wwwtyro.net/2019/11/18/instanced-lines.html
    const { gl } = this;

    const vertexShaderSource = `#version 300 es
      precision highp float;

      uniform mat3 uPanZoomMatrix;

      // instanced
      in vec3 aPositionType;

      // for picking
      in vec4 aIndex; 

      // lines
      in vec4 aSourceTarget;
      in float aLineWidth;
      in vec4 aLineColor;

      // arrows
      in vec4 aSourceArrowColor;
      in vec4 aTargetArrowColor;
      in mat3 aSourceArrowTransform;
      in mat3 aTargetArrowTransform;

      out vec4 vColor;
      flat out vec4 vIndex;
      flat out float vVertType;

      void main(void) {
        vec3  position = vec3(aPositionType.xy, 1.0);
        float vertType = aPositionType.z;

        if(vertType == ${LINE}.0) {
          vec2 source = aSourceTarget.xy;
          vec2 target = aSourceTarget.zw;
          vec2 xBasis = target - source;
          vec2 yBasis = normalize(vec2(-xBasis.y, xBasis.x));
          vec2 point = source + xBasis * position.x + yBasis * aLineWidth * position.y;
          gl_Position = vec4(uPanZoomMatrix * vec3(point, 1.0), 1.0);
          vColor = aLineColor;
        } 
        else if(vertType == ${SOURCE_ARROW}.0 && aSourceArrowColor.a > 0.0) {
          gl_Position = vec4(uPanZoomMatrix * aSourceArrowTransform * position, 1.0);
          vColor = aSourceArrowColor;
        }
        else if(vertType == ${TARGET_ARROW}.0 && aTargetArrowColor.a > 0.0) {
          gl_Position = vec4(uPanZoomMatrix * aTargetArrowTransform * position, 1.0);
          vColor = aTargetArrowColor;
        } 
        else {
          gl_Position = vec4(2.0, 0.0, 0.0, 1.0); // discard vertex by putting it outside webgl clip space
          vColor = vec4(0.0, 0.0, 0.0, 0.0);
        }

        vIndex = aIndex;
        vVertType = vertType;
      }
    `;

    const fragmentShaderSource = `#version 300 es
      precision highp float;

      uniform vec4 uBGColor;

      in vec4 vColor;
      flat in vec4 vIndex;
      flat in float vVertType;

      out vec4 outColor;

      void main(void) {
        if(vVertType == ${SOURCE_ARROW}.0 || vVertType == ${TARGET_ARROW}.0) {
          // blend arrow color with background (using premultiplied alpha)
          outColor.rgb = vColor.rgb + (uBGColor.rgb * (1.0 - vColor.a)); 
          outColor.a = 1.0; // make opaque, masks out line under arrow
        } else {
          outColor = vColor;
        }

        ${ renderTarget.picking ?
          ` if(outColor.a == 0.0)
              outColor = vec4(0.0, 0.0, 0.0, 0.0);
            else
              outColor = vIndex;
          `
          : ''
        }
      }
    `;

    const program = util.createProgram(gl, vertexShaderSource, fragmentShaderSource);

    program.uPanZoomMatrix = gl.getUniformLocation(program, 'uPanZoomMatrix');
    program.uBGColor = gl.getUniformLocation(program, 'uBGColor');
    
    program.aPositionType  = gl.getAttribLocation(program, 'aPositionType');

    program.aIndex        = gl.getAttribLocation(program, 'aIndex');
    program.aSourceTarget = gl.getAttribLocation(program, 'aSourceTarget');
    program.aLineWidth    = gl.getAttribLocation(program, 'aLineWidth');
    program.aLineColor    = gl.getAttribLocation(program, 'aLineColor');

    program.aSourceArrowColor     = gl.getAttribLocation(program, 'aSourceArrowColor');
    program.aTargetArrowColor     = gl.getAttribLocation(program, 'aTargetArrowColor');
    program.aSourceArrowTransform = gl.getAttribLocation(program, 'aSourceArrowTransform');
    program.aTargetArrowTransform = gl.getAttribLocation(program, 'aTargetArrowTransform');

    return program;
  }

  createVAO() {
    // Pack the vertex type into the z coord of the position attribute to save shader attributes.
    const line = [
      0, -0.5, LINE,
      1, -0.5, LINE,
      1,  0.5, LINE,
      0, -0.5, LINE,
      1,  0.5, LINE,
      0,  0.5, LINE,
    ];
    const sourceArrow = [ // same as the 'triangle' shape in the base renderer
      -0.15, -0.3, SOURCE_ARROW,
       0,     0,   SOURCE_ARROW,
       0.15, -0.3, SOURCE_ARROW,
    ];
    const targetArrow = [
      -0.15, -0.3, TARGET_ARROW,
       0,     0,   TARGET_ARROW,
       0.15, -0.3, TARGET_ARROW,
    ];
    // const label = [ // same as NodeDrawing
    //   0, 0,   0, 1,   1, 0,
    //   1, 0,   0, 1,   1, 1,
    // ];

    const instanceGeometry = [ // order matters, back to front
      ...line,
      ...sourceArrow,
      ...targetArrow,
    ];

    this.vertexCount = instanceGeometry.length / 3;
  
    const { gl, program } = this;

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    util.createBufferStaticDraw(gl, 'vec3', program.aPositionType, instanceGeometry);

    const n = this.maxInstances;
    this.indexBuffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aIndex);
    this.sourceTargetBuffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aSourceTarget);
    this.lineWidthBuffer = util.createBufferDynamicDraw(gl, n, 'float', program.aLineWidth);
    this.lineColorBuffer = util.createBufferDynamicDraw(gl, n, 'vec4' , program.aLineColor);

    this.sourceArrowColorBuffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aSourceArrowColor);
    this.targetArrowColorBuffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aTargetArrowColor);
    this.sourceArrowTransformBuffer = util.create3x3MatrixBufferDynamicDraw(gl, n, program.aSourceArrowTransform);
    this.targetArrowTransformBuffer = util.create3x3MatrixBufferDynamicDraw(gl, n, program.aTargetArrowTransform);

    gl.bindVertexArray(null);
    return vao;
  }


  getArrowInfo(edge, edgeWidth, prefix) {
    // Edge points and arrow angles etc are calculated by the base renderer and cached in the rscratch object.
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

    // TODO pass in a matrix view instead of creating a new matrix every time
    const transform = mat3.create();
    mat3.translate(transform, transform, [x, y]);
    mat3.scale(transform, transform, [size, size]);
    mat3.rotate(transform, transform, angle);

    return {
      transform,
      color
    }
  }


  startFrame(panZoomMatrix, debugInfo, renderTarget = RENDER_TARGET.SCREEN) {
    this.panZoomMatrix = panZoomMatrix
    this.debugInfo = debugInfo;
    this.renderTarget = renderTarget;
  }

  startBatch() {
    this.instanceCount = 0;
  }

  /**
   * This function gets the data needed to draw an edge and sets it into the buffers.
   * This function is called for evey edge on every frame, it is performance critical.
   * Set values in the buffers using Typed Array Views for performance.
   */
  draw(edge, eleIndex) {
    const instance = this.instanceCount;
    // Edge points and arrow angles etc are calculated by the base renderer and cached in the rscratch object.
    const rs = edge._private.rscratch;

    // source and target points
    {
      const { allpts } = rs;
      const view = this.sourceTargetBuffer.getView(instance);
      view[0] = allpts[0]; // source x
      view[1] = allpts[1]; // source y
      view[2] = allpts[allpts.length-2]; // target x
      view[3] = allpts[allpts.length-1]; // target y
    }
    
    // Element index in the array returned by r.getCachedZSortedEles(), used for picking.
    {
      const view = this.indexBuffer.getView(instance);
      util.indexToVec4(eleIndex, view);
    }

    // line style
    const baseOpacity = edge.pstyle('opacity').value;
    const lineOpacity = edge.pstyle('line-opacity').value;
    const width = edge.pstyle('width').pfValue;
    const color = edge.pstyle('line-color').value;
    const opacity = baseOpacity * lineOpacity;
    {
      const view = this.lineColorBuffer.getView(instance);
      util.toWebGLColor(color, opacity, view);
    }
    {
      const view = this.lineWidthBuffer.getView(instance);
      view[0] = width;
    }

    // arrow colors and transforms
    const sourceInfo = this.getArrowInfo(edge, width, 'source');
    const sourceColorView = this.sourceArrowColorBuffer.getView(instance);
    if(sourceInfo) {
      const { color, transform } = sourceInfo;
      this.sourceArrowTransformBuffer.setData(transform, instance);
      util.toWebGLColor(color, opacity, sourceColorView);
    } else {
      util.zeroColor(sourceColorView);
    }

    const targetInfo = this.getArrowInfo(edge, width, 'target');
    const targetColorView = this.targetArrowColorBuffer.getView(instance);
    if(targetInfo) {
      const { color, transform } = targetInfo;
      this.targetArrowTransformBuffer.setData(transform, instance);
      util.toWebGLColor(color, opacity, targetColorView);
    } else {
      util.zeroColor(targetColorView);
    }

    this.instanceCount++;

    if(this.instanceCount >= this.maxInstances) {
      this.endBatch();
    }
  }

  /**
   * This function does the actual drawing of the edges using WebGL.
   */
  endBatch() {
    const { gl, vao, vertexCount, instanceCount: count } = this;
    if(count === 0) 
      return;

    const program = this.renderTarget.picking 
      ? this.pickingProgram 
      : this.program;

    gl.useProgram(program);
    gl.bindVertexArray(vao);

    // buffer the attribute data
    this.indexBuffer.bufferSubData(count);
    this.sourceTargetBuffer.bufferSubData(count);
    this.lineWidthBuffer.bufferSubData(count);
    this.lineColorBuffer.bufferSubData(count);
    this.sourceArrowColorBuffer.bufferSubData(count);
    this.targetArrowColorBuffer.bufferSubData(count);
    this.sourceArrowTransformBuffer.bufferSubData(count);
    this.targetArrowTransformBuffer.bufferSubData(count);

    // Set the projection matrix uniform
    gl.uniformMatrix3fv(program.uPanZoomMatrix, false, this.panZoomMatrix);

    // set background color, needed for edge arrow color blending
    const webglBgColor = util.toWebGLColor(this.bgColor, 1);
    gl.uniform4fv(program.uBGColor, webglBgColor);

    // draw!
    gl.drawArraysInstanced(gl.TRIANGLES, 0, vertexCount, count);

    gl.bindVertexArray(null);

    if(this.debugInfo) {
      this.debugInfo.push({ count });
    }
    
    // start another batch, even if not needed
    this.startBatch();
  }

}
