import { describe } from 'mocha';
import { expect } from 'chai';
import { Atlas, AtlasCollection, AtlasManager } from '../../src/extensions/renderer/canvas/webgl/atlas';


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
  };
  canvas.clear = () => {};

  return canvas;
}

function createAtlas(webglTexSize = 100, webglTexRows = 10) {
  return new Atlas(
    null,
    webglTexSize, 
    webglTexRows, 
    createTextureCanvas
  );
}

function createAtlasCollection(webglTexSize = 100, webglTexRows = 10) {
  return new AtlasCollection(
    null, 
    webglTexSize, 
    webglTexRows, 
    createTextureCanvas
  );
}

function createAtlasManager(webglTexSize = 100, webglTexPerBatch = 16) {
  return new AtlasManager(
    null, 
    {
      webglTexSize,
      webglTexPerBatch,
      createTextureCanvas
    }
  );
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

    expect(atlas.isEmpty()).to.be.false;
    expect([...atlas.getKeys()]).to.have.members([1, 2, 3]);
  });


  it('AtlasCollection draws and wraps', function() {
    const atlasCollection = createAtlasCollection();
    let atlas;

    atlas = atlasCollection.draw(1, { h:10, w:100 });
    expect(atlas.getOffsets(1)).to.eql([ { x: 0, y: 0, w: 100, h: 10 }, { x: 100, y: 0, w: 0, h: 10 } ]);
    
    atlas = atlasCollection.draw(2, { h:10, w:50 });
    expect(atlas.getOffsets(2)).to.eql([ { x: 0, y: 10, w: 50, h: 10 }, { x: 50, y: 10, w: 0, h: 10 } ]);

    atlas = atlasCollection.draw(3, { h:10, w:100 });
    expect(atlas.getOffsets(3)).to.eql([ { x: 50, y: 10, w: 50, h: 10 }, { x: 0, y: 20, w: 50, h: 10 } ]);
  });


  it('AtlasCollection garbage collects (easy)', function() {
    const ac = createAtlasCollection();
    ac.draw(1, { h:10, w:100 });
    ac.draw(2, { h:10, w:50  });
    ac.draw(3, { h:10, w:100 });
    expect(ac.getCounts().keyCount).to.equal(3);

    ac.markKeyForGC(2);
    ac.gc();

    expect(ac.getCounts().keyCount).to.equal(2);
    expect(ac.getAtlas(1).getOffsets(1)).to.eql([ { x: 0, y: 0, w: 100, h: 10 }, { x: 100, y: 0, w: 0, h: 10 } ]);
    expect(ac.getAtlas(2)).to.be.undefined;
    expect(ac.getAtlas(3).getOffsets(3)).to.eql([ { x: 0, y: 10, w: 100, h: 10 }, { x: 100, y: 10, w: 0, h: 10 } ]);
  });


  it('AtlasCollection garbage collects (hard)', function() {
    const ac = createAtlasCollection(100, 4); // height is 25
    ac.draw(1, { h:25, w:100 });
    ac.draw(2, { h:25, w:75  });
    ac.draw(3, { h:25, w:50  });
    ac.draw(4, { h:25, w:100 });
    ac.draw(5, { h:25, w:50  });
    ac.draw(6, { h:25, w:75  });
    ac.draw(7, { h:25, w:75  });

    expect(ac.getCounts().keyCount).to.equal(7);
    expect(ac.getCounts().atlasCount).to.equal(2);

    ac.markKeyForGC(2);
    ac.markKeyForGC(5); 
    ac.markKeyForGC(7); 
    ac.gc();

    expect(ac.getCounts().keyCount).to.equal(4);
    expect(ac.getCounts().atlasCount).to.equal(1);
    expect(ac.getAtlas(1).getOffsets(1)).to.eql([ { x: 0,  y: 0,  w: 100, h: 25 }, { x: 100, y: 0,  w: 0,  h: 25 } ]);
    expect(ac.getAtlas(3).getOffsets(3)).to.eql([ { x: 0,  y: 25, w: 50,  h: 25 }, { x: 50,  y: 25, w: 0,  h: 25 } ]);
    expect(ac.getAtlas(4).getOffsets(4)).to.eql([ { x: 50, y: 25, w: 50,  h: 25 }, { x: 0,   y: 50, w: 50, h: 25 } ]);
    expect(ac.getAtlas(6).getOffsets(6)).to.eql([ { x: 50, y: 50, w: 50,  h: 25 }, { x: 0,   y: 75, w: 25, h: 25 } ]);

    ac.draw(11, { h:25, w:100 });

    expect(ac.getCounts().keyCount).to.equal(5);
    expect(ac.getCounts().atlasCount).to.equal(2);
    expect(ac.getAtlas(11).getOffsets(11)).to.eql([ { x: 0, y: 0, w: 100,  h: 25 }, { x: 100, y: 0,  w: 0,  h: 25 } ]);
  });


  it('AtlasManager draws and garbage collects', function() {
    const am = createAtlasManager(100, 2);

    expect(am.getAtlasSize()).to.equal(100);
    expect(am.getMaxAtlasesPerBatch()).to.equal(2);

    // Configure the AtlasManager
    am.addAtlasCollection('node',  { texRows: 4  }); // texture height 25
    am.addAtlasCollection('label', { texRows: 10 }); // texture height 10

    let styleKeySuffix = 0;
    am.addRenderType('node-body', { 
      collection: 'node',
      getBoundingBox: () => ({ h:50, w:50 }),
      getKey: x => `node-body-${x}-${styleKeySuffix}`,
      getID: x => x,
      drawElement: () => null
    });
    am.addRenderType('node-underlay', { 
      collection: 'node',
      getBoundingBox: () => ({ h:50, w:50 }),
      getKey: x => `node-underlay-${x}-${styleKeySuffix}`,
      getID: x => x,
      drawElement: () => null
    });
    am.addRenderType('node-label', { 
      collection: 'label',
      getBoundingBox: () => ({ h:25, w:100 }),
      getKey: x => `node-label-${x}-${styleKeySuffix}`,
      getID: x => x,
      drawElement: () => null
    });
    am.addRenderType('bogus', { 
      collection: 'label',
      getKey: x => `bogus-${x}`,
      getID: x => x,
      drawElement: () => null
    });

    expect(() => am.addRenderType('blah', { collection: 'blah' }))
      .to.throw(`invalid atlas collection name 'blah'`);

    expect(am.getAtlasCollection('node')).to.be.an.instanceof(AtlasCollection);
    expect(am.getAtlasCollection('label')).to.be.an.instanceof(AtlasCollection);
    expect(am.getAtlasCollection('blah')).to.be.an('undefined');

    // "Draw" some stuff (the drawElement functions above are no-ops)
    const atlasUnderlay = am.getOrCreateAtlas('n1', 'node-underlay');
    const atlasBody = am.getOrCreateAtlas('n1', 'node-body');
    const atlasLabel = am.getOrCreateAtlas('n1', 'node-label');

    expect(atlasUnderlay).to.be.an.instanceof(Atlas);
    expect(atlasBody).to.be.an.instanceof(Atlas);
    expect(atlasLabel).to.be.an.instanceof(Atlas);
   
    expect(atlasUnderlay).to.equal(atlasBody);
    expect(atlasLabel).to.not.equal(atlasUnderlay);
    expect(atlasLabel).to.not.equal(atlasBody);
    
    // Start a draw batch, atlas index becomes a fragment shader texture unit
    am.startBatch();
    expect(am.getAtlasCount()).to.equal(0);
    expect(am.getAtlasIndexForBatch(atlasUnderlay)).to.equal(0);
    expect(am.getAtlasIndexForBatch(atlasBody)).to.equal(0);
    expect(am.getAtlasIndexForBatch(atlasLabel)).to.equal(1);
    expect(am.getAtlasCount()).to.equal(2);
    expect(am.canAddToCurrentBatch('b1', 'bogus')).to.be.false;

    // Check things are correct
    const ai = am.getAtlasInfo('n1', 'node-body');
    expect(ai.index).to.equal(0);
    expect(ai.bb).to.eql({ h:50, w:50 });
    expect(ai.tex1).to.eql({ x: 25, y: 0, w: 25, h: 25 });
    expect(ai.tex2).to.eql({ x: 50, y: 0, w: 0,  h: 25 });

    // draw some more stuff
    const atlasN2 = am.getOrCreateAtlas('n2', 'node-body');
    const atlasN3 = am.getOrCreateAtlas('n3', 'node-body');
    expect(atlasBody).to.equal(atlasN2);
    expect(atlasBody).to.equal(atlasN3);

    const ai2 = am.getAtlasInfo('n2', 'node-body');
    expect(ai2.tex1).to.eql({ x: 50, y: 0, w: 25, h: 25 });
    expect(ai2.tex2).to.eql({ x: 75, y: 0, w: 0,  h: 25 });

    expect([...atlasLabel.getKeys()])
      .to.have.members(['node-label-n1-0']);
    expect([...atlasBody.getKeys()])
      .to.have.members(['node-underlay-n1-0', 'node-body-n1-0', 'node-body-n2-0', 'node-body-n3-0']);

    // invalidate some elements
    styleKeySuffix = 1; // change the style key, models the case where elements style changes

    const needGC = am.invalidate(['n1']);
    expect(needGC).to.be.true;

    // garbage collect
    am.gc();

    // Draw the elements again
    const atlasUnderlay2 = am.getOrCreateAtlas('n1', 'node-underlay');
    const atlasBody2 = am.getOrCreateAtlas('n1', 'node-body');
    const atlasLabel2 = am.getOrCreateAtlas('n1', 'node-label');
    expect(atlasUnderlay2).to.equal(atlasBody2);

    expect([...atlasLabel2.getKeys()])
      .to.have.members(['node-label-n1-1']);
    expect([...atlasBody2.getKeys()])
      .to.have.members(['node-underlay-n1-1', 'node-body-n1-1', 'node-body-n2-0', 'node-body-n3-0']);
  });
});