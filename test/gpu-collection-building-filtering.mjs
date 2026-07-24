import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

describe('gpu/collection: building and filtering', function(){

  var cy;

  var ids = eles => eles.map( ele => ele.id() );

  beforeEach(function(){
    cy = cytoscapeGpu({
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'c' }, selected: true },
        { data: { id: 'ab', source: 'a', target: 'b' } },
        { data: { id: 'bc', source: 'b', target: 'c' } }
      ]
    });
  });

  it('unions collections', function(){
    var eles = cy.$('#a').union( cy.$('#b') );

    expect( ids(eles) ).to.deep.equal(['a', 'b']);
    expect( ids( cy.$('#a').or( cy.$('#b') ) ) ).to.deep.equal(['a', 'b']);
    expect( ids( cy.$('#a').u( cy.$('#b') ) ) ).to.deep.equal(['a', 'b']);
    expect( ids( cy.$('#a').add( cy.$('#b') ) ) ).to.deep.equal(['a', 'b']);
  });

  it('unions with a selector argument', function(){
    expect( ids( cy.$('#a').union('#c') ) ).to.deep.equal(['a', 'c']);
  });

  it('takes differences', function(){
    expect( ids( cy.nodes().difference('#b') ) ).to.deep.equal(['a', 'c']);
    expect( ids( cy.nodes().not('#b') ) ).to.deep.equal(['a', 'c']);
    expect( ids( cy.nodes().subtract( cy.$('#a, #c') ) ) ).to.deep.equal(['b']);
  });

  it('takes intersections', function(){
    expect( ids( cy.nodes().intersection(':selected') ) ).to.deep.equal(['c']);
    expect( ids( cy.elements().intersect( cy.edges() ) ) ).to.deep.equal(['ab', 'bc']);
    expect( ids( cy.nodes().and('#a, #b') ) ).to.deep.equal(['a', 'b']);
  });

  it('intersecting with an empty collection is empty', function(){
    expect( cy.nodes().intersect( cy.collection() ).empty() ).to.be.true;
  });

  it('takes symmetric differences', function(){
    expect( ids( cy.$('#a, #b').symmetricDifference('#b, #c') ) ).to.deep.equal(['a', 'c']);
    expect( ids( cy.$('#a, #b').xor('#b, #c') ) ).to.deep.equal(['a', 'c']);
    expect( ids( cy.$('#a, #b').symdiff('#b, #c') ) ).to.deep.equal(['a', 'c']);
  });

  it('filters with a selector', function(){
    expect( ids( cy.elements().filter('node') ) ).to.deep.equal(['a', 'b', 'c']);
    expect( ids( cy.elements().filter('node:selected') ) ).to.deep.equal(['c']);
  });

  it('filters with a function', function(){
    var eles = cy.nodes().filter(function( ele, i, all ){
      expect( all ).to.have.length(3);
      expect( this ).to.equal( ele );

      return i !== 1;
    });

    expect( ids(eles) ).to.deep.equal(['a', 'c']);
  });

  it('filters from the core', function(){
    expect( ids( cy.filter('edge') ) ).to.deep.equal(['ab', 'bc']);
    expect( ids( cy.$(':selected') ) ).to.deep.equal(['c']);
    expect( ids( cy.filter( ele => ele.isEdge() ) ) ).to.deep.equal(['ab', 'bc']);
  });

  it('narrows with nodes()/edges()', function(){
    expect( ids( cy.elements().nodes() ) ).to.deep.equal(['a', 'b', 'c']);
    expect( ids( cy.elements().edges() ) ).to.deep.equal(['ab', 'bc']);
    expect( ids( cy.elements().nodes(':selected') ) ).to.deep.equal(['c']);
  });

  it('gets by id within a collection', function(){
    expect( cy.nodes().getElementById('b').id() ).to.equal('b');
    expect( cy.nodes().getElementById('ab') ).to.have.length(0);
  });

  it('selects with core selectors', function(){
    expect( ids( cy.$('node') ) ).to.deep.equal(['a', 'b', 'c']);
    expect( ids( cy.$('#a, #ab') ) ).to.deep.equal(['a', 'ab']);
    expect( ids( cy.$('*') ) ).to.have.length(5);
  });

});
