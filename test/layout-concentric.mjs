import { expect } from 'chai';
import cytoscape from '../src/test.mjs';

describe('Layout concentric', function(){

  var bb = { x1: 0, y1: 0, w: 400, h: 400 };
  var cy;

  afterEach(function(){
    cy.destroy();
  });

  var makeCy = function( levels, nodesPerLevel ){
    var elements = [];

    for( var l = 0; l < levels; l++ ){
      for( var i = 0; i < nodesPerLevel; i++ ){
        elements.push({ data: { id: 'n' + l + '-' + i, level: l } });
      }
    }

    cy = cytoscape({
      headless: true,
      styleEnabled: true,
      elements: elements
    });
  };

  var runLayout = function(){
    cy.layout({
      name: 'concentric',
      boundingBox: bb,
      fit: false,
      avoidOverlap: false,
      minNodeSpacing: 10,
      concentric: function( node ){ return node.data('level'); },
      levelWidth: function(){ return 1; }
    }).run();
  };

  var expectNodesInsideBoundingBox = function(){
    cy.nodes().forEach(function( node ){
      var p = node.position();
      var halfW = node.outerWidth() / 2;
      var halfH = node.outerHeight() / 2;

      expect( p.x - halfW, node.id() + ' left' ).to.be.at.least( bb.x1 );
      expect( p.x + halfW, node.id() + ' right' ).to.be.at.most( bb.x1 + bb.w );
      expect( p.y - halfH, node.id() + ' top' ).to.be.at.least( bb.y1 );
      expect( p.y + halfH, node.id() + ' bottom' ).to.be.at.most( bb.y1 + bb.h );
    });
  };

  it('keeps many single-node levels inside the bounding box when avoidOverlap is false', function(){
    makeCy( 10, 1 );

    runLayout();

    expectNodesInsideBoundingBox();
  });

  it('keeps many multi-node levels inside the bounding box when avoidOverlap is false', function(){
    makeCy( 10, 4 );

    runLayout();

    expectNodesInsideBoundingBox();
  });

});
