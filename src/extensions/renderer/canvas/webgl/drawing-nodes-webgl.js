// For rendering nodes
import * as util from './webgl-util';
import { defaults } from '../../../../util';
import { mat3 } from 'gl-matrix';
import Atlas from './atlas';

const initDefaults = defaults({
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
  constructor(r, gl) {
    this.r = r;
    this.gl = gl;

    this.maxInstances = 1000; // TODO
    this.maxAtlases = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
    this.atlasSize = 4096; // all Atlases must be the same size, because this is a uniform

    console.log('max texture units', this.maxAtlases);
    console.log('max texture size', gl.getParameter(gl.MAX_TEXTURE_SIZE));

    this.program = this.createShaderProgram();
    this.vao = this.createVAO();

    this.renderTypes = new Map(); // string -> object

    this.currentAtlas = this.createAtlas();
    this.overlayUnderlay = this.initOverlayUnderlay(); // used for overlay/underlay shapes

    this.testAtlas = new Atlas(r, gl);
  }

  addRenderType(type, options) {
    const renderOptions = {
      type,
      opts: initDefaults(options),
      styleKeyToAtlas: new Map()
    }
    this.renderTypes.set(type, renderOptions);
  }

  createAtlas() {
    const { r, gl, atlasSize } = this;
    return new Atlas(r, gl, { atlasSize });
  }

  getAtlas(type, styleKey) {
    return this.renderTypes.get(type).styleKeyToAtlas.get(styleKey);
  }

  setAtlas(type, styleKey, atlas) {
    return this.renderTypes.get(type).styleKeyToAtlas.set(styleKey, atlas);
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


  createShaderProgram() {
    const { gl } = this;

    // compute texture coordinates in the shader, becase we are using instanced drawing
    const vertexShaderSource = `#version 300 es
      precision highp float;

      uniform mat3 uPanZoomMatrix;
      uniform int  uAtlasSize;
      
      in vec2 aPosition; // instanced
      in vec4 aLayColor; // overlay/underlay color
      in int aAtlasId; // which shader unit/atlas to use
      in vec4 aTex1; // x/y/w/h of texture in atlas
      in vec4 aTex2; 

      in mat3 aNodeMatrix1;
      in mat3 aNodeMatrix2;

      out vec2 vTexCoord;
      flat out vec4 vLayColor;
      flat out int vAtlasId;

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

        gl_Position = vec4(uPanZoomMatrix * nodeMatrix * vec3(aPosition, 1.0), 1.0);
      }
    `;

    const idxs = Array.from({ length: this.maxAtlases }, (v,i) => i);

    const fragmentShaderSource = `#version 300 es
      precision highp float;

      // define texture unit for each node in the batch
      ${idxs.map(i => `uniform sampler2D uTexture${i};`).join('\t\n')}

      in vec2 vTexCoord;
      flat in int vAtlasId;
      flat in vec4 vLayColor;

      out vec4 outColor;

      void main(void) {
        vec4 texColor;
        ${idxs.map(i => `if(vAtlasId == ${i}) texColor = texture(uTexture${i}, vTexCoord);`).join('\n\telse ')}

        if(vLayColor.a == 0.0)
         outColor = texColor;
        else
         outColor = texColor * vLayColor;
      }
    `;

    const program = util.createProgram(gl, vertexShaderSource, fragmentShaderSource);

    // attributes
    program.aPosition    = gl.getAttribLocation(program, 'aPosition');
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
    
    this.atlasIdBuffer  = util.createBufferDynamicDraw(gl, n, 'int',  program.aAtlasId);
    this.layColorBuffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aLayColor);
    this.tex1Buffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aTex1);
    this.tex2Buffer = util.createBufferDynamicDraw(gl, n, 'vec4', program.aTex2);

    gl.bindVertexArray(null);
    return vao;
  }


  getOrCreateTexture(renderType, node, opts) {
    const styleKey = opts.getKey(node);
    const bb = opts.getBoundingBox(node);

    let atlas = this.getAtlas(renderType, styleKey);

    if(!atlas) {
      if(!this.currentAtlas.canFit(bb)) {
        this.currentAtlas = this.createAtlas();
      }

      atlas = this.currentAtlas;
      // console.log('drawing texture for', styleKey);

      atlas.draw(styleKey, bb, (context) => {
        opts.drawElement(context, node, bb, true, false);
      });

      this.setAtlas(renderType, styleKey, atlas);
    }

    return atlas;
  }

  /**
   * Adjusts the BB to accomodate padding and split for wrapped textures.
   */
  getAdjustedBB(node, opts, padding, first, ratio) {
    let { x1, y1, w, h } = opts.getBoundingBox(node);

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
  setTransformMatrix(matrix, node, opts, padding, first, ratio) {
    const bb = this.getAdjustedBB(node, opts, padding, first, ratio);

    let x, y;
    mat3.identity(matrix);

    const theta = opts.getRotation(node);
    if(theta !== 0) {
      const { x:sx, y:sy } = opts.getRotationPoint(node);
      mat3.translate(matrix, matrix, [sx, sy]);
      mat3.rotate(matrix, matrix, theta);

      const offset = opts.getRotationOffset(node);

      x = offset.x + bb.xOffset;
      y = offset.y
    } else {
      x = bb.x1;
      y = bb.y1;
    }

    mat3.translate(matrix, matrix, [x, y]);
    mat3.scale(matrix, matrix, [bb.w, bb.h]);
  }


  startBatch(panZoomMatrix) {
    if(panZoomMatrix) {
      this.panZoomMatrix = panZoomMatrix;
    }
    this.instanceCount = 0;
    this.atlases = []; // up to 16 texture units for a draw call
  }


  draw(node, type) {
    const opts = this.renderTypes.get(type).opts;
    if(!opts.isVisible(node))
      return;

    const bufferInstanceData = (atlasID, tex1, tex2, padding=0, layColor=[0, 0, 0, 0]) => {
      const i = this.instanceCount;
      this.atlasIdBuffer.setData([atlasID], i);
      this.tex1Buffer.setBB(tex1, i);
      this.tex2Buffer.setBB(tex2, i);
      this.layColorBuffer.setData(layColor, i);

      const tex1ratio = tex1.w / (tex1.w + tex2.w);
      const tex2ratio = 1 - tex1ratio;

      // pass the array view to setTransformMatrix
      const matrix1 = this.matrixBuffer1.getMatrixView(i);
      this.setTransformMatrix(matrix1, node, opts, padding, true, tex1ratio);
      const matrix2 = this.matrixBuffer2.getMatrixView(i);
      this.setTransformMatrix(matrix2, node, opts, padding, false, tex2ratio);

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
      const atlas = this.getOrCreateTexture(type, node, opts);
      const atlasID = getAtlasIdForBatch(atlas);
      const [ tex1, tex2 ] = atlas.getTexOffsets(styleKey);
      
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
      const [ tex1, tex2 ] = atlas.getTexOffsets(styleKey);
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
    const { gl, program, vao, instanceCount, vertexCount } = this;
    if(instanceCount === 0) 
      return;

    gl.useProgram(program);
    gl.bindVertexArray(vao);

    // upload the new matrix data
    this.matrixBuffer1.bufferSubData(instanceCount);
    this.matrixBuffer2.bufferSubData(instanceCount);
    this.atlasIdBuffer.bufferSubData(instanceCount);
    this.layColorBuffer.bufferSubData(instanceCount);
    this.tex1Buffer.bufferSubData(instanceCount);
    this.tex2Buffer.bufferSubData(instanceCount);

    // Activate all the texture units that we need
    for(let i = 0; i < this.atlases.length; i++) {
      const atlas = this.atlases[i];
      atlas.maybeBuffer(gl); // buffering textures can take a long time

      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, atlas.texture);
      gl.uniform1i(program.uTextures[i], i);
    }

    // Set the uniforms
    gl.uniformMatrix3fv(program.uPanZoomMatrix, false, this.panZoomMatrix);
    gl.uniform1i(program.uAtlasSize, this.atlasSize);

    // draw!
    gl.drawArraysInstanced(gl.TRIANGLES, 0, vertexCount, instanceCount);

    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null); // TODO is this right when having multiple texture units?

    // debug
    // const nodeContext = this.r.data.contexts[this.r.NODE];
    // nodeContext.save();
    // nodeContext.setTransform(1, 0, 0, 1, 0, 0);
    // nodeContext.scale(0.25, 0.25);
    // nodeContext.drawImage(this.atlases[1].canvas, 0, 0);
    // nodeContext.restore();

    // start the next batch, even if not needed
    this.startBatch();
  }

}
