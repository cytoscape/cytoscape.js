// For rendering nodes
import * as util from './webgl-util';
import { defaults } from '../../../../util';
import { mat3 } from 'gl-matrix';

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

// TODO make these values options that are passed in
// They should adapt to the size of the network automatically, or be configurable by the user.
// Square atlas, each side has this many pixels, maybe should be power of 2 for performance?
const atlasSize = 4096; 
const cols = 6;
const rows = 10;

const texPerAtlas = cols * rows;
const texWidth  = Math.floor(atlasSize / cols);
const texHeight = Math.floor(atlasSize / rows);

function getTexOffsets(texIndex) {
  const row = Math.floor(texIndex / cols);
  const col = texIndex % cols;
  const xOffset = col * texWidth;
  const yOffset = row * texHeight;
  return { xOffset, yOffset };
}

function getTexScale(bb) {
  const wScale = texWidth  / bb.w;
  const hScale = texHeight / bb.h;
  const scale = Math.min(wScale, hScale);
  const w = bb.w * scale;
  const h = bb.h * scale;
  return { w, h, scale };
}


class Atlas {
  constructor() {
    this.texture = null;
    this.canvas = null;
    this.index = 0;
    this.buffered = false;
  }

  isFull() {
    return this.index >= texPerAtlas;
  }

  maybeBuffer(gl) {
    if(!this.buffered) {
      this.texture = util.bufferTexture(gl, this.canvas);
      if(this.isFull()) {
        this.canvas = null;
      }
      this.buffered = true;
    }
  }

  draw(r, doDrawing) {
    if(this.isFull())
      throw new Error("This Atlas is full!");

    if(this.canvas === null)
      this.canvas = util.createTextureCanvas(r, atlasSize);
    
    const { context } = this.canvas;
    const { xOffset, yOffset } = getTexOffsets(this.index);

    // for debugging
    // context.strokeStyle = 'red';
    // context.lineWidth = 4;
    // context.strokeRect(xOffset, yOffset, texWidth, texHeight);

    context.save();
    context.translate(xOffset, yOffset);
    doDrawing(context);
    context.restore();

    this.buffered = false;
    this.index++;
  }

  drawNode(r, node, opts) {
    this.draw(r, (context) => {
      const bb = opts.getBoundingBox(node);
      const { scale } = getTexScale(bb);
      context.scale(scale, scale);
      opts.drawElement(context, node, bb, true, false);
    });
  }
}


export class NodeDrawing {

  /** 
   * @param {WebGLRenderingContext} gl 
   */
  constructor(r, gl) {
    this.r = r;
    this.gl = gl;

    this.maxInstances = 1000;
    this.maxAtlases = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);

    console.log('max texture units', this.maxAtlases);
    console.log('max texture size', gl.getParameter(gl.MAX_TEXTURE_SIZE));

    this.program = this.createShaderProgram();
    this.vao = this.createVAO();

    this.renderTypes = new Map(); // string -> object

    this.styleKeyToAtlas = new Map(); // need to know which texure atlas has the texture
    this.styleKeyToTexIndex = new Map(); // which texture in the atlas for a node

