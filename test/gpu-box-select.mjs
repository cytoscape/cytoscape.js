import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

describe('gpu/box-select', function(){

  describe('cy.selectionType()', function(){
    it('defaults to single', function(){
      var cy = cytoscapeGpu();

      expect( cy.selectionType() ).to.equal( 'single' );
    });

    it('is settable via the option and the method', function(){
      var cy = cytoscapeGpu({ selectionType: 'additive' });

      expect( cy.selectionType() ).to.equal( 'additive' );

      cy.selectionType( 'single' );

      expect( cy.selectionType() ).to.equal( 'single' );
    });

    it('rejects invalid values', function(){
      var cy = cytoscapeGpu();

      expect( function(){ cy.selectionType( 'bogus' ); } ).to.throw( /selection type/ );
      expect( function(){ cytoscapeGpu({ selectionType: 'bogus' }); } ).to.throw( /selection type/ );
    });

    it('is included in the json() export', function(){
      expect( cytoscapeGpu().json().selectionType ).to.equal( 'single' );
    });
  });

  describe('cy.elementsInBox()', function(){

    var cy;

    beforeEach(function(){
      // default node size 30x30, so a node "contains" iff its 30x30 box fits
      cy = cytoscapeGpu({
        elements: [
          { data: { id: 'in1' }, position: { x: 50, y: 50 } },
          { data: { id: 'in2' }, position: { x: 80, y: 80 } },
          { data: { id: 'edgeOfBox' }, position: { x: 10, y: 50 } }, // bb sticks out at x < 0
          { data: { id: 'out' }, position: { x: 500, y: 500 } },
          { data: { id: 'inIn', source: 'in1', target: 'in2' } },
          { data: { id: 'inOut', source: 'in1', target: 'out' } }
        ]
      });
    });

    it('contains nodes whose bounding box lies fully inside', function(){
      var box = cy.elementsInBox( 0, 0, 100, 100 );

      expect( box.nodes().map( n => n.id() ) ).to.deep.equal([ 'in1', 'in2' ]);
    });

    it('excludes nodes that only partially overlap', function(){
      // edgeOfBox at x=10 has bb x1 = -5 < 0
      expect( cy.elementsInBox( 0, 0, 100, 100 ).getElementById('edgeOfBox') ).to.have.length( 0 );

      // a box that also covers the negative-x fringe contains it
      expect( cy.elementsInBox( -10, 0, 100, 100 ).getElementById('edgeOfBox') ).to.have.length( 1 );
    });

    it('accounts for the border width in the node bounding box', function(){
      cy.style({ nodes: { 'border-width': 20 } });

      // 30/2 + 20/2 = 25 half-extent; in1 at (50,50) no longer fits in x >= 30
      expect( cy.elementsInBox( 30, 0, 100, 100 ).getElementById('in1') ).to.have.length( 0 );
      expect( cy.elementsInBox( 0, 0, 100, 100 ).getElementById('in1') ).to.have.length( 1 );
    });

    it('contains edges when both endpoint centers are inside', function(){
      var box = cy.elementsInBox( 0, 0, 100, 100 );

      expect( box.edges().map( e => e.id() ) ).to.deep.equal([ 'inIn' ]);
    });

    it('accepts corners in any order', function(){
      expect( cy.elementsInBox( 100, 100, 0, 0 ).nodes() ).to.have.length( 2 );
    });

    it('excludes hidden elements', function(){
      cy.$id('in1').hide();

      var box = cy.elementsInBox( 0, 0, 100, 100 );

      expect( box.getElementById('in1') ).to.have.length( 0 );
      // edges of a hidden node still report: visibility masks per element,
      // and inIn itself is visible with both endpoints inside
      expect( box.getElementById('in2') ).to.have.length( 1 );
    });

    it('excludes removed elements', function(){
      cy.$id('in2').remove();

      var box = cy.elementsInBox( 0, 0, 100, 100 );

      expect( box.getElementById('in2') ).to.have.length( 0 );
      expect( box.getElementById('inIn') ).to.have.length( 0 ); // cascaded away
    });

    it('feeds the usual selection flow', function(){
      var box = cy.elementsInBox( 0, 0, 100, 100 );

      box.filter( ele => ele.selectable() && !ele.selected() ).select();

      expect( cy.elements({ selected: true }).map( e => e.id() ) )
        .to.deep.equal([ 'in1', 'in2', 'inIn' ]);
    });
  });

  describe('curved edges (12b: the curve-endpoint upgrade)', function(){
    it('a curved edge tests its curve boundary endpoints, not just centers', function(){
      // a segments edge whose route bulges: the *curve endpoints* sit on
      // the node boundaries, so a box containing both boundary points —
      // but not the full node boxes — still contains the edge
      var cy = cytoscapeGpu({
        elements: [
          { data: { id: 'a' }, position: { x: 0, y: 0 } },
          { data: { id: 'b' }, position: { x: 100, y: 0 } },
          { data: { id: 'e', source: 'a', target: 'b' } }
        ],
        style: { edges: { 'curve-style': 'segments', 'segment-distances': 20 } }
      });

      var s = cy.$id('e').sourceEndpoint();
      var t = cy.$id('e').targetEndpoint();

      // a box just around the two curve endpoints contains the edge...
      var box = cy.elementsInBox( s.x - 1, Math.min(s.y, t.y) - 1, t.x + 1, Math.max(s.y, t.y) + 25 );

      expect( box.filter( e => e.isEdge() ).map( e => e.id() ) ).to.deep.equal([ 'e' ]);

      // ...and a box that excludes the source-side boundary point does not
      var miss = cy.elementsInBox( s.x + 2, -100, t.x + 1, 100 );

      expect( miss.filter( e => e.isEdge() ) ).to.have.length( 0 );
    });

    it('a taxi edge is contained by the box around its launch endpoints', function(){
      var cy = cytoscapeGpu({
        elements: [
          { data: { id: 'a' }, position: { x: 0, y: 0 } },
          { data: { id: 'b' }, position: { x: 10, y: 200 } },
          { data: { id: 'e', source: 'a', target: 'b' } }
        ],
        style: { edges: { 'curve-style': 'taxi' } }
      });

      // launch endpoints: (0, 15) and (10, 185)
      var hit = cy.elementsInBox( -5, 10, 15, 190 );

      expect( hit.filter( e => e.isEdge() ).map( e => e.id() ) ).to.deep.equal([ 'e' ]);

      var miss = cy.elementsInBox( -5, 20, 15, 190 ); // cuts the source launch

      expect( miss.filter( e => e.isEdge() ) ).to.have.length( 0 );
    });
  });
});
