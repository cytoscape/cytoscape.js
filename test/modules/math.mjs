import { expandBoundingBoxSides, makeBoundingBox, gcd, gcdMultiple } from '../../src/math.mjs'
import { describe } from 'mocha'
import { expect } from 'chai'

describe('Math', function(){

    describe('Bounding box', function(){

        let bb;

        beforeEach(function(){
           bb = makeBoundingBox();
           bb.x1 = 0;
           bb.y1 = -5;
           bb.x2 = 10;
           bb.y2 = 15;
           bb.w = 10;
           bb.h = 20;
        });

        it('expandBoundingBoxSides([number])', function(){
            expandBoundingBoxSides(bb, [10]);
            expect( bb.x1 ).equals( -10 );
            expect( bb.y1 ).equals( -15 );
            expect( bb.x2 ).equals( 20 );
            expect( bb.y2 ).equals( 25 );
            expect( bb.w ).equals( 30 );
            expect( bb.h ).equals( 40 );
        });

        it('expandBoundingBoxSides([number, number])', function(){
            expandBoundingBoxSides(bb, [1, 2]);
            expect( bb.x1 ).equals( -2 );
            expect( bb.y1 ).equals( -6 );
            expect( bb.x2 ).equals( 12 );
            expect( bb.y2 ).equals( 16 );
            expect( bb.w ).equals( 14 );
            expect( bb.h ).equals( 22 );
        });

        it('expandBoundingBoxSides([number, number, number, number])', function(){
            expandBoundingBoxSides(bb, [1, 2, 3 ,4]);
            expect( bb.x1 ).equals( -4 );
            expect( bb.y1 ).equals( -6 );
            expect( bb.x2 ).equals( 12 );
            expect( bb.y2 ).equals( 18 );
            expect( bb.w ).equals( 16 );
            expect( bb.h ).equals( 24 );
        });
    });

    describe('GCD', function(){
        it('gcd(a, b) for integers a > b', function(){
            expect(gcd(552, 138)).equals(138);
            // https://en.wikipedia.org/wiki/Greatest_common_divisor#Euclidean_algorithm
            expect(gcd(48, 18)).equals(6);
            expect(gcd(6, 5)).equals(1);
            expect(gcd(6, 1)).equals(1);
            expect(gcd(6, 0)).equals(6);
        });
        it('gcd(a, b) for integers a < b', function(){
            expect(gcd(138, 552)).equals(138);
            expect(gcd(18, 48)).equals(6);
            expect(gcd(5, 6)).equals(1);
            expect(gcd(1, 6)).equals(1);
            expect(gcd(0, 6)).equals(6);
        });
        it('gcd(a, b) for integers a = b', function(){
            expect(gcd(138, 138)).equals(138);
            expect(gcd(18, 18)).equals(18);
            expect(gcd(5, 5)).equals(5);
            expect(gcd(1, 1)).equals(1);
            // just define this as zero, per
            // https://en.wikipedia.org/wiki/Greatest_common_divisor#Definition
            expect(gcd(0, 0)).equals(0);
        });
        it('gcd of > 2 integers', function(){
            expect(gcdMultiple([138, 552, 276, 138])).equals(138);
            expect(gcdMultiple([276, 276, 1242, 966])).equals(138);
            expect(gcdMultiple([276, 276, 0, 1242, 966])).equals(138);
            expect(gcdMultiple([276, 276, 1, 1242, 966])).equals(1);
            expect(gcdMultiple([138, 138])).equals(138);
            expect(gcdMultiple([5, 5])).equals(5);
            expect(gcdMultiple([5, 6])).equals(1);
            expect(gcdMultiple([5, 6, 0])).equals(1);
            expect(gcdMultiple([1, 1, 1, 1, 1, 1])).equals(1);
            expect(gcdMultiple([0, 0, 0])).equals(0);
            expect(gcdMultiple([1, 0, 0, 0])).equals(1);
            expect(gcdMultiple([0, 0, 0, 1])).equals(1);
            expect(gcdMultiple([0, 1, 0, 0])).equals(1);
        });
    });
});