    this.currentAtlas = new Atlas();
    this.overlayUnderlay = this.initOverlayUnderlay(); // used for overlay/underlay shapes
  }


  addRenderType(type, options) {
    this.renderTypes.set(type, initDefaults(options));
  }


  initOverlayUnderlay() {
    const { r } = this;
    const atlas = new Atlas();

    const size = Math.min(texWidth, texHeight);
    const center = size / 2;

    // textures are white so that the overlay color is preserved when multiplying in the fragment shader
    atlas.draw(r, (context) => {
      context.fillStyle = '#FFF';
      r.drawRoundRectanglePath(context, center, center, size, size, 80); // TODO don't hardcode the radius
      context.fill();
    });
    
    atlas.draw(r, (context) => {
      context.fillStyle = '#FFF';
      r.drawEllipsePath(context, center, center, size, size)
      context.fill();
    });

    // TODO Textures above have same width and height. This causes rounded corners 
    // to look stretched when applied to wider nodes. We could create more textures with different
    // aspect ratios, then choose the one that's closest to the node to minimize stretching.
    const getTexIndex = (shape) => {
      // TODO pick a tex index based on aspect ratio or size
      if(shape === 'roundrectangle' || shape === 'round-rectangle')
        return 0;
      else if(shape === 'ellipse')
        return 1;
      return -1;
    };

    const getTexWidthHeight = (bb) => {
      // TEMPORARY Overlay texture has aspect ratio of 1, it will fill either the width or 
      // height of a texture in the atlas
      const texSize = Math.min(texWidth, texHeight); 
      const wScale = texSize / bb.w;
      const hScale = texSize / bb.h;
      const w = bb.w * wScale;
      const h = bb.h * hScale;
      return { w, h }; // Returns the width/height of the texture
    };

    return {
      atlas,
      getTexIndex,
      getTexWidthHeight
    };
  }


  createShaderProgram() {
    const { gl } = this;

    const vertexShaderSource = `#version 300 es
      precision highp float;

      uniform mat3 uPanZoomMatrix;
      uniform int uAtlasSize;
      uniform int uCols;
      uniform int uRows;
      
      in vec2 aPosition; // instanced
      in mat3 aNodeMatrix;
      in int  aTexId; // which shader unit/atlas to use
      in vec4 aLayColor; // overlay/underlay color
      in vec2 aOffsets;
      in vec2 aWidthHeight; 

      out vec2 vTexCoord;
      flat out vec4 vLayColor;
      flat out int vTexId;

      void main(void) {
        // compute texture coordinates here in the shader
        // we have to do this here becase we are using instanced drawing

        float xOffset = aOffsets.x;
        float yOffset = aOffsets.y;

        if(gl_VertexID == 2 || gl_VertexID == 3 || gl_VertexID == 5) {
          xOffset += aWidthHeight.x;
        }
        if(gl_VertexID == 1 || gl_VertexID == 4 || gl_VertexID == 5) {
          yOffset += aWidthHeight.y;
        }

        float d = float(uAtlasSize);
        vTexCoord = vec2(xOffset / d, yOffset / d); // tex coords must be between 0 and 1

        vTexId = aTexId;
        vLayColor = aLayColor;

        gl_Position = vec4(uPanZoomMatrix * aNodeMatrix * vec3(aPosition, 1.0), 1.0);
      }
    `;

    const idxs = Array.from({ length: this.maxAtlases }, (v,i) => i);

    const fragmentShaderSource = `#version 300 es
      precision highp float;

      // define texture unit for each node in the batch
      ${idxs.map(i => `uniform sampler2D uTexture${i};`).join('\t\n')}

      in vec2 vTexCoord;
      flat in int vTexId;
      flat in vec4 vLayColor;

      out vec4 outColor;

      void main(void) {
        vec4 texColor;
        ${idxs.map(i => `if(vTexId == ${i}) texColor = texture(uTexture${i}, vTexCoord);`).join('\n\telse ')}

        if(vLayColor.a == 0.0)
          outColor = texColor;
        else
          outColor = texColor * vLayColor;
      }
    `;

    const program = util.createProgram(gl, vertexShaderSource, fragmentShaderSource);

    // attributes
    program.aPosition    = gl.getAttribLocation(program, 'aPosition');
    program.aNodeMatrix  = gl.getAttribLocation(program, 'aNodeMatrix');
    program.aTexId       = gl.getAttribLocation(program, 'aTexId');
    program.aLayColor    = gl.getAttribLocation(program, 'aLayColor');
    program.aOffsets     = gl.getAttribLocation(program, 'aOffsets');
    program.aWidthHeight = gl.getAttribLocation(program, 'aWidthHeight');

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
    const unitQuad = [
      0, 0,  0, 1,  1, 0,
      1, 0,  0, 1,  1, 1,
    ];
  
    const { gl, program } = this;

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    util.createAttributeBufferStaticDraw(gl, {
      attributeLoc: program.aPosition,
      dataArray: unitQuad,
      type: 'vec2'
    });

    this.texIdBuffer = util.createInstanceBufferDynamicDraw(gl, {
      attributeLoc: program.aTexId,
      maxInstances: this.maxInstances,
      type: 'int'
    });

    this.layColorBuffer = util.createInstanceBufferDynamicDraw(gl, {
      attributeLoc: program.aLayColor,
      maxInstances: this.maxInstances,
      type: 'vec4'
    });

    this.offsetsBuffer = util.createInstanceBufferDynamicDraw(gl, {
      attributeLoc: program.aOffsets,
      maxInstances: this.maxInstances,
      type: 'vec2'
    });

    this.widthHeightBuffer = util.createInstanceBufferDynamicDraw(gl, {
      attributeLoc: program.aWidthHeight,
      maxInstances: this.maxInstances,
      type: 'vec2'
    });

    this.matrixBuffer = util.create3x3MatrixBufferDynamicDraw(gl, {
      attributeLoc: program.aNodeMatrix,
      maxInstances: this.maxInstances
    });

    gl.bindVertexArray(null);
    return vao;
  }


  getOrCreateTexture(node, opts) {
    const { r } = this;
    const styleKey = opts.getKey(node);

    let atlas = this.styleKeyToAtlas.get(styleKey);
    let texIndex = this.styleKeyToTexIndex.get(styleKey);

    if(!atlas) {
      if(this.currentAtlas.isFull()) {
        this.currentAtlas = new Atlas();
      }

      atlas = this.currentAtlas;
      texIndex = this.currentAtlas.index;

      console.log('drawing texture for', styleKey);
      atlas.drawNode(r, node, opts);

      this.styleKeyToAtlas.set(styleKey, atlas);
      this.styleKeyToTexIndex.set(styleKey, texIndex);
    }

    return { atlas, texIndex };
  }


  setTransformMatrix(matrix, node, opts, padding) {
    // matrix is expected to be a 9 element array
    // follows same pattern as CRp.drawCachedElementPortion(...)
    const bb = opts.getBoundingBox(node);
    let x, y;

    mat3.identity(matrix);

    const theta = opts.getRotation(node);
    if(theta !== 0) {
      const { x:sx, y:sy } = opts.getRotationPoint(node);
      mat3.translate(matrix, matrix, [sx, sy]);
      mat3.rotate(matrix, matrix, theta);

      const offset = opts.getRotationOffset(node);
      x = offset.x;
      y = offset.y;
    } else {
      x = bb.x1;
      y = bb.y1;
    }

    let nodeWidth  = bb.w;
    let nodeHeight = bb.h;
    if(padding) {
      x -= padding;
      y -= padding;
      nodeWidth  += 2 * padding;
      nodeHeight += 2 * padding;
    }
    
    mat3.translate(matrix, matrix, [x, y]);
    mat3.scale(matrix, matrix, [nodeWidth, nodeHeight]);
  }


  startBatch(panZoomMatrix) {
    if(panZoomMatrix) {
      this.panZoomMatrix = panZoomMatrix;
    }
    this.instanceCount = 0;
    this.atlases = []; // up to 16 texture units for a draw call
  }


  draw(node, type) {
    const opts = this.renderTypes.get(type);
    if(!opts.isVisible(node))
      return;

    const bufferInstanceData = (texID, xOffset, yOffset, w, h, padding=0, layColor=[0, 0, 0, 0]) => {
      this.texIdBuffer.setDataAt([texID], this.instanceCount);
      this.offsetsBuffer.setDataAt([xOffset, yOffset], this.instanceCount);
      this.widthHeightBuffer.setDataAt([w, h], this.instanceCount);
      this.layColorBuffer.setDataAt(layColor, this.instanceCount);
      // pass the array view to setTransformMatrix
      const matrix = this.matrixBuffer.getMatrixView(this.instanceCount);
      this.setTransformMatrix(matrix, node, opts, padding);

      this.instanceCount++;
    };

    const getTexIdForBatch = (atlas) => {
      let texID = this.atlases.indexOf(atlas);
      if(texID < 0) {
        if(this.atlases.length === this.maxAtlases) {
           // If we run out of space for textures in the current batch then start a new batch
          this.endBatch();
        }
        this.atlases.push(atlas);
        texID = this.atlases.length - 1;
      }
      return texID;
    };

    const drawBodyOrLabel = () => {
      const { atlas, texIndex } = this.getOrCreateTexture(node, opts);
      const texID = getTexIdForBatch(atlas);
      const { xOffset, yOffset } = getTexOffsets(texIndex);
      const bb = opts.getBoundingBox(node);
      const { w, h } = getTexScale(bb);
      bufferInstanceData(texID, xOffset, yOffset, w, h);
    };

    const drawOverlayUnderlay = () => {
      const style = opts.getOverlayUnderlayStyle(node);
      const { opacity, color, shape, padding } = style; // Ignore radius for now

      const texIndex = this.overlayUnderlay.getTexIndex(shape);
      if(texIndex < 0)
        return;

      const texID = getTexIdForBatch(this.overlayUnderlay.atlas);
      const { xOffset, yOffset } = getTexOffsets(texIndex);
      const bb = opts.getBoundingBox(node);
      const { w, h } = this.overlayUnderlay.getTexWidthHeight(bb);
      const webglColor = util.toWebGLColor(color, opacity, { premultiplyAlpha: true });
      bufferInstanceData(texID, xOffset, yOffset, w, h, padding, webglColor);
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
    // const nodeContext = this.r.data.contexts[this.r.NODE];
    // nodeContext.save();
    // nodeContext.scale(0.25, 0.25);
    // nodeContext.drawImage(this.atlases[0].canvas, 0, 0);
    // nodeContext.restore();

    const count = this.instanceCount;
    if(count === 0) 
      return;

    const { gl, program, vao } = this;

    gl.useProgram(program);
    gl.bindVertexArray(vao);

    // upload the new matrix data
    this.matrixBuffer.bufferSubData(count);
    this.texIdBuffer.bufferSubData(count);
    this.offsetsBuffer.bufferSubData(count);
    this.widthHeightBuffer.bufferSubData(count);
    this.layColorBuffer.bufferSubData(count);

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
    gl.uniform1i(program.uAtlasSize, atlasSize);

    // draw!
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count); // 6 verticies per node

    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null); // TODO is this right when having multiple texture units?

    // start the next batch, even if not needed
    this.startBatch();
  }

}
