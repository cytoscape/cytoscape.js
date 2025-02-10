import * as util from './webgl-util.mjs';
import { mat3 } from 'gl-matrix';
import { RENDER_TARGET } from './defaults.mjs';
import { AtlasManager } from './atlas.mjs';


// Vertex types
const TEXTURE = 0;
const EDGE_STRAIGHT = 1;
const EDGE_CURVE_SEGMENT = 2;
const EDGE_ARROW = 3;
const RECTANGLE = 4;


export class ElementDrawingWebGL {

  /** 
   * @param {WebGLRenderingContext} gl 
   */
  constructor(r, gl, opts) {
    this.r = r;
    this.gl = gl;
    
    this.maxInstances = opts.webglBatchSize;
    this.atlasSize = opts.webglTexSize;
    this.bgColor = opts.bgColor;
    
    this.debug = opts.webglDebug;
    this.batchDebugInfo = [];

    opts.enableWrapping = true;
    opts.createTextureCanvas = util.createTextureCanvas; // Unit tests mock this
    this.atlasManager = new AtlasManager(r, opts);

    this.program = this.createShaderProgram(RENDER_TARGET.SCREEN);
    this.pickingProgram = this.createShaderProgram(RENDER_TARGET.PICKING);

    this.vao = this.createVAO();
  }

  addAtlasCollection(groupName, opts) {
    this.atlasManager.addAtlasCollection(groupName, opts);
  }

  addAtlasRenderType(typeName, opts) {
    this.atlasManager.addRenderType(typeName, opts);
  }

  invalidate(eles, { type } = {}) {
    const { atlasManager } = this;
    if(type) {
      return atlasManager.invalidate(eles, { 
        filterType: t => t === type, 
        forceRedraw: true
      });
    } else {
      return atlasManager.invalidate(eles);
    }
  }

  gc() {
    this.atlasManager.gc();
  }


  createShaderProgram(renderTarget) {
    const { gl } = this;

    // compute texture coordinates in the shader, becase we are using instanced drawing
    const vertexShaderSource = `#version 300 es
      precision highp float;

      uniform mat3 uPanZoomMatrix;
      uniform int  uAtlasSize;
      
      // instanced
      in vec2 aPosition; 

      in mat3 aTransform;

      // what are we rendering?
      in int aVertType;

      // for picking
      in vec4 aIndex;
      
      // For textures
      in int aAtlasId; // which shader unit/atlas to use
      in vec4 aTex; // x/y/w/h of texture in atlas

      // for edges
      in vec4 aPointAPointB;
      in vec4 aPointCPointD;
      in float aLineWidth;
      in vec4 aColor;

      out vec2 vTexCoord;
      out vec4 vColor;
      flat out int vAtlasId;
      flat out vec4 vIndex;
      flat out int vVertType;

      void main(void) {
        int vid = gl_VertexID;
        vec2 position = aPosition;

        if(aVertType == ${TEXTURE}) {
          float texX = aTex.x;
          float texY = aTex.y;
          float texW = aTex.z;
          float texH = aTex.w;

          int vid = gl_VertexID;

          if(vid == 1 || vid == 2 || vid == 4) {
            texX += texW;
          }
          if(vid == 2 || vid == 4 || vid == 5) {
            texY += texH;
          }

          float d = float(uAtlasSize);
          vTexCoord = vec2(texX / d, texY / d); // tex coords must be between 0 and 1

          gl_Position = vec4(uPanZoomMatrix * aTransform * vec3(position, 1.0), 1.0);
        }
        else if(aVertType == ${RECTANGLE}) {
          gl_Position = vec4(uPanZoomMatrix * aTransform * vec3(position, 1.0), 1.0);
          vColor = aColor;
        }
        else if(aVertType == ${EDGE_STRAIGHT}) {
          vec2 source = aPointAPointB.xy;
          vec2 target = aPointAPointB.zw;

          // adjust the geometry so that the line is centered on the edge
          position.y = position.y - 0.5;

          vec2 xBasis = target - source;
          vec2 yBasis = normalize(vec2(-xBasis.y, xBasis.x));
          vec2 point = source + xBasis * position.x + yBasis * aLineWidth * position.y;

          gl_Position = vec4(uPanZoomMatrix * vec3(point, 1.0), 1.0);
          vColor = aColor;
        } 
        else if(aVertType == ${EDGE_CURVE_SEGMENT}) {
          vec2 pointA = aPointAPointB.xy;
          vec2 pointB = aPointAPointB.zw;
          vec2 pointC = aPointCPointD.xy;
          vec2 pointD = aPointCPointD.zw;

          // adjust the geometry so that the line is centered on the edge
          position.y = position.y - 0.5;

          vec2 p0 = pointA;
          vec2 p1 = pointB;
          vec2 p2 = pointC;
          vec2 pos = position;
          if(position.x == 1.0) {
            p0 = pointD;
            p1 = pointC;
            p2 = pointB;
            pos = vec2(0.0, -position.y);
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

          vColor = aColor;
        } 
        else if(aVertType == ${EDGE_ARROW} && vid < 3) {
          // massage the first triangle into an edge arrow
          if(vid == 0)
            position = vec2(-0.15, -0.3);
          if(vid == 1)
            position = vec2( 0.0,   0.0);
          if(vid == 2)
            position = vec2( 0.15, -0.3);

          gl_Position = vec4(uPanZoomMatrix * aTransform * vec3(position, 1.0), 1.0);
          vColor = aColor;
        }
        else {
          gl_Position = vec4(2.0, 0.0, 0.0, 1.0); // discard vertex by putting it outside webgl clip space
        }

        vAtlasId = aAtlasId;
        vIndex = aIndex;
        vVertType = aVertType;
      }
    `;

    const idxs = this.atlasManager.getIndexArray();

    const fragmentShaderSource = `#version 300 es
      precision highp float;

      // define texture unit for each node in the batch
      ${idxs.map(i => `uniform sampler2D uTexture${i};`).join('\n\t')}

      uniform vec4 uBGColor;

      in vec2 vTexCoord;
      in vec4 vColor;
      flat in int vAtlasId;
      flat in vec4 vIndex;
      flat in int vVertType;

      out vec4 outColor;

      void main(void) {
        if(vVertType == ${TEXTURE}) {
          ${idxs.map(i => `if(vAtlasId == ${i}) outColor = texture(uTexture${i}, vTexCoord);`).join('\n\telse ')}
        } else if(vVertType == ${EDGE_ARROW}) {
          // blend arrow color with background (using premultiplied alpha)
          outColor.rgb = vColor.rgb + (uBGColor.rgb * (1.0 - vColor.a)); 
          outColor.a = 1.0; // make opaque, masks out line under arrow
        } else {
          outColor = vColor;
        }

        ${ renderTarget.picking
          ? `if(outColor.a == 0.0) discard;
             else outColor = vIndex;`
          : ''
        }
      }
    `;

    const program = util.createProgram(gl, vertexShaderSource, fragmentShaderSource);

    // instance geometry
    program.aPosition = gl.getAttribLocation(program, 'aPosition');

    // attributes
    program.aIndex     = gl.getAttribLocation(program, 'aIndex');
    program.aVertType  = gl.getAttribLocation(program, 'aVertType');
    program.aTransform = gl.getAttribLocation(program, 'aTransform');

    program.aAtlasId   = gl.getAttribLocation(program, 'aAtlasId');
    program.aTex       = gl.getAttribLocation(program, 'aTex');

    program.aPointAPointB   = gl.getAttribLocation(program, 'aPointAPointB');
    program.aPointCPointD   = gl.getAttribLocation(program, 'aPointCPointD');
    program.aLineWidth      = gl.getAttribLocation(program, 'aLineWidth');
    program.aColor          = gl.getAttribLocation(program, 'aColor');

    // uniforms
    program.uPanZoomMatrix = gl.getUniformLocation(program, 'uPanZoomMatrix');
    program.uAtlasSize     = gl.getUniformLocation(program, 'uAtlasSize');
    program.uBGColor       = gl.getUniformLocation(program, 'uBGColor');

    program.uTextures = [];
    for(let i = 0; i < this.atlasManager.getMaxAtlasesPerBatch(); i++) {
      program.uTextures.push(gl.getUniformLocation(program, `uTexture${i}`));
    }

    return program;
  }

