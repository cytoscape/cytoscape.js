import { expect } from 'chai';
import { CurveBlob } from '../src/gpu/store/curve-blob.mjs';
import { GraphStore } from '../src/gpu/store/graph-store.mjs';
import {
  CURVE_MULTI, CURVE_SEGMENTS, CURVE_STRAIGHT, CURVE_TAXI,
  FLAG_CURVED, FLAG_CURVED_BOX
} from '../src/gpu/contract.mjs';

describe('gpu/store: CurveBlob', function(){

  var moves;
  var blob;

  beforeEach(function(){
    moves = [];
    blob = new CurveBlob(function( slot, offset ){ moves.push([ slot, offset ]); });
  });

  it('appends records and returns their offsets', function(){
    var a = blob.write(0, [1, 2, 3]);
    var b = blob.write(1, [4, 5]);

    expect( a ).to.equal(0);
    expect( b ).to.equal(3);
    expect( blob.length() ).to.equal(5);
    expect( Array.from( blob.data().subarray(0, 5) ) ).to.deep.equal([1, 2, 3, 4, 5]);
  });

  it('rewrites same-length records in place', function(){
    blob.write(0, [1, 2, 3]);
    blob.write(1, [4, 5]);

    var off = blob.write(0, [7, 8, 9]);

    expect( off ).to.equal(0);
    expect( blob.length() ).to.equal(5);
    expect( Array.from( blob.data().subarray(0, 3) ) ).to.deep.equal([7, 8, 9]);
  });

  it('reallocates changed-length records and meters the waste', function(){
    blob.write(0, [1, 2, 3]);
    blob.write(0, [1, 2, 3, 4]);

    expect( blob.offsetOf(0) ).to.equal(3);
    expect( blob.stats().waste ).to.equal(3);
    expect( blob.stats().live ).to.equal(4);
  });

  it('frees records', function(){
    blob.write(0, [1, 2, 3]);
    blob.free(0);

    expect( blob.offsetOf(0) ).to.equal(-1);
    expect( blob.stats().live ).to.equal(0);
    expect( blob.stats().waste ).to.equal(3);

    blob.free(0); // no-op
    blob.free(99); // never allocated: no-op
  });

  it('reports coalesced dirty spans, returns-and-clears', function(){
    blob.write(0, [1, 2]);
    blob.write(1, [3, 4]);

    var dirty = blob.takeDirty();

    expect( dirty.resized ).to.be.true; // first growth
    expect( blob.takeDirty() ).to.equal(null);

    blob.write(0, [9, 9]);
    dirty = blob.takeDirty();

    expect( dirty.resized ).to.be.false;
    expect( dirty.start ).to.equal(0);
    expect( dirty.end ).to.equal(2);
  });

  it('compacts when waste exceeds half the live floats and relocates survivors', function(){
    // large records so we clear the 256-float floor
    var big = new Array(100).fill(1);

    blob.write(0, big);
    blob.write(1, big);
    blob.write(2, big);
    blob.write(3, big);

    // free enough to exceed max(live, 256)/2: live 200 after two frees,
    // waste 200 > 128? floor: max(200,256)/2 = 128 < 200 => compacts
    blob.free(0);
    blob.free(1);

    expect( blob.stats().waste ).to.equal(0); // compacted
    expect( blob.length() ).to.equal(200);
    expect( blob.offsetOf(2) ).to.equal(0);
    expect( blob.offsetOf(3) ).to.equal(100);
    expect( moves ).to.deep.equal([[2, 0], [3, 100]]);

    var dirty = blob.takeDirty();

    expect( dirty.resized ).to.be.true;
  });

});

describe('gpu/store: curve blob integration', function(){

  var store;
  var s, t, e;

  beforeEach(function(){
    store = new GraphStore();
    s = store.addNode('a', 0, 0);
    t = store.addNode('b', 100, 0);
    e = store.addEdge('e', 'a', 'b');
    store.takeDelta();
  });

  it('setCurveParamsBlob writes the header, blob record and flags', function(){
    store.setCurveParamsBlob(e, CURVE_MULTI, [0, 40, 0.5], 1, 40, false);

    var params = store.column('edge.curveParams');

    expect( params[e * 4] ).to.equal(0); // blob offset
    expect( params[e * 4 + 1] ).to.equal(40); // dev
    expect( params[e * 4 + 2] ).to.equal(1); // n
    expect( params[e * 4 + 3] ).to.equal(CURVE_MULTI);
    expect( store.hasFlag('edges', e, FLAG_CURVED) ).to.be.true;
    expect( store.hasFlag('edges', e, FLAG_CURVED_BOX) ).to.be.false;
    expect( Array.from( store.curveBlob().subarray(0, 3) ) ).to.deep.equal([0, 40, 0.5]);
    expect( store.curveBlobLength() ).to.equal(3);
  });

  it('box kinds set FLAG_CURVED_BOX and engage curveSlack', function(){
    store.setPair('node.size', s, 30, 30);

    // node halves alone don't engage the slack: nothing is curved yet
    expect( store.curveSlack() ).to.equal(0);

    // a box kind engages it even at dev 0 (taxi routes need the
    // node-half margin on their AABB test)
    store.setCurveParamsBlob(e, CURVE_TAXI, [0, 0.5, 1, 10, 0, 0, 0, 1], 0, 0, true);

    expect( store.hasFlag('edges', e, FLAG_CURVED_BOX) ).to.be.true;
    expect( store.curveSlack() ).to.equal(15);
  });

  it('takeDelta carries the blob span alongside the header span', function(){
    store.setCurveParamsBlob(e, CURVE_SEGMENTS, [0, 0, 20, 0.5, 0, 0], 1, 20, false);

    var delta = store.takeDelta();

    expect( delta.curveBlob ).to.exist;
    expect( delta.curveBlob.resized ).to.be.true; // first growth

    var span = delta.spans.find(function( sp ){ return sp.column === 'edge.curveParams'; });

    expect( span ).to.exist;

    // a same-length rewrite is a plain span, not a resize
    store.setCurveParamsBlob(e, CURVE_SEGMENTS, [0, 0, 30, 0.5, 0, 0], 1, 30, false);
    delta = store.takeDelta();
    expect( delta.curveBlob.resized ).to.be.false;
    expect( delta.curveBlob.start ).to.equal(0);
    expect( delta.curveBlob.end ).to.equal(6);
  });

  it('switching back to a fixed kind frees the record and clears the box flag', function(){
    store.setCurveParamsBlob(e, CURVE_TAXI, [0, 0.5, 1, 10, 0, 0, 0, 1], 0, 0, true);
    store.setCurveParams(e, 0, 0, 0, CURVE_STRAIGHT);

    expect( store.hasFlag('edges', e, FLAG_CURVED) ).to.be.false;
    expect( store.hasFlag('edges', e, FLAG_CURVED_BOX) ).to.be.false;

    var params = store.column('edge.curveParams');

    expect( params[e * 4 + 3] ).to.equal(CURVE_STRAIGHT);
  });

});
