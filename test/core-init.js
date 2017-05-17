var expect = require('chai').expect;
var cytoscape = require('../src/test.js', cytoscape);
var Promise = Promise || require('bluebird');

describe('Core initialisation', function(){

  it('does not add a node with the same ID as an earlier one', function(done){
    cytoscape({
      headless: true,

      elements: {
        nodes: [
          { data: { id: 'n1', foo: 'one' } },
          { data: { id: 'n2', foo: 'two' } },
          { data: { id: 'n1', foo: 'what is this guy doing here' } }
        ]
      },
      ready: function(){
        var cy = this;

        expect( cy.elements().size() ).to.equal(2);
        expect( cy.$('#n1').data('foo') ).to.equal('one');

        done();
      }
    });
  });

  it('loads ok with empty graph', function(done){
    cytoscape({
      headless: true,

      ready: function(){
        var cy = this;

        expect( cy.elements().length ).to.equal(0);

        done();
      }
    });
  });

  it('does not create an edge with bad source and target', function(done){
    cytoscape({
      headless: true,

      elements: {
        edges: [ { data: { source: "n1", target: "n2" } } ]
      },
      ready: function(){
        var cy = this;

        expect( cy.elements().length ).to.equal(0);

        done();
      }
    });
  });

  it('does not create an edge with bad target', function(done){
    cytoscape({
      headless: true,

      elements: {
        nodes: [ { data: { id: "n1" } } ],
        edges: [ { data: { source: "n1", target: "n2" } } ]
      },
      ready: function(){
        var cy = this;

        expect( cy.edges().size() ).to.equal( 0 );
        expect( cy.nodes().size() ).to.equal( 1 );

        done();
      }
    });
  });

  it('creates an edge that specifies good source and target', function(done){
    cytoscape({
      headless: true,

      elements: {
        nodes: [ { data: { id: "n1" } }, { data: { id: "n2" } } ],
        edges: [ { data: { source: "n1", target: "n2" } } ]
      },
      ready: function(){
        var cy = this;

        expect( cy.edges().size() ).to.equal(1);
        expect( cy.nodes().size() ).to.equal(2);

        done();
      }
    });
  });

  it('adds node with self as parent but as parentless node', function(done){
    cytoscape({
      headless: true,

      elements: {
        nodes: [ { data: { id: "n1", parent: "n1" } } ]
      },
      ready: function(){
        var cy = this;

        expect( cy.$("#n1").parent().size() ).to.equal(0);

        done();
      }
    });
  });

  it('breaks a parent cycle between two nodes', function(done){
    cytoscape({
      headless: true,

      elements: {
        nodes: [
          { data: { id: "n1", parent: "n2" } },
          { data: { id: "n2", parent: "n1" } }
        ]
      },
      ready: function(){
        var cy = this;

        expect( cy.$("#n1").parent().parent().length ).to.equal(0);

        done();
      }
    });
  });

  it('loads style via promise', function(done){
    var cy = cytoscape({
      headless: true,
      styleEnabled: true,
      elements: [
        { group: 'nodes' } // node
      ],
      style: Promise.resolve([
        {
          selector: 'node',
          style: {
            'width': 1000
          }
        }
      ])
    });

    cy.ready(function(){
      expect( parseInt( cy.nodes()[0].style('width') ) ).to.equal( 1000 );

      cy.destroy();
      done();
    });
  });

  it('loads elements via promise', function(done){
    var cy = cytoscape({
      headless: true,
      elements: Promise.resolve([
        { group: 'nodes' }
      ])
    });

    cy.ready(function(){
      expect( cy.nodes().length ).to.equal( 1 );

      cy.destroy();
      done();
    });
  });

  it('loads elements and style via promises', function(done){
    var cy = cytoscape({
      headless: true,
      styleEnabled: true,
      elements: Promise.resolve([
        { group: 'nodes' }
      ]),
      style: Promise.resolve([
        {
          selector: 'node',
          style: {
            'width': 1000
          }
        }
      ])
    });

    cy.ready(function(){
      expect( cy.nodes().length ).to.equal( 1 );
      expect( parseInt( cy.nodes()[0].style('width') ) ).to.equal( 1000 );

      cy.destroy();
      done();
    });
  });

  it('loads elements and style via promises with style off', function(done){
    var cy = cytoscape({
      headless: true,
      styleEnabled: false,
      elements: Promise.resolve([
        { group: 'nodes' }
      ]),
      style: Promise.resolve([
        {
          selector: 'node',
          style: {
            'width': 1000
          }
        }
      ])
    });

    cy.ready(function(){
      cy.destroy();
      done();
    });
  });

  it('loads only style via promise', function(done){
    var cy = cytoscape({
      headless: true,
      styleEnabled: true,
      elements: undefined,
      style: Promise.resolve([
        {
          selector: 'node',
          style: {
            'width': 1000
          }
        }
      ])
    });

    cy.ready(function(){
      cy.destroy();
      done();
    });
  });

  it('loads empty graph', function(done){
    var cy = cytoscape({
      headless: true,
      styleEnabled: true
    });

    cy.ready(function(){
      cy.destroy();
      done();
    });
  });

  it('loads empty elements object', function(done){
    var cy = cytoscape({
      headless: true,
      styleEnabled: true,
      elements: { nodes: [], edges: [] }
    });

    cy.ready(function(){
      cy.destroy();
      done();
    });
  });

});