  createVAO() {
    const instanceGeometry = [
      0, 0,  1, 0,  1, 1,
      0, 0,  1, 1,  0, 1,
    ];

    this.vertexCount = instanceGeometry.length / 2;
    const n = this.maxInstances;
    const { gl, program } = this;

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    util.createBufferStaticDraw(gl, 'vec2', program.aPosition, instanceGeometry);
    
    // Create buffers for all the attributes
    this.transformBuffer = util.create3x3MatrixBufferDynamicDraw(gl, n, program.aTransform);

    this.indexBuffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aIndex);
    this.vertTypeBuffer = util.createBufferDynamicDraw(gl, n, 'int', program.aVertType);
    this.atlasIdBuffer = util.createBufferDynamicDraw(gl, n, 'int', program.aAtlasId);
    this.texBuffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aTex);
    this.pointAPointBBuffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aPointAPointB);
    this.pointCPointDBuffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aPointCPointD);
    this.lineWidthBuffer = util.createBufferDynamicDraw(gl, n, 'float', program.aLineWidth);
    this.colorBuffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aColor);

    gl.bindVertexArray(null);
    return vao;
  }

  get buffers() {
    if(!this._buffers) {
      this._buffers = Object.keys(this).filter(k => k.endsWith('Buffer')).map(k => this[k]);
    }
    return this._buffers;
  }


  startFrame(panZoomMatrix, renderTarget = RENDER_TARGET.SCREEN) {
    this.panZoomMatrix = panZoomMatrix;
    this.renderTarget = renderTarget;

    this.batchDebugInfo = [];
    this.wrappedCount = 0; // TODO this should be in the AtlasManager
    this.rectangleCount = 0;
    
    this.startBatch();
  }

  startBatch() {
    this.instanceCount = 0;
    this.atlasManager.startBatch();
  }

  endFrame() {
    this.endBatch();
  }

  getTempMatrix() {
    return this.tempMatrix = this.tempMatrix || mat3.create();
  }


  drawTexture(ele, eleIndex, type) {
    const { atlasManager } = this;
    if(!ele.visible()) {
      return;
    }
    if(!atlasManager.getRenderTypeOpts(type).isVisible(ele)) {
      return;
    }
    if(!atlasManager.canAddToCurrentBatch(ele, type)) {
      this.endBatch(); // draws then starts a new batch
    }
    if(this.instanceCount + 1 >= this.maxInstances) {
      this.endBatch(); // make sure there's space for at least two instances, wrapped textures need two instances
    }
    
    const instance = this.instanceCount;
    this.vertTypeBuffer.getView(instance)[0] = TEXTURE;

    const indexView = this.indexBuffer.getView(instance);
    util.indexToVec4(eleIndex, indexView);

    const atlasInfo = atlasManager.getAtlasInfo(ele, type);
    const { index, tex1, tex2 } = atlasInfo;

    if(tex2.w > 0)
      this.wrappedCount++;

    let first = true;
    for(const tex of [tex1, tex2]) {
      if(tex.w != 0) {
        const instance = this.instanceCount;
        this.vertTypeBuffer.getView(instance)[0] = TEXTURE;

        const indexView = this.indexBuffer.getView(instance);
        util.indexToVec4(eleIndex, indexView);

        // Set values in the buffers using Typed Array Views for performance.
        const atlasIdView = this.atlasIdBuffer.getView(instance);
        atlasIdView[0] = index;
        
        // we have two sets of texture coordinates and transforms because textures can wrap in the atlas
        const texView = this.texBuffer.getView(instance);
        texView[0] = tex.x;
        texView[1] = tex.y;
        texView[2] = tex.w;
        texView[3] = tex.h;

        const matrixView = this.transformBuffer.getMatrixView(instance);
        atlasManager.setTransformMatrix(ele, matrixView, type, atlasInfo, first);

        this.instanceCount++;
      }
      first = false;
    }

    if(this.instanceCount >= this.maxInstances) {
      this.endBatch();
    }
  }


  drawSimpleRectangle(ele, eleIndex, type) {
    if(!ele.visible()) {
      return;
    }
    const { atlasManager } = this;

    const instance = this.instanceCount;
    this.vertTypeBuffer.getView(instance)[0] = RECTANGLE;

    const indexView = this.indexBuffer.getView(instance);
    util.indexToVec4(eleIndex, indexView);

    const color = ele.pstyle('background-color').value;
    const opacity = ele.pstyle('background-opacity').value;

    const colorView = this.colorBuffer.getView(instance);
    util.toWebGLColor(color, opacity, colorView);

    const matrixView = this.transformBuffer.getMatrixView(instance);
    atlasManager.setTransformMatrix(ele, matrixView, type);

    this.rectangleCount++;
    this.instanceCount++;
    if(this.instanceCount >= this.maxInstances) {
      this.endBatch();
    }
  }

  
  drawEdgeArrow(edge, eleIndex, prefix) {
    if(!edge.visible()) {
      return;
    }
    // Edge points and arrow angles etc are calculated by the base renderer and cached in the rscratch object.
    const rs = edge._private.rscratch;

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

    // check shape after the x/y check because pstyle() is a bit slow
    const arrowShape = edge.pstyle(prefix + '-arrow-shape').value;
    if(arrowShape === 'none' ) {
      return; 
    }

    const color = edge.pstyle(prefix + '-arrow-color').value;

    const baseOpacity = edge.pstyle('opacity').value;
    const lineOpacity = edge.pstyle('line-opacity').value;
    const opacity = baseOpacity * lineOpacity;

    const lineWidth = edge.pstyle('width').pfValue;
    const scale = edge.pstyle('arrow-scale').value;
    const size = this.r.getArrowWidth(lineWidth, scale);

    const instance = this.instanceCount;
    
    const transform = this.transformBuffer.getMatrixView(instance);

    mat3.identity(transform);
    mat3.translate(transform, transform, [x, y]);
    mat3.scale(transform, transform, [size, size]);
    mat3.rotate(transform, transform, angle);

    this.vertTypeBuffer.getView(instance)[0] = EDGE_ARROW;

    const indexView = this.indexBuffer.getView(instance);
    util.indexToVec4(eleIndex, indexView);

    const colorView = this.colorBuffer.getView(instance);
    util.toWebGLColor(color, opacity, colorView);

    this.instanceCount++;
    if(this.instanceCount >= this.maxInstances) {
      this.endBatch();
    }
  }


  drawEdgeLine(edge, eleIndex) {
    if(!edge.visible()) {
      return;
    }
    const points = this.getEdgePoints(edge);
    if(!points) {
      return;
    }

    // line style
    const baseOpacity = edge.pstyle('opacity').value;
    const lineOpacity = edge.pstyle('line-opacity').value;
    const width = edge.pstyle('width').pfValue;
    const color = edge.pstyle('line-color').value;
    const opacity = baseOpacity * lineOpacity;

    if(points.length/2 + this.instanceCount > this.maxInstances) {
      this.endBatch();
    }

    if(points.length == 4) { // straight line
      const instance = this.instanceCount;

      this.vertTypeBuffer.getView(instance)[0] = EDGE_STRAIGHT;

      const indexView = this.indexBuffer.getView(instance);
      util.indexToVec4(eleIndex, indexView);
      const colorView = this.colorBuffer.getView(instance);
      util.toWebGLColor(color, opacity, colorView);
      const lineWidthBuffer = this.lineWidthBuffer.getView(instance);
      lineWidthBuffer[0] = width;

      const sourceTargetView = this.pointAPointBBuffer.getView(instance);
      sourceTargetView[0] = points[0]; // source x
      sourceTargetView[1] = points[1]; // source y
      sourceTargetView[2] = points[2]; // target x
      sourceTargetView[3] = points[3]; // target y

      this.instanceCount++;
      if(this.instanceCount >= this.maxInstances) {
        this.endBatch();
      }

    } else { // curved line
      for(let i = 0; i < points.length-2; i += 2) {
        const instance = this.instanceCount;

        this.vertTypeBuffer.getView(instance)[0] = EDGE_CURVE_SEGMENT;

        const indexView = this.indexBuffer.getView(instance);
        util.indexToVec4(eleIndex, indexView);
        const colorView = this.colorBuffer.getView(instance);
        util.toWebGLColor(color, opacity, colorView);
        const lineWidthBuffer = this.lineWidthBuffer.getView(instance);
        lineWidthBuffer[0] = width;

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

        const pointABView = this.pointAPointBBuffer.getView(instance);
        pointABView[0] = pAx;
        pointABView[1] = pAy;
        pointABView[2] = pBx;
        pointABView[3] = pBy;

        const pointCDView = this.pointCPointDBuffer.getView(instance);
        pointCDView[0] = pCx;
        pointCDView[1] = pCy;
        pointCDView[2] = pDx;
        pointCDView[3] = pDy;

        this.instanceCount++;
        if(this.instanceCount >= this.maxInstances) {
          this.endBatch();
        }
      }
    }
  }
  
  getEdgePoints(edge) {
    const rs = edge._private.rscratch;

    // if bezier ctrl pts can not be calculated, then die
    if( rs.badLine || rs.allpts == null || isNaN(rs.allpts[0]) ){ // isNaN in case edge is impossible and browser bugs (e.g. safari)
      return;
    }
    const controlPoints = rs.allpts;
    if(controlPoints.length == 4) {
      return controlPoints;
    }
    const numSegments = this.getNumSegments(edge);
    return this.getCurveSegmentPoints(controlPoints, numSegments);
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
    // note: segments don't need to be evenly spaced out, it might make sense to have shorter segments nearer to the control points
    const numSegments = 15;
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
        const t = i / segments; // segments have equal length, its not strictly necessary to do it this way
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

    const atlases = this.atlasManager.getAtlases();
    // must buffer before activating texture units
    for(let i = 0; i < atlases.length; i++) {
      atlases[i].bufferIfNeeded(gl);
    }
    // Activate all the texture units that we need
    for(let i = 0; i < atlases.length; i++) {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, atlases[i].texture);
      gl.uniform1i(program.uTextures[i], i);
    }

    // Set the uniforms
    gl.uniformMatrix3fv(program.uPanZoomMatrix, false, this.panZoomMatrix);
    gl.uniform1i(program.uAtlasSize, this.atlasManager.getAtlasSize());
    // set background color, needed for edge arrow color blending
    const webglBgColor = util.toWebGLColor(this.bgColor, 1);
    gl.uniform4fv(program.uBGColor, webglBgColor);

    // draw!
    gl.drawArraysInstanced(gl.TRIANGLES, 0, vertexCount, count);

    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null); // TODO is this right when having multiple texture units?

    if(this.debug) {
      this.batchDebugInfo.push({
        count, // instance count
        atlasCount: atlases.length
      });
    }

    // start the next batch, even if not needed
    this.startBatch();
  }


  getDebugInfo() {
    const atlasInfo = this.atlasManager.getDebugInfo();
    const totalAtlases = atlasInfo.reduce((count, info) => count + info.atlasCount, 0);

    const batchInfo = this.batchDebugInfo;
    const totalInstances = batchInfo.reduce((count, info) => count + info.count, 0);

    return {
      atlasInfo,
      totalAtlases,
      wrappedCount: this.wrappedCount,
      rectangleCount: this.rectangleCount,
      batchCount: batchInfo.length,
      batchInfo,
      totalInstances
    };
  }

}
