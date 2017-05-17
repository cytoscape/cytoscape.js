var expect = require('chai').expect;
var cytoscape = require('../src/test.js', cytoscape);

describe('Collection compound nodes', function(){

  var cy, n1, n2, n3, n4;

  // test setup
  beforeEach(function(done){
    cytoscape({
      styleEnabled: true,

      elements: {
        nodes: [
            { data: { id: 'n1' } },
            { data: { id: 'n2', parent: 'n1' } },
            { data: { id: 'n3', parent: 'n2' } },
            { data: { id: 'n4', parent: 'n2' } }
        ]
      },

      layout: {
        name: 'grid'
      },

      ready: function(){
        cy = this;
        n1 = cy.$('#n1');
        n2 = cy.$('#n2');
        n3 = cy.$('#n3');
        n4 = cy.$('#n4');

        done();
      }
    });
  });

  afterEach(function(){
    cy.destroy();
  });

  it('node.isParent()', function(){
    expect( n1.isParent() ).to.be.true;
    expect( n3.isParent() ).to.be.false;
  });

  it('node.isChildless()', function(){
    expect( n1.isChildless() ).to.be.false;
    expect( n3.isChildless() ).to.be.true;
  });

  it('node.isChild()', function(){
    expect( n1.isChild() ).to.be.false;
    expect( n3.isChild() ).to.be.true;
  });

  it('node.isOrphan()', function(){
    expect( n1.isOrphan() ).to.be.true;
    expect( n3.isOrphan() ).to.be.false;
  });

  it('nodes.parent()', function(){
    expect( n2.parent().same(n1) ).to.be.true;
  });

  it('nodes.parents()', function(){
    expect( n3.parents().same( n1.add(n2) ) ).to.be.true;
  });

  it('nodes.children()', function(){
    expect( n1.children().same( n2 ) ).to.be.true;
  });

  it('nodes.descendants()', function(){
    expect( n1.descendants().same( n2.add(n3).add(n4) ) ).to.be.true;
  });

  it('nodes.siblings()', function(){
    expect( n3.siblings().same( n4 ) ).to.be.true;
  });

  it('nodes.commonAncestors()', function(){
    var ancestors = n3.add(n4).commonAncestors();

    expect( ancestors.length ).to.equal( 2 );
    expect( ancestors[0].same( n2 ) ).to.be.true;
    expect( ancestors[1].same( n1 ) ).to.be.true;
  });

  it('nodes.orphans()', function(){
    expect( cy.elements().orphans().same( n1 ) ).to.be.true;
  });

  it('nodes.nonorphans()', function(){
    expect( cy.elements().nonorphans().same( n2.add(n3).add(n4) ) ).to.be.true;
  });

  it('child.position() moves parent', function(){
    var p1 = {
      x: n2.position().x,
      y: n2.position().y
    };

    n4.position({ x: -200, y: -200 });

    expect( n2.position() ).to.not.deep.equal( p1 );
  });

  it('child.position() moves parent boundingbox', function(){
    var w = n2.boundingBox().w;
    var h = n2.boundingBox().h;

    n4.position({ x: -200, y: -200 });

    expect( n2.boundingBox().w ).to.not.equal( w );
    expect( n2.boundingBox().h ).to.not.equal( h );
  });
});
