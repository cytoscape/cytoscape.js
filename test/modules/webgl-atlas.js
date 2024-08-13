import { describe } from 'mocha';
import { expect } from 'chai';
import Atlas from '../../src/extensions/renderer/canvas/webgl/atlas';

describe('webgl-atlas', function() {

  it('draws and wraps', function() {
    const atlas = new Atlas(null, { webglTexSize: 100, webglTexRows: 10 });
    expect(atlas.isEmpty()).to.be.true;

    const offsets1 = atlas.draw(1, { h:10, w:100 });
    expect(offsets1).to.eql([ { x: 0, y: 0, w: 100, h: 10 }, { x: 100, y: 0, w: 0, h: 10 } ]);
    
    const offsets2 = atlas.draw(2, { h:10, w:50 });
    expect(offsets2).to.eql([ { x: 0, y: 10, w: 50, h: 10 }, { x: 50, y: 10, w: 0, h: 10 } ]);

    const offsets3 = atlas.draw(3, { h:10, w:100 });
    expect(offsets3).to.eql([ { x: 50, y: 10, w: 50, h: 10 }, { x: 0, y: 20, w: 50, h: 10 } ]);

    expect(atlas.isEmpty()).to.be.false;
  });


});