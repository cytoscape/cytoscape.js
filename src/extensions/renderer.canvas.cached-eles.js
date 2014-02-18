;(function($$){ "use strict";

  var CanvasRenderer = $$('renderer', 'canvas');

  CanvasRenderer.prototype.getCachedNodes = function() {
    var data = this.data; var cy = this.data.cy;
    
    if (data.cache == undefined) {
      data.cache = {};
    }
    
    if (data.cache.cachedNodes == undefined) {
      data.cache.cachedNodes = cy.nodes();
    }
    
    return data.cache.cachedNodes;
  }
  
  CanvasRenderer.prototype.updateNodesCache = function() {
    var data = this.data; var cy = this.data.cy;
    
    if (data.cache == undefined) {
      data.cache = {};
    }
    
    data.cache.cachedNodes = cy.nodes();
  }
  
  CanvasRenderer.prototype.getCachedEdges = function() {
    var data = this.data; var cy = this.data.cy;
    
    if (data.cache == undefined) {
      data.cache = {};
    }
    
    if (data.cache.cachedEdges == undefined) {
      data.cache.cachedEdges = cy.edges();
    }
    
    return data.cache.cachedEdges;
  }
  
  CanvasRenderer.prototype.updateEdgesCache = function() {
    var data = this.data; var cy = this.data.cy;
    
    if (data.cache == undefined) {
      data.cache = {};
    }
    
    data.cache.cachedEdges = cy.edges();
  }

})( cytoscape );
