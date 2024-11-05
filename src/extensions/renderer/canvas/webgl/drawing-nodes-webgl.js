// For rendering nodes
import * as util from './webgl-util';
import { AtlasManager } from './atlas';
import { RENDER_TARGET } from './drawing-redraw-webgl';


export class NodeDrawing {

  /** 
   * @param {WebGLRenderingContext} gl 
   */
  constructor(r, gl, opts) {
    this.r = r;
    this.gl = gl;
    this.maxInstances = opts.webglBatchSize;

    opts.enableWrapping = true;
    this.atlasManager = new AtlasManager(r, opts);

    this.program = this.createShaderProgram(RENDER_TARGET.SCREEN);
    this.pickingProgram = this.createShaderProgram(RENDER_TARGET.PICKING);
    this.vao = this.createVAO();

    this.debugInfo = [];
  }

  addRenderType(type, opts) {
    this.atlasManager.addRenderType(type, opts);
  }

  invalidate(eles, { type } = {}) {
    const testEle = ele => ele.isNode();
    const testType = type ? t => t === type : null; 
    const forceRedraw = type ? true : false;
    return this.atlasManager.invalidate(eles, { testEle, testType, forceRedraw });
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

    const idxs = this.atlasManager.getIndexArray();

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

        ${ renderTarget.picking
          ? `if(outColor.a == 0.0) discard;
             else outColor = vIndex;`
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
    for(let i = 0; i < this.atlasManager.maxAtlases; i++) {
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
  

  startFrame(panZoomMatrix, debugInfo, renderTarget = RENDER_TARGET.SCREEN) {
    this.panZoomMatrix = panZoomMatrix;
    this.debugInfo = debugInfo;
    this.renderTarget = renderTarget;
  }

  startBatch() {
    this.instanceCount = 0;
    this.atlasManager.startBatch();
  }

  draw(node, eleIndex, type) {
    const { atlasManager } = this;
    if(!atlasManager.isRenderable(node, type)) {
      return;
    }
    if(!atlasManager.canAddToCurrentBatch(node, type)) {
      this.endBatch(); // draws then starts a new batch
    }

    const atlasInfo = atlasManager.getAtlasInfo(node, type);
    const { atlasID, tex1, tex2 } = atlasInfo;
    const instance = this.instanceCount;

    // Set values in the buffers using Typed Array Views for performance.
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

    const matrix1View = this.matrixBuffer1.getMatrixView(instance);
    atlasManager.setTransformMatrix(matrix1View, atlasInfo, node, true);
    const matrix2View = this.matrixBuffer2.getMatrixView(instance);
    atlasManager.setTransformMatrix(matrix2View, atlasInfo, node, false);

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
