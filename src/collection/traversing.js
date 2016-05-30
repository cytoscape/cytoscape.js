'use strict';

var util = require( '../util' );
var is = require( '../is' );

var elesfn = {};

var cache = function( fn, name ){
  return function traversalCache( arg1, arg2, arg3, arg4 ){
    var selectorOrEles = arg1;
    var eles = this;
    var key;

    if( selectorOrEles == null ){
      key = 'null';
    } else if( is.elementOrCollection( selectorOrEles ) && selectorOrEles.length === 1 ){
      key = '#' + selectorOrEles.id();
    }

    if( eles.length === 1 && key ){
      var _p = eles[0]._private;
      var tch = _p.traversalCache = _p.traversalCache || {};
      var ch = tch[ name ] = tch[ name ] || {};
      var cacheHit = ch[ key ];

      if( cacheHit ){
        return cacheHit;
      } else {
        return ( ch[ key ] = fn.call( eles, arg1, arg2, arg3, arg4 ) );
      }
    } else {
      return fn.call( eles, arg1, arg2, arg3, arg4 );
    }
  };
};

// DAG functions
////////////////

var defineDagExtremity = function( params ){
  return function dagExtremityImpl( selector ){
    var eles = this;
    var ret = [];

    for( var i = 0; i < eles.length; i++ ){
      var ele = eles[ i ];
      if( !ele.isNode() ){
        continue;
      }

      var disqualified = false;
      var edges = ele.connectedEdges();

      for( var j = 0; j < edges.length; j++ ){
        var edge = edges[j];
        var src = edge.source();
        var tgt = edge.target();

        if(
             ( params.noIncomingEdges && tgt === ele && src !== ele )
          || ( params.noOutgoingEdges && src === ele && tgt !== ele )
        ){
          disqualified = true;
          break;
        }
      }

      if( !disqualified ){
        ret.push( ele );
      }
    }

    return this.spawn( ret, { unique: true } ).filter( selector );
  };
};

var defineDagOneHop = function( params ){
  return function( selector ){
    var eles = this;
    var oEles = [];

    for( var i = 0; i < eles.length; i++ ){
      var ele = eles[ i ];

      if( !ele.isNode() ){ continue; }

      var edges = ele.connectedEdges();
      for( var j = 0; j < edges.length; j++ ){
        var edge = edges[ j ];
        var src = edge.source();
        var tgt = edge.target();

        if( params.outgoing && src === ele ){
          oEles.push( edge );
          oEles.push( tgt );
        } else if( params.incoming && tgt === ele ){
          oEles.push( edge );
          oEles.push( src );
        }
      }
    }

    return this.spawn( oEles, { unique: true } ).filter( selector );
  };
};

var defineDagAllHops = function( params ){
  return function( selector ){
    var eles = this;
    var sEles = [];
    var sElesIds = {};

    for( ;; ){
      var next = params.outgoing ? eles.outgoers() : eles.incomers();

      if( next.length === 0 ){ break; } // done if none left

      var newNext = false;
      for( var i = 0; i < next.length; i++ ){
        var n = next[ i ];
        var nid = n.id();

        if( !sElesIds[ nid ] ){
          sElesIds[ nid ] = true;
          sEles.push( n );
          newNext = true;
        }
      }

      if( !newNext ){ break; } // done if touched all outgoers already

      eles = next;
    }

    return this.spawn( sEles, { unique: true } ).filter( selector );
  };
};

util.extend( elesfn, {
  // get the root nodes in the DAG
  roots: defineDagExtremity({ noIncomingEdges: true }),

  // get the leaf nodes in the DAG
  leaves: defineDagExtremity({ noOutgoingEdges: true }),

  // normally called children in graph theory
  // these nodes =edges=> outgoing nodes
  outgoers: cache( defineDagOneHop({ outgoing: true }) , 'outgoers' ),

  // aka DAG descendants
  successors: defineDagAllHops({ outgoing: true }),

  // normally called parents in graph theory
  // these nodes <=edges= incoming nodes
  incomers: cache( defineDagOneHop({ incoming: true }), 'incomers' ),

  // aka DAG ancestors
  predecessors: defineDagAllHops({ incoming: true })
} );


// Neighbourhood functions
//////////////////////////

util.extend( elesfn, {
  neighborhood: cache(function( selector ){
    var elements = [];
    var nodes = this.nodes();

    for( var i = 0; i < nodes.length; i++ ){ // for all nodes
      var node = nodes[ i ];
      var connectedEdges = node.connectedEdges();

      // for each connected edge, add the edge and the other node
      for( var j = 0; j < connectedEdges.length; j++ ){
        var edge = connectedEdges[ j ];
        var src = edge.source();
        var tgt = edge.target();
        var otherNode = node === src ? tgt : src;

        // need check in case of loop
        if( otherNode.length > 0 ){
          elements.push( otherNode[0] ); // add node 1 hop away
        }

        // add connected edge
        elements.push( edge[0] );
      }

    }

    return ( this.spawn( elements, { unique: true } ) ).filter( selector );
  }, 'neighborhood'),

  closedNeighborhood: function( selector ){
    return this.neighborhood().add( this ).filter( selector );
  },

  openNeighborhood: function( selector ){
    return this.neighborhood( selector );
  }
} );

// aliases
elesfn.neighbourhood = elesfn.neighborhood;
elesfn.closedNeighbourhood = elesfn.closedNeighborhood;
elesfn.openNeighbourhood = elesfn.openNeighborhood;

// Edge functions
/////////////////

