import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

var ids = eles => eles.map( ele => ele.id() ).sort();

describe('gpu/collection: edge move() (re-endpoint)', function(){

  var cy;

  beforeEach(function(){
    cy = cytoscapeGpu({
      elements: [
        { data: { id: 'n1' }, position: { x: 0, y: 0 } },
        { data: { id: 'n2' }, position: { x: 100, y: 0 } },
        { data: { id: 'n3' }, position: { x: 200, y: 0 } },
        { data: { id: 'e1', source: 'n1', target: 'n2' } }
      ]
    });
  });

  it('move({ target }) re-points the edge target', function(){
    cy.$('#e1').move({ target: 'n3' });

    expect( cy.$('#e1').source().id() ).to.equal('n1');
    expect( cy.$('#e1').target().id() ).to.equal('n3');
  });

  it('move({ source }) re-points the edge source, leaving the target', function(){
    cy.$('#e1').move({ source: 'n2' });

    expect( cy.$('#e1').source().id() ).to.equal('n2');
    expect( cy.$('#e1').target().id() ).to.equal('n2'); // target unchanged
  });

  it('adjacency updates: old node loses the edge, new node gains it', function(){
    cy.$('#e1').move({ target: 'n3' });

    expect( ids( cy.$('#n2').connectedEdges() ) ).to.deep.equal([]);
    expect( ids( cy.$('#n3').connectedEdges() ) ).to.deep.equal(['e1']);
    expect( ids( cy.$('#n1').outgoers('node') ) ).to.deep.equal(['n3']);
  });

  it('degree reflects the move', function(){
    expect( cy.$('#n2').degree() ).to.equal( 1 );
    cy.$('#e1').move({ target: 'n3' });
    expect( cy.$('#n2').degree() ).to.equal( 0 );
    expect( cy.$('#n3').degree() ).to.equal( 1 );
  });

  it('data() id stays; source/target reflect new endpoints', function(){
    cy.$('#e1').move({ source: 'n3', target: 'n1' });

    expect( cy.$('#e1').data('id') ).to.equal('e1');
    expect( cy.$('#e1').data('source') ).to.equal('n3');
    expect( cy.$('#e1').data('target') ).to.equal('n1');
  });

  it('throws on a nonexistant endpoint', function(){
    expect( () => cy.$('#e1').move({ target: 'nope' }) ).to.throw(/nonexistant/);
  });

  it('emits move when listened', function(){
    var fired = 0;
    cy.$('#e1').on('move', () => fired++);
    cy.$('#e1').move({ target: 'n3' });
    expect( fired ).to.equal( 1 );
  });

  it('preserves primitive scratch data across a move', function(){
    var edge = cy.$('#e1');

    edge.scratch('foo', 'bar');
    edge.move({ source: 'n3' });

    expect( edge.scratch('foo') ).to.equal('bar');
    expect( cy.$('#e1').scratch('foo') ).to.equal('bar');
  });

  it('preserves object scratch data across a move', function(){
    var edge = cy.$('#e1');
    var payload = { nested: [1, 2, 3] };

    edge.scratch('obj', payload);
    edge.move({ target: 'n3' });

    expect( cy.$('#e1').scratch('obj') ).to.equal( payload );
  });

  it('removing the edge after a move cascades from the new node', function(){
    var edge = cy.$('#e1');

    edge.move({ target: 'n3' });
    cy.$('#n3').remove();

    expect( edge.removed() ).to.equal( true );
    expect( cy.getElementById('e1').length ).to.equal( 0 );
  });

});
