import * as util from './webgl-util';

// A "texture atlas" is a big image/canvas, and sections of it are used as textures for nodes/labels.

export class Atlas {

  constructor(r, opts) {
    this.debugID = Math.floor(Math.random() * 10000);
    this.r = r;

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

    this.canvas  = opts.createTextureCanvas(r, this.atlasSize, this.atlasSize);
    this.scratch = opts.createTextureCanvas(r, this.atlasSize, this.texHeight);
  }

  getKeys() {
    return new Set(this.keyToLocation.keys());
  }

  getScale({ w, h }) {
    const { texHeight, maxTexWidth } = this;
    // try to fit to the height of a row
    let scale = texHeight / h;  // TODO what about pixelRatio?
    let texW = w * scale;
    let texH = h * scale;
    // if the scaled width is too wide then scale to fit max width instead
    if(texW > maxTexWidth) {
      scale = maxTexWidth / w;
      texW = w * scale;
      texH = h * scale;
    }
    return { scale, texW, texH };
  }


  draw(key, bb, doDrawing) {
    const { atlasSize, rows, texHeight } = this;
    const { scale, texW, texH } = this.getScale(bb);
    
    const drawAt = (location, canvas) => {
      if(doDrawing && canvas) {
        const { context } = canvas;
        const { x, row } = location;
        const xOffset = x;
        const yOffset = texHeight * row;

        context.save();
        context.translate(xOffset, yOffset);
        context.scale(scale, scale);
        doDrawing(context, bb);
        context.restore();
      }
    };

    const locations = [ null, null ];

    if(this.freePointer.x + texW <= atlasSize) {
      // don't need to wrap, draw directly on the canvas
      drawAt(this.freePointer, this.canvas);
      
      locations[0] = {
        x: this.freePointer.x,
        y: this.freePointer.row * texHeight,
        w: texW,
        h: texHeight
      };
      locations[1] = {  // indlude a second location with a width of 0, for convenience
        x: this.freePointer.x + texW,
        y: this.freePointer.row * texHeight,
        w: 0,
        h: texHeight
      }; 

      // move the pointer to the end of the texture
      this.freePointer.x += texW;
      if(this.freePointer.x == atlasSize) {
        this.freePointer.x = 0;
        this.freePointer.row++;
      }
    } else {
      if(this.freePointer.row >= rows-1) {
        return false; // No space left in this atlas for this texture. TODO maybe trigger garbage collection?
      }
      
      const { scratch, canvas } = this;

      // Draw to the scratch canvas
      scratch.clear();
      drawAt({ x:0, row:0 }, scratch);

      const firstTexW = atlasSize - this.freePointer.x;
      const secondTexW = texW - firstTexW;
      const h = texHeight;

      { // copy first part of scratch to the first texture
        const dx = this.freePointer.x;
        const dy = this.freePointer.row * texHeight;
        const w = firstTexW;
        
        canvas.context.drawImage(scratch, 
          0,  0,  w, h, 
          dx, dy, w, h
        );
        
        locations[0] = { 
          x: dx, 
          y: dy, 
          w: w, 
          h: texH 
        };
      }
      { // copy second part of scratch to the second texture
        const sx = firstTexW;
        const dy = (this.freePointer.row + 1) * texHeight;
        const w = secondTexW;

        if(canvas) {
          canvas.context.drawImage(scratch, 
            sx, 0, w, h, 
            0, dy, w, h
          );
        }

        locations[1] = { 
          x: 0, 
          y: dy,
          w: w,  
          h: texH 
        };
      }

      this.freePointer.x = secondTexW;
      this.freePointer.row++;
    }

    this.keyToLocation.set(key, locations);
    this.buffered = false;
    return locations;
  }

  getOffsets(key) {
    return this.keyToLocation.get(key);
  }

  isEmpty() {
    return this.freePointer.x === 0 && this.freePointer.row === 0;
  }

  canFit(bb) {
    const { atlasSize, rows } = this;
    const { texW } = this.getScale(bb);
    if(this.freePointer.x + texW > atlasSize) { // need to wrap
      return this.freePointer.row < rows - 1; // return true if there's a row to wrap to
    }
    return true;
  }

  bufferIfNeeded(gl, util) {
    if(!this.buffered) {
      this.texture = util.bufferTexture(gl, this.canvas);
      this.buffered = true;
    }
  }

}


export class AtlasControl {

  constructor(r, opts) {
    this.r = r;
    this.opts = opts;

    this.keyToIds = new Map();
    this.idToKey  = new Map();

    this.atlases = [];
    this.styleKeyToAtlas = new Map();
  }

  getKeys() {
    return new Set(this.styleKeyToAtlas.keys());
  }

  getIdsFor(key) {
    let ids = this.keyToIds.get(key);
    if(!ids) {
      ids = new Set();
      this.keyToIds.set(key, ids);
    }
    return ids;
  }

  _createAtlas() {
    const { r, opts } = this;
    return new Atlas(r, opts);
  }

  _getScratchCanvas() {
    if(!this.scratch) {
      const { r, opts } = this;
      const atlasSize = opts.webglTexSize;
      const texHeight = Math.floor(atlasSize / opts.webglTexRows);
      this.scratch = this.opts.createTextureCanvas(r, atlasSize, texHeight);
    }
    return this.scratch;
  }

  draw(id, key, bb, doDrawing) {
    let atlas = this.styleKeyToAtlas.get(key);
    if(!atlas) {
      // this is an overly simplistic way of finding an atlas, needs to be rewritten
      atlas = this.atlases[this.atlases.length - 1];
      if(!atlas || !atlas.canFit(bb)) {
        atlas = this._createAtlas();
        this.atlases.push(atlas);
      }

      atlas.draw(key, bb, doDrawing);

      this.styleKeyToAtlas.set(key, atlas);
      this.getIdsFor(key).add(id);
      this.idToKey.set(id, key);
    }
    return atlas;
  }

  getAtlas(key) {
    return this.styleKeyToAtlas.get(key);
  }

  checkKey(id, newKey) {
    console.log('checkKey', id, newKey);
    if(!this.idToKey.has(id))
      return;

    const oldKey = this.idToKey.get(id);
    if(oldKey != newKey) {
      this.idToKey.delete(id);
      this.getIdsFor(oldKey).delete(id);
    }
  }

  _getKeysToCollect() {
    const markedKeys = new Set();
    for(const key of this.styleKeyToAtlas.keys()) {
      if(this.getIdsFor(key).size == 0) {
        markedKeys.add(key);
      }
    }
    return markedKeys;
  }

  /**
   * TODO dispose of the old atlas and texture
   */
  gc() {
    const markedKeys = this._getKeysToCollect();
    if(markedKeys.size === 0) {
      console.log("nothing to garbage collect");
      return;
    }

    const newAtlases = [];
    const newStyleKeyToAtlas = new Map();

    let newAtlas = null;

    for(const atlas of this.atlases) {
      const keys = atlas.getKeys();
      
      const keysToCollect = intersection(markedKeys, keys);

      if(keysToCollect.size === 0) {
        newAtlases.push(atlas);
        keys.forEach(k => newStyleKeyToAtlas.set(k, atlas));
        continue;
      } 

      if(!newAtlas) {
        newAtlas = this._createAtlas();
        newAtlases.push(newAtlas);
      }

      for(const key of keys) {
        if(!keysToCollect.has(key)) {
          const [ s1, s2 ] = atlas.getOffsets(key);
          if(!newAtlas.canFit({ w: s1.w + s2.w, h: s1.h })) {
            newAtlas = this._createAtlas();
            newAtlases.push(newAtlas);
          }
          this._copyTextureToNewAtlas(key, atlas, newAtlas);
          newStyleKeyToAtlas.set(key, newAtlas);
        }
      }

    }

    this.atlases = newAtlases;
    this.styleKeyToAtlas = newStyleKeyToAtlas;
    // TODO, I might not clean up every key
    this.markedKeys = new Set();
  }


  _copyTextureToNewAtlas(key, oldAtlas, newAtlas) {
    const [ s1, s2 ] = oldAtlas.getOffsets(key);

    if(s2.w === 0) { // the texture does not wrap, draw directly to new atlas
      newAtlas.draw(key, s1, context => {
        context.drawImage(oldAtlas.canvas, 
          s1.x, s1.y, s1.w, s1.h, 
          0,    0,    s1.w, s1.h
        );
      });
    } else {
      // the texture wraps, first draw both parts to a scratch canvas
      const scratch = this._getScratchCanvas();
      scratch.clear();
      scratch.context.drawImage(oldAtlas.canvas, 
        s1.x, s1.y, s1.w, s1.h,
        0,    0,    s1.w, s1.h
      );
      scratch.context.drawImage(oldAtlas.canvas, 
        s2.x, s2.y, s2.w, s2.h,
        s1.w, 0,    s2.w, s2.h
      );

      // now draw the scratch to the new atlas
      const w = s1.w + s2.w;
      const h = s1.h;
      newAtlas.draw(key, { w, h }, context => {
        context.drawImage(scratch, 
          0, 0, w, h,
          0, 0, w, h   // the destination context has already been translated to the correct position
        );
      });
    }
  }


  getCounts() {
    return { 
      keyCount: this.styleKeyToAtlas.size,
      atlasCount: new Set(this.styleKeyToAtlas.values()).size
    };
  }

}


function intersection(set1, set2) {
  // TODO why no Set.intersection in node 16???
  if(set1.intersection)
    return set1.intersection(set2);
  else
    return new Set([...set1].filter(x => set2.has(x)));
}
