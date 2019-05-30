import { expect } from 'chai';
import { hashString, hashInt, hashIntsArray } from '../../src/util';

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
  });

});
