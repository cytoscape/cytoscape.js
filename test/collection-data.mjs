var expect = require('chai').expect;
var cytoscape = require('../src/test.js', cytoscape);

describe('Collection data', function(){

  var cy;
  var n1, n1n2;

  // test setup
  beforeEach(function(){
    cy = cytoscape({
      renderer: {
        name: 'null'
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
      }
    });

    n1 = cy.$('#n1');
    n1n2 = cy.$('#n1n2');
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

      expect( n.data('id') ).to.exist;
      expect( n.data('parent') ).to.exist;
      expect( e.data('id') ).to.exist;
      expect( e.data('source') ).to.exist;
      expect( e.data('target') ).to.exist;
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
      expect( json ).to.have.property('data');
      expect( json.data ).to.have.property('id', 'n1');
      expect( json.data ).to.have.property('foo', 'one');
      expect( json.data ).to.have.property('weight', 0.25);
      expect( json ).to.have.property('position');
      expect( json ).to.have.property('selected', n1.selected());
      expect( json ).to.have.property('selectable', n1.selectable());
      expect( json ).to.have.property('locked', n1.locked());
      expect( json ).to.have.property('grabbable', n1.grabbable());
      expect( json ).to.have.property('pannable', n1.pannable());
      expect( json ).to.have.property('classes');
      expect( json.classes === 'odd one' || json.classes === 'one odd' ).to.be.true;

    });

    it('sets data', function(){
      var evts = 0;
      n1.on('data', function(){ evts++; });

      n1.json({ data: { foo: 'bar' } });

      expect( n1.data('foo') ).to.equal('bar');
      expect( evts ).to.equal(1);
    });

    it('sets classes', function(){
      var evts = 0;
      n1.on('class', function(){ evts++; });

      n1.json({ classes: 'odd other' });

      expect( n1.hasClass('odd') ).to.be.true;
      expect( n1.hasClass('other') ).to.be.true;

      expect( evts ).to.equal(1);
    });

    it('sets position', function(){
      var evts = 0;
      n1.on('position', function(){ evts++; });

      n1.json({ position: { x: 100, y: 200 } });

      expect( n1.position() ).to.deep.equal({ x: 100, y: 200 });

      expect( evts ).to.equal(1);
    });

    it('sets selected', function(){
      var evts = 0;
      n1.on('select', function(){ evts++; });

      n1.json({ selected: true });

      expect( n1.selected() ).to.be.true;

      expect( evts ).to.equal(1);
    });

    it('sets unselected', function(){
      n1.select();

      var evts = 0;
      n1.on('unselect', function(){ evts++; });

      n1.json({ selected: false });

      expect( n1.selected() ).to.be.false;

      expect( evts ).to.equal(1);
    });

    it('sets locked', function(){
      var evts = 0;
      n1.on('lock', function(){ evts++; });

      n1.json({ locked: true });

      expect( n1.locked() ).to.be.true;

      expect( evts ).to.equal(1);
    });

    it('sets unlocked', function(){
      n1.lock();

      var evts = 0;
      n1.on('unlock', function(){ evts++; });

      n1.json({ locked: false });

      expect( n1.locked() ).to.be.false;

      expect( evts ).to.equal(1);
    });

    it('sets grabbable', function(){
      n1.ungrabify();

      var evts = 0;
      n1.on('grabify', function(){ evts++; });

      n1.json({ grabbable: true });

      expect( n1.grabbable() ).to.be.true;

      expect( evts ).to.equal(1);
    });

    it('sets ungrabbable', function(){
      var evts = 0;
      n1.on('ungrabify', function(){ evts++; });

      n1.json({ grabbable: false });

      expect( n1.grabbable() ).to.be.false;

      expect( evts ).to.equal(1);
    });

    it('sets pannable', function(){
      n1n2.unpanify();

      var evts = 0;
      n1n2.on('panify', function(){ evts++; });

      n1n2.json({ pannable: true });

      expect( n1n2.pannable() ).to.be.true;

      expect( evts ).to.equal(1);
    });

    it('sets unpannable', function(){
      var evts = 0;
      n1n2.on('unpanify', function(){ evts++; });

      n1n2.json({ pannable: false });

      expect( n1n2.pannable() ).to.be.false;

      expect( evts ).to.equal(1);
    });

    it('moves edge source', function(){
      var n1n2 = cy.$('#n1n2');

      n1n2.json({ data: { source: 'n3' } });

      expect( cy.$('#n1n2').source().id() ).to.equal('n3');
    });

    it('moves edge target', function(){
      var n1n2 = cy.$('#n1n2');

      n1n2.json({ data: { target: 'n3' } });

      expect( cy.$('#n1n2').target().id() ).to.equal('n3');
    });

    it('moves edge source and target', function(){
      var n1n2 = cy.$('#n1n2');

      n1n2.json({ data: { source: 'n3', target: 'n4' } });

      expect( cy.$('#n1n2').source().id() ).to.equal('n3');
      expect( cy.$('#n1n2').target().id() ).to.equal('n4');
    });

    it('moves edge source and target and selected state', function(){
      var n1n2 = cy.$('#n1n2');

      // changing the source or target removes the old ele and adds a new one
      // so make sure that the selected state is applied to the new ele
      n1n2.json({ data: { source: 'n3', target: 'n4' }, selected: true });

      expect( cy.$('#n1n2').source().id() ).to.equal('n3');
      expect( cy.$('#n1n2').target().id() ).to.equal('n4');
      expect( cy.$('#n1n2').selected() ).to.be.true;
    });

    it('moves node parent', function(){
      cy.$('#n4').json({ data: { parent: 'n1' } });

      expect( cy.$('#n4').parent().id() ).to.equal('n1');
    });

    it('moves node parent and position', function(){
      // changing parent removes the old ele and adds a new one
      // so make sure that position is applied to the new ele
      cy.$('#n4').json({ data: { parent: 'n1' }, position: { x: 1234, y: 5678 } });

      expect( cy.$('#n4').parent().id() ).to.equal('n1');
      expect( cy.$('#n4').position() ).to.deep.equal({ x: 1234, y: 5678 });
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

});
