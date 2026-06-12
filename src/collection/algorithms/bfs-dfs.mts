import * as is from '../../is.mjs';
import type { Collection, Element } from '../eles-types.mjs';

/** Callback invoked for each visited node during a search. Return `true` to
 * stop and record the node as `found`; return `false` to stop without. */
export type SearchVisitFn = (
  v: Element,
  e: Element | undefined,
  u: Element | undefined,
  i: number,
  depth: number
) => boolean | void;

/** Options object accepted by breadthFirstSearch / depthFirstSearch. */
export interface SearchOptions {
  roots?: Collection | Element | string;
  root?: Collection | Element | string;
  visit?: SearchVisitFn;
  directed?: boolean;
}

/** Result of a breadth/depth-first search. */
export interface SearchResult {
  path: Collection;
  found: Collection;
}

/** A configured search method (bfs or dfs). */
export type SearchFn = (
  this: Collection,
  roots?: SearchOptions | Collection | Element | string,
  fn?: SearchVisitFn | boolean,
  directed?: boolean
) => SearchResult;

export interface AlgorithmsBfsDfs {
  breadthFirstSearch: SearchFn;
  depthFirstSearch: SearchFn;
  bfs: SearchFn;
  dfs: SearchFn;
}

let defineSearch = function( params: { bfs?: boolean; dfs?: boolean } ): SearchFn {
  params = {
    bfs: params.bfs || !params.dfs,
    dfs: params.dfs || !params.bfs
  };

  // from pseudocode on wikipedia
  return function searchFn(
    this: Collection,
    roots?: SearchOptions | Collection | Element | string,
    fn?: SearchVisitFn | boolean,
    directed?: boolean
  ): SearchResult {
    let options;
    if( is.plainObject( roots ) && !is.elementOrCollection( roots ) ){
      options = roots as SearchOptions;
      roots = options.roots || options.root;
      fn = options.visit;
      directed = options.directed;
    }

    directed = arguments.length === 2 && !is.fn( fn ) ? ( fn as unknown as boolean ) : directed;
    let visitFn: SearchVisitFn = is.fn( fn ) ? ( fn as SearchVisitFn ) : function(){};

    let cy = this._private.cy;
    let v: Collection = roots = ( is.string( roots ) ? this.filter( roots ) : roots ) as Collection;
    let Q: Element[] = [];
    let connectedNodes: Element[] = [];
    let connectedBy: Record<string, Element> = {};
    let id2depth: Record<string, number> = {};
    let V: Record<string, boolean> = {};
    let j = 0;
    let found: Element | undefined;
    let { nodes, edges } = this.byGroup();

    // enqueue v
    for( let i = 0; i < v.length; i++ ){
      let vi = v[i];
      let viId = vi.id()!;

      if( vi.isNode() ){
        Q.unshift( vi );

        if( params.bfs ){
          V[ viId ] = true;

          connectedNodes.push( vi );
        }

        id2depth[ viId ] = 0;
      }
    }

    while( Q.length !== 0 ){
      let v = ( params.bfs ? Q.shift() : Q.pop() ) as Element;
      let vId = v.id()!;

      if( params.dfs ){
        if( V[ vId ] ){ continue; }

        V[ vId ] = true;

        connectedNodes.push( v );
      }

      let depth = id2depth[ vId ];
      let prevEdge = connectedBy[ vId ];
      let src = prevEdge != null ? prevEdge.source() : null;
      let tgt = prevEdge != null ? prevEdge.target() : null;
      let prevNode = prevEdge == null ? undefined : ( v.same(src as Collection) ? ( tgt as Collection )[0] : ( src as Collection )[0] );
      let ret;

      ret = visitFn( v, prevEdge, prevNode, j++, depth );

      if( ret === true ){
        found = v;
        break;
      }

      if( ret === false ){
        break;
      }

      let vwEdges = v.connectedEdges().filter(( e: Element ) => (!directed || e.source().same(v)) && edges.has(e));
      for( let i = 0; i < vwEdges.length; i++ ){
        let e = vwEdges[ i ];
        let w: Collection = e.connectedNodes().filter(( n: Element ) => !n.same(v) && nodes.has(n));
        let wId = w.id()!;

        if( w.length !== 0 && !V[ wId ] ){
          let w0 = w[0];

          Q.push( w0 );

          if( params.bfs ){
            V[ wId ] = true;

            connectedNodes.push( w0 );
          }

          connectedBy[ wId ] = e;

          id2depth[ wId ] = id2depth[ vId ] + 1;
        }
      }

    }

    // collections have an internal `push` method not exposed on the public type
    let connectedEles = cy.collection() as unknown as Collection & { push( ele: Element ): void };

    for( let i = 0; i < connectedNodes.length; i++ ){
      let node = connectedNodes[ i ];
      let edge = connectedBy[ node.id()! ];

      if( edge != null ){
        connectedEles.push( edge );
      }

      connectedEles.push( node );
    }

    return {
      path: cy.collection( connectedEles ),
      found: cy.collection( found )
    };
  };
};

// search, spanning trees, etc
let elesfn = ({
  breadthFirstSearch: defineSearch( { bfs: true } ),
  depthFirstSearch: defineSearch( { dfs: true } )
}) as AlgorithmsBfsDfs;

// nice, short mathematical alias
elesfn.bfs = elesfn.breadthFirstSearch;
elesfn.dfs = elesfn.depthFirstSearch;

export default elesfn;
