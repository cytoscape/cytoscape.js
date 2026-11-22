import { expect } from 'chai';
import { color2tuple, rgb2tuple, hsl2tuple, hex2tuple, colorname2tuple, colors } from '../../src/util/colors.mjs';

describe('colors', function(){

  describe('rgb2tuple', function(){
    it('parses rgb() without alpha', function(){
      expect( rgb2tuple('rgb(1, 2, 3)') ).to.deep.equal([1, 2, 3]);
    });

    it('parses rgba() with alpha', function(){
      expect( rgb2tuple('rgba(1, 2, 3, 0.5)') ).to.deep.equal([1, 2, 3, 0.5]);
    });

    it('parses rgba() with alpha of 0', function(){
      expect( rgb2tuple('rgba(1, 2, 3, 0)') ).to.deep.equal([1, 2, 3, 0]);
    });

    it('parses rgba() with alpha of 1', function(){
      expect( rgb2tuple('rgba(1, 2, 3, 1)') ).to.deep.equal([1, 2, 3, 1]);
    });

    it('rejects an out-of-range alpha', function(){
      expect( rgb2tuple('rgba(1, 2, 3, 1.5)') ).to.not.exist;
      expect( rgb2tuple('rgba(1, 2, 3, -0.5)') ).to.not.exist;
    });

    it('rounds percentages and fractional channels to the nearest integer', function(){
      expect( rgb2tuple('rgb(50%, 50%, 50%)') ).to.deep.equal([128, 128, 128]);
      expect( rgb2tuple('rgb(10%, 20%, 30%)') ).to.deep.equal([26, 51, 77]);
      expect( rgb2tuple('rgb(127.6, 0.5, 254.5)') ).to.deep.equal([128, 1, 255]);
    });
  });

  describe('hsl2tuple', function(){
    it('parses hsl() without alpha', function(){
      let tuple = hsl2tuple('hsl(0, 100%, 50%)');

      expect( tuple.length ).to.equal(4);
      expect( tuple[3] ).to.be.undefined;
      expect( tuple.slice(0, 3) ).to.deep.equal([255, 0, 0]);
    });

    it('parses hsla() with alpha', function(){
      let tuple = hsl2tuple('hsla(0, 100%, 50%, 0.5)');

      expect( tuple ).to.deep.equal([255, 0, 0, 0.5]);
    });

    it('rejects an out-of-range alpha', function(){
      expect( hsl2tuple('hsla(0, 100%, 50%, 1.5)') ).to.not.exist;
    });

    it('parses a hue with a fraction or an exponent', function(){
      expect( hsl2tuple('hsl(120.5, 100%, 50%)').slice(0, 3) ).to.deep.equal([0, 255, 2]);
      expect( hsl2tuple('hsl(0.5, 100%, 50%)').slice(0, 3) ).to.deep.equal([255, 2, 0]);
      expect( hsl2tuple('hsl(-0.5, 100%, 50%)').slice(0, 3) ).to.deep.equal([255, 0, 2]);
      expect( hsl2tuple('hsl(1e2, 100%, 50%)').slice(0, 3) ).to.deep.equal([85, 255, 0]);
    });
  });

  describe('hex2tuple', function(){
    it('parses long form hex with no alpha channel', function(){
      expect( hex2tuple('#010203') ).to.deep.equal([1, 2, 3]);
    });

    it('parses short form hex with no alpha channel', function(){
      expect( hex2tuple('#123') ).to.deep.equal([17, 34, 51]);
    });
  });

  describe('colorname2tuple', function(){
    it('preserves alpha === 0 for the color name `transparent`', function(){
      expect( colorname2tuple('transparent') ).to.deep.equal([0, 0, 0, 0]);
    });

    it('returns a plain rgb tuple for a named color', function(){
      expect( colorname2tuple('red') ).to.deep.equal( colors.red );
    });
  });

  describe('color2tuple', function(){
    it('preserves alpha from rgba()', function(){
      expect( color2tuple('rgba(10, 20, 30, 0.25)') ).to.deep.equal([10, 20, 30, 0.25]);
    });

    it('preserves alpha from hsla()', function(){
      expect( color2tuple('hsla(0, 100%, 50%, 0.25)') ).to.deep.equal([255, 0, 0, 0.25]);
    });

    it('preserves alpha === 0 for string value `transparent`', function(){
      expect( color2tuple('transparent') ).to.deep.equal([0, 0, 0, 0]);
    });

    it('passes an array color straight through with alpha included', function(){
      expect( color2tuple([1, 2, 3, 0.5]) ).to.deep.equal([1, 2, 3, 0.5]);
    });

    it('has no alpha element for a plain rgb() color', function(){
      expect( color2tuple('rgb(1, 2, 3)')[3] ).to.be.undefined;
    });
  });
});