import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

describe('gpu/batch', function(){

  var cy;

  beforeEach(function(){
    cy = cytoscapeGpu({
      elements: [
        { data: { id: 'a', weight: 1 } },
        { data: { id: 'b', weight: 2 } },
        { data: { id: 'ab', source: 'a', target: 'b' } }
      ]
    });
  });

  it('reports batching state, including nesting', function(){
    expect( cy.batching() ).to.be.false;

    cy.startBatch();
    expect( cy.batching() ).to.be.true;

    cy.startBatch();
    cy.endBatch();
    expect( cy.batching() ).to.be.true; // still inside the outer batch

    cy.endBatch();
    expect( cy.batching() ).to.be.false;
  });

  it('endBatch without startBatch is a no-op', function(){
    expect( function(){ cy.endBatch(); } ).to.not.throw();
    expect( cy.batching() ).to.be.false;
  });

  it('defers the first style apply of added elements to endBatch', function(){
    cy.startBatch();
    cy.add({ data: { id: 'c' } });

    // style application is deferred, so the node still has zeroed channels
    expect( cy.$id('c').width() ).to.equal( 0 );

    cy.endBatch();

    expect( cy.$id('c').width() ).to.equal( 30 ); // default node width
  });

  it('skips elements added then removed within the batch', function(){
    cy.startBatch();
    cy.add({ data: { id: 'c' } });
    cy.$id('c').remove();

    expect( function(){ cy.endBatch(); } ).to.not.throw();
    expect( cy.hasElementWithId('c') ).to.be.false;
  });

  it('defers sheet application to endBatch', function(){
    cy.startBatch();
    cy.style({ node: { width: 50, height: 50 } });

    expect( cy.$id('a').width() ).to.equal( 30 ); // not yet applied

    cy.endBatch();

    expect( cy.$id('a').width() ).to.equal( 50 );
  });

  it('a sheet set during the batch also styles elements added during it', function(){
    cy.startBatch();
    cy.add({ data: { id: 'c' } });
    cy.style({ node: { width: 50, height: 50 } });
    cy.endBatch();

    expect( cy.$id('c').width() ).to.equal( 50 );
  });

  it('still validates a sheet set during a batch', function(){
    cy.startBatch();

    expect( function(){
      cy.style({ node: { 'bogus-prop': 1 } });
    } ).to.throw();

    cy.endBatch();
  });

  it('defers data-mapped label refresh to endBatch', function(){
    cy.style({ node: { label: 'data(name)' } });
    cy.$id('a').data('name', 'before');

    expect( cy.$id('a').label() ).to.equal( 'before' );

    cy.startBatch();
    cy.$id('a').data('name', 'after');

    expect( cy.$id('a').label() ).to.equal( 'before' ); // stale inside the batch

    cy.endBatch();

    expect( cy.$id('a').label() ).to.equal( 'after' );
  });

  it('still fires events during the batch, as in v3', function(){
    var events = [];

    cy.on('add', function( e ){ events.push( 'add:' + e.target.id() ); });
    cy.on('data', function( e ){ events.push( 'data:' + e.target.id() ); });

    cy.batch( function(){
      cy.add({ data: { id: 'c' } });
      cy.$id('a').data('weight', 3);
    } );

    expect( events ).to.deep.equal([ 'add:c', 'data:a' ]);
  });

  it('batch( fn ) ends the batch even when fn throws', function(){
    expect( function(){
      cy.batch( function(){
        throw new Error('boom');
      } );
    } ).to.throw('boom');

    expect( cy.batching() ).to.be.false;
  });

  it('batchData applies per-id patches in one batch', function(){
    cy.batchData({
      a: { weight: 10 },
      b: { weight: 20 }
    });

    expect( cy.$id('a').data('weight') ).to.equal( 10 );
    expect( cy.$id('b').data('weight') ).to.equal( 20 );
  });
});
