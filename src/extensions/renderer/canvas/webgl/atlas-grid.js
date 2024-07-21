import * as util from './webgl-util';
import { defaults } from '../../../../util';

// A "texture atlas" is a big image/canvas, and sections of it are used as textures for nodes/labels.


const initDefaults = (options) => {
  const opts = defaults({
    atlasSize: 4096, 
    cols: 6,
    rows: 10,
  })(options);
  opts.texPerAtlas = opts.cols * opts.rows;
  opts.texWidth  = Math.floor(opts.atlasSize / opts.cols);
  opts.texHeight = Math.floor(opts.atlasSize / opts.rows);
  return opts;
};

/**
 * A simple atlas that's divided into fixed rows and columns.
 */
export class GridAtlas {
  constructor(r, gl, options) {
    this.r = r;
    this.gl = gl;
    
    this.opts = initDefaults(options);

    this.texture = null;
    this.canvas = null;
    this.index = 0;
    this.buffered = false;
  }

  isFull() {
    return this.index >= this.opts.texPerAtlas;
  }

  getOpts() {
    return this.opts;
  }

  getTexOffsets(texIndex) {
    const { cols, texWidth, texHeight } = this.opts;
    const row = Math.floor(texIndex / cols);
    const col = texIndex % cols;
    const xOffset = col * texWidth;
    const yOffset = row * texHeight;
    return { xOffset, yOffset };
  }
  
  getTexScale({ w, h }) {
    const { texWidth, texHeight } = this.opts;
    const wScale = texWidth  / w;
    const hScale = texHeight / h;
    const scale = Math.min(wScale, hScale);
    return { 
      w: w * scale, 
      h: h * scale, 
      scale 
    };
  }

  maybeBuffer() {
    if(!this.buffered) {
      this.texture = util.bufferTexture(this.gl, this.canvas);
      if(this.isFull()) {
        this.canvas = null;
      }
      this.buffered = true;
    }
  }

  draw(bb, doDrawing) {
    if(this.isFull())
      throw new Error("This Atlas is full!");

    const { atlasSize } = this.opts;
    if(this.canvas === null)
      this.canvas = util.createTextureCanvas(this.r, atlasSize);
    
    const { context } = this.canvas;
    const { xOffset, yOffset } = this.getTexOffsets(this.index);
    const { scale } = this.getTexScale(bb);

    // for debugging
    // context.strokeStyle = 'red';
    // context.lineWidth = 4;
    // context.strokeRect(xOffset, yOffset, texWidth, texHeight);

    context.save();
    context.translate(xOffset, yOffset);
    context.scale(scale, scale);
    doDrawing(context, bb);
    context.restore();

    this.buffered = false;
    this.index++;
  }
}

export default GridAtlas;