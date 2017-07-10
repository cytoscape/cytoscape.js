let ifEdge = (self, then) => {
  if( self.isEdge() ){
    return then( self.renderer() );
  }
};

module.exports = {
  controlPoints: function(){
    return ifEdge( this, renderer => renderer.getControlPoints( this ) );
  },
  segmentPoints: function(){
    return ifEdge( this, renderer => renderer.getSegmentPoints( this ) );
  },
  sourceEndpoint: function(){
    return ifEdge( this, renderer => renderer.getSourceEndpoint( this ) );
  },
  targetEndpoint: function(){
    return ifEdge( this, renderer => renderer.getTargetEndpoint( this ) );
  },
  midpoint: function(){
    return ifEdge( this, renderer => renderer.getEdgeMidpoint( this ) );
  }
};
