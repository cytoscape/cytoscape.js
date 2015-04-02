;(function($$){ 'use strict';

  var CanvasRenderer = $$('renderer', 'canvas');
  var CRp = CanvasRenderer.prototype;

  CRp.getCachedNodes = function() {
    var data = this.data; var cy = this.data.cy;
    
    if (data.cache == null) {
      data.cache = {};
    }
    
    if (data.cache.cachedNodes == null) {
      data.cache.cachedNodes = cy.nodes();
    }
    
    return data.cache.cachedNodes;
  };
  
  CRp.updateNodesCache = function() {
    var data = this.data; var cy = this.data.cy;
    
    if (data.cache == null) {
      data.cache = {};
    }
    
    data.cache.cachedNodes = cy.nodes();
  };
  
  CRp.getCachedEdges = function() {
    var data = this.data; var cy = this.data.cy;
    
    if (data.cache == null) {
      data.cache = {};
    }
    
    if (data.cache.cachedEdges == null) {
      data.cache.cachedEdges = cy.edges();
    }
    
    return data.cache.cachedEdges;
  };
  
  CRp.updateEdgesCache = function() {
    var data = this.data; var cy = this.data.cy;
    
    if (data.cache == null) {
      data.cache = {};
    }
    
    data.cache.cachedEdges = cy.edges();
  };

})( cytoscape );
