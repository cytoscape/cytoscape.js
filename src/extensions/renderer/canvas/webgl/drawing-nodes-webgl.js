// For rendering nodes
import * as util from './webgl-util';
import { defaults } from '../../../../util';
import { mat3 } from 'gl-matrix';
import { Atlas, AtlasCollection } from './atlas';
import { RENDER_TARGET } from './drawing-redraw-webgl';

const initRenderTypeDefaults = defaults({
  getKey: null,
  drawElement: null,
  getBoundingBox: null,
  getRotation: null,
  getRotationPoint: null,
  getRotationOffset: null,
  isVisible: null,
  getPadding: null,
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

    this.createAtlasCollection = () => new AtlasCollection(r, { ...opts, enableWrapping: true });

    this.program = this.createShaderProgram(RENDER_TARGET.SCREEN);
    this.pickingProgram = this.createShaderProgram(RENDER_TARGET.PICKING);

    this.vao = this.createVAO();
    this.renderTypes = new Map(); // string -> object

    this.debugInfo = [];
  }

  addRenderType(type, options) {
    const atlasCollection = this.createAtlasCollection();
    const typeOpts = initRenderTypeDefaults(options);

    const renderTypeOpts = {
      type,
      atlasCollection,
      ...typeOpts
    }

    this.renderTypes.set(type, renderTypeOpts);
  }

  getRenderTypes() {
    return [...this.renderTypes.values()];
  }

  getRenderType(type) {
    return this.renderTypes.get(type);
  }

  invalidate(eles) {
    for(const ele of eles) {
      if(ele.isNode()) {
        const id = ele.id();
        for(const opts of this.getRenderTypes()) {
          const styleKey = opts.getKey(ele);
          opts.atlasCollection.checkKey(id, styleKey);
        }
      }
    }
  }

  gc() {
    for(const opts of this.getRenderTypes()) {
      opts.atlasCollection.gc();
    }
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
      in int aAtlasId; // which shader unit/atlas to use
      in vec4 aTex1; // x/y/w/h of texture in atlas
      in vec4 aTex2; 

      in mat3 aNodeMatrix1;
      in mat3 aNodeMatrix2;

      out vec2 vTexCoord;
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
      flat in vec4 vIndex;

      out vec4 outColor;

      void main(void) {
        ${idxs.map(i => `if(vAtlasId == ${i}) outColor = texture(uTexture${i}, vTexCoord);`).join('\n\telse ')}

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

    // attributes
    program.aPosition    = gl.getAttribLocation(program, 'aPosition');
    program.aIndex       = gl.getAttribLocation(program, 'aIndex');
    program.aNodeMatrix1 = gl.getAttribLocation(program, 'aNodeMatrix1');
    program.aNodeMatrix2 = gl.getAttribLocation(program, 'aNodeMatrix2');
    program.aAtlasId     = gl.getAttribLocation(program, 'aAtlasId');
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
    
    this.indexBuffer    = util.createBufferDynamicDraw(gl, n, 'vec4', program.aIndex);
    this.atlasIdBuffer  = util.createBufferDynamicDraw(gl, n, 'int',  program.aAtlasId);
    this.tex1Buffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aTex1);
    this.tex2Buffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aTex2);

    gl.bindVertexArray(null);
    return vao;
  }
  
  
  getOrCreateAtlas(node, bb, opts) {
    const { atlasCollection } = opts;
    const styleKey = opts.getKey(node);
    const id = node.id();

    const atlas = atlasCollection.draw(id, styleKey, bb, context => {
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

    const theta = opts.getRotation ? opts.getRotation(node) : 0;
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

  getAtlasIdForBatch(atlas) {
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
  }

  draw(node, eleIndex, type) {
    const opts = this.renderTypes.get(type);
    if(!opts || !opts.isVisible(node))
      return;

    const styleKey = opts.getKey(node);
    if(styleKey === null)
      return;

    const bb = opts.getBoundingBox(node);
    const atlas = this.getOrCreateAtlas(node, bb, opts);
    const atlasID = this.getAtlasIdForBatch(atlas);
    const [ tex1, tex2 ] = atlas.getOffsets(styleKey);
    
    // Set values in the buffers using Typed Array Views for performance.
    const instance = this.instanceCount;
      
    const atlasIdView = this.atlasIdBuffer.getView(instance);
    atlasIdView[0] = atlasID;

    const indexView = this.indexBuffer.getView(instance);
    util.indexToVec4(eleIndex, indexView);
    
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

    const tex1ratio = tex1.w / (tex1.w + tex2.w);
    const tex2ratio = 1 - tex1ratio;
    const padding = opts.getPadding ? opts.getPadding(node) : 0; // TODO

    const matrix1View = this.matrixBuffer1.getMatrixView(instance);
    this.setTransformMatrix(matrix1View, node, bb, opts, padding, true,  tex1ratio);
    const matrix2View = this.matrixBuffer2.getMatrixView(instance);
    this.setTransformMatrix(matrix2View, node, bb, opts, padding, false, tex2ratio);

    this.instanceCount++;

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
    this.tex1Buffer.bufferSubData(count);
    this.tex2Buffer.bufferSubData(count);

    // make sure all textures are buffered, must be done before activating the texture units
    for(let i = 0; i < this.atlases.length; i++) {
      this.atlases[i].bufferIfNeeded(gl);
    }

    // Activate all the texture units that we need
    for(let i = 0; i < this.atlases.length; i++) {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, this.atlases[i].texture);
      gl.uniform1i(program.uTextures[i], i);
    }

    // Set the uniforms
    gl.uniformMatrix3fv(program.uPanZoomMatrix, false, this.panZoomMatrix);
    gl.uniform1i(program.uAtlasSize, this.atlasSize);

    // draw!
    gl.drawArraysInstanced(gl.TRIANGLES, 0, vertexCount, count);

    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null); // TODO is this right when having multiple texture units?

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
        const { keyCount, atlasCount } = opts.atlasCollection.getCounts();
        debugInfo.push({ type, keyCount, atlasCount });
      }
    }
    return debugInfo;
  }

  getDebugInfo() {
    return this.debugInfo;
  }

}
