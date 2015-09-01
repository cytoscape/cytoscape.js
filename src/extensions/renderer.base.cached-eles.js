;(function($$){ 'use strict';

  var BaseRenderer = $$('renderer', 'base');
  var BR = BaseRenderer;
  var BRp = BR.prototype;

  var delEleCache = function( r ){
    r.eleEache = null;
  };

  var getEleCache = function( r ){
    if( !r.eleEache ){
      r.eleEache = {
        nodes: r.cy.nodes(),
        edges: r.cy.edges()
      };
    }

    return r.eleEache;
  };

  BRp.getCachedElements = function(){
    return getEleCache( this );
  };

  BRp.getCachedNodes = function(){
    return getEleCache( this ).nodes;
  };

  BRp.getCachedEdges = function(){
    return getEleCache( this ).edges;
  };

  BRp.updateElementsCache = function(){
    var r = this;

    delEleCache( r );

    return getEleCache( r );
  };

})( cytoscape );
