import { describe } from 'mocha';
import { expect } from 'chai';
import { Atlas, AtlasControl } from '../../src/extensions/renderer/canvas/webgl/atlas';


function createTextureCanvasMock(r, width, height) {
  // const canvas = new Array(width);
  // for(let x = 0; x < width; x++) {
  //   canvas[x] = new Array(height);
  // }
  const canvas = {};
  canvas.context = {
    drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh) {
      if(sw !== dw || sh !== dh) {
        throw new Error("assuming width and height should be the same when drawing");
      }
    },
    save() {
    },
    translate(xOffset, yOffset) {
    },
    scale(xScale, yScale) {
    },
    restore() {
    },
  }
  canvas.clear = () => {
  };

  return canvas;
}

function createAtlas() {
  return new Atlas(null, { 
    webglTexSize: 100, 
    webglTexRows: 10, 
    createTextureCanvas: createTextureCanvasMock 
  });
}

function createAtlasControl() {
  return new AtlasControl(null, { 
    webglTexSize: 100, 
    webglTexRows: 10, 
    createTextureCanvas: createTextureCanvasMock 
  });
}


describe('webgl-atlas', function() {

  it('Atlas draws and wraps', function() {
    const atlas = createAtlas();
    expect(atlas.isEmpty()).to.be.true;

    const offsets1 = atlas.draw(1, { h:10, w:100 });
    expect(offsets1).to.eql([ { x: 0, y: 0, w: 100, h: 10 }, { x: 100, y: 0, w: 0, h: 10 } ]);
    
    const offsets2 = atlas.draw(2, { h:10, w:50 });
    expect(offsets2).to.eql([ { x: 0, y: 10, w: 50, h: 10 }, { x: 50, y: 10, w: 0, h: 10 } ]);

    const offsets3 = atlas.draw(3, { h:10, w:100 });
    expect(offsets3).to.eql([ { x: 50, y: 10, w: 50, h: 10 }, { x: 0, y: 20, w: 50, h: 10 } ]);

    // TODO add case where width > webglTexSize

    expect(atlas.isEmpty()).to.be.false;
  });


  it('AtlasControl draws and wraps', function() {
    const atlasControl = createAtlasControl();
    let atlas;

    atlas = atlasControl.draw(1, 'a', { h:10, w:100 });
    const offsets1 = atlas.getTexOffsets(1);
    expect(offsets1).to.eql([ { x: 0, y: 0, w: 100, h: 10 }, { x: 100, y: 0, w: 0, h: 10 } ]);
    
    atlas = atlasControl.draw(2, 'b', { h:10, w:50 });
    const offsets2 = atlas.getTexOffsets(2);
    expect(offsets2).to.eql([ { x: 0, y: 10, w: 50, h: 10 }, { x: 50, y: 10, w: 0, h: 10 } ]);

    atlas = atlasControl.draw(3, 'c', { h:10, w:100 });
    const offsets3 = atlas.getTexOffsets(3);
    expect(offsets3).to.eql([ { x: 50, y: 10, w: 50, h: 10 }, { x: 0, y: 20, w: 50, h: 10 } ]);
  });


  it('AtlasControl garbage collects (easy)', function() {
    const atlasControl = createAtlasControl();
    atlasControl.draw(1, 'a', { h:10, w:100 });
    atlasControl.draw(2, 'b', { h:10, w:50  });
    atlasControl.draw(3, 'c', { h:10, w:100 });

    atlasControl.invalidate(4, 'b'); 
    atlasControl.gc();

    const offsets1 = atlasControl.getAtlas(1).getTexOffsets(1);
    expect(offsets1).to.eql([ { x: 0, y: 0, w: 100, h: 10 }, { x: 100, y: 0, w: 0, h: 10 } ]);

    expect(atlasControl.getAtlas(2)).to.be.undefined;

    const offsets3 = atlasControl.getAtlas(3).getTexOffsets(3);
    expect(offsets3).to.eql([ { x: 0, y: 10, w: 100, h: 10 }, { x: 100, y: 10, w: 0, h: 10 } ]);
  });

});