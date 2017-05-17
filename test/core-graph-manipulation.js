var expect = require('chai').expect;
var cytoscape = require('../src/test.js', cytoscape);

describe('Core graph manipulation', function(){

  function OneLayout( options ){
    this.options = options;
  }

  OneLayout.prototype.run = function(){
    this.options.eles.layoutPositions(this, this.options, function(){
      return { x: 1, y: 1 };
    });
  };

  cytoscape('layout', 'one', OneLayout);

  var cy;

  // test setup
  beforeEach(function(){
    cy = cytoscape({
      styleEnabled: true,

      elements: {
        nodes: [
            { data: { id: "n1", foo: "one", weight: 0.25 }, classes: "odd one" },
            { data: { id: "n2", foo: "two", weight: 0.5 }, classes: "even two" },
            { data: { id: "n3", foo: "three", weight: 0.75 }, classes: "odd three" }
        ],

        edges: [
            { data: { id: "n1n2", source: "n1", target: "n2", weight: 0.33 }, classes: "uh" },
            { data: { id: "n2n3", source: "n2", target: "n3", weight: 0.66 }, classes: "huh" }
        ]
      }
    });
  });

  afterEach(function(){
    cy.destroy();
  });

  describe('cy.add()', function(){

    it('adds via single object', function(){

      cy.add({
        group: 'nodes',
        data: { id: 'new-node' }
      });

      expect( cy.$('#new-node') ).to.have.length(1);
      expect( cy.nodes() ).to.have.length(4);

    });

    it('adds via single object (inferred node)', function(){

      cy.add({
        data: { id: 'new-node' }
      });

      expect( cy.$('#new-node') ).to.have.length(1);
      expect( cy.nodes() ).to.have.length(4);
      expect( cy.$('#new-node').isNode() ).to.be.true;

    });

    it('adds via single object (inferred node) with int id', function(){

      cy.add({
        data: { id: 0 }
      });

      expect( cy.$('#0') ).to.have.length(1);
      expect( cy.nodes() ).to.have.length(4);
      expect( cy.$('#0').isNode() ).to.be.true;

    });

    it('adds via single object (inferred edge) with int id', function(){

      cy.add({
        data: { id: 0 }
      });

      cy.add({
        data: { id: 1 }
      });

      cy.add({
        data: { id: 2, source: 0, target: 1 }
      });

      expect( cy.$('#0') ).to.have.length(1);
      expect( cy.nodes() ).to.have.length(5);
      expect( cy.$('#0').isNode() ).to.be.true;

      expect( cy.$('#1') ).to.have.length(1);
      expect( cy.nodes() ).to.have.length(5);
      expect( cy.$('#1').isNode() ).to.be.true;

      expect( cy.$('#2') ).to.have.length(1);
      expect( cy.edges() ).to.have.length(3);
      expect( cy.$('#2').isEdge() ).to.be.true;
    });

    it('adds via single object (inferred edge)', function(){

      cy.add({
        data: { id: 'new-edge', source: 'n1', target: 'n2' }
      });

      expect( cy.$('#new-edge') ).to.have.length(1);
      expect( cy.edges() ).to.have.length(3);
      expect( cy.$('#new-edge').isEdge() ).to.be.true;

    });

    it('adds via array of objects', function(){

      cy.add([
        {
          group: 'edges',
          data: { id: 'new-edge', source: 'n1', target: 'new-node' }
        },

        {
          group: 'nodes',
          data: { id: 'new-node' }
        }
      ]);

      expect( cy.$('#new-node') ).to.have.length(1);
      expect( cy.$('#new-node').inside() ).to.be.true;
      expect( cy.$('#new-edge') ).to.have.length(1);
      expect( cy.$('#new-edge').inside() ).to.be.true;

    });

    it('adds via collection', function(){

      var edges = cy.$('edge').remove();

      cy.add( edges );

      expect( cy.$('#n1n2') ).to.have.length(1);
      expect( cy.$('#n1n2').inside() ).to.be.true;
      expect( cy.$('#n2n3') ).to.have.length(1);
      expect( cy.$('#n2n3').inside() ).to.be.true;

    });

  });

  describe('eles.restore()', function(){

    it('restores a node', function(){
      var n1 = cy.$('#n1');

      n1.remove();
      expect( n1.removed() ).to.be.true;
      expect( cy.$('#n1') ).to.have.length(0);

      n1.restore();
      expect( n1.removed() ).to.be.false;
      expect( cy.$('#n1') ).to.have.length(1);
      expect( n1.degree() ).to.equal(0);
    });

  });

  describe('cy.remove()', function(){

    it('removes a single node', function(){
      var n1 = cy.$('#n1');

      cy.remove(n1);

      expect( cy.nodes() ).to.have.length(2);
      expect( cy.$('#n2') ).to.have.length(1);
      expect( cy.$('#n3') ).to.have.length(1);
      expect( n1.removed() ).to.be.true;
      expect( cy.$('#n1') ).to.have.length(0);

    });

    it('correctly removes an edge repeatedly', function(){
      var n1n2 = cy.$('#n1n2');

      for( var i = 0; i < 10; i++ ){
        cy.remove( n1n2 );

        expect( cy.edges() ).to.have.length(1);
        expect( cy.$('#n1') ).to.have.length(1);
        expect( cy.$('#n2') ).to.have.length(1);
        expect( cy.$('#n3') ).to.have.length(1);
        expect( cy.$('#n2n3') ).to.have.length(1);
        expect( n1n2.removed() ).to.be.true;
        expect( cy.$("#n1").degree() ).to.equal(0);
        expect( cy.$("#n2").degree() ).to.equal(1);

        cy.add( n1n2 );

        expect( cy.$("#n1").degree() ).to.equal(1);
        expect( cy.$("#n2").degree() ).to.equal(2);
        expect( cy.$('#n1n2') ).to.have.length(1);
        expect( n1n2.removed() ).to.be.false;
      }

    });

    it('removes via selector', function(){
      cy.remove('edge');

      expect( cy.edges() ).to.have.length(0);
    });

  });

  describe('cy.collection()', function(){

    it('gets an empty collection', function(){
      var col = cy.collection();

      expect( col ).to.have.length(0);
      expect( col[0] ).to.be.undefined;
    });

  });

  describe('cy.$() et al', function(){

    it('cy.$()', function(){
      expect( cy.$('node#n1') ).to.have.length(1);
    });

    it('cy.elements()', function(){
      expect( cy.elements('node#n1') ).to.have.length(1);
    });

    it('cy.nodes()', function(){
      expect( cy.nodes('#n1') ).to.have.length(1);
    });

    it('cy.edges()', function(){
      expect( cy.edges('#n1n2') ).to.have.length(1);
    });

    it('cy.filter() with selector', function(){
      expect( cy.filter('node#n1') ).to.have.length(1);
    });

    it('cy.filter() with function', function(){
      expect( cy.filter(function(ele, i){
        return ele.id() === 'n1';
      }) ).to.have.length(1);
    });

    it('cy.$() returns immutible collection', function(){
      var eles = cy.$();
      var length = eles.length;

      cy.add({ data: { id: 'foo' } });

      expect( eles.length ).to.equal( length );
      expect( eles.filter('#foo').empty() ).to.be.true;
    });

  });

  describe('cy.json()', function(){

    it('cy.json() adds element', function(){
      var cb = 0;
      cy.on('add', function(){ cb++; });

      cy.json({
        elements: [
          { group: 'nodes', data: { id: "n1", foo: "one", weight: 0.25 }, classes: "odd one" },
          { group: 'nodes', data: { id: "n2", foo: "two", weight: 0.5 }, classes: "even two" },
          { group: 'nodes', data: { id: "n3", foo: "three", weight: 0.75 }, classes: "odd three" },
          { group: 'nodes', data: { id: "n4", foo: "four", weight: 1 }, classes: "even four" },
          { group: 'edges', data: { id: "n1n2", source: "n1", target: "n2", weight: 0.33 }, classes: "uh" },
          { group: 'edges', data: { id: "n2n3", source: "n2", target: "n3", weight: 0.66 }, classes: "huh" }
        ]
      });

      expect( cy.$('#n1').length ).to.equal(1);
      expect( cy.$('#n2').length ).to.equal(1);
      expect( cy.$('#n3').length ).to.equal(1);
      expect( cy.$('#n4').length ).to.equal(1);
      expect( cy.$('#n1n2').length ).to.equal(1);
      expect( cy.$('#n2n3').length ).to.equal(1);

      expect( cy.$('#n1').data('foo') ).to.equal('one');

      expect( cb ).to.equal(1);
    });

    it('cy.json() adds element via alt syntax', function(){
      var cb = 0;
      cy.on('add', function(){ cb++; });

      cy.json({
        elements: {
          nodes: [
              { data: { id: "n1", foo: "one", weight: 0.25 }, classes: "odd one" },
              { data: { id: "n2", foo: "two", weight: 0.5 }, classes: "even two" },
              { data: { id: "n3", foo: "three", weight: 0.75 }, classes: "odd three" },
              { data: { id: "n4", foo: "four", weight: 1 }, classes: "even four" }
          ],

          edges: [
              { data: { id: "n1n2", source: "n1", target: "n2", weight: 0.33 }, classes: "uh" },
              { data: { id: "n2n3", source: "n2", target: "n3", weight: 0.66 }, classes: "huh" }
          ]
        }
      });

      expect( cy.$('#n1').length ).to.equal(1);
      expect( cy.$('#n2').length ).to.equal(1);
      expect( cy.$('#n3').length ).to.equal(1);
      expect( cy.$('#n4').length ).to.equal(1);
      expect( cy.$('#n1n2').length ).to.equal(1);
      expect( cy.$('#n2n3').length ).to.equal(1);

      expect( cy.$('#n1').data('foo') ).to.equal('one');

      expect( cb ).to.equal(1);
    });

    it('cy.json() removes element', function(){
      var cb = 0;
      cy.on('remove', function(){ cb++; });

      cy.json({
        elements: [
          { group: 'nodes', data: { id: "n1", foo: "one", weight: 0.25 }, classes: "odd one" },
          { group: 'nodes', data: { id: "n2", foo: "two", weight: 0.5 }, classes: "even two" },
          { group: 'edges', data: { id: "n1n2", source: "n1", target: "n2", weight: 0.33 }, classes: "uh" },
          { group: 'edges', data: { id: "n2n3", source: "n2", target: "n3", weight: 0.66 }, classes: "huh" }
        ]
      });

      expect( cy.$('#n1').length ).to.equal(1);
      expect( cy.$('#n2').length ).to.equal(1);
      expect( cy.$('#n3').length ).to.equal(0);
      expect( cy.$('#n1n2').length ).to.equal(1);
      expect( cy.$('#n2n3').length ).to.equal(0); // because connected

      expect( cb ).to.equal(2);
    });

    it('cy.json() removes element via alt syntax', function(){
      var cb = 0;
      cy.on('remove', function(){ cb++; });

      cy.json({
        elements: {
          nodes: [
              { data: { id: "n1", foo: "one", weight: 0.25 }, classes: "odd one" },
              { data: { id: "n2", foo: "two", weight: 0.5 }, classes: "even two" }
          ],

          edges: [
              { data: { id: "n1n2", source: "n1", target: "n2", weight: 0.33 }, classes: "uh" },
              { data: { id: "n2n3", source: "n2", target: "n3", weight: 0.66 }, classes: "huh" }
          ]
        }
      });

      expect( cy.$('#n1').length ).to.equal(1);
      expect( cy.$('#n2').length ).to.equal(1);
      expect( cy.$('#n3').length ).to.equal(0);
      expect( cy.$('#n1n2').length ).to.equal(1);
      expect( cy.$('#n2n3').length ).to.equal(0); // because connected

      expect( cy.$('#n1').data('foo') ).to.equal('one');

      expect( cb ).to.equal(2);
    });

    it('cy.json() updates style', function(){
      cy.json({
        style: [
          {
            selector: 'node',
            style: {
              'background-color': 'red'
            }
          }
        ]
      });

      var styleColor = cy.$('#n1').style('background-color');

      cy.$('#n1').style('background-color', 'red');

      var bypassColor = cy.$('#n1').style('background-color');

      expect( styleColor ).to.equal( bypassColor );
    });

    it('cy.json() sets zoom', function(){
      var cb = 0;
      cy.on('zoom', function(){ cb++; });

      cy.json({
        zoom: 3
      });

      expect( cy.zoom() ).to.equal(3);
      expect( cb ).to.equal(1);
    });

    it('cy.json() sets pan', function(){
      cy.json({
        pan: { x: 100, y: 200 }
      });

      expect( cy.pan() ).to.deep.equal({ x: 100, y: 200 });
    });

    it('cy.json() sets one dim of pan', function(){
      var cb = 0;
      cy.on('pan', function(){ cb++; });

      cy.json({
        pan: { x: 100 }
      });

      expect( cy.pan().x ).to.equal(100);

      cy.json({
        pan: { y: 200 }
      });

      expect( cy.pan().x ).to.equal(100);
      expect( cy.pan().y ).to.equal(200);

      expect( cb ).to.equal(2);
    });

    it('cy.json() sets userPanningEnabled', function(){
      cy.json({
        userPanningEnabled: false
      });

      expect( cy.userPanningEnabled() ).to.equal( false );

      cy.json({
        userPanningEnabled: true
      });

      expect( cy.userPanningEnabled() ).to.equal( true );
    });

  });

});
