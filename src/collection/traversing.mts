import * as util from '../util/index.mjs';
import * as is from '../is.mjs';
import cache from './cache-traversal-call.mjs';
import type { Collection, Element, SharedCollection, ElementPrivate, CoreAccess, NodeCollection, NodeSingular, EdgeCollection } from './eles-types.mjs';

/** Selector/filter argument accepted by traversal methods. */
type SelectorArg = string | ( ( ele: Element, i: number, eles: Collection ) => boolean | unknown ) | SharedCollection | undefined | null;

let elesfn: Record<string, unknown> = {};

// DAG functions
////////////////

interface DagExtremityParams {
  noIncomingEdges?: boolean;
  noOutgoingEdges?: boolean;
}

let defineDagExtremity = function( params: DagExtremityParams ){
  return function dagExtremityImpl( this: Collection, selector?: SelectorArg ): Collection {
    let eles = this; // eslint-disable-line @typescript-eslint/no-this-alias
    let ret: Element[] = [];

    for( let i = 0; i < eles.length; i++ ){
      let ele = eles[ i ];
      if( !ele.isNode() ){
        continue;
      }

      let disqualified = false;
      let edges = ele.connectedEdges();

      for( let j = 0; j < edges.length; j++ ){
        let edge = edges[j];
        let src = edge.source();
        let tgt = edge.target();

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

    return this.spawn( ret, true ).filter( selector );
  };
};

interface DagOneHopParams {
  outgoing?: boolean;
  incoming?: boolean;
}

let defineDagOneHop = function( params: DagOneHopParams ){
  return function( this: Collection, selector?: SelectorArg ): Collection {
    let eles = this; // eslint-disable-line @typescript-eslint/no-this-alias
    let oEles: SharedCollection[] = [];

    for( let i = 0; i < eles.length; i++ ){
      let ele = eles[ i ];

      if( !ele.isNode() ){ continue; }

      let edges = ele.connectedEdges();
      for( let j = 0; j < edges.length; j++ ){
        let edge = edges[ j ];
        let src = edge.source();
        let tgt = edge.target();

        if( params.outgoing && src === ele ){
          oEles.push( edge );
          oEles.push( tgt );
        } else if( params.incoming && tgt === ele ){
          oEles.push( edge );
          oEles.push( src );
        }
      }
    }

    return this.spawn( oEles, true ).filter( selector );
  };
};

let defineDagAllHops = function( params: DagOneHopParams ){
  return function( this: Collection, selector?: SelectorArg ): Collection {
    let eles: Collection = this; // eslint-disable-line @typescript-eslint/no-this-alias
    let sEles: Element[] = [];
    let sElesIds: Record<string, boolean> = {};

    for( ;; ){
      let next = params.outgoing ? eles.outgoers() : eles.incomers();

      if( next.length === 0 ){ break; } // done if none left

      let newNext = false;
      for( let i = 0; i < next.length; i++ ){
        let n = next[ i ];
        let nid = n.id() as string;

        if( !sElesIds[ nid ] ){
          sElesIds[ nid ] = true;
          sEles.push( n );
          newNext = true;
        }
      }

      if( !newNext ){ break; } // done if touched all outgoers already

      eles = next;
    }

    return this.spawn( sEles, true ).filter( selector );
  };
};

elesfn.clearTraversalCache = function( this: Collection ){
  for( let i = 0; i < this.length; i++ ){
    ( this[i]._private as ElementPrivate ).traversalCache = null as unknown as ElementPrivate['traversalCache'];
  }
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
  neighborhood: cache(function( this: Collection, selector?: SelectorArg ): Collection {
    let elements: Element[] = [];
    let nodes = this.nodes();

    for( let i = 0; i < nodes.length; i++ ){ // for all nodes
      let node = nodes[ i ];
      let connectedEdges = node.connectedEdges();

      // for each connected edge, add the edge and the other node
      for( let j = 0; j < connectedEdges.length; j++ ){
        let edge = connectedEdges[ j ];
        let src = edge.source();
        let tgt = edge.target();
        let otherNode = node === src ? tgt : src;

        // need check in case of loop
        if( otherNode.length > 0 ){
          elements.push( otherNode[0] ); // add node 1 hop away
        }

        // add connected edge
        elements.push( edge[0] );
      }

    }

    return ( this.spawn( elements, true ) ).filter( selector );
  }, 'neighborhood'),

  closedNeighborhood: function( this: Collection, selector?: SelectorArg ): Collection {
    return this.neighborhood().add( this ).filter( selector );
  },

  openNeighborhood: function( this: Collection, selector?: SelectorArg ): Collection {
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
  source: cache(function sourceImpl( this: Collection, selector?: SelectorArg ): Collection {
    let ele = this[0];
    let src: Collection | undefined;

    if( ele ){
      src = ( ele._private as ElementPrivate ).source || ele.cy().collection();
    }

    return ( src && selector ? src.filter( selector ) : src ) as Collection;
  }, 'source'),

  target: cache(function targetImpl( this: Collection, selector?: SelectorArg ): Collection {
    let ele = this[0];
    let tgt: Collection | undefined;

    if( ele ){
      tgt = ( ele._private as ElementPrivate ).target || ele.cy().collection();
    }

    return ( tgt && selector ? tgt.filter( selector ) : tgt ) as Collection;
  }, 'target'),

  sources: defineSourceFunction( {
    attr: 'source'
  } ),

  targets: defineSourceFunction( {
    attr: 'target'
  } )
} );

interface SourceFunctionParams {
  attr: 'source' | 'target';
}

function defineSourceFunction( params: SourceFunctionParams ){
  return function sourceImpl( this: Collection, selector?: SelectorArg ): Collection {
    let sources: Element[] = [];

    for( let i = 0; i < this.length; i++ ){
      let ele = this[ i ];
      let src = ( ele._private as ElementPrivate )[ params.attr ] as Element | undefined;

      if( src ){
        sources.push( src );
      }
    }

    return this.spawn( sources, true ).filter( selector );
  };
}

util.extend( elesfn, {
  edgesWith: cache( defineEdgesWithFunction(), 'edgesWith' ),

  edgesTo: cache( defineEdgesWithFunction( {
    thisIsSrc: true
  } ), 'edgesTo' )
} );

interface EdgesWithParams {
  thisIsSrc?: boolean;
  thisIsTgt?: boolean;
}

function defineEdgesWithFunction( params?: EdgesWithParams ){

  return function edgesWithImpl( this: Collection, otherNodes: string | Collection ): Collection {
    let elements: Element[] = [];
    let cy = this._private.cy;
    let p = params || {};
    let others: Collection;

    // get elements if a selector is specified
    if( is.string( otherNodes ) ){
      others = cy.$( otherNodes );
    } else {
      others = otherNodes;
    }

    for( let h = 0; h < others.length; h++ ){
      let edges = ( others[ h ]._private as ElementPrivate ).edges;

      for( let i = 0; i < edges.length; i++ ){
        let edge = edges[ i ];
        let edgeData = edge._private.data;
        let thisToOther = this.hasElementWithId( edgeData.source as string ) && others.hasElementWithId( edgeData.target as string );
        let otherToThis = others.hasElementWithId( edgeData.source as string ) && this.hasElementWithId( edgeData.target as string );
        let edgeConnectsThisAndOther = thisToOther || otherToThis;

        if( !edgeConnectsThisAndOther ){ continue; }

        if( p.thisIsSrc || p.thisIsTgt ){
          if( p.thisIsSrc && !thisToOther ){ continue; }

          if( p.thisIsTgt && !otherToThis ){ continue; }
        }

        elements.push( edge );
      }
    }

    return this.spawn( elements, true );
  };
}

util.extend( elesfn, {
  connectedEdges: cache(function( this: Collection, selector?: SelectorArg ): Collection {
    let retEles: Element[] = [];

    let eles = this; // eslint-disable-line @typescript-eslint/no-this-alias
    for( let i = 0; i < eles.length; i++ ){
      let node = eles[ i ];
      if( !node.isNode() ){ continue; }

      let edges = ( node._private as ElementPrivate ).edges;

      for( let j = 0; j < edges.length; j++ ){
        let edge = edges[ j ];
        retEles.push( edge );
      }
    }

    return this.spawn( retEles, true ).filter( selector );
  }, 'connectedEdges'),

  connectedNodes: cache(function( this: Collection, selector?: SelectorArg ): Collection {
    let retEles: Element[] = [];

    let eles = this; // eslint-disable-line @typescript-eslint/no-this-alias
    for( let i = 0; i < eles.length; i++ ){
      let edge = eles[ i ];
      if( !edge.isEdge() ){ continue; }

      retEles.push( edge.source()[0] );
      retEles.push( edge.target()[0] );
    }

    return this.spawn( retEles, true ).filter( selector );
  }, 'connectedNodes'),

  parallelEdges: cache( defineParallelEdgesFunction(), 'parallelEdges' ),

  codirectedEdges: cache( defineParallelEdgesFunction( {
    codirected: true
  } ), 'codirectedEdges' )
} );

interface ParallelEdgesParams {
  codirected?: boolean;
}

function defineParallelEdgesFunction( params?: ParallelEdgesParams ){
  let defaults = {
    codirected: false
  };
  let p = util.extend( {}, defaults, params ) as Required<ParallelEdgesParams>;

  return function parallelEdgesImpl( this: Collection, selector?: SelectorArg ): Collection { // micro-optimised for renderer
    let elements: Element[] = [];
    let edges = this.edges();

    // look at all the edges in the collection
    for( let i = 0; i < edges.length; i++ ){
      let edge1 = edges[ i ];
      let edge1_p = edge1._private as ElementPrivate;
      let src1 = edge1_p.source as Element;
      let srcid1 = src1._private.data.id;
      let tgtid1 = edge1_p.data.target;
      let srcEdges1 = src1._private.edges;

      // look at edges connected to the src node of this edge
      for( let j = 0; j < srcEdges1.length; j++ ){
        let edge2 = srcEdges1[ j ];
        let edge2data = edge2._private.data;
        let tgtid2 = edge2data.target;
        let srcid2 = edge2data.source;

        let codirected = tgtid2 === tgtid1 && srcid2 === srcid1;
        let oppdirected = srcid1 === tgtid2 && tgtid1 === srcid2;

        if( (p.codirected && codirected) || (!p.codirected && (codirected || oppdirected)) ){
          elements.push( edge2 );
        }
      }
    }

    return this.spawn( elements, true ).filter( selector );
  };

}

// Misc functions
/////////////////

util.extend( elesfn, {
  components: function( this: Collection, root?: Collection | Element | null ): Collection[] {
    let self = this; // eslint-disable-line @typescript-eslint/no-this-alias
    let cy = self.cy();
    let visited = cy.collection();
    let unvisited = root == null ? self.nodes() : root.nodes();
    let components: Collection[] = [];

    if( root != null && unvisited.empty() ){ // root may contain only edges
      unvisited = root.sources(); // doesn't matter which node to use (undirected), so just use the source sides
    }

    let visitInComponent = ( node: Element | Collection, component: Collection ) => {
      visited.merge( node as Collection );
      unvisited.unmerge( node as Collection );
      component.merge( node as Collection );
    };

    if( unvisited.empty() ){ return self.spawn() as unknown as Collection[]; }

    do { // each iteration yields a component
      let cmpt = cy.collection();
      components.push( cmpt );

      let root = unvisited[0];
      visitInComponent( root, cmpt );

      self.bfs({
        directed: false,
        roots: root,
        visit: v => visitInComponent( v, cmpt )
      } );

      cmpt.forEach(node => {
        node.connectedEdges().forEach(e => { // connectedEdges() usually cached
          if( self.has(e) && cmpt.has(e.source()) && cmpt.has(e.target()) ){ // has() is cheap
            cmpt.merge(e); // forEach() only considers nodes -- sets N at call time
          }
        });
      });

    } while( unvisited.length > 0 );

    return components;
  },

  component: function( this: Collection ): Collection {
    let ele = this[0];

    return ( ele.cy() ).mutableElements().components( ele )[0];
  }
} );

elesfn.componentsOf = elesfn.components;

export interface CollectionTraversing {
  /** @internal */
  clearTraversalCache(): void;
  roots( selector?: SelectorArg ): NodeCollection;
  leaves( selector?: SelectorArg ): NodeCollection;
  outgoers( selector?: SelectorArg ): Collection;
  successors( selector?: SelectorArg ): Collection;
  incomers( selector?: SelectorArg ): Collection;
  predecessors( selector?: SelectorArg ): Collection;
  neighborhood( selector?: SelectorArg ): Collection;
  neighbourhood( selector?: SelectorArg ): Collection;
  closedNeighborhood( selector?: SelectorArg ): Collection;
  closedNeighbourhood( selector?: SelectorArg ): Collection;
  openNeighborhood( selector?: SelectorArg ): Collection;
  openNeighbourhood( selector?: SelectorArg ): Collection;
  source( selector?: SelectorArg ): NodeSingular;
  target( selector?: SelectorArg ): NodeSingular;
  sources( selector?: SelectorArg ): NodeCollection;
  targets( selector?: SelectorArg ): NodeCollection;
  edgesWith( otherNodes: string | Collection ): EdgeCollection;
  edgesTo( otherNodes: string | Collection ): EdgeCollection;
  connectedEdges( selector?: SelectorArg ): EdgeCollection;
  connectedNodes( selector?: SelectorArg ): NodeCollection;
  parallelEdges( selector?: SelectorArg ): EdgeCollection;
  codirectedEdges( selector?: SelectorArg ): EdgeCollection;
  components( root?: Collection | Element | null ): Collection[];
  componentsOf( root?: Collection | Element | null ): Collection[];
  component(): Collection;
}

export default elesfn as unknown as CollectionTraversing;
