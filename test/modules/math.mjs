import { expandBoundingBoxSides, makeBoundingBox, gcd, gcdMultipleZeroIfNonInt, isIntegerMultiple, median } from '../../src/math.mjs'
import { describe, it, beforeEach } from 'mocha'
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
            expect( gcd( 552, 138 ) ).equals( 138 );
            // https://en.wikipedia.org/wiki/Greatest_common_divisor#Euclidean_algorithm
            expect( gcd( 48, 18 ) ).equals( 6 );
            expect( gcd( 45, 15 ) ).equals( 15 );
            expect( gcd( 40, 15 ) ).equals( 5 );
            expect( gcd( 6, 5 ) ).equals( 1 );
            expect( gcd( 6, 1 ) ).equals( 1 );
            expect( gcd( 6, 0 ) ).equals( 6 );
        });
        it('gcd(a, b) for integers a < b', function(){
            expect( gcd( 138, 552 ) ).equals( 138 );
            expect( gcd( 18, 48 ) ).equals( 6 );
            expect( gcd( 15, 45 ) ).equals( 15 );
            expect( gcd( 15, 40 ) ).equals( 5 );
            expect( gcd( 5, 6 ) ).equals( 1 );
            expect( gcd( 1, 6 ) ).equals( 1 );
            expect( gcd( 0, 6 ) ).equals( 6 );
        });
        it('gcd(a, b) for integers a = b', function(){
            expect( gcd( 138, 138 ) ).equals( 138 );
            expect( gcd( 18, 18 ) ).equals( 18 );
            expect( gcd( 5, 5 ) ).equals( 5 );
            expect( gcd( 1, 1 ) ).equals( 1 );
            // just define this as zero, per
            // https://en.wikipedia.org/wiki/Greatest_common_divisor#Definition
            expect( gcd( 0, 0 ) ).equals( 0 );
        });
        it('gcd of an array of numbers (all integers)', function(){
            expect ( gcdMultipleZeroIfNonInt( [ 138, 552, 276, 138 ] ) ).equals( 138 );
            expect ( gcdMultipleZeroIfNonInt( [ 276, 276, 1242, 966 ] ) ).equals( 138 );
            expect ( gcdMultipleZeroIfNonInt( [ 276, 276, 0, 1242, 966 ] ) ).equals( 138 );
            expect ( gcdMultipleZeroIfNonInt( [ 276, 276, 1, 1242, 966 ] ) ).equals( 1 );
            expect ( gcdMultipleZeroIfNonInt( [ 45, 15, 50, 25, 100 ] ) ).equals( 5 );
            expect ( gcdMultipleZeroIfNonInt( [ 138, 138 ] ) ).equals( 138 );
            expect ( gcdMultipleZeroIfNonInt( [ 5, 5 ] ) ).equals( 5 );
            expect ( gcdMultipleZeroIfNonInt( [ 5, 6 ] ) ).equals( 1 );
            expect ( gcdMultipleZeroIfNonInt( [ 5, 6, 0 ] ) ).equals( 1 );
            expect ( gcdMultipleZeroIfNonInt( [ 1, 1, 1, 1, 1, 1 ] ) ).equals( 1 );
            expect ( gcdMultipleZeroIfNonInt( [ 0, 0, 0 ] ) ).equals( 0 );
            expect ( gcdMultipleZeroIfNonInt( [ 1, 0, 0, 0 ] ) ).equals( 1 );
            expect ( gcdMultipleZeroIfNonInt( [ 0, 0, 0, 1 ] ) ).equals( 1 );
            expect ( gcdMultipleZeroIfNonInt( [ 0, 1, 0, 0 ] ) ).equals( 1 );
        });
        it('gcd of an array of numbers, including float(s)', function(){
            expect ( gcdMultipleZeroIfNonInt( [ 138, 552, 276.3, 138 ] ) ).equals( 0 );
            expect ( gcdMultipleZeroIfNonInt( [ 276, 276.001, 1242, 966 ] ) ).equals( 0 );
            expect ( gcdMultipleZeroIfNonInt( [ 0, 1.5, 0, 0.3 ] ) ).equals( 0 );
            // in theory, you could speed up this kind of function by exiting
            // as soon as it sees a 1 -- since (if the numbers in the list are
            // integers) then this indicates that these numbers' GCD is 1.
            // however, since we have stated that this function returns 0 if it
            // contains any non-integer values, we should *not* do this.
            // (shouldn't make a difference in terms of finding scroll factors,
            // but at least the function will behave as expected.)
            expect ( gcdMultipleZeroIfNonInt( [ 1, 1.1 ] ) ).equals( 0 );
        });
    });

    describe('isIntegerMultiple()', function(){
        it('accepts integer multiples', function(){
            expect( isIntegerMultiple( 120, 120 ) ).to.be.true;
            expect( isIntegerMultiple( 360, 120 ) ).to.be.true;
        });

        it('rejects non-multiples', function(){
            expect( isIntegerMultiple( 180, 120 ) ).to.be.false;
            expect( isIntegerMultiple( 2.015625, 120 ) ).to.be.false;
            expect( isIntegerMultiple( 44.8125, 120 ) ).to.be.false;
        });

        it('rejects values too small to be a multiple', function(){
            expect( isIntegerMultiple( 0.00001, 120 ) ).to.be.false;
        });

        it('tolerates floating-point error', function(){
            const notch = 100 / 1.1;

            expect( ( notch + notch + notch ) / notch ).not.equals( 3 );
            expect( isIntegerMultiple( notch + notch + notch, notch ) ).to.be.true;
        });
    });

    describe('Median', function(){
        it('single element array', function(){
            expect( median([10]) ).equals( 10 );
        });

        it('odd-length array', function(){
            expect( median([10, 20, 30]) ).equals( 20 );
            expect( median([1, 2, 3, 4, 5]) ).equals( 3 );
            expect( median([5, 1, 3]) ).equals( 3 );
        });

        it('even-length array', function(){
            expect( median([10, 20]) ).equals( 15 );
            expect( median([1, 2, 3, 4]) ).equals( 2.5 );
            expect( median([4, 1, 3, 2]) ).equals( 2.5 );
        });

        it('array with non-finite placeholders (affinity propagation preference)', function(){
            // 2-node AP matrix: 2 diagonal placeholders (-Infinity) + 2 finite similarities [-1, -1]
            // finite similarities are [-1, -1], median is -1
            expect( median([-Infinity, -1, -1, -Infinity]) ).equals( -1 );

            // 3-node AP matrix: 3 diagonal placeholders (-Infinity) + 6 finite similarities
            // finite similarities are [1, 2, 3, 4, 5, 6], median is (3 + 4) / 2 = 3.5
            let S = [ -Infinity, 1, 2, 3, -Infinity, 4, 5, 6, -Infinity ];
            expect( median( S ) ).equals( 3.5 );

            // odd number of finite similarities with placeholders:
            // 2 placeholders + 3 finite similarities [10, 20, 30] -> median is 20
            expect( median([ -Infinity, 10, -Infinity, 30, 20 ]) ).equals( 20 );
            expect( median([ NaN, 10, 20, 30 ]) ).equals( 20 );
        });
    });
});
