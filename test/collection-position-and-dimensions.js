var expect = require('chai').expect;
var cytoscape = require('../src/test.js', cytoscape);

describe('Collection position & dimensions', function(){

  var cy;

  // test setup
  beforeEach(function(){
    cy = cytoscape({
      elements: {
        nodes: [
            { data: { id: 'n1' }, position: { x: 100, y: 200 } },
            { data: { id: 'n2' } },
            { data: { id: 'n3' } }
        ],

        edges: [
            { data: { id: 'n1n2', source: 'n1', target: 'n2' } },
            { data: { id: 'n2n3', source: 'n2', target: 'n3' } }
        ]
      },
      layout: { name: 'preset' }
    });
  });

  describe('eles.position()', function(){

    var n1;

    beforeEach(function(){
      n1 = cy.$('#n1');
    });

    it('ele.position() gets initial position', function(){
      var n1Pos = n1.position();

      // test get
      expect( n1Pos.x ).to.equal(100);
      expect( n1Pos.y ).to.equal(200);
    });

    it('eles.posiiton("x") sets and gets correctly', function(){
      n1.position('x', 123);
      expect( n1.position('x') ).to.equal(123);
    });

    it('eles.position({}) sets one dimension', function(){
      n1.position({
        y: 234
      });
      expect( n1.position().y ).to.equal(234);
      expect( n1.position().x ).to.equal(100);
    });

    it('eles.position({}) sets both dimensions', function(){
      n1.position({
        x: 1,
        y: 2
      });
      expect( n1.position().x ).to.equal(1);
      expect( n1.position().y ).to.equal(2);
    });

    it('eles.position({}) sets all elements in collection', function(){
      var nodes = cy.nodes().position({
        x: 12,
        y: 34
      });

      for(var i = 0; i < nodes.length; i++){
        expect( nodes[i].position().x ).to.equal(12);
        expect( nodes[i].position().y ).to.equal(34);
      }
    });

  });

  describe('eles.positions()', function(){
    it('sets correctly', function(){
      var nodes = cy.nodes().positions(function(ele, i){
        switch( ele.id() ){
          case 'n1':
            return false;
          case 'n2':
            return { x: 2, y: 3 };
          case 'n3':
            return { x: 3, y: 4 };
        }
      });

      expect( cy.$('#n1').position().x ).to.equal(100);
      expect( cy.$('#n1').position().y ).to.equal(200);

      expect( cy.$('#n2').position().x ).to.equal(2);
      expect( cy.$('#n2').position().y ).to.equal(3);

      expect( cy.$('#n3').position().x ).to.equal(3);
      expect( cy.$('#n3').position().y ).to.equal(4);
    });

    it('fires the `position` event', function(){
      var calls = 0;
      cy.nodes().on('position', function(){
        calls++;
      });

      cy.nodes().positions(function(){
        return { x: 1, y: 2 };
      });

      expect( calls ).to.equal(3);
    });
  });

  describe('eles.lock() etc', function(){

    it('should prevent position changes', function(){
      var n1 = cy.$('#n1');

      n1.lock();
      expect( n1.locked() ).to.be.true;
      n1.position({ x: 1, y: 2 });

      expect( n1.position().x ).to.equal(100);
      expect( n1.position().y ).to.equal(200);

      n1.unlock();
      n1.position({ x: 1, y: 2 });

      expect( n1.position().x ).to.equal(1);
      expect( n1.position().y ).to.equal(2);
    });

    it('should fire the `lock` event', function(done){
      var n1 = cy.$('#n1');

      n1.on('lock', function(){
        done();
      });

      n1.lock();
    });

  });

  describe('Dimensions are nonzero', function(){

    it('width', function(){
      expect( cy.$('#n1').width() ).to.not.equal(0);
      expect( cy.$('#n1').width() ).to.be.defined;
    });

    it('height', function(){
      expect( cy.$('#n1').width() ).to.not.equal(0);
      expect( cy.$('#n1').width() ).to.be.defined;
    });

    it('position', function(){
      expect( cy.$('#n1').position().x ).to.be.defined;
      expect( cy.$('#n1').position().y ).to.be.defined;
    });

    it('boundingbox', function(){
      var bb = cy.$('#n1').boundingBox();

      expect( bb.w ).to.be.defined;
      expect( bb.w ).to.not.equal(0);

      expect( bb.h ).to.be.defined;
      expect( bb.h ).to.not.equal(0);

      expect( bb.x1 ).to.be.defined;
      expect( bb.x2 ).to.be.defined;
      expect( bb.y1 ).to.be.defined;
      expect( bb.y2 ).to.be.defined;
    });

  });

});
