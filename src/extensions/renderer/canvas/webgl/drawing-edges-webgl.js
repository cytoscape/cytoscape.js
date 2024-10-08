import * as util from './webgl-util';
import { mat3 } from 'gl-matrix';
import { AtlasManager } from './atlas';
import { RENDER_TARGET } from './drawing-redraw-webgl';
import { initRenderTypeDefaults } from './drawing-redraw-webgl';

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
const LABEL = 3;


export class EdgeDrawing {

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

    this.labelOpts = initRenderTypeDefaults(labelRenderOptions);

    // with the current strategy we don't have enough shader attributes for wrapped textures
    this.atlasManager = new AtlasManager(r, { ...opts, enableWrapping: false }); // for labels
    this.atlasManager.addRenderType('edge-label', labelRenderOptions);

    this.program = this.createShaderProgram(RENDER_TARGET.SCREEN);
    this.pickingProgram = this.createShaderProgram(RENDER_TARGET.PICKING);

    this.vao = this.createVAO();
  }

  invalidate(eles) {
    this.atlasManager.invalidate(eles, ele => ele.isNode());
  }

  gc() {
    this.atlasCollection.gc();
  }

  createShaderProgram(renderTarget) {
    // see https://wwwtyro.net/2019/11/18/instanced-lines.html
    const { gl } = this;

    const vertexShaderSource = `#version 300 es
      precision highp float;

      uniform mat3 uPanZoomMatrix;
      uniform int  uAtlasSize;

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
      in vec4 aSourceArrowScaleRotate;  // vectors use fewer attributes than matrices
      in vec2 aSourceArrowTranslate;
      in vec4 aTargetArrowScaleRotate;
      in vec2 aTargetArrowTranslate;

      // labels
      in int aAtlasId; // which shader unit/atlas to use
      in vec4 aTex; // x/y/w/h of texture in atlas
      in vec4 aLabelScaleRotate;
      in vec2 aLabelTranslate;

      out vec4 vColor;
      flat out vec4 vIndex;
      flat out float vVertType;

      flat out int vAtlasId;
      out vec2 vTexCoord;

      void main(void) {
        vec3  position = vec3(aPositionType.xy, 1.0);
        float vertType = aPositionType.z;

        if(vertType == ${LABEL}.0) {
          int vid = gl_VertexID;
          float texX = aTex.x;
          float texY = aTex.y;
          float texW = aTex.z;
          float texH = aTex.w;

          if(vid == 14 || vid == 15 || vid == 17 ) {
            texX += texW;
          }
          if(vid == 13 || vid == 16 || vid == 17) {
            texY += texH;
          }

          float d = float(uAtlasSize);
          vTexCoord = vec2(texX / d, texY / d); // tex coords must be between 0 and 1
          vAtlasId = aAtlasId;

          mat3 transform = mat3(
            vec3(aLabelScaleRotate.xy, 0.0),
            vec3(aLabelScaleRotate.zw, 0.0),
            vec3(aLabelTranslate,      1.0)
          );
          gl_Position = vec4(uPanZoomMatrix * transform * position, 1.0);
        } 
        else if(vertType == ${LINE}.0) {
          vec2 source = aSourceTarget.xy;
          vec2 target = aSourceTarget.zw;
          vec2 xBasis = target - source;
          vec2 yBasis = normalize(vec2(-xBasis.y, xBasis.x));
          vec2 point = source + xBasis * position.x + yBasis * aLineWidth * position.y;
          gl_Position = vec4(uPanZoomMatrix * vec3(point, 1.0), 1.0);
          vColor = aLineColor;
        } 
        else if(vertType == ${SOURCE_ARROW}.0 && aSourceArrowColor.a > 0.0) {
          mat3 transform = mat3(
            vec3(aSourceArrowScaleRotate.xy, 0.0),
            vec3(aSourceArrowScaleRotate.zw, 0.0),
            vec3(aSourceArrowTranslate,      1.0)
          );
          gl_Position = vec4(uPanZoomMatrix * transform * position, 1.0);
          vColor = aSourceArrowColor;
        }
        else if(vertType == ${TARGET_ARROW}.0 && aTargetArrowColor.a > 0.0) {
          mat3 transform = mat3(
            vec3(aTargetArrowScaleRotate.xy, 0.0),
            vec3(aTargetArrowScaleRotate.zw, 0.0),
            vec3(aTargetArrowTranslate,      1.0)
          );
          gl_Position = vec4(uPanZoomMatrix * transform * position, 1.0);
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

    const idxs = this.atlasManager.getIndexArray();

    const fragmentShaderSource = `#version 300 es
      precision highp float;

      uniform vec4 uBGColor;

      // define texture unit for each node in the batch
      ${idxs.map(i => `uniform sampler2D uTexture${i};`).join('\n\t')}

      in vec4 vColor;
      flat in vec4 vIndex;
      flat in float vVertType;

      // labels
      in vec2 vTexCoord;
      flat in int vAtlasId;

      out vec4 outColor;

      void main(void) {
        if(vVertType == ${LABEL}.0) {
          ${idxs.map(i => `if(vAtlasId == ${i}) outColor = texture(uTexture${i}, vTexCoord);`).join('\n\telse ')}
        }
        else if(vVertType == ${SOURCE_ARROW}.0 || vVertType == ${TARGET_ARROW}.0) {
          // blend arrow color with background (using premultiplied alpha)
          outColor.rgb = vColor.rgb + (uBGColor.rgb * (1.0 - vColor.a)); 
          outColor.a = 1.0; // make opaque, masks out line under arrow
        } 
        else {
          outColor = vColor;
        }

        ${ renderTarget.picking
          ? `outColor = outColor.a == 0.0 ? vec4(0.0) : vIndex;` 
          : ''
        }
      }
    `;


    console.log(vertexShaderSource);
    console.log(fragmentShaderSource);
    const program = util.createProgram(gl, vertexShaderSource, fragmentShaderSource);

    program.aPositionType  = gl.getAttribLocation(program, 'aPositionType');

    program.aIndex        = gl.getAttribLocation(program, 'aIndex');
    program.aSourceTarget = gl.getAttribLocation(program, 'aSourceTarget');
    program.aLineWidth    = gl.getAttribLocation(program, 'aLineWidth');
    program.aLineColor    = gl.getAttribLocation(program, 'aLineColor');

    program.aSourceArrowColor = gl.getAttribLocation(program, 'aSourceArrowColor');
    program.aTargetArrowColor = gl.getAttribLocation(program, 'aTargetArrowColor');
    program.aSourceArrowScaleRotate = gl.getAttribLocation(program, 'aSourceArrowScaleRotate');
    program.aSourceArrowTranslate   = gl.getAttribLocation(program, 'aSourceArrowTranslate');
    program.aTargetArrowScaleRotate = gl.getAttribLocation(program, 'aTargetArrowScaleRotate');
    program.aTargetArrowTranslate   = gl.getAttribLocation(program, 'aTargetArrowTranslate');

    program.aAtlasId = gl.getAttribLocation(program, 'aAtlasId');
    program.aTex = gl.getAttribLocation(program, 'aTex');
    program.aLabelScaleRotate = gl.getAttribLocation(program, 'aLabelScaleRotate');
    program.aLabelTranslate = gl.getAttribLocation(program, 'aLabelTranslate');

    program.uPanZoomMatrix = gl.getUniformLocation(program, 'uPanZoomMatrix');
    program.uBGColor = gl.getUniformLocation(program, 'uBGColor');
    program.uAtlasSize = gl.getUniformLocation(program, 'uAtlasSize');

    program.uTextures = [];
    for(let i = 0; i < this.atlasManager.maxAtlases; i++) {
      program.uTextures.push(gl.getUniformLocation(program, `uTexture${i}`));
    }
    
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
    const label = [ // same as NodeDrawing
      0, 0, LABEL,
      0, 1, LABEL,
      1, 0, LABEL,
      1, 0, LABEL,
      0, 1, LABEL,
      1, 1, LABEL,
    ];

    const instanceGeometry = [ // order matters, back to front
      ...line,
      ...sourceArrow,
      ...targetArrow,
      ...label,
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
    this.sourceArrowScaleRotateBuffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aSourceArrowScaleRotate);
    this.sourceArrowTranslateBuffer   = util.createBufferDynamicDraw(gl, n, 'vec2', program.aSourceArrowTranslate);
    this.targetArrowScaleRotateBuffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aTargetArrowScaleRotate);
    this.targetArrowTranslateBuffer   = util.createBufferDynamicDraw(gl, n, 'vec2', program.aTargetArrowTranslate);

    this.atlasIdBuffer  = util.createBufferDynamicDraw(gl, n, 'int',  program.aAtlasId);
    this.texBuffer      = util.createBufferDynamicDraw(gl, n, 'vec4', program.aTex);
    this.labelScaleRotateBuffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aLabelScaleRotate);
    this.labelTranslateBuffer   = util.createBufferDynamicDraw(gl, n, 'vec2', program.aLabelTranslate);

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

    // reuse the same matrix for all arrows
    const transform = this.transformMatrix = this.transformMatrix || mat3.create();

    mat3.identity(transform);
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
    this.atlasManager.startBatch();
  }

  /**
   * This function gets the data needed to draw an edge and sets it into the buffers.
   * This function is called for evey edge on every frame, it is performance critical.
   * Set values in the buffers using Typed Array Views for performance.
   */
  draw(edge, eleIndex) {
    const { atlasManager } = this;

    let atlasInfo;
    if(atlasManager.isRenderable(edge, 'edge-label')) {
      if(!atlasManager.canAddToCurrentBatch(edge, 'edge-label')) {
        this.endBatch(); // draws then starts a new batch
      }
      atlasInfo = atlasManager.getAtlasInfo(edge, 'edge-label');
    }

    const instance = this.instanceCount;
    // Edge points and arrow angles etc are calculated by the base renderer and cached in the rscratch object.
    const rs = edge._private.rscratch;

    // source and target points
    const { allpts } = rs;
    const sourceTargetView = this.sourceTargetBuffer.getView(instance);
    sourceTargetView[0] = allpts[0]; // source x
    sourceTargetView[1] = allpts[1]; // source y
    sourceTargetView[2] = allpts[allpts.length-2]; // target x
    sourceTargetView[3] = allpts[allpts.length-1]; // target y
    
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

    // arrow colors and transforms
    for(const prefix of ['source', 'target']) {
      const arrowInfo = this.getArrowInfo(edge, width, prefix);
      const colorView = this[prefix+'ArrowColorBuffer'].getView(instance);
      if(arrowInfo) {
        const { color, transform } = arrowInfo; // transform is a 3x3 matrix

        const scaleRotateView = this[prefix+'ArrowScaleRotateBuffer'].getView(instance);
        scaleRotateView[0] = transform[0];
        scaleRotateView[1] = transform[1];
        scaleRotateView[2] = transform[3];
        scaleRotateView[3] = transform[4];

        const translateView = this[prefix+'ArrowTranslateBuffer'].getView(instance);
        translateView[0] = transform[6];
        translateView[1] = transform[7];

        util.toWebGLColor(color, opacity, colorView);
      } else {
        util.zeroColor(colorView);
      }
    };

    // labels
    if(atlasInfo) {
      const { atlasID, tex } = atlasInfo;

      const atlasIdView = this.atlasIdBuffer.getView(instance);
      atlasIdView[0] = atlasID;

      const texView = this.texBuffer.getView(instance);
      texView[0] = tex.x;
      texView[1] = tex.y;
      texView[2] = tex.w;
      texView[3] = tex.h;

      // TODO temporary, reuse a matrix object
      const transform = this.atlasManager.getTransformMatrix(atlasInfo, edge);

      const labelScaleRotateView = this.labelScaleRotateBuffer.getView(instance);
      labelScaleRotateView[0] = transform[0];
      labelScaleRotateView[1] = transform[1];
      labelScaleRotateView[2] = transform[3];
      labelScaleRotateView[3] = transform[4];

      const labelTranslateView = this.labelTranslateBuffer.getView(instance);
      labelTranslateView[0] = transform[6];
      labelTranslateView[1] = transform[7];
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
    this.sourceArrowScaleRotateBuffer.bufferSubData(count);
    this.sourceArrowTranslateBuffer.bufferSubData(count);
    this.targetArrowScaleRotateBuffer.bufferSubData(count);
    this.targetArrowTranslateBuffer.bufferSubData(count);
    this.atlasIdBuffer.bufferSubData(count);
    this.texBuffer.bufferSubData(count);
    this.labelScaleRotateBuffer.bufferSubData(count);
    this.labelTranslateBuffer.bufferSubData(count);

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

    // Set the projection matrix uniform
    gl.uniformMatrix3fv(program.uPanZoomMatrix, false, this.panZoomMatrix);
    gl.uniform1i(program.uAtlasSize, this.atlasManager.atlasSize);

    // set background color, needed for edge arrow color blending
    const webglBgColor = util.toWebGLColor(this.bgColor, 1);
    gl.uniform4fv(program.uBGColor, webglBgColor);

    // draw!
    gl.drawArraysInstanced(gl.TRIANGLES, 0, vertexCount, count);

    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    if(this.debugInfo) {
      this.debugInfo.push({ 
        type: 'edge',
        count,
        atlasCount: atlases.length
      });
    }
    
    // start another batch, even if not needed
    this.startBatch();
  }

  getDebugInfo() {
    return this.debugInfo;
  }

  getAtlasDebugInfo() {
    return this.atlasManager.getDebugInfo();
  }

}