util.extend( elesfn, {
  source: cache(function sourceImpl( selector ){
    var ele = this[0];
    var src;

    if( ele ){
      src = ele._private.source || ele.cy().collection();
    }

    return src && selector ? src.filter( selector ) : src;
  }, 'source'),

  target: cache(function targetImpl( selector ){
    var ele = this[0];
    var tgt;

    if( ele ){
      tgt = ele._private.target || ele.cy().collection();
    }

    return tgt && selector ? tgt.filter( selector ) : tgt;
  }, 'target'),

  sources: defineSourceFunction( {
    attr: 'source'
  } ),

  targets: defineSourceFunction( {
    attr: 'target'
  } )
} );

function defineSourceFunction( params ){
  return function sourceImpl( selector ){
    var sources = [];

    for( var i = 0; i < this.length; i++ ){
      var ele = this[ i ];
      var src = ele._private[ params.attr ];

      if( src ){
        sources.push( src );
      }
    }

    return this.spawn( sources, { unique: true } ).filter( selector );
  };
}

util.extend( elesfn, {
  edgesWith: cache( defineEdgesWithFunction(), 'edgesWith', true ),

  edgesTo: cache( defineEdgesWithFunction( {
    thisIsSrc: true
  } ), 'edgesTo', true )
} );

function defineEdgesWithFunction( params ){

  return function edgesWithImpl( otherNodes ){
    var elements = [];
    var cy = this._private.cy;
    var p = params || {};

    // get elements if a selector is specified
    if( is.string( otherNodes ) ){
      otherNodes = cy.$( otherNodes );
    }

    var thisIds = this._private.ids;
    var otherIds = otherNodes._private.ids;

    for( var h = 0; h < otherNodes.length; h++ ){
      var edges = otherNodes[ h ]._private.edges;

      for( var i = 0; i < edges.length; i++ ){
        var edge = edges[ i ];
        var edgeData = edge._private.data;
        var thisToOther = thisIds[ edgeData.source ] && otherIds[ edgeData.target ];
        var otherToThis = otherIds[ edgeData.source ] && thisIds[ edgeData.target ];
        var edgeConnectsThisAndOther = thisToOther || otherToThis;

        if( !edgeConnectsThisAndOther ){ continue; }

        if( p.thisIsSrc || p.thisIsTgt ){
          if( p.thisIsSrc && !thisToOther ){ continue; }

          if( p.thisIsTgt && !otherToThis ){ continue; }
        }

        elements.push( edge );
      }
    }

    return this.spawn( elements, { unique: true } );
  };
}

util.extend( elesfn, {
  connectedEdges: cache(function( selector ){
    var retEles = [];

    var eles = this;
    for( var i = 0; i < eles.length; i++ ){
      var node = eles[ i ];
      if( !node.isNode() ){ continue; }

      var edges = node._private.edges;

      for( var j = 0; j < edges.length; j++ ){
        var edge = edges[ j ];
        retEles.push( edge );
      }
    }

    return this.spawn( retEles, { unique: true } ).filter( selector );
  }, 'connectedEdges'),

  connectedNodes: cache(function( selector ){
    var retEles = [];

    var eles = this;
    for( var i = 0; i < eles.length; i++ ){
      var edge = eles[ i ];
      if( !edge.isEdge() ){ continue; }

      retEles.push( edge.source()[0] );
      retEles.push( edge.target()[0] );
    }

    return this.spawn( retEles, { unique: true } ).filter( selector );
  }, 'connectedNodes'),

  parallelEdges: cache( defineParallelEdgesFunction(), 'parallelEdges' ),

  codirectedEdges: cache( defineParallelEdgesFunction( {
    codirected: true
  } ), 'codirectedEdges' )
} );

function defineParallelEdgesFunction( params ){
  var defaults = {
    codirected: false
  };
  params = util.extend( {}, defaults, params );

  return function parallelEdgesImpl( selector ){ // micro-optimised for renderer
    var elements = [];
    var edges = this.edges();
    var p = params;

    // look at all the edges in the collection
    for( var i = 0; i < edges.length; i++ ){
      var edge1 = edges[ i ];
      var edge1_p = edge1._private;
      var src1 = edge1_p.source;
      var srcid1 = src1._private.data.id;
      var tgtid1 = edge1_p.data.target;
      var srcEdges1 = src1._private.edges;

      // look at edges connected to the src node of this edge
      for( var j = 0; j < srcEdges1.length; j++ ){
        var edge2 = srcEdges1[ j ];
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

    return this.spawn( elements, { unique: true } ).filter( selector );
  };

}

// Misc functions
/////////////////

util.extend( elesfn, {
  components: function(){
    var self = this;
    var cy = self.cy();
    var visited = self.spawn();
    var unvisited = self.nodes().spawnSelf();
    var components = [];

    var visitInComponent = function( node, component ){
      visited.merge( node );
      unvisited.unmerge( node );
      component.merge( node );
    };

    if( unvisited.empty() ){ return self.spawn(); }

    do {
      var component = cy.collection();
      components.push( component );

      var root = unvisited[0];
      visitInComponent( root, component );

      self.bfs({
        directed: false,
        roots: root,
        visit: function( i, depth, v, e, u ){
          visitInComponent( v, component );
        }
      } );

    } while( unvisited.length > 0 );

    return components.map(function( component ){
      var connectedEdges = component.connectedEdges().stdFilter(function( edge ){
        return component.anySame( edge.source() ) && component.anySame( edge.target() );
      });

      return component.union( connectedEdges );
    });
  }
} );

module.exports = elesfn;
