import * as util from './webgl-util';
import { RENDER_TARGET } from './defaults';


export class EdgeBezierDrawing {

  /** 
   * @param {WebGLRenderingContext} gl 
   */
  constructor(r, gl, opts, labelRenderOptions) {
    this.r = r;
    this.gl = gl;
    
    this.maxInstances = opts.webglBatchSize;
    this.maxAtlases = opts.webglTexPerBatch;
    this.atlasSize = opts.webglTexSize;
    this.bgColor = opts.bgColor;

    this.labelOpts = labelRenderOptions;

    this.program = this.createShaderProgram(RENDER_TARGET.SCREEN);
    this.pickingProgram = this.createShaderProgram(RENDER_TARGET.PICKING);

    this.vao = this.createVAO();
  }

  invalidate(eles) {
  }

  gc() {
  }

  createShaderProgram(renderTarget) {
    // see https://wwwtyro.net/2019/11/18/instanced-lines.html
    // and https://wwwtyro.net/2021/10/01/instanced-lines-part-2.html 

    const vertexShaderSource = `#version 300 es
      precision highp float;

      uniform mat3 uPanZoomMatrix;

      // instanced
      in vec2 aPosition;
      in vec4 aIndex; 

      in vec2 aPointA;
      in vec2 aPointB;
      in vec2 aPointC;
      in vec2 aPointD;

      in float aLineWidth;
      in vec4  aLineColor;

      out vec4 vColor;
      flat out vec4 vIndex;

      void main(void) {
        vec2 p0 = aPointA;
        vec2 p1 = aPointB;
        vec2 p2 = aPointC;
        vec2 pos = aPosition;
        if(aPosition.x == 1.0) {
          p0 = aPointD;
          p1 = aPointC;
          p2 = aPointB;
          pos = vec2(0.0, -aPosition.y);
        }

        vec2 p01 = p1 - p0;
        vec2 p12 = p2 - p1;
        vec2 p21 = p1 - p2;

        // Find the normal vector.
        vec2 tangent = normalize(normalize(p12) + normalize(p01));
        vec2 normal = vec2(-tangent.y, tangent.x);

        // Find the vector perpendicular to p0 -> p1.
        vec2 p01Norm = normalize(vec2(-p01.y, p01.x));

        // Determine the bend direction.
        float sigma = sign(dot(p01 + p21, normal));
        float width = aLineWidth;

        if(sign(pos.y) == -sigma) {
          // This is an intersecting vertex. Adjust the position so that there's no overlap.
          vec2 point = 0.5 * width * normal * -sigma / dot(normal, p01Norm);
          gl_Position = vec4(uPanZoomMatrix * vec3(p1 + point, 1.0), 1.0);
        } else {
          // This is a non-intersecting vertex. Treat it like a mitre join.
          vec2 point = 0.5 * width * normal * sigma * dot(normal, p01Norm);
          gl_Position = vec4(uPanZoomMatrix * vec3(p1 + point, 1.0), 1.0);
        }

        vColor = aLineColor;
        vIndex = aIndex;
      }
    `;

    const fragmentShaderSource = `#version 300 es
      precision highp float;

      in vec4 vColor;
      flat in vec4 vIndex;

      out vec4 outColor;

      void main(void) {
        outColor = vColor;

        ${ renderTarget.picking
          ? `if(outColor.a == 0.0) discard;
             else outColor = vIndex;`
          : ''
        }
      }
    `;

    const { gl } = this;
    const program = util.createProgram(gl, vertexShaderSource, fragmentShaderSource);

    program.aPosition = gl.getAttribLocation(program, 'aPosition');
    program.aIndex    = gl.getAttribLocation(program, 'aIndex');

    program.aPointA = gl.getAttribLocation(program, 'aPointA');
    program.aPointB = gl.getAttribLocation(program, 'aPointB');
    program.aPointC = gl.getAttribLocation(program, 'aPointC');
    program.aPointD = gl.getAttribLocation(program, 'aPointD');

    program.aLineWidth = gl.getAttribLocation(program, 'aLineWidth');
    program.aLineColor = gl.getAttribLocation(program, 'aLineColor');

    program.uPanZoomMatrix = gl.getUniformLocation(program, 'uPanZoomMatrix');

    return program;
  }

  createVAO() {
    // Pack the vertex type into the z coord of the position attribute to save shader attributes.
    const line = [
      0, -0.5,
      1, -0.5,
      1,  0.5,
      0, -0.5,
      1,  0.5,
      0,  0.5,
    ];

    const instanceGeometry = [ // order matters, back to front
      ...line,
    ]; 

    this.vertexCount = instanceGeometry.length / 2;
  
    const { gl, program } = this;

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    util.createBufferStaticDraw(gl, 'vec2', program.aPosition, instanceGeometry);

    const n = this.maxInstances;
    this.indexBuffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aIndex);

    // TODO: use a single buffer for the points, but with different offsets for the attributes
    this.aPointABuffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aPointA);
    this.aPointBBuffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aPointB);
    this.aPointCBuffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aPointC);
    this.aPointDBuffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aPointD);

    this.lineWidthBuffer = util.createBufferDynamicDraw(gl, n, 'float', program.aLineWidth);
    this.lineColorBuffer = util.createBufferDynamicDraw(gl, n, 'vec4' , program.aLineColor);

    gl.bindVertexArray(null);
    return vao;
  }

  get buffers() {
    if(!this._buffers) {
      this._buffers = Object.keys(this).filter(k => k.endsWith('Buffer')).map(k => this[k]);
    }
    return this._buffers;
  }


  startFrame(panZoomMatrix, debugInfo, renderTarget = RENDER_TARGET.SCREEN) {
    this.panZoomMatrix = panZoomMatrix;
    this.debugInfo = debugInfo;
    this.renderTarget = renderTarget;
  }

  startBatch() {
    this.instanceCount = 0;
  }

  
  getControlPoints(edge) {
    const rs = edge._private.rscratch;
    return rs.allpts;
  }
  
  getNumSegments(edge) {
    // TODO Need a heuristic that decides how many segments to use. Factors to consider:
    // - edge width/length
    // - edge curvature (the more the curvature, the more segments)
    // - zoom level (more segments when zoomed in)
    // - number of visible edges (more segments when there are fewer edges)
    // - performance (fewer segments when performance is a concern)
    // - user configurable option(s)
    // note: number of segments should be less than the max number of instances
    const numSegments = 10;
    return Math.min(Math.max(numSegments, 5), this.maxInstances);
  }

  getCurveSegmentPoints(controlPoints, segments) {
    if(controlPoints.length == 4) {
      return controlPoints; // straight line
    }
    const curvePoints = Array((segments + 1) * 2);
    for(let i = 0; i <= segments; i++) {
      // the first and last points are the same as the first and last control points
      if(i == 0) {
        curvePoints[0] = controlPoints[0];
        curvePoints[1] = controlPoints[1];
      } else if(i == segments) {
        curvePoints[i*2  ] = controlPoints[controlPoints.length-2];
        curvePoints[i*2+1] = controlPoints[controlPoints.length-1];
      } else {
        const t = i / segments;
        // pass in curvePoints to set the values in the array directly
        this.setCurvePoint(controlPoints, t, curvePoints, i*2);
      }
    }
    return curvePoints;
  }

  setCurvePoint(points, t, curvePoints, cpi) {
    if(points.length <= 2) {
      curvePoints[cpi  ] = points[0];
      curvePoints[cpi+1] = points[1];
    } else {
      const newpoints = Array(points.length-2);
      for(let i = 0; i < newpoints.length; i+=2) {
        const x = (1-t) * points[i  ] + t * points[i+2];
        const y = (1-t) * points[i+1] + t * points[i+3];
        newpoints[i  ] = x;
        newpoints[i+1] = y;
      }
      return this.setCurvePoint(newpoints, t, curvePoints, cpi);
    }
  }

  getEdgePoints(edge) {
    const controlPoints = this.getControlPoints(edge);
    if(controlPoints.length == 4) {
      return controlPoints;
    }
    const numSegments = this.getNumSegments(edge);
    return this.getCurveSegmentPoints(controlPoints, numSegments);
  }

  /**
   * This function gets the data needed to draw an edge and sets it into the buffers.
   * This function is called for evey edge on every frame, it is performance critical.
   * Set values in the buffers using Typed Array Views for performance.
   */
  draw(edge, eleIndex) {
    const points = this.getEdgePoints(edge);

    // console.log('controlPoints', controlPoints);
    // console.log('curvePoints', curvePoints);

    if(points.length/2 + this.instanceCount > this.maxInstances) {
      this.endBatch();
    }

    for(let i = 0; i < points.length-2; i += 2) {
      const instance = this.instanceCount;

      let pAx = points[i-2], pAy = points[i-1];
      let pBx = points[i  ], pBy = points[i+1];
      let pCx = points[i+2], pCy = points[i+3];
      let pDx = points[i+4], pDy = points[i+5];

      // make phantom points for the first and last segments
      // TODO adding 0.001 to avoid division by zero in the shader (I think), need a better solution
      if(i == 0) {
        pAx = 2*pBx - pCx + 0.001;
        pAy = 2*pBy - pCy + 0.001;
      }
      if(i == points.length-4) {
        pDx = 2*pCx - pBx + 0.001;
        pDy = 2*pCy - pBy + 0.001;
      }

      // TODO using 4 separate buffers may not be efficient, could use a single buffer with different offsets
      this.aPointABuffer.setPoint(instance, pAx, pAy);
      this.aPointBBuffer.setPoint(instance, pBx, pBy);
      this.aPointCBuffer.setPoint(instance, pCx, pCy);
      this.aPointDBuffer.setPoint(instance, pDx, pDy);

      // Element index in the array returned by r.getCachedZSortedEles(), used for picking.
      const indexView = this.indexBuffer.getView(instance);
      util.indexToVec4(eleIndex, indexView);

      // line style
      const baseOpacity = edge.pstyle('opacity').value;
      const lineOpacity = edge.pstyle('line-opacity').value;
      const width = edge.pstyle('width').pfValue;
      const color = edge.pstyle('line-color').value;
      const opacity = baseOpacity * lineOpacity;

      const lineColorView = this.lineColorBuffer.getView(instance);
      util.toWebGLColor(color, opacity, lineColorView);
      const lineWidthBuffer = this.lineWidthBuffer.getView(instance);
      lineWidthBuffer[0] = width;

      this.instanceCount++;
    }

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
    for(const buffer of this.buffers) {
      buffer.bufferSubData(count);
    }

    // Set the projection matrix uniform
    gl.uniformMatrix3fv(program.uPanZoomMatrix, false, this.panZoomMatrix);

    // draw!
    gl.drawArraysInstanced(gl.TRIANGLES, 0, vertexCount, count);

    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    if(this.debugInfo) {
      this.debugInfo.push({ 
        type: 'edge-curved',
        count,
      });
    }
    
    // start another batch, even if not needed
    this.startBatch();
  }

  getDebugInfo() {
    return this.debugInfo;
  }

}