import { expect } from 'chai';
import cytoscape from '../src/test.mjs';

describe('Extensions', function(){
  var cy;

  before(function(){
    var coreExt = function( cytoscape ){
      cytoscape('core', 'foo', function(){ return 'foo-core'; });
    };

    cytoscape.use( coreExt );
  });

  before(function(){
    var collectionExt = function( cytoscape ){
      cytoscape('collection', 'foo', function(){ return 'foo-collection'; });
    };

    cytoscape.use( collectionExt );
  });

  before(function(){
    var layoutExt = function( cytoscape ){
      function Layout( options ){
        this.options = options;
      }

      Layout.prototype.run = function(){
        this.options.eles.nodes().layoutPositions( this, this.options, function(){
          return { x: -1, y: -1 };
        } );
      };

      cytoscape('layout', 'foo', Layout);
    };

    cytoscape.use( layoutExt );
  });

  before(function(){
    cy = cytoscape({ headless: true });
  });

  it('core extension works', function(){
    expect( cy.foo() ).to.equal('foo-core');
  });

  it('collection extension works', function(){
    expect( cy.nodes().foo() ).to.equal('foo-collection');
  });

  it('layout extension works', function(){
    cy.layout({ name: 'foo' }).run();

    cy.nodes().forEach(function(n){
      expect( n.position() ).to.deep.equal({ x: -1, y: -1 });
    });
  });
});
