import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

// cy.serialize(): live-graph export to the binary wire format, plus the
// padding parity accessors
describe('gpu/core: serialize + padding accessors', function(){

  var cy;

  beforeEach(function(){
    cy = cytoscapeGpu({
      elements: [
        { data: { id: 'a', weight: 1.5, kind: 'x', misc: { deep: true } }, position: { x: 10, y: 20 } },
        { data: { id: 'b', kind: 'y' }, position: { x: -5, y: 7 } },
        { data: { id: 'c' }, position: { x: 0, y: 0 } },
        { data: { id: 'ab', source: 'a', target: 'b', weight: 3 } },
        { data: { id: 'bc', source: 'b', target: 'c' } }
      ]
    });
  });

  it('round-trips ids, positions and data through the wire', function(){
    var buf = cy.serialize();

    expect( buf ).to.be.an.instanceOf( ArrayBuffer );

    var cy2 = cytoscapeGpu({ elements: buf });

    expect( cy2.nodes().map( n => n.id() ).sort() ).to.deep.equal([ 'a', 'b', 'c' ]);
    expect( cy2.edges().map( e => e.id() ).sort() ).to.deep.equal([ 'ab', 'bc' ]);

    expect( cy2.$id('a').position() ).to.deep.equal({ x: 10, y: 20 });
    expect( cy2.$id('b').position() ).to.deep.equal({ x: -5, y: 7 });

    expect( cy2.$id('ab').source().id() ).to.equal('a');
    expect( cy2.$id('ab').target().id() ).to.equal('b');

    expect( cy2.$id('a').data('weight') ).to.equal( 1.5 );
    expect( cy2.$id('a').data('kind') ).to.equal('x');
    expect( cy2.$id('a').data('misc') ).to.deep.equal({ deep: true });
    expect( cy2.$id('b').data('weight') ).to.equal( undefined );
    expect( cy2.$id('ab').data('weight') ).to.equal( 3 );
  });

  it('round-trips selection state', function(){
    cy.$id('a').select();
    cy.$id('ab').select();
    cy.$id('b').unselectify();

    var cy2 = cytoscapeGpu({ elements: cy.serialize() });

    expect( cy2.$id('a').selected() ).to.be.true;
    expect( cy2.$id('ab').selected() ).to.be.true;
    expect( cy2.$id('c').selected() ).to.be.false;
    expect( cy2.$id('b').selectable() ).to.be.false;
    expect( cy2.$id('a').selectable() ).to.be.true;
  });

  it('reflects live mutations (post-load writes and removals)', function(){
    cy.$id('c').data( 'kind', 'z' );
    cy.remove( cy.$id('bc') );
    cy.add( { data: { id: 'd' }, position: { x: 99, y: 99 } } );

    var cy2 = cytoscapeGpu({ elements: cy.serialize() });

    expect( cy2.nodes().length ).to.equal( 4 );
    expect( cy2.edges().map( e => e.id() ) ).to.deep.equal([ 'ab' ]);
    expect( cy2.$id('c').data('kind') ).to.equal('z');
    expect( cy2.$id('d').position() ).to.deep.equal({ x: 99, y: 99 });
  });

  it('cy.add() accepts the buffer too', function(){
    var cy2 = cytoscapeGpu({});

    cy2.add( cy.serialize() );

    expect( cy2.nodes().length ).to.equal( 3 );
    expect( cy2.$id('a').data('weight') ).to.equal( 1.5 );
  });

  it('serializes an empty graph', function(){
    var cy2 = cytoscapeGpu({});
    var cy3 = cytoscapeGpu({ elements: cy2.serialize() });

    expect( cy3.elements().length ).to.equal( 0 );
  });

  describe('padding accessors (v3 parity; no padding prop in v4)', function(){
    it('padding() is 0 for a live node, undefined when empty', function(){
      expect( cy.$id('a').padding() ).to.equal( 0 );
      expect( cy.collection().padding() ).to.equal( undefined );
    });

    it('paddedWidth/paddedHeight equal width/height', function(){
      expect( cy.$id('a').paddedWidth() ).to.equal( cy.$id('a').width() );
      expect( cy.$id('a').paddedHeight() ).to.equal( cy.$id('a').height() );
    });
  });
});
