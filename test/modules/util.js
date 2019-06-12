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

    if( process.env.TRAVIS ){
      // run this test only on travis because it's slow

      it('hash is unique per two-uint combos on 0...1000', function(){
        this.timeout(5 * 60 * 1000);

        var min = 0;
        var max = 1000;
        var hashes = {};
        var i, j, h, arr = [0, 0];

        for( i = min; i <= max; i++ ){
          for( j = min; j <= max; j++ ){
            arr[0] = i;
            arr[1] = j;

            h = hashIntsArray(arr);

            expect(hashes[h]).to.not.exist;

            hashes[h] = true;
          }
        }
      });
    }

    it('hash is unique for random int pairs', function(){
      var N = 100000;
      var min = 0;
      var max = 100;
      var hashes = {};
      var i, h, arr = [0, 0];
      var existing;
      var a, b, A, B;

      for( i = 0; i < N; i++ ){
        arr = [randInt(min, max), randInt(min, max)];

        h = hashIntsArray(arr);

        existing = hashes[h];

        if( existing != null ){
          a = arr[0];
          b = arr[1];
          A = existing.arr[0];
          B = existing.arr[1];

          if( (a !== A || b !== B) ){
            throw new Error(a + ',' + b + ' collides with ' + A + ',' + B);
          }
        }

        hashes[h] = { arr: arr, val: h };
      }
    });

    function testMTuple(M){
      it('hash is unique for random int ' + M + '-tuple', function(){
        var N = 100000;
        var min1 = 0;
        var max1 = 100;
        var min2 = 2147483647 - 1024;
        var max2 = 2147483647;
        var hashes = {};
        var i, h, arr = [0, 0];
        var existing;
        var t1, t2;
        var low;
  
        var getTupleString = function(arr){ return arr.join(','); };
  
        for( i = 0; i < N; i++ ){
          arr = [];

          for( var j = 0; j < M; j++ ){
            low = Math.random() < 0.8;
            arr.push( low ? randInt(min1, max1) : randInt(min2, max2) );
          }
  
          h = hashIntsArray(arr);
  
          existing = hashes[h];
  
          if( existing != null ){
            t1 = getTupleString(arr);
            t2 = getTupleString(existing.arr);
  
            console.log(t1, t2)

            if( t1 !== t2 ){
              throw new Error(t1 + ' matches ' + t2 + ' with value ' + h);
            }
          }
  
          hashes[h] = { arr: arr, val: h };
        }
      });
    }

    (function(){
      for( var i = 3; i <= 10; i++ ){
        testMTuple(i);
      }
    })(); 

    it('hash is unique for random low-high int pairs', function(){
      var N = 1000;
      var min1 = 0;
      var max1 = 100;
      var min2 = 2147483647 - 1024;
      var max2 = 2147483647;
      var hashes = {};
      var i, h, arr = [0, 0];
      var existing;
      var a, b, A, B;

      for( i = 0; i < N; i++ ){
        arr = [randInt(min1, max1), randInt(min2, max2)];

        h = hashIntsArray(arr);

        existing = hashes[h];

        if( existing != null ){
          a = arr[0];
          b = arr[1];
          A = existing.arr[0];
          B = existing.arr[1];

          if( (a !== A || b !== B) ){
            throw new Error(a + ',' + b + ' collides with ' + A + ',' + B);
          }
        }

        hashes[h] = { arr: arr, val: h };
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
  });

});
