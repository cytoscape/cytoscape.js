import { describe } from 'mocha';
import { expect } from 'chai';
import { Atlas, AtlasCollection } from '../../src/extensions/renderer/canvas/webgl/atlas';


function createTextureCanvas(r, width, height) {
  const canvas = {};
  canvas.context = {
    drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh) {
      if(sw !== dw || sh !== dh) {
        throw new Error("assuming width and height should be the same when drawing");
      }
    },
    save() { },
    translate(xOffset, yOffset) { },
    scale(xScale, yScale) { },
    restore() { },
  }
  canvas.clear = () => { };

  return canvas;
}

function createAtlas(webglTexSize = 100, webglTexRows = 10) {
  return new Atlas(null, { 
    webglTexSize, 
    webglTexRows, 
    createTextureCanvas,
    enableWrapping: true
  });
}

function createAtlasCollection(webglTexSize = 100, webglTexRows = 10) {
  return new AtlasCollection(null, { 
    webglTexSize, 
    webglTexRows, 
    createTextureCanvas,
    enableWrapping: true
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


  it('AtlasCollection draws and wraps', function() {
    const atlasCollection = createAtlasCollection();
    let atlas;

    atlas = atlasCollection.draw('a', 1, { h:10, w:100 });
    expect(atlas.getOffsets(1)).to.eql([ { x: 0, y: 0, w: 100, h: 10 }, { x: 100, y: 0, w: 0, h: 10 } ]);
    
    atlas = atlasCollection.draw('b', 2, { h:10, w:50 });
    expect(atlas.getOffsets(2)).to.eql([ { x: 0, y: 10, w: 50, h: 10 }, { x: 50, y: 10, w: 0, h: 10 } ]);

    atlas = atlasCollection.draw('c', 3, { h:10, w:100 });
    expect(atlas.getOffsets(3)).to.eql([ { x: 50, y: 10, w: 50, h: 10 }, { x: 0, y: 20, w: 50, h: 10 } ]);
  });


  it('AtlasCollection garbage collects (easy)', function() {
    const ac = createAtlasCollection();
    ac.draw('a', 1, { h:10, w:100 });
    ac.draw('b', 2, { h:10, w:50  });
    ac.draw('c', 3, { h:10, w:100 });
    expect(ac.getCounts().keyCount).to.equal(3);

    ac.checkKey('b', 4); 
    ac.gc();

    expect(ac.getCounts().keyCount).to.equal(2);
    expect(ac.getAtlas(1).getOffsets(1)).to.eql([ { x: 0, y: 0, w: 100, h: 10 }, { x: 100, y: 0, w: 0, h: 10 } ]);
    expect(ac.getAtlas(2)).to.be.undefined;
    expect(ac.getAtlas(3).getOffsets(3)).to.eql([ { x: 0, y: 10, w: 100, h: 10 }, { x: 100, y: 10, w: 0, h: 10 } ]);
  });


  it('AtlasCollection garbage collects (hard)', function() {
    const ac = createAtlasCollection(100, 4); // height is 25
    ac.draw('a', 1, { h:25, w:100 });
    ac.draw('b', 2, { h:25, w:75  });
    ac.draw('c', 3, { h:25, w:50  });
    ac.draw('d', 4, { h:25, w:100 });
    ac.draw('e', 5, { h:25, w:50  });
    ac.draw('f', 6, { h:25, w:75  });
    ac.draw('g', 7, { h:25, w:75  });

    expect(ac.getCounts().keyCount).to.equal(7);
    expect(ac.getCounts().atlasCount).to.equal(2);

    ac.checkKey('b', 8);
    ac.checkKey('e', 9);
    ac.checkKey('g', 10);

    ac.gc();

    expect(ac.getCounts().keyCount).to.equal(4);
    expect(ac.getCounts().atlasCount).to.equal(1);
    expect(ac.getAtlas(1).getOffsets(1)).to.eql([ { x: 0,  y: 0,  w: 100, h: 25 }, { x: 100, y: 0,  w: 0,  h: 25 } ]);
    expect(ac.getAtlas(3).getOffsets(3)).to.eql([ { x: 0,  y: 25, w: 50,  h: 25 }, { x: 50,  y: 25, w: 0,  h: 25 } ]);
    expect(ac.getAtlas(4).getOffsets(4)).to.eql([ { x: 50, y: 25, w: 50,  h: 25 }, { x: 0,   y: 50, w: 50, h: 25 } ]);
    expect(ac.getAtlas(6).getOffsets(6)).to.eql([ { x: 50, y: 50, w: 50,  h: 25 }, { x: 0,   y: 75, w: 25, h: 25 } ]);

    ac.draw('h', 11, { h:25, w:100 });

    expect(ac.getCounts().keyCount).to.equal(5);
    expect(ac.getCounts().atlasCount).to.equal(2);
    expect(ac.getAtlas(11).getOffsets(11)).to.eql([ { x: 0, y: 0, w: 100,  h: 25 }, { x: 100, y: 0,  w: 0,  h: 25 } ]);
  });

});