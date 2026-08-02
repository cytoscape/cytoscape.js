import { expect } from 'chai';
import { layoutLabel } from '../src/gpu/render/label-layout.mjs';
import { computeSdf, SDF_RADIUS } from '../src/gpu/render/glyph-atlas.mjs';
import { GlyphBuffer, GLYPH_WORDS, DEAD_GLYPH } from '../src/gpu/render/glyph-buffer.mjs';

// Node-testable pieces of the SDF label renderer: the pure layout math,
// the distance-transform core, and the glyph instance buffer (mock queue).

describe('gpu/labels: render pieces', function(){

  describe('layoutLabel()', function(){
    // fake metrics: every glyph is 10 wide (advance), ink 8×12 at pad 2
    var metricsFor = ch => {
      if( ch === ' ' ){ return { advance: 5, planeX: 0, planeY: 0, w: 0, h: 0, u0: 0, v0: 0, u1: 0, v1: 0 }; }
      if( ch === '?' ){ return null; } // pretend the atlas is full for '?'

      return { advance: 10, planeX: -2, planeY: -14, w: 12, h: 16, u0: 0.1, v0: 0.2, u1: 0.3, v1: 0.4 };
    };

    it('returns nothing for empty text', function(){
      expect( layoutLabel('', metricsFor, 24) ).to.have.length(0);
    });

    it('advances the pen and centers horizontally', function(){
      var glyphs = layoutLabel('abc', metricsFor, 24);

      expect( glyphs ).to.have.length(3);

      // total width 30 => pens at -15, -5, 5; quad x = pen + planeX
      expect( glyphs.map( g => g.x ) ).to.deep.equal([ -17, -7, 3 ]);
      expect( glyphs[0].y ).to.equal(24 - 14); // ascent + planeY
      expect( glyphs[0].w ).to.equal(12);
      expect( glyphs[0].u1 ).to.equal(0.3);
    });

    it('advances for whitespace without emitting quads', function(){
      var glyphs = layoutLabel('a b', metricsFor, 24);

      expect( glyphs ).to.have.length(2);
      // width 25 => pens 0 and 15 => x = pen - 12.5 + planeX
      expect( glyphs[0].x ).to.equal(-14.5);
      expect( glyphs[1].x ).to.equal(0.5);
    });

    it('skips glyphs the atlas cannot supply', function(){
      expect( layoutLabel('a?b', metricsFor, 24) ).to.have.length(2);
    });

    it('treats newlines as spaces (single-line)', function(){
      expect( layoutLabel('a\nb', metricsFor, 24) ).to.have.length(2);
    });
  });

  describe('computeSdf()', function(){
    it('maps inside to high, edge to ~half, outside to low', function(){
      // 9x9 grid with a filled 5x5 square in the middle
      var w = 9, h = 9;
      var alpha = new Uint8Array(w * h);

      for( var y = 2; y <= 6; y++ ){
        for( var x = 2; x <= 6; x++ ){
          alpha[y * w + x] = 255;
        }
      }

      var sdf = computeSdf(alpha, w, h);

      var at = (x, y) => sdf[y * w + x];

      expect( at(4, 4) ).to.be.above(200); // deep inside
      expect( at(0, 0) ).to.be.below(60); // far outside (dist ~2.8 of radius 8... clearly darker)
      expect( at(1, 4) ).to.be.below(128); // just outside
      expect( at(3, 4) ).to.be.above(128); // just inside

      // one px further out drops by ~255/SDF_RADIUS
      var step = 255 / SDF_RADIUS;

      expect( at(1, 4) - at(0, 4) ).to.be.closeTo(step, 3);
    });

    it('is monotonic along a ray from the shape', function(){
      var w = 16, h = 3;
      var alpha = new Uint8Array(w * h);

      for( var y = 0; y < h; y++ ){ alpha[y * w] = 255; } // filled left column

      var sdf = computeSdf(alpha, w, h);

      for( var x = 1; x < w; x++ ){
        expect( sdf[w + x] ).to.be.at.most( sdf[w + x - 1] );
      }
    });
  });

  describe('GlyphBuffer', function(){
    var mock, buffer;

    var makeMockDevice = () => {
      var writes = [];
      var created = [];
      var workDone = [];

      return {
        writes,
        created,
        flushWorkDone(){ workDone.forEach( r => r() ); workDone.length = 0; },
        device: {
          createBuffer( descriptor ){
            var buf = { size: descriptor.size, destroyed: false, destroy(){ this.destroyed = true; } };

            created.push(buf);

            return buf;
          },
          queue: {
            writeBuffer( buf, offset, data, dataOffset, size ){
              writes.push({ buf, offset, dataOffset, size });
            },
            onSubmittedWorkDone(){
              return new Promise( resolve => workDone.push(resolve) );
            }
          }
        }
      };
    };

    var glyphWords = (count, marker) => {
      var words = new Uint32Array(count * GLYPH_WORDS);

      for( var i = 0; i < count; i++ ){
        words[i * GLYPH_WORDS] = 0; // nodeSlot placeholder; caller semantics
        words[i * GLYPH_WORDS + 1] = marker;
      }

      return words;
    };

    beforeEach(function(){
      mock = makeMockDevice();
      buffer = new GlyphBuffer(mock.device, 8);
    });

    it('appends runs and tracks the draw count', function(){
      buffer.set(0, glyphWords(3, 7));
      buffer.set(1, glyphWords(2, 9));

      expect( buffer.highWater ).to.equal(5);
      expect( buffer.count() ).to.equal(5);
    });

    it('uploads one coalesced span per sync', function(){
      buffer.set(0, glyphWords(3, 7));
      buffer.set(1, glyphWords(2, 9));
      buffer.sync();

      expect( mock.writes ).to.have.length(1);
      expect( mock.writes[0].offset ).to.equal(0);
      expect( mock.writes[0].size ).to.equal(5 * GLYPH_WORDS * 4);

      buffer.sync(); // clean ⇒ no-op

      expect( mock.writes ).to.have.length(1);
    });

    it('tombstones replaced runs and appends the new one', function(){
      buffer.set(0, glyphWords(3, 7));
      buffer.set(1, glyphWords(2, 9));
      buffer.sync();
      mock.writes.length = 0;

      buffer.set(0, glyphWords(1, 8)); // replace node 0's run

      expect( buffer.count() ).to.equal(3); // 2 live from node 1 + 1 new
      expect( buffer.highWater ).to.equal(6);

      buffer.sync();

      // span covers the tombstoned old run through the appended new run
      expect( mock.writes ).to.have.length(1);
      expect( mock.writes[0].offset ).to.equal(0);
      expect( mock.writes[0].size ).to.equal(6 * GLYPH_WORDS * 4);
    });

    it('clears runs with null', function(){
      buffer.set(0, glyphWords(3, 7));
      buffer.set(0, null);

      expect( buffer.count() ).to.equal(0);
    });

    it('compacts when garbage dominates', function(){
      for( var i = 0; i < 40; i++ ){
        buffer.set(i, glyphWords(4, i));
      }

      var before = buffer.highWater;

      for( var j = 0; j < 39; j++ ){
        buffer.set(j, null);
      }

      expect( buffer.highWater ).to.be.below(before); // compacted
      expect( buffer.count() ).to.equal(4); // node 39's run survives
      expect( buffer.highWater ).to.be.at.most(8); // bounded garbage tail
    });

    it('rewrites a same-count replacement in place (25.5: no growth under a tween)', function(){
      buffer.set(0, glyphWords(3, 7));
      buffer.set(1, glyphWords(2, 9));
      buffer.sync();
      mock.writes.length = 0;

      var before = buffer.highWater;

      // the font-size tween's steady state: same glyph count per tick
      for( var t = 0; t < 50; t++ ){
        buffer.set(0, glyphWords(3, 100 + t));
      }

      expect( buffer.highWater ).to.equal(before); // no append growth
      expect( buffer.count() ).to.equal(5);        // no tombstones

      // one coalesced span over node 0's existing range only, holding
      // the last tick's in-place words
      var captured;

      mock.device.queue.writeBuffer = function( buf, offset, data, dataOffset, size ){
        mock.writes.push({ buf, offset, dataOffset, size });
        captured = new Uint32Array( data.slice(dataOffset, dataOffset + size) );
      };

      buffer.sync();

      expect( mock.writes ).to.have.length(1);
      expect( mock.writes[0].offset ).to.equal(0);
      expect( mock.writes[0].size ).to.equal(3 * GLYPH_WORDS * 4);
      expect( captured[1] ).to.equal(149);
    });

    it('reallocates the GPU buffer on growth with a version bump', async function(){
      var oldGpu = buffer.buffer();
      var versionBefore = buffer.version;

      buffer.set(0, glyphWords(20, 1)); // exceeds initial cap of 8
      buffer.sync();

      expect( buffer.version ).to.be.above(versionBefore);
      expect( buffer.buffer() ).to.not.equal(oldGpu);
      expect( buffer.buffer().size ).to.be.at.least(20 * GLYPH_WORDS * 4);

      // full re-upload happened on the new buffer
      var full = mock.writes.find( w => w.buf === buffer.buffer() && w.offset === 0 );

      expect( full ).to.exist;

      // old buffer destroyed only after submitted work completes
      expect( oldGpu.destroyed ).to.be.false;
      mock.flushWorkDone();
      await new Promise( r => setTimeout(r, 0) );
      expect( oldGpu.destroyed ).to.be.true;
    });

    it('writes dead sentinels for tombstoned glyphs', function(){
      buffer.set(0, glyphWords(2, 7));
      buffer.sync();
      buffer.set(0, null);

      var captured;

      mock.device.queue.writeBuffer = function( buf, offset, data, dataOffset, size ){
        captured = new Uint32Array( data.slice(dataOffset, dataOffset + size) );
      };

      buffer.sync();

      expect( captured[0] ).to.equal(DEAD_GLYPH);
      expect( captured[GLYPH_WORDS] ).to.equal(DEAD_GLYPH);
    });
  });

});
