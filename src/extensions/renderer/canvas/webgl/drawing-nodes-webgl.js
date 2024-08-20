// For rendering nodes
import * as util from './webgl-util';
import { defaults } from '../../../../util';
import { mat3 } from 'gl-matrix';
import { Atlas, AtlasControl } from './atlas';
import { RENDER_TARGET } from './drawing-redraw-webgl';

const initRenderTypeDefaults = defaults({
  getKey: null,
  drawElement: null,
  getBoundingBox: null,
  getRotation: null,
  getRotationPoint: null,
  getRotationOffset: null,
  isVisible: null,
  getOverlayUnderlayStyle: null,
  isOverlayOrUnderlay: false,
});


export class NodeDrawing {

  /** 
   * @param {WebGLRenderingContext} gl 
   */
  constructor(r, gl, opts) {
    this.r = r;
    this.gl = gl;
    
    this.maxInstances = opts.webglBatchSize;
    this.maxAtlases = opts.webglTexPerBatch;
    this.atlasSize = opts.webglTexSize;
    opts.createTextureCanvas = util.createTextureCanvas;

    this.createAtlas = () => new Atlas(r, opts);
    this.createAtlasControl = () => new AtlasControl(r, opts);

    this.program = this.createShaderProgram(RENDER_TARGET.SCREEN);
    this.pickingProgram = this.createShaderProgram(RENDER_TARGET.PICKING);

    this.vao = this.createVAO();
    this.overlayUnderlay = this.initOverlayUnderlay(); // used for overlay/underlay shapes
    this.renderTypes = new Map(); // string -> object

    this.debugInfo = [];
  }

  addRenderType(type, options) {
    const atlasControl = this.createAtlasControl();
    const typeOpts = initRenderTypeDefaults(options);

    const renderTypeOpts = {
      type,
      atlasControl,
      ...typeOpts
    }

    this.renderTypes.set(type, renderTypeOpts);
  }

  getRenderTypes(includeOverlays = false) {
    const types = [];
    for(const opts of this.renderTypes.values()) {
      if(includeOverlays || !opts.isOverlayOrUnderlay) {
        types.push(opts);
      }
    }
    return types;
  }

  getRenderType(type) {
    return this.renderTypes.get(type);
  }

  invalidate(eles) {
    for(const ele of eles) {
      if(ele.isNode()) {
        for(const opts of this.getRenderTypes()) {
          const styleKey = opts.getKey(ele);
          const id = ele.id();
          opts.atlasControl.checkKey(id, styleKey);
        }
      }
    }
  }

  gc() {
    for(const opts of this.getRenderTypes()) {
      console.log('garbage collect ' + opts.type);
      opts.atlasControl.gc();
    }
  }

  initOverlayUnderlay() {
    const { r } = this;
    const atlas = this.createAtlas();

    const size = 100;
    const center = size / 2;
    const bb = { w: size, h: size };
    
    // TODO These textures have same width and height. This causes rounded corners 
    // to look stretched when applied to wider nodes. We could create more textures with different
    // widths, then choose the one that's closest to the node to minimize stretching. 
    // Also can rotate textures 90 degs for portrait orientation.

    // textures are white so that the overlay color is preserved when multiplying in the fragment shader
    atlas.draw(0, bb, (context) => {
      context.fillStyle = '#FFF';
      r.drawRoundRectanglePath(context, center, center, size, size, 15);
      context.fill();
    });
    
    atlas.draw(1, bb, (context) => {
      context.fillStyle = '#FFF';
      r.drawEllipsePath(context, center, center, size, size);
      context.fill();
    });
    
    const getTexKey = (shape) => {
      switch(shape) {
        case 'round-rectangle': case 'roundrectangle':
          return 0;
        case 'ellipse':
          return 1;
        default:
          return -1;
      }
    };

    return { atlas, getTexKey };
  }


  createShaderProgram(renderTarget) {
    const { gl } = this;

    // compute texture coordinates in the shader, becase we are using instanced drawing
    const vertexShaderSource = `#version 300 es
      precision highp float;

      uniform mat3 uPanZoomMatrix;
      uniform int  uAtlasSize;
      
      in vec2 aPosition; // instanced

      in vec4 aIndex;
      in vec4 aLayColor; // overlay/underlay color
      in int aAtlasId; // which shader unit/atlas to use
      in vec4 aTex1; // x/y/w/h of texture in atlas
      in vec4 aTex2; 

      in mat3 aNodeMatrix1;
      in mat3 aNodeMatrix2;

      out vec2 vTexCoord;
      flat out vec4 vLayColor;
      flat out int vAtlasId;
      flat out vec4 vIndex;

      void main(void) {
        int vid = gl_VertexID;

        float texX;
        float texY;
        float texW;
        float texH;
        mat3  nodeMatrix;

        if(vid <= 5) {
          texX = aTex1.x;
          texY = aTex1.y;
          texW = aTex1.z;
          texH = aTex1.w;
          nodeMatrix = aNodeMatrix1;
        } else {
          texX = aTex2.x;
          texY = aTex2.y;
          texW = aTex2.z;
          texH = aTex2.w;
          nodeMatrix = aNodeMatrix2;
        }

        if(vid == 2 || vid == 3 || vid == 5 || vid == 8 || vid == 9 || vid == 11) {
          texX += texW;
        }
        if(vid == 1 || vid == 4 || vid == 5 || vid == 7 || vid == 10 || vid == 11) {
          texY += texH;
        }

        float d = float(uAtlasSize);
        vTexCoord = vec2(texX / d, texY / d); // tex coords must be between 0 and 1

        vAtlasId = aAtlasId;
        vLayColor = aLayColor;
        vIndex = aIndex;

        gl_Position = vec4(uPanZoomMatrix * nodeMatrix * vec3(aPosition, 1.0), 1.0);
      }
    `;

    const idxs = Array.from({ length: this.maxAtlases }, (v,i) => i);

    const fragmentShaderSource = `#version 300 es
      precision highp float;

      // define texture unit for each node in the batch
      ${idxs.map(i => `uniform sampler2D uTexture${i};`).join('\n\t')}

      in vec2 vTexCoord;
      flat in int vAtlasId;
      flat in vec4 vLayColor;
      flat in vec4 vIndex;

      out vec4 outColor;

      void main(void) {
        vec4 texColor;
        ${idxs.map(i => `if(vAtlasId == ${i}) texColor = texture(uTexture${i}, vTexCoord);`).join('\n\telse ')}

        ${(() => {
          if(renderTarget.screen) {
            return `
              if(vLayColor.a == 0.0)
                outColor = texColor;
              else
                outColor = texColor * vLayColor;
            `;
          } else if(renderTarget.picking) {
            return `
              outColor = vIndex;
            `;
          }
        })()}
      }
    `;

    const program = util.createProgram(gl, vertexShaderSource, fragmentShaderSource);

    // attributes
    program.aPosition    = gl.getAttribLocation(program, 'aPosition');
    program.aIndex       = gl.getAttribLocation(program, 'aIndex');
    program.aNodeMatrix1 = gl.getAttribLocation(program, 'aNodeMatrix1');
    program.aNodeMatrix2 = gl.getAttribLocation(program, 'aNodeMatrix2');
    program.aAtlasId     = gl.getAttribLocation(program, 'aAtlasId');
    program.aLayColor    = gl.getAttribLocation(program, 'aLayColor');
    program.aTex1        = gl.getAttribLocation(program, 'aTex1');
    program.aTex2        = gl.getAttribLocation(program, 'aTex2');

    // uniforms
    program.uPanZoomMatrix = gl.getUniformLocation(program, 'uPanZoomMatrix');
    program.uAtlasSize     = gl.getUniformLocation(program, 'uAtlasSize');

    program.uTextures = [];
    for(let i = 0; i < this.maxAtlases; i++) {
      program.uTextures.push(gl.getUniformLocation(program, `uTexture${i}`));
    }

    return program;
  }


  createVAO() {
    const quad = [
      0, 0,  0, 1,  1, 0,
      1, 0,  0, 1,  1, 1,
    ];
    const instanceGeometry = [
      ...quad, // a texture is split into two parts if it wraps in the atlas
      ...quad
    ];

    this.vertexCount = instanceGeometry.length / 2;
    const n = this.maxInstances;
    const { gl, program } = this;

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    util.createBufferStaticDraw(gl, 'vec2', program.aPosition, instanceGeometry);
    
    this.matrixBuffer1 = util.create3x3MatrixBufferDynamicDraw(gl, n, program.aNodeMatrix1);
    this.matrixBuffer2 = util.create3x3MatrixBufferDynamicDraw(gl, n, program.aNodeMatrix2);
    
    this.indexBuffer    = util.createBufferDynamicDraw(gl, n, 'vec4',  program.aIndex);
    this.atlasIdBuffer  = util.createBufferDynamicDraw(gl, n, 'int',  program.aAtlasId);
    this.layColorBuffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aLayColor);
    this.tex1Buffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aTex1);
    this.tex2Buffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aTex2);

    gl.bindVertexArray(null);
    return vao;
  }
  
  getOrCreateAtlas(node, bb, opts) {
    const { atlasControl } = opts;
    const styleKey = opts.getKey(node);
    const id = node.id();

    const atlas = atlasControl.draw(id, styleKey, bb, context => {
      opts.drawElement(context, node, bb, true, false);
    });

    return atlas;
  }

  /**
   * Adjusts the BB to accomodate padding and split for wrapped textures.
   */
  getAdjustedBB(bb, padding, first, ratio) {
    let { x1, y1, w, h } = bb;

    if(padding) {
      x1 -= padding;
      y1 -= padding;
      w += 2 * padding;
      h += 2 * padding;
    }

    let xOffset = 0;
    const adjW = w * ratio;

    if(first && ratio < 1) {
      w = adjW;
    } else if(!first && ratio < 1) {
      xOffset = w - adjW;
      x1 += xOffset;
      w = adjW;
    }

    return { x1, y1, w, h, xOffset };
  }

  /**
   * matrix is expected to be a 9 element array
   * this function follows same pattern as CRp.drawCachedElementPortion(...)
   */
  setTransformMatrix(matrix, node, bb, opts, padding, first, ratio) {
    const adjBB = this.getAdjustedBB(bb, padding, first, ratio);

    let x, y;
    mat3.identity(matrix);

    const theta = opts.getRotation(node);
    if(theta !== 0) {
      const { x:sx, y:sy } = opts.getRotationPoint(node);
      mat3.translate(matrix, matrix, [sx, sy]);
      mat3.rotate(matrix, matrix, theta);

      const offset = opts.getRotationOffset(node);

      x = offset.x + adjBB.xOffset;
      y = offset.y
    } else {
      x = adjBB.x1;
      y = adjBB.y1;
    }

    mat3.translate(matrix, matrix, [x, y]);
    mat3.scale(matrix, matrix, [adjBB.w, adjBB.h]);
  }


  startFrame(panZoomMatrix, debugInfo, renderTarget = RENDER_TARGET.SCREEN) {
    this.panZoomMatrix = panZoomMatrix
    this.debugInfo = debugInfo;
    this.renderTarget = renderTarget;
  }

  startBatch() {
    this.instanceCount = 0;
    this.atlases = []; // up to 16 texture units for a draw call
  }

  draw(node, index, type) {
    const opts = this.renderTypes.get(type);
    if(!opts.isVisible(node))
      return;

    const bb = opts.getBoundingBox(node); // there may be overhead calling this, only call once per node

    const bufferInstanceData = (atlasID, tex1, tex2, padding=0, layColor=[0, 0, 0, 0]) => {
      const i = this.instanceCount;
      this.atlasIdBuffer.setData([atlasID], i);
      this.indexBuffer.setData(util.indexToVec4(index), i);
      this.tex1Buffer.setBB(tex1, i);
      this.tex2Buffer.setBB(tex2, i);
      this.layColorBuffer.setData(layColor, i);

      const tex1ratio = tex1.w / (tex1.w + tex2.w);
      const tex2ratio = 1 - tex1ratio;

      // pass the array view to setTransformMatrix
      const matrix1 = this.matrixBuffer1.getMatrixView(i);
      this.setTransformMatrix(matrix1, node, bb, opts, padding, true,  tex1ratio);
      const matrix2 = this.matrixBuffer2.getMatrixView(i);
      this.setTransformMatrix(matrix2, node, bb, opts, padding, false, tex2ratio);

      this.instanceCount++;
    };

    const getAtlasIdForBatch = (atlas) => {
      let atlasID = this.atlases.indexOf(atlas);
      if(atlasID < 0) {
        if(this.atlases.length === this.maxAtlases) {
           // If we run out of space for textures in the current batch then start a new batch
          this.endBatch();
        }
        this.atlases.push(atlas);
        atlasID = this.atlases.length - 1;
      }
      return atlasID;
    };

    const drawBodyOrLabel = () => {
      const styleKey = opts.getKey(node);
      const atlas = this.getOrCreateAtlas(node, bb, opts);
      const atlasID = getAtlasIdForBatch(atlas);
      const [ tex1, tex2 ] = atlas.getOffsets(styleKey);
      
      bufferInstanceData(atlasID, tex1, tex2);
    };

    const drawOverlayUnderlay = () => {
      const style = opts.getOverlayUnderlayStyle(node);
      const { opacity, color, shape, padding } = style; // Ignore radius for now

      const styleKey = this.overlayUnderlay.getTexKey(shape);
      if(styleKey < 0)
        return;

      const { atlas } = this.overlayUnderlay;
      const atlasID = getAtlasIdForBatch(atlas);
      const [ tex1, tex2 ] = atlas.getOffsets(styleKey);
      const webglColor = util.toWebGLColor(color, opacity);

      bufferInstanceData(atlasID, tex1, tex2, padding, webglColor);
    }

    if(opts.isOverlayOrUnderlay) {
      drawOverlayUnderlay();
    } else {
      drawBodyOrLabel();
    }

    if(this.instanceCount >= this.maxInstances) {
      this.endBatch();
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

    // upload the new matrix data
    this.indexBuffer.bufferSubData(count);
    this.matrixBuffer1.bufferSubData(count);
    this.matrixBuffer2.bufferSubData(count);
    this.atlasIdBuffer.bufferSubData(count);
    this.layColorBuffer.bufferSubData(count);
    this.tex1Buffer.bufferSubData(count);
    this.tex2Buffer.bufferSubData(count);

    // Activate all the texture units that we need
    for(let i = 0; i < this.atlases.length; i++) {
      const atlas = this.atlases[i]; 
      atlas.bufferIfNeeded(gl, util); // buffering textures can take a long time

      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, atlas.texture);
      gl.uniform1i(program.uTextures[i], i);
    }

    // Set the uniforms
    gl.uniformMatrix3fv(program.uPanZoomMatrix, false, this.panZoomMatrix);
    gl.uniform1i(program.uAtlasSize, this.atlasSize);

    // draw!
    gl.drawArraysInstanced(gl.TRIANGLES, 0, vertexCount, count);

    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null); // TODO is this right when having multiple texture units?

    // debug
    // const nodeContext = this.r.data.contexts[this.r.NODE];
    // nodeContext.save();
    // nodeContext.setTransform(1, 0, 0, 1, 0, 0);
    // nodeContext.scale(0.25, 0.25);
    // nodeContext.drawImage(this.atlases[1].canvas, 0, 0);
    // nodeContext.restore();

    if(this.debugInfo) {
      this.debugInfo.push({
        type: 'node',
        count,
        atlasCount: this.atlases.length
      });
    }

    // start the next batch, even if not needed
    this.startBatch();
  }


  getAtlasDebugInfo() {
    const debugInfo = [];
    for(let [ type, opts ] of this.renderTypes) {
      if(!opts.isOverlayOrUnderlay) {
        const { keyCount, atlasCount } = opts.atlasControl.getCounts();
        debugInfo.push({ type, keyCount, atlasCount });
      }
    }
    return debugInfo;
  }s

  getDebugInfo() {
    return this.debugInfo;
  }

}
