var expect = require('chai').expect;
var cytoscape = require('../build/cytoscape.js', cytoscape);

function MockRenderer(){
  this.notifications = 0;
}

MockRenderer.prototype.notify = function(){
  this.notifications++;
};

MockRenderer.prototype.numNotifications = function(){
  return this.notifications;
};

cytoscape('renderer', 'mock', MockRenderer);

describe('Collection data', function(){

  var cy;

  // test setup
  beforeEach(function(done){
    cytoscape({
      renderer: {
        name: 'mock'
      },

      elements: {
        nodes: [
            { data: { id: "n1", foo: "one", weight: 0.25 }, classes: "odd one" },
            { data: { id: "n2", foo: "two", weight: 0.5 }, classes: "even two" },
            { data: { id: "n3", foo: "three", weight: 0.75 }, classes: "odd three" },
            { data: { id: "n4", parent: "n5", foo: "bar" } },
            { data: { id: "n5" } }
        ],
        
        edges: [
            { data: { id: "n1n2", source: "n1", target: "n2", weight: 0.33 }, classes: "uh" },
            { data: { id: "n2n3", source: "n2", target: "n3", weight: 0.66 }, classes: "huh" },
            { data: { id: "n1n1", source: "n1", target: "n1" } }
        ]
      },
      ready: function(){
        cy = this;

        done();
      }
    });
  });


  describe('eles.data()', function(){

    it('eles.data() gets all data', function(){
      var n1 = cy.$('#n1');
      var data = n1.data();

      expect( data ).to.have.property( 'foo', 'one' );
      expect( data ).to.have.property( 'weight', 0.25 );
    });

    it('eles.data(name) gets an individual field', function(){
      expect( cy.$('#n1').data('foo') ).to.equal('one');
      expect( cy.$('#n1').data('weight') ).to.equal(0.25);
    });

    it('eles.data(name, value) sets an individual field', function(){
      cy.$('#n1').data('foo', 'bar');
      expect( cy.$('#n1').data('foo') ).to.equal('bar');

      var nodes = cy.nodes().data('foo', 'bar');
      for( var i = 0; i < nodes.length; i++ ){
        expect( nodes[i].data('foo') ).to.equal('bar'); 
      }
    });

    it('eles.data(obj) sets data via an object', function(){
      var nodes = cy.$('#n1, #n2').data({ foo: 'foo', bar: 'bar' });

      for( var i = 0; i < nodes.length; i++ ){
        expect( nodes[i].data('foo') ).equals('foo');
        expect( nodes[i].data('bar') ).equals('bar');
      }
    });

  });

  describe('eles.removeData()', function(){

    it('eles.removeData() removes all data', function(){
      var nodes = cy.nodes().removeData();

      for( var i = 0; i < nodes.length; i++ ){
        expect( nodes[i].data('foo') ).to.be.undefined;
        expect( nodes[i].data('weight') ).to.be.undefined;
      }
    });

    it('eles.removeData(names) removes specified names', function(){
      var n1 = cy.$('#n1').removeData('foo');
      expect( n1.data('foo') ).to.be.undefined;
    });

    it('leave immutable data intact', function(){
      var n = cy.$('#n4').removeData();
      var e = cy.$('#n1n2').removeData();

      expect( n.data('id') ).to.be.defined;
      expect( n.data('parent') ).to.be.defined;
      expect( e.data('id') ).to.be.defined;
      expect( e.data('source') ).to.be.defined;
      expect( e.data('target') ).to.be.defined;
    });

  });

  describe('eles.id()', function(){

    it('gets the ID', function(){
      expect( cy.$('#n1').id() ).equals('n1');
      expect( cy.$('#n2').id() ).equals('n2');
      expect( cy.$('#n3').id() ).equals('n3');
    });

  });

  describe('eles.json()', function(){

    it('has all fields defined', function(){
      var n1 = cy.$('#n1');
      var json = n1.json();

      expect( json ).to.have.property('group', 'nodes');
      expect( json ).to.have.deep.property('data.id', 'n1');
      expect( json ).to.have.deep.property('data.foo', 'one');
      expect( json ).to.have.deep.property('data.weight', 0.25);
      expect( json ).to.have.property('position');
      expect( json ).to.have.property('selected', n1.selected());
      expect( json ).to.have.property('selectable', n1.selectable());
      expect( json ).to.have.property('locked', n1.locked());
      expect( json ).to.have.property('grabbable', n1.grabbable());
      expect( json ).to.have.property('classes');
      expect( json.classes === 'odd one' || json.classes === 'one odd' ).to.be.true;

    });

  });

  describe('eles.group()', function(){

    it('returns "nodes" for a node', function(){
      expect( cy.$('#n1').group() ).to.equal('nodes');
    });

    it('returns "edges" for a edge', function(){
      expect( cy.$('#n1n2').group() ).to.equal('edges');
    });

  });

  describe('eles.isNode()', function(){

    it('returns true for a node', function(){
      expect( cy.$('#n1').isNode() ).to.be.true;
    });

    it('returns false for a edge', function(){
      expect( cy.$('#n1n2').isNode() ).to.be.false;
    });

  });

  describe('eles.isEdge()', function(){

    it('returns false for a node', function(){
      expect( cy.$('#n1').isEdge() ).to.be.false;
    });

    it('returns true for a edge', function(){
      expect( cy.$('#n1n2').isEdge() ).to.be.true;
    });

  });

  describe('eles.isLoop()', function(){

    it('returns false for normal edge', function(){
      expect( cy.$('#n1n2').isLoop() ).to.be.false;
    });

    it('returns true for loop edge', function(){
      expect( cy.$('#n1n1').isLoop() ).to.be.true;
    });

  });

  describe('eles.batch()', function(){

    it('limits notifications to 1', function(){
      var numNots = cy.renderer().numNotifications();

      cy.batch(function(){
        cy.$('#n1')
          .addClass('foo')
          .removeClass('bar')
          .data('foo', 'bar')
          .select()
        ;
      });

      expect( cy.renderer().numNotifications() ).to.equal( numNots + 1 );
    });

    it('can also be used async style', function(done){
      var numNots = cy.renderer().numNotifications();

      cy.startBatch();

      setTimeout(function(){
        cy.$('#n1')
          .addClass('foo')
          .removeClass('bar')
          .data('foo', 'bar')
          .select()
        ;
        
        cy.endBatch();

        expect( cy.renderer().numNotifications() ).to.equal( numNots + 1 );

        done();
      }, 10);

    });

  });

});