import * as util from './webgl-util';
import { mat3 } from 'gl-matrix';
import { RENDER_TARGET } from './defaults';
import { AtlasManager } from './atlas';

// Vertex types
const EDGE_STRAIGHT = 0;
const EDGE_CURVE_SEGMENT = 1;
const TEXTURE = 2;


export class ElementDrawingWebGL {

  /** 
   * @param {WebGLRenderingContext} gl 
   */
  constructor(r, gl, opts) {
    this.r = r;
    this.gl = gl;
    
    this.maxInstances = opts.webglBatchSize;
    this.maxAtlases = opts.webglTexPerBatch;
    this.atlasSize = opts.webglTexSize;
    this.bgColor = opts.bgColor;

    opts.enableWrapping = true;
    this.atlasManager = new AtlasManager(r, opts);

    this.program = this.createShaderProgram(RENDER_TARGET.SCREEN);
    this.pickingProgram = this.createShaderProgram(RENDER_TARGET.PICKING);

    this.vao = this.createVAO();

    this.debugInfo = [];
  }

  addTextureRenderType(type, opts) {
    this.atlasManager.addRenderType(type, opts);
  }

  invalidate(eles, { type } = {}) {
    // const testEle = ele => ele.isNode();
    // // TODO, will need to add support for edges 
    // const testType = type ? t => t === type : null; 
    // const forceRedraw = type ? true : false;
    // return this.atlasManager.invalidate(eles, { testEle, testType, forceRedraw });
  }

  gc() {
    // this.atlasManager.gc();
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

      // what are we rendering?
      in int aVertType;

      // for picking
      in vec4 aIndex;
      
      // For textures
      in int aAtlasId; // which shader unit/atlas to use
      in vec4 aTex1; // x/y/w/h of texture in atlas
      in vec4 aTex2; 
      in vec4 aTex1ScaleRotate;  // vectors use fewer attributes than matrices
      in vec2 aTex1Translate;
      in vec4 aTex2ScaleRotate;
      in vec2 aTex2Translate;

      // for edges
      in vec4 aPointAPointB;
      in vec4 aPointCPointD;
      in float aLineWidth;
      in vec4  aLineColor;

      out vec2 vTexCoord;
      out vec4 vEdgeColor;
      flat out int vAtlasId;
      flat out vec4 vIndex;
      flat out int vVertType;

      void main(void) {
        int vid = gl_VertexID;
        vec2 position = aPosition;

        if(aVertType == ${TEXTURE}) {
          float texX;
          float texY;
          float texW;
          float texH;
          mat3  texMatrix;

          int vid = gl_VertexID;
          if(vid <= 5) {
            texX = aTex1.x;
            texY = aTex1.y;
            texW = aTex1.z;
            texH = aTex1.w;
            texMatrix = mat3(
              vec3(aTex1ScaleRotate.xy, 0.0),
              vec3(aTex1ScaleRotate.zw, 0.0),
              vec3(aTex1Translate,      1.0)
            );
          } else {
            texX = aTex2.x;
            texY = aTex2.y;
            texW = aTex2.z;
            texH = aTex2.w;
            texMatrix = mat3(
              vec3(aTex2ScaleRotate.xy, 0.0),
              vec3(aTex2ScaleRotate.zw, 0.0),
              vec3(aTex2Translate,      1.0)
            );
          }

          if(vid == 1 || vid == 2 || vid == 4 || vid == 7 || vid == 8 || vid == 10) {
            texX += texW;
          }
          if(vid == 2 || vid == 4 || vid == 5 || vid == 8 || vid == 10 || vid == 11) {
            texY += texH;
          }

          float d = float(uAtlasSize);
          vTexCoord = vec2(texX / d, texY / d); // tex coords must be between 0 and 1

          gl_Position = vec4(uPanZoomMatrix * texMatrix * vec3(position, 1.0), 1.0);
        } 
        else if(aVertType == ${EDGE_STRAIGHT} && vid < 6) {
          vec2 source = aPointAPointB.xy;
          vec2 target = aPointAPointB.zw;

          // adjust the geometry so that the line is centered on the edge
          position.y = position.y - 0.5;

          vec2 xBasis = target - source;
          vec2 yBasis = normalize(vec2(-xBasis.y, xBasis.x));
          vec2 point = source + xBasis * position.x + yBasis * aLineWidth * position.y;

          gl_Position = vec4(uPanZoomMatrix * vec3(point, 1.0), 1.0);
          vEdgeColor = aLineColor;
        } 
        else if(aVertType == ${EDGE_CURVE_SEGMENT} && vid < 6) {
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

          vEdgeColor = aLineColor;
        } else {
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

      in vec2 vTexCoord;
      in vec4 vEdgeColor;
      flat in int vAtlasId;
      flat in vec4 vIndex;
      flat in int vVertType;

      out vec4 outColor;

      void main(void) {
        if(vVertType == ${TEXTURE}) {
          ${idxs.map(i => `if(vAtlasId == ${i}) outColor = texture(uTexture${i}, vTexCoord);`).join('\n\telse ')}
        } else {
          outColor = vEdgeColor;
        }

        ${ renderTarget.picking
          ? `if(outColor.a == 0.0) discard;
             else outColor = vIndex;`
          : ''
        }
      }
    `;

    const program = util.createProgram(gl, vertexShaderSource, fragmentShaderSource);

    // attributes
    program.aPosition = gl.getAttribLocation(program, 'aPosition');

    program.aIndex    = gl.getAttribLocation(program, 'aIndex');
    program.aVertType = gl.getAttribLocation(program, 'aVertType');

    program.aAtlasId     = gl.getAttribLocation(program, 'aAtlasId');
    program.aTex1        = gl.getAttribLocation(program, 'aTex1');
    program.aTex2        = gl.getAttribLocation(program, 'aTex2');
    program.aTex1ScaleRotate = gl.getAttribLocation(program, 'aTex1ScaleRotate');
    program.aTex1Translate   = gl.getAttribLocation(program, 'aTex1Translate');
    program.aTex2ScaleRotate = gl.getAttribLocation(program, 'aTex2ScaleRotate');
    program.aTex2Translate   = gl.getAttribLocation(program, 'aTex2Translate');

    program.aPointAPointB   = gl.getAttribLocation(program, 'aPointAPointB');
    program.aPointCPointD   = gl.getAttribLocation(program, 'aPointCPointD');
    program.aLineWidth      = gl.getAttribLocation(program, 'aLineWidth');
    program.aLineColor      = gl.getAttribLocation(program, 'aLineColor');

    // uniforms
    program.uPanZoomMatrix = gl.getUniformLocation(program, 'uPanZoomMatrix');
    program.uAtlasSize     = gl.getUniformLocation(program, 'uAtlasSize');

    program.uTextures = [];
    for(let i = 0; i < this.atlasManager.maxAtlases; i++) {
      program.uTextures.push(gl.getUniformLocation(program, `uTexture${i}`));
    }

    return program;
  }

  createVAO() {
    const quad = [
      0, 0,  1, 0,  1, 1,
      0, 0,  1, 1,  0, 1,
    ];

    // a texture is split into two parts if it wraps in the atlas
    const instanceGeometry = [
      ...quad, 
      ...quad
    ];

    this.vertexCount = instanceGeometry.length / 2;
    const n = this.maxInstances;
    const { gl, program } = this;

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    util.createBufferStaticDraw(gl, 'vec2', program.aPosition, instanceGeometry);
    
    // Create buffers for all the attributes
    this.indexBuffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aIndex);
    this.vertTypeBuffer = util.createBufferDynamicDraw(gl, n, 'int', program.aVertType);
    this.atlasIdBuffer = util.createBufferDynamicDraw(gl, n, 'int', program.aAtlasId);
    this.tex1Buffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aTex1);
    this.tex2Buffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aTex2);
    this.tex1ScaleRotateBuffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aTex1ScaleRotate);
    this.tex1TranslateBuffer = util.createBufferDynamicDraw(gl, n, 'vec2', program.aTex1Translate);
    this.tex2ScaleRotateBuffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aTex2ScaleRotate);
    this.tex2TranslateBuffer = util.createBufferDynamicDraw(gl, n, 'vec2', program.aTex2Translate);
    this.pointAPointBBuffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aPointAPointB);
    this.pointCPointDBuffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aPointCPointD);
    this.lineWidthBuffer = util.createBufferDynamicDraw(gl, n, 'float', program.aLineWidth);
    this.lineColorBuffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aLineColor);

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
    this.startBatch();
  }

  startBatch() {
    this.instanceCount = 0;
    this.atlasManager.startBatch();
  }

  endFrame() {
    this.endBatch();
  }

  drawTexture(ele, eleIndex, type) {
    const { atlasManager } = this;
    if(!atlasManager.isRenderable(ele, type)) {
      return;
    }
    if(!atlasManager.canAddToCurrentBatch(ele, type)) {
      this.endBatch(); // draws then starts a new batch
    }
    
    const instance = this.instanceCount;

    this.vertTypeBuffer.getView(instance)[0] = TEXTURE;

    const indexView = this.indexBuffer.getView(instance);
    util.indexToVec4(eleIndex, indexView);

    const atlasInfo = atlasManager.getAtlasInfo(ele, type);
    const { atlasID, tex1, tex2 } = atlasInfo;

    // Set values in the buffers using Typed Array Views for performance.
    const atlasIdView = this.atlasIdBuffer.getView(instance);
    atlasIdView[0] = atlasID;
    
    const tex1View = this.tex1Buffer.getView(instance);
    tex1View[0] = tex1.x;
    tex1View[1] = tex1.y;
    tex1View[2] = tex1.w;
    tex1View[3] = tex1.h;

    const tex2View = this.tex2Buffer.getView(instance);
    tex2View[0] = tex2.x;
    tex2View[1] = tex2.y;
    tex2View[2] = tex2.w;
    tex2View[3] = tex2.h;

    const transform = this.tempMatrix = this.tempMatrix || mat3.create();

    for(const tex of [1, 2]) {
      atlasManager.setTransformMatrix(transform, atlasInfo, ele, tex === 1);

      const scaleRotateView = this[`tex${tex}ScaleRotateBuffer`].getView(instance);
      scaleRotateView[0] = transform[0];
      scaleRotateView[1] = transform[1];
      scaleRotateView[2] = transform[3];
      scaleRotateView[3] = transform[4];

      const translateView = this[`tex${tex}TranslateBuffer`].getView(instance);
      translateView[0] = transform[6];
      translateView[1] = transform[7];
    }

    this.instanceCount++;

    if(this.instanceCount >= this.maxInstances) {
      this.endBatch();
    }
  }

  drawEdge(edge, eleIndex) {
    // line style
    const baseOpacity = edge.pstyle('opacity').value;
    const lineOpacity = edge.pstyle('line-opacity').value;
    const width = edge.pstyle('width').pfValue;
    const color = edge.pstyle('line-color').value;
    const opacity = baseOpacity * lineOpacity;

    const bufferStyleAndIndex = (instance) => {
      const indexView = this.indexBuffer.getView(instance);
      util.indexToVec4(eleIndex, indexView);

      const lineColorView = this.lineColorBuffer.getView(instance);
      util.toWebGLColor(color, opacity, lineColorView);

      const lineWidthBuffer = this.lineWidthBuffer.getView(instance);
      lineWidthBuffer[0] = width;
    };

    const points = this.getEdgePoints(edge);

    if(points.length/2 + this.instanceCount > this.maxInstances) {
      this.endBatch();
    }

    if(points.length == 4) { // straight line
      const instance = this.instanceCount;
      
      this.vertTypeBuffer.getView(instance)[0] = EDGE_STRAIGHT;

      const sourceTargetView = this.pointAPointBBuffer.getView(instance);
      sourceTargetView[0] = points[0]; // source x
      sourceTargetView[1] = points[1]; // source y
      sourceTargetView[2] = points[2]; // target x
      sourceTargetView[3] = points[3]; // target y

      bufferStyleAndIndex(instance);

      this.instanceCount++;

    } else { // curved line
      for(let i = 0; i < points.length-2; i += 2) {
        const instance = this.instanceCount;

        this.vertTypeBuffer.getView(instance)[0] = EDGE_CURVE_SEGMENT;

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

        bufferStyleAndIndex(instance);

        this.instanceCount++;
      }
    }
  }
  
  getEdgePoints(edge) {
    const rs = edge._private.rscratch;
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
    gl.uniform1i(program.uAtlasSize, this.atlasManager.atlasSize);

    // draw!
    gl.drawArraysInstanced(gl.TRIANGLES, 0, vertexCount, count);

    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null); // TODO is this right when having multiple texture units?

    if(this.debugInfo) {
      this.debugInfo.push({
        type: 'node',
        count,
        atlasCount: atlases.length
      });
    }

    // start the next batch, even if not needed
    this.startBatch();
  }

  getDebugInfo() {
    return this.debugInfo;
  }

  getAtlasDebugInfo() {
    return this.atlasManager.getDebugInfo();
  }

}
