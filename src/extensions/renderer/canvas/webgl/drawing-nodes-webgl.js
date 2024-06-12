// For rendering nodes
import * as util from './webgl-util';
import { assign, defaults } from '../../../../util';

   // texInfo: { atlasSize, texSize, texPerRow, texPerAtlas }
const initDefaults = defaults({
  getKey: null,
  drawElement: null,
  getBoundingBox: null,
  getTransformMatrix: null,
  getRotationPoint: null,
  getRotationOffset: null,
  atlasSize: 8192,
  texSize: 1024,
});


export class NodeDrawing {
  constructor(r, gl, options) {
    this.r = r;
    this.gl = gl;

    const opts = initDefaults(options);
    opts.texPerRow = Math.floor(opts.atlasSize / opts.texSize);
    opts.texPerAtlas = opts.texPerRow * opts.texPerRow; // assume texture atlas is a square
    assign(this, opts);

    this.program = this.createShaderProgram();

    this.nodeIdToStyleKey = new Map(); // style keys for nodes can change, this is how we remove old styles
    this.styleKeyToAtlas  = new Map();

    this.initialized = false;
  }

  isInitialized() {
    return this.initialized;
  }

  initialize() { 
    // need to call on first frame
    // TODO is there a better place to call initialize() ?
    const eles = this.r.getCachedZSortedEles(); 
    for(let i = 0; i < eles.length; i++) {
      const ele = eles[i];
      if(ele.isNode()) {
        this.addNode(ele);
      }
    }
    this.registerListeners();
    this.initialized = true;
  }

  /**
   * What can change?
   * - Nodes can be added or removed
   * - Node style changes
   * - Node label changes
   * - Node z-order changes (often happens on drag)
   * - Node x/y changes (can happen on drag or layout or just programatically)
   */
  registerListeners() {
    const { cy } = this.r;
    // cy.on('node position', evt => {
    //   this.updatePosition(evt.target);
    // });
    // cy.on('node style', evt => {
    //   this.updateStyle(evt.target);
    // });
    // cy.on('node add', evt => {
    //   this.addNode(evt.target);
    // });
    // cy.on('node remove', evt => {
    //   this.removeNode(evt.target);
    // });
  }
  

  /**
   * Assumes the node hasn't been added yet.
   */
  addNode(node) {
    const styleKey = this.getKey(node);
    
    if(this.styleKeyToAtlas.has(styleKey)) {
      const atlas = this.styleKeyToAtlas.get(styleKey);
      atlas.addNode(node);
    } else {
      let atlas;
      for(let a of this.styleKeyToAtlas.values()) {
        if(!a.isFull()) {
          atlas = a;
          break;
        }
      } 
      if(!atlas) {
        atlas = new Atlas(this);
        this.styleKeyToAtlas.set(styleKey, atlas);
      }
      atlas.addNode(node);
    }
  }

  createShaderProgram() {
    const { gl } = this;

    const vertexShaderSource = `#version 300 es
      precision highp float;

      uniform mat4 uMatrix;

      in vec2 aVertexPosition;
      in float aVertexZ;
      in vec2 aTexCoord;

      out vec2 vTexCoord;

      void main(void) {
        vTexCoord = aTexCoord;
        gl_Position = uMatrix * vec4(aVertexPosition, aVertexZ, 1.0);
      }
    `;

    const fragmentShaderSource = `#version 300 es
      precision highp float;

      uniform sampler2D uEleTexture;

      in vec2 vTexCoord;

      out vec4 outColor;

      void main(void) {
        vec4 bodyColor = texture(uEleTexture, vTexCoord);
        // vec4 bottomColor = texture(uEleTexture, vTexCoord);
        // vec4 topColor = texture(uLabelTexture, vTexCoord);
        // outColor = mix(bottomColor, topColor, topColor.a);
        outColor = bodyColor;
      }
    `;

    const program = util.createProgram(gl, vertexShaderSource, fragmentShaderSource);

    program.uMatrix = gl.getUniformLocation(program, 'uMatrix');
    program.uEleTexture = gl.getUniformLocation(program, 'uEleTexture');

    program.aVertexPosition = gl.getAttribLocation(program,  'aVertexPosition');
    program.aVertexZ = gl.getAttribLocation(program,  'aVertexZ');
    program.aTexCoord = gl.getAttribLocation(program, 'aTexCoord');

    return program;
  }

  draw(transformMatrix) {
    for(let atlas of this.styleKeyToAtlas.values()) {
      atlas.draw(transformMatrix);
    }
  }

}


class Atlas {
  constructor(nodeDrawing) {
    this.parent = nodeDrawing;

    this.styleKeyToTexIndex = new Map();
    this.styleKeyToNode = new Map(); // only need one node as representative for the style
    this.nodes = new Set(); // is it ok to store the actual nodes? should we store IDs, or BBs instead?

    // gl objects
    this.vao = null;
    this.texture = null;

    // texture canvas
    const { r, atlasSize, texPerAtlas } = this.parent;
    this.textureCanvas = util.createTextureCanvas(r, atlasSize);
    this.texNeedDraw = new Array(texPerAtlas).fill(true);
    this.zNeedBuffer = true;
    this.xyNeedBuffer = true;
    this.texNeedBuffer = true;
  }

  isFull() {
    const { texPerAtlas } = this.parent;
    return this.styleKeyToTexIndex.size >= texPerAtlas;
  }

  addNode(node) {
    const styleKey = this.parent.getKey(node);
    this.styleKeyToNode.set(styleKey, node);
    this.nodes.add(node);
    
    this.xyNeedBuffer = true;
    this.zNeedBuffer = true;

    if(!this.styleKeyToTexIndex.has(styleKey)) {
      const texIndex = this.getAvailableTexIndex();
      this.styleKeyToTexIndex.set(styleKey, texIndex);
    }
  }

  getAvailableTexIndex() {
    const { texPerAtlas } = this.parent;
    const indices = [...this.styleKeyToTexIndex.values()];
    for(let i = 0; i < texPerAtlas; i++) {
      if(!indices.includes(i)) {
        return i;
      }
    }
    throw new Error("No available texture index");
  }

  getTextureInfo(node, texIndex) {
    const { texSize, texPerRow, getBoundingBox } = this.parent;
    const bb = getBoundingBox(node);
    const { w, h } = bb;
    const row = Math.floor(texIndex / texPerRow);
    const col = texIndex % texPerRow;
    const scale = Math.min(texSize / w, texSize / h);
    const xOffset = col * texSize;
    const yOffset = row * texSize;
    return {
      row, col, scale, xOffset, yOffset, bb
    };
  }

  drawTexture(node, texIndex) {
    const { texSize, drawElement } = this.parent;
    const { scale, xOffset, yOffset, bb } = this.getTextureInfo(node, texIndex);
    const { context } = this.textureCanvas;
    context.save();
    context.translate(xOffset, yOffset);
    context.strokeStyle = 'red';
    context.strokeRect(0, 0, texSize, texSize);
    context.scale(scale, scale);
    drawElement(context, node, bb);
    context.restore();
  }

  createTextures() {
    for(let [ styleKey, node ] of this.styleKeyToNode) {
      console.log('here', node.id());
      const texIndex = this.styleKeyToTexIndex.get(styleKey);
      console.log('tex index', texIndex);
      if(this.texNeedDraw[texIndex]) {
        console.log('drawing texture for ', node.id());
        this.drawTexture(node, texIndex);
        this.texNeedDraw[texIndex] = false;
      }
    }
  }

  bufferArrays() {
    const { gl, getKey, getBoundingBox } = this.parent;
    const { atlasSize, program } = this.parent;

    if(this.xyNeedBuffer || this.zNeedBuffer) { // TODO separate x/y/tex and z
      const xyArray = [];
      const zArray = [];
      const texArray = [];
      let z = 0; // TODO TEMPORARY!!!

      for(let node of this.nodes) {
        console.log('getting vertex data for ' + node.id());
        const styleKey = getKey(node);
        const texIndex = this.styleKeyToTexIndex.get(styleKey);

        const { x1, x2, y1, y2, w, h } = getBoundingBox(node);
        const { scale, xOffset, yOffset } = this.getTextureInfo(node, texIndex);

        const d = atlasSize - 1;
        const tx1 = xOffset / d;
        const tx2 = (xOffset + (w * scale)) / d;
        const ty1 = yOffset / d;
        const ty2 = (yOffset + (h * scale)) / d;

        xyArray.push(
          x1, y2,   x2, y2,   x2, y1,  // triangle 1
          x1, y2,   x2, y1,   x1, y1,  // triangle 2
        );
        zArray.push(
          z,   z,   z,  // triangle 1
          z,   z,   z,  // triangle 2
        );
        texArray.push(
          tx1, ty2,   tx2, ty2,   tx2, ty1,  // triangle 1
          tx1, ty2,   tx2, ty1,   tx1, ty1,  // triangle 2
        );
        z++;
      }

      if(!this.vao) {
        this.vao = gl.createVertexArray();
      }

      gl.bindVertexArray(this.vao);
      { // x/y positions
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(xyArray), gl.STATIC_DRAW);
        gl.vertexAttribPointer(program.aVertexPosition, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.aVertexPosition);
      }
      { // z positions
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(zArray), gl.STATIC_DRAW);
        gl.vertexAttribPointer(program.aVertexZ, 1, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.aVertexZ);
      }
      { // texture coords
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texArray), gl.STATIC_DRAW);
        gl.vertexAttribPointer(program.aTexCoord, 2, gl.FLOAT, true, 0, 0);
        gl.enableVertexAttribArray(program.aTexCoord);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
      }
      gl.bindVertexArray(null);
    }
    this.xyNeedBuffer = false;
    this.zNeedBuffer = false;
  }

  bufferTexture() {
    if(this.texNeedBuffer) {
      console.log('buffer texture');
      const { gl, atlasSize } = this.parent;
      if(!this.texture) {
        this.texture = gl.createTexture();
      }
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, atlasSize, atlasSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.textureCanvas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
    this.texNeedBuffer = false;
  }

  draw(transformMatrix) {
    console.log('atlas draw');
    console.log('nodes', this.nodes.size);

    this.createTextures();
    this.bufferArrays();
    this.bufferTexture();

    const { gl, program } = this.parent;
    gl.useProgram(program);

    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(program.uEleTexture, 0);

    gl.uniformMatrix4fv(program.uMatrix, false, transformMatrix);
    gl.drawArrays(gl.TRIANGLES, 0, this.nodes.size * 6); // 6 verticies per node

    gl.bindVertexArray(null);
  }

}
