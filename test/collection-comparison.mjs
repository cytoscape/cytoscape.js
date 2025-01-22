var expect = require('chai').expect;
var cytoscape = require('../src/test.js', cytoscape);
var $$ = cytoscape;

var is = {
  elementOrCollection: function(o){
    return o != null && o.instanceString && o.instanceString() === 'collection';
  },

  number: function(o){ return typeof o === 'number'; }
};

describe('Collection comparison', function(){

  var cy;

  // test setup
  beforeEach(function(done){
    cytoscape({
      elements: {
        nodes: [
            { data: { id: 'n1' } },
            { data: { id: 'n2' } },
            { data: { id: 'n3' } }
        ],

        edges: [
            { data: { id: 'n1n2', source: 'n1', target: 'n2' } },
            { data: { id: 'n2n3', source: 'n2', target: 'n3' } }
        ]
      },
      ready: function(){
        cy = this;

        done();
      }
    });
  });


  it('eles.same()', function(){
    expect( cy.$('#n1').same( cy.$('#n1') ) ).to.be.true;
    expect( cy.$('#n1, #n2').same( cy.$('#n1, #n2') ) ).to.be.true;
    expect( cy.$('#n1').same( cy.$('#n1, #n2') ) ).to.be.false;
  });

  it('eles.anySame()', function(){
    expect( cy.$('#n1').anySame( cy.$('#n1') ) ).to.be.true;
    expect( cy.$('#n1, #n2').anySame( cy.$('#n1, #n2') ) ).to.be.true;
    expect( cy.$('#n1').anySame( cy.$('#n1, #n2') ) ).to.be.true;
    expect( cy.$('#n3').anySame( cy.$('#n1, #n3') ) ).to.be.true;
    expect( cy.$('#n1n2, #n3').anySame( cy.$('#n1, #n3') ) ).to.be.true;
  });

  it('eles.allAreNeighbors()', function(){
    expect( cy.$('#n2').allAreNeighbors( cy.$('#n1, #n3') ) ).to.be.true;
    expect( cy.$('#n1').allAreNeighbors( cy.$('#n2, #n3') ) ).to.be.false;
    expect( cy.$('#n1').allAreNeighbors( cy.$('#n1n2, #n2') ) ).to.be.true;
  });

  it('eles.is()', function(){
    expect( cy.$('#n1').is('node') ).to.be.true;
    expect( cy.$('#n1n2').is('edge') ).to.be.true;
    expect( cy.$('#n1n2, #n1').is('edge') ).to.be.true;
    expect( cy.$('#n1n2, #n1').is('node') ).to.be.true;
  });

  it('eles.allAre()', function(){
    expect( cy.$('#n1, #n2').allAre('node') ).to.be.true;
    expect( cy.$('#n1, #n1n2').allAre('node') ).to.be.false;
  });

  it('eles.some()', function(){
    expect( cy.edges().some(function( ele, i, eles ){
      expect( is.elementOrCollection(ele) ).to.be.true;
      expect( is.elementOrCollection(eles) ).to.be.true;
      expect( is.number(i) ).to.be.true;

      return ele.data('source') === 'n1';
    }) ).to.be.true;

    expect( cy.edges().some(function( ele, i, eles ){
      expect( is.elementOrCollection(ele) ).to.be.true;
      expect( is.elementOrCollection(eles) ).to.be.true;
      expect( is.number(i) ).to.be.true;

      return ele.data('source') === 'no-way-this-id-exists';
    }) ).to.be.false;
  });

  it('eles.every()', function(){
    expect( cy.edges().every(function( ele, i, eles ){
      expect( is.elementOrCollection(ele) ).to.be.true;
      expect( is.elementOrCollection(eles) ).to.be.true;
      expect( is.number(i) ).to.be.true;

      return ele.data('source') === 'n1';
    }) ).to.be.false;

    expect( cy.edges().every(function( ele, i, eles ){
      expect( is.elementOrCollection(ele) ).to.be.true;
      expect( is.elementOrCollection(eles) ).to.be.true;
      expect( is.number(i) ).to.be.true;

      return ele.isEdge();
    }) ).to.be.true;
  });

  it('eles.contains()', function(){
    expect( cy.$('#n1, #n2').contains('#n1') ).to.be.true;
    expect( cy.$('#n1, #n2').contains( cy.$('#n1') ) ).to.be.true;
    expect( cy.$('#n1, #n2').contains('#n2') ).to.be.true;
    expect( cy.$('#n1, #n2').contains( cy.$('#n2') ) ).to.be.true;
    expect( cy.$('#n1, #n2').contains('#n3') ).to.be.false;
    expect( cy.$('#n1, #n2').contains( cy.$('#n3') ) ).to.be.false;
  });

});
