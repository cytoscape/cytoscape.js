import { expect } from 'chai';
import { hashString, hashInt, hashIntsArray, hashStrings } from '../../src/util';

var randInt = function(min, max){
  return Math.round(Math.random() * (max - min) + min);
};

describe('util', function(){

  describe('hash', function(){
    it('gives same result with seed for one-char strings', function(){
      var h1 = hashString('a');
      var h2 = hashString('b', h1);
      var h3 = hashString('ab');

      expect(h2).to.equal(h3);
    });

    it('gives same result with seed for multi-char strings', function(){
      var h1 = hashString('foo');
      var h2 = hashString('bar', h1);
      var h3 = hashString('foobar');

      expect(h2).to.equal(h3);
    });

    it('gives different results for strings of opposite order', function(){
      var h1 = hashString('foobar');
      var h2 = hashString('raboof');

      expect(h1).to.not.equal(h2);
    });

    // usecase : separate hashes can be joined
    it('gives same result by hashing individual ints', function(){
      var a = 846302;
      var b = 466025;

      var h1 = hashInt(a);
      var h2 = hashInt(b, h1);

      var h3 = hashIntsArray([a, b]);

      expect(h2).to.equal(h3);
    });

    // main usecase is hashing ascii strings for style properties
    it('hash is unique per ascii char', function(){
      var min = 0;
      var max = 127;
      var hashes = {};

      for( var i = min; i <= max; i++ ){
        var h = hashInt(i);

        expect( hashes[h] ).to.not.exist;

        hashes[h] = true;
      }
    });

    it('hash is different for negative numbers', function(){
      for( var i = 1; i < 1000; i++ ){
        var h = hashInt(i);
        var hn = hashInt(-i);

        expect(h, 'hash '+i).to.not.equal(hn, 'hash -'+i);
      }
    });

    it('hash is unique for common values', function(){
      var v = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 16, 18, 20, 22, 24, 25, 30, 32, 35, 36, 40, 42, 45, 48, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100 ];
      var N = v.length;

      for( var i = 0; i < N; i++ ){
        var vi = v[i];
        var hi = hashInt(vi);

        for( var j = i + 1; j < N; j++ ){
          var vj = v[j];
          var hj = hashInt(vj);

          expect(hi, 'vi ' + vi).to.not.equal(hj, 'vj ' + vj);
        }
      }
    });

    it('hash is unique for simulated style', function(){
      var h1 = hashString('ellipse');
      h1 = hashInt(30, h1);
      h1 = hashInt(30, h1);
      h1 = hashString('blue', h1);

      var h2 = hashString('ellipse');
      h2 = hashInt(35, h2);
      h2 = hashInt(35, h2);
      h2 = hashString('red', h2);
      h2 = hashInt(2, h2);
      h2 = hashString('green', h2);

      expect(h1).to.not.equal(h2);
    });

    // problematic for djb2
    it('"000Q" versus "0010"', function(){
      var h1 = hashString('000Q');
      var h2 = hashString('0010');

      expect(h1).to.not.equal(h2);
    });

    // problematic for djb2
    it('hash is unique for random id strings', function(){
      var ids = ["0000","0007","0005","000P","000B","0008","000G","000L","0006","000T","000V","000W","000M","000Q","000O","000F","000K","0012","000N","000X","000Y","000Z","0010","0014","0011","0013","000S"];
      var hashes = ids.map(hashString);
      var numUniqueHashes = (new Set(hashes)).size;

      expect(numUniqueHashes).to.equal(hashes.length);
    });

    it('Long string with shared suffix', function(){
      var h1 = hashString('Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.');
      var h2 = hashString('Some beginning.  Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.');

      expect(h1).to.not.equal(h2);
    });

    it('Long string with shared prefix', function(){
      var h1 = hashString('Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.');
      var h2 = hashString('Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.  Some ending.');

      expect(h1).to.not.equal(h2);
    });
  });

});
