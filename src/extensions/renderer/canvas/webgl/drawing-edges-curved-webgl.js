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
    const { gl } = this;

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
          pos = vec2(1.0 - aPosition.x, -aPosition.y);
        }

        // Find the normal vector.
        vec2 tangent = normalize(normalize(p2 - p1) + normalize(p1 - p0));
        vec2 normal = vec2(-tangent.y, tangent.x);

        // Find the vector perpendicular to p0 -> p1.
        vec2 p01 = p1 - p0;
        vec2 p21 = p1 - p2;
        vec2 p01Norm = normalize(vec2(-p01.y, p01.x));

        // Determine the bend direction.
        float sigma = sign(dot(p01 + p21, normal));

        if(sign(pos.y) == -sigma) {
          // This is an intersecting vertex. Adjust the position so that there's no overlap.
          vec2 point = 0.5 * normal * -sigma * aLineWidth / dot(normal, p01Norm);
          gl_Position = vec4(uPanZoomMatrix * vec3(p1 + point, 1.0), 1.0);
        } else {
          // This is a non-intersecting vertex. Treat it normally.
          vec2 xBasis = p2 - p1;
          vec2 yBasis = normalize(vec2(-xBasis.y, xBasis.x));
          vec2 point = p1 + xBasis * pos.x + yBasis * aLineWidth * pos.y;
          gl_Position = vec4(uPanZoomMatrix * vec3(point, 1.0), 1.0);
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

    // BAD! use one buffer but with different offsets
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
    const { allpts } = rs;
    const points = [];
    for(let i = 0; i < allpts.length; i += 2) {
      points.push({ x: allpts[i], y: allpts[i+1] });
    }
    return points;
  }

  getCurvePoint(points, t) {
    if(points.length == 1) {
      return points[0];
    } else {
      const newpoints = Array(points.length-1);
      for(let i = 0; i < newpoints.length; i++) {
        const x = (1-t) * points[i].x + t * points[i+1].x;
        const y = (1-t) * points[i].y + t * points[i+1].y;
        newpoints[i] = { x, y };
      }
      return this.getCurvePoint(newpoints, t);
    }
  }

  getCurvePoints(points, steps) {
    const curvePoints = [];
    for(let i = 0; i <= steps; i++) {
      const t = i / steps;
      curvePoints.push(this.getCurvePoint(points, t));
    }
    return curvePoints;
  }

  getNumSegments(edge) {
    // TODO need a heuristic that decides how many segments to use
    // factors to consider:
    // - edge width/length
    // - edge curvature (the more the curvature, the more segments)
    // - zoom level (more segments when zoomed in)
    // - number of visible edges (more segments when there are fewer edges)
    // - performance (fewer segments when performance is a concern)
    // - user configurable option(s)
    // note: number of segments should be less than the max number of instances
    return 16;
  }

  /**
   * This function gets the data needed to draw an edge and sets it into the buffers.
   * This function is called for evey edge on every frame, it is performance critical.
   * Set values in the buffers using Typed Array Views for performance.
   */
  draw(edge, eleIndex) {
    const controlPoints = this.getControlPoints(edge);
    const numSegments = this.getNumSegments(edge);
    const curvePoints = this.getCurvePoints(controlPoints, numSegments);

    if(curvePoints.length + this.instanceCount > this.maxInstances) {
      this.endBatch();
    }

    for(let i = 0; i < curvePoints.length-1; i++) {
      const instance = this.instanceCount;

      let pA = curvePoints[i-1];
      let pB = curvePoints[i];   // start
      let pC = curvePoints[i+1]; // end
      let pD = curvePoints[i+2];

      // make phantom points for the first and last segments
      if(i == 0) {
        pA = { x: 2*pB.x - pC.x, y: 2*pB.y - pC.y };
      }
      if(i == curvePoints.length-2) {
        pD = { x: 2*pC.x - pB.x, y: 2*pC.y - pB.y };
      }

      const pAView = this.aPointABuffer.getView(instance);
      pAView[0] = pA.x;
      pAView[1] = pA.y;

      const pBView = this.aPointBBuffer.getView(instance);
      pBView[0] = pB.x;
      pBView[1] = pB.y;

      const pCView = this.aPointCBuffer.getView(instance);
      pCView[0] = pC.x;
      pCView[1] = pC.y;

      const pDView = this.aPointDBuffer.getView(instance);
      pDView[0] = pD.x;
      pDView[1] = pD.y;

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