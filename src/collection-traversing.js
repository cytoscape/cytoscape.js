;(function($$){ 'use strict';

  // DAG functions
  //////////////////////////

  $$.fn.eles({
    // get the root nodes in the DAG
    roots: function( selector ){
      var eles = this;
      var roots = [];

      for( var i = 0; i < eles.length; i++ ){
        var ele = eles[i];
        if( !ele.isNode() ){
          continue;
        }

        var hasEdgesPointingIn = ele.connectedEdges(function(){
          return this.data('target') === ele.id() && this.data('source') !== ele.id();
        }).length > 0;

        if( !hasEdgesPointingIn ){
          roots.push( ele );
        }
      }

      return new $$.Collection( this._private.cy, roots, { unique: true } ).filter( selector );
    },

    // get the leaf nodes in the DAG
    leaves: function( selector ){
      var eles = this;
      var leaves = [];

      for( var i = 0; i < eles.length; i++ ){
        var ele = eles[i];
        if( !ele.isNode() ){
          continue;
        }

        var hasEdgesPointingOut = ele.connectedEdges(function(){
          return this.data('source') === ele.id() && this.data('target') !== ele.id();
        }).length > 0;

        if( !hasEdgesPointingOut ){
          leaves.push( ele );
        }
      }

      return new $$.Collection( this._private.cy, leaves, { unique: true } ).filter( selector );
    },

    // normally called children in graph theory
    // these nodes =edges=> outgoing nodes
    outgoers: function( selector ){
      var eles = this;
      var oEles = [];

      for( var i = 0; i < eles.length; i++ ){
        var ele = eles[i];
        var eleId = ele.id();

        if( !ele.isNode() ){ continue; }

        var edges = ele._private.edges;
        for( var j = 0; j < edges.length; j++ ){
          var edge = edges[j];
          var srcId = edge._private.data.source;
          var tgtId = edge._private.data.target;

          if( srcId === eleId && tgtId !== eleId ){
            oEles.push( edge );
            oEles.push( edge.target()[0] );
          }
        }
      }

      return new $$.Collection( this._private.cy, oEles, { unique: true } ).filter( selector );
    },

    // aka DAG descendants
    successors: function( selector ){
      var eles = this;
      var sEles = [];
      var sElesIds = {};

      for(;;){
        var outgoers = eles.outgoers();

        if( outgoers.length === 0 ){ break; } // done if no outgoers left

        var newOutgoers = false;
        for( var i = 0; i < outgoers.length; i++ ){
          var outgoer = outgoers[i];
          var outgoerId = outgoer.id();

          if( !sElesIds[ outgoerId ] ){
            sElesIds[ outgoerId ] = true;
            sEles.push( outgoer );
            newOutgoers = true;
          }
        }

        if( !newOutgoers ){ break; } // done if touched all outgoers already

        eles = outgoers;
      }

      return new $$.Collection( this._private.cy, sEles, { unique: true } ).filter( selector );
    },

    // normally called parents in graph theory
    // these nodes <=edges= incoming nodes
    incomers: function( selector ){
      var eles = this;
      var oEles = [];

      for( var i = 0; i < eles.length; i++ ){
        var ele = eles[i];
        var eleId = ele.id();

        if( !ele.isNode() ){ continue; }

        var edges = ele._private.edges;
        for( var j = 0; j < edges.length; j++ ){
          var edge = edges[j];
          var srcId = edge._private.data.source;
          var tgtId = edge._private.data.target;

          if( tgtId === eleId && srcId !== eleId ){
            oEles.push( edge );
            oEles.push( edge.source()[0] );
          }
        }
      }

      return new $$.Collection( this._private.cy, oEles, { unique: true } ).filter( selector );
    },

    // aka DAG ancestors
    predecessors: function( selector ){
      var eles = this;
      var pEles = [];
      var pElesIds = {};

      for(;;){
        var incomers = eles.incomers();

        if( incomers.length === 0 ){ break; } // done if no incomers left

        var newIncomers = false;
        for( var i = 0; i < incomers.length; i++ ){
          var incomer = incomers[i];
          var incomerId = incomer.id();

          if( !pElesIds[ incomerId ] ){
            pElesIds[ incomerId ] = true;
            pEles.push( incomer );
            newIncomers = true;
          }
        }

        if( !newIncomers ){ break; } // done if touched all incomers already

        eles = incomers;
      }

      return new $$.Collection( this._private.cy, pEles, { unique: true } ).filter( selector );
    }
  });


  // Neighbourhood functions
  //////////////////////////

  $$.fn.eles({
    neighborhood: function(selector){
      var elements = [];
      var cy = this._private.cy;
      var nodes = this.nodes();

      for( var i = 0; i < nodes.length; i++ ){ // for all nodes
        var node = nodes[i];
        var connectedEdges = node.connectedEdges();

        // for each connected edge, add the edge and the other node
        for( var j = 0; j < connectedEdges.length; j++ ){
          var edge = connectedEdges[j];
          var otherNode = edge.connectedNodes().not(node);

          // need check in case of loop
          if( otherNode.length > 0 ){
            elements.push( otherNode[0] ); // add node 1 hop away
          }
          
          // add connected edge
          elements.push( edge[0] );
        }

      }
      
      return ( new $$.Collection( cy, elements, { unique: true } ) ).filter( selector );
    },

    closedNeighborhood: function(selector){
      return this.neighborhood().add( this ).filter( selector );
    },

    openNeighborhood: function(selector){
      return this.neighborhood( selector );
    }
  });  

  // aliases
  $$.elesfn.neighbourhood = $$.elesfn.neighborhood;
  $$.elesfn.closedNeighbourhood = $$.elesfn.closedNeighborhood;
  $$.elesfn.openNeighbourhood = $$.elesfn.openNeighborhood;


  // Edge functions
  /////////////////

  $$.fn.eles({
    source: function( selector ){
      var ele = this[0];
      var src;

      if( ele ){
        src = ele._private.source;
      }

      return src && selector ? src.filter( selector ) : src;
    },

    target: function( selector ){
      var ele = this[0];
      var tgt;

      if( ele ){
        tgt = ele._private.target;
      }

      return tgt && selector ? tgt.filter( selector ) : tgt;
    },

    sources: defineSourceFunction({
      attr: 'source'
    }),

    targets: defineSourceFunction({
      attr: 'target'
    })
  });
  
  function defineSourceFunction( params ){
    return function( selector ){
      var sources = [];
      var cy = this._private.cy;

      for( var i = 0; i < this.length; i++ ){
        var ele = this[i];
        var src = ele._private[ params.attr ];

        if( src ){
          sources.push( src );
        }
      }
      
      return new $$.Collection( cy, sources, { unique: true } ).filter( selector );
    };
  }

  $$.fn.eles({
    edgesWith: defineEdgesWithFunction(),

    edgesTo: defineEdgesWithFunction({
      thisIs: 'source'
    })
  });
  
  function defineEdgesWithFunction( params ){
    
    return function(otherNodes){
      var elements = [];
      var cy = this._private.cy;
      var p = params || {};

      // get elements if a selector is specified
      if( $$.is.string(otherNodes) ){
        otherNodes = cy.$( otherNodes );
      }
      
      var thisIds = this._private.ids;
      var otherIds = otherNodes._private.ids;
      
      for( var h = 0; h < otherNodes.length; h++ ){
        var edges = otherNodes[h]._private.edges;
        
        for( var i = 0; i < edges.length; i++ ){
          var edge = edges[i];
          var foundId;
          var edgeData = edge._private.data;
          var thisToOther = thisIds[ edgeData.source ] && otherIds[ edgeData.target ];
          var otherToThis = otherIds[ edgeData.source ] && thisIds[ edgeData.target ];
          var edgeConnectsThisAndOther = thisToOther || otherToThis;

          if( !edgeConnectsThisAndOther ){ continue; }

          if( p.thisIs ){
            if( p.thisIs === 'source' && !thisToOther ){ continue; }
            
            if( p.thisIs === 'target' && !otherToThis ){ continue; }
          }
          
          elements.push( edge );
        }
      }
      
      return new $$.Collection( cy, elements, { unique: true } );
    };
  }
  
  $$.fn.eles({
    connectedEdges: function( selector ){
      var retEles = [];
      var cy = this._private.cy;
      
      var eles = this;
      for( var i = 0; i < eles.length; i++ ){
        var node = eles[i];
        if( !node.isNode() ){ continue; }

        var edges = node._private.edges;

        for( var j = 0; j < edges.length; j++ ){
          var edge = edges[j];          
          retEles.push( edge );
        }
      }
      
      return new $$.Collection( cy, retEles, { unique: true } ).filter( selector );
    },

    connectedNodes: function( selector ){
      var retEles = [];
      var cy = this._private.cy;

      var eles = this;
      for( var i = 0; i < eles.length; i++ ){
        var edge = eles[i];
        if( !edge.isEdge() ){ continue; }

        retEles.push( edge.source()[0] );
        retEles.push( edge.target()[0] );
      }

      return new $$.Collection( cy, retEles, { unique: true } ).filter( selector );
    },

    parallelEdges: defineParallelEdgesFunction(),

    codirectedEdges: defineParallelEdgesFunction({
      codirected: true
    })
  });
  
  function defineParallelEdgesFunction(params){
    var defaults = {
      codirected: false
    };
    params = $$.util.extend({}, defaults, params);
    
    return function( selector ){
      var cy = this._private.cy;
      var elements = [];
      var edges = this.edges();
      var p = params;

      // look at all the edges in the collection
      for( var i = 0; i < edges.length; i++ ){
        var edge1 = edges[i];
        var src1 = edge1.source()[0];
        var srcid1 = src1.id();
        var tgt1 = edge1.target()[0];
        var tgtid1 = tgt1.id();
        var srcEdges1 = src1._private.edges;

        // look at edges connected to the src node of this edge
        for( var j = 0; j < srcEdges1.length; j++ ){
          var edge2 = srcEdges1[j];
          var edge2data = edge2._private.data;
          var tgtid2 = edge2data.target;
          var srcid2 = edge2data.source;

          var codirected = tgtid2 === tgtid1 && srcid2 === srcid1;
          var oppdirected = srcid1 === tgtid2 && tgtid1 === srcid2;
          
          if( (p.codirected && codirected) || (!p.codirected && (codirected || oppdirected)) ){
            elements.push( edge2 );
          }
        }
      }
      
      return new $$.Collection( cy, elements, { unique: true } ).filter( selector );
    };
  
  }

  
})( cytoscape );
