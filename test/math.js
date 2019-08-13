import { expandBoundingBoxSides, makeBoundingBox } from "../src/math";
import {describe} from "mocha";
let expect = require('chai').expect;

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
});
