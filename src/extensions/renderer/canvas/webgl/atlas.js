import * as util from './webgl-util';

// A "texture atlas" is a big image/canvas, and sections of it are used as textures for nodes/labels.

export class Atlas {
  constructor(r, gl, opts) {
    this.debugID = Math.floor(Math.random() * 10000);
    this.r = r;
    this.gl = gl;

    this.atlasSize = opts.webglTexSize;
    this.rows = opts.webglTexRows;
    this.texHeight = Math.floor(this.atlasSize / this.rows);
    this.maxTexWidth = this.atlasSize;

    this.texture = null;
    this.canvas = null;
    this.buffered = false;

    // a "location" is an object with a row and x fields
    this.freePointer = { x: 0, row: 0 };
    // map from the style key to the row/x where the texture starts
    // if the texture wraps then there's a second location
    this.keyToLocation = new Map(); // styleKey -> [ location, location ]

    this.canvas  = util.createTextureCanvas(r, this.atlasSize);
    this.scratch = util.createTextureCanvas(r, this.atlasSize, this.texHeight);
  }

  getScale(bb) {
    const { texHeight, maxTexWidth } = this;
    // try to fit to the height of a row
    let scale = texHeight / bb.h;  // TODO what about pixelRatio?
    let texW = bb.w * scale;
    let texH = bb.h * scale;
    // if the scaled width is too wide then scale to fit max width instead
    if(texW > maxTexWidth) {
      scale = maxTexWidth / bb.w;
      texW = bb.w * scale;
      texH = bb.h * scale;
    }
    return { scale, texW, texH };
  }


  draw(key, bb, doDrawing) {
    const { atlasSize, rows, texHeight } = this;
    const { scale, texW, texH } = this.getScale(bb);
    
    const drawAt = (location, context) => {
      const { x, row } = location;
      const xOffset = x;
      const yOffset = texHeight * row;
  
      // context.save();
      // context.strokeStyle = 'blue';
      // context.lineWidth = 4;
      // context.strokeRect(xOffset, yOffset, texW, texHeight);
      // context.restore();

      context.save();
      context.translate(xOffset, yOffset);
      context.scale(scale, scale);
      doDrawing(context, bb);
      context.restore();
    };


    if(this.freePointer.x + texW > atlasSize) { // doesn't fit on current row, need to wrap
      if(this.freePointer.row >= rows-1) {
        return false; // No space left in this atlas for this texture. TODO maybe trigger garbage collection?
      }
      const firstTexW = atlasSize - this.freePointer.x;
      const secondTexW = texW - firstTexW;

      // Draw to the scratch canvas
      const { scratch } = this;
      scratch.clear();
      drawAt({ x:0, row:0 }, scratch.context);

      const locations = [];
      const { context } = this.canvas;

      { // copy first part of scratch to the first texture
        const dx = this.freePointer.x;
        const dy = this.freePointer.row * texHeight;
        const w = firstTexW;
        const h = texHeight;
        context.drawImage(scratch, 0, 0, w, h, dx, dy, w, h);
        
        locations[0] = { 
          x: dx, 
          y: dy, 
          w, 
          h: texH 
        };
      }
      { // copy second part of scratch to the second texture
        const sx = firstTexW;
        const dy = (this.freePointer.row + 1) * texHeight;
        const w = secondTexW;
        const h = texHeight;
        context.drawImage(scratch, sx, 0, w, h, 0, dy, w, h);

        locations[1] = { 
          x: 0, 
          y: dy,
          w, 
          h: texH 
        };
      }

      this.keyToLocation.set(key, locations);
      
      this.freePointer.x = secondTexW;
      this.freePointer.row++;

      this.buffered = false;
      return locations;
    } else {
      // don't need to wrap, draw directly on the canvas
      drawAt(this.freePointer, this.canvas.context);
      
      const locations = [{
        x: this.freePointer.x,
        y: this.freePointer.row * texHeight,
        w: texW,
        h: texHeight
      }, 
      {  // indlude a second location with a width of 0, for convenience
        x: this.freePointer.x + texW,
        y: this.freePointer.row * texHeight,
        w: 0,
        h: texHeight
      }]; 
      this.keyToLocation.set(key, locations);

      // move the pointer to the end of the texture
      this.freePointer.x += texW;
      if(this.freePointer.x == atlasSize) { // if it happens to be all the way at the end of the current row
        this.freePointer.x = 0;
        this.freePointer.row++;
      }

      this.buffered = false;
      return locations;
    }
  }

  getTexOffsets(key) {
    return this.keyToLocation.get(key);
  }

  canFit(bb) {
    const { atlasSize, rows } = this;
    const { texW } = this.getScale(bb);
    if(this.freePointer.x + texW > atlasSize) { // need to wrap
      return this.freePointer.row < rows - 1; // return true if there's a row to wrap to
    }
    return true;
  }

  maybeBuffer() {
    if(!this.buffered) {
      this.texture = util.bufferTexture(this.gl, this.canvas);
      this.buffered = true;
    }
  }

}

export default Atlas;