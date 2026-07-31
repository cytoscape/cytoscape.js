import * as math from '../../math.mjs';
import { rotatePosAndSkewByBox } from '../../util/position.mjs';
import { ascending } from '../../util/sort.mjs';
import type { BoundingBox, Position } from '../../types.mjs';
import type { GpuBreadthFirstLayoutOptions } from '../gpu-types.mjs';
import type { GpuCollection } from '../collection.mjs';
import type { GpuCore } from '../core.mjs';

/*
Breadthfirst (tree/hierarchy) layout: v3's pass over the collection scope,
using the round-10 slot-native bfs for the depth assignment.  No compounds
in v4, so every node is childless.  `roots` takes a collection or an array
of node ids (no selector strings).
*/

const defaults: Omit<GpuBreadthFirstLayoutOptions, 'name'> = {
  fit: true,
  directed: false,
  direction: 'downward',
  padding: 30,
  circle: false,
  grid: false,
  spacingFactor: 1.75,
  boundingBox: undefined,
  avoidOverlap: true,
  roots: undefined,
  depthSort: undefined,
  animate: false,
  animationDuration: 500,
  animationEasing: undefined,
  animateFilter: undefined,
  ready: undefined,
  stop: undefined,
  transform: undefined,
  maximal: false,
  acyclic: false
};

interface BfInfo {
  depth: number;
  index: number;
}

const getInfo = ( ele: GpuCollection ): BfInfo => ele.scratch( 'breadthfirst' ) as BfInfo;
const setInfo = ( ele: GpuCollection, obj: BfInfo ): void => { ele.scratch( 'breadthfirst', obj ); };

const rotateDegrees: Record<string, number> = {
  downward: 0,
  leftward: 90,
  upward: 180,
  rightward: -90
};

export class BreadthFirstLayout {
  options: GpuBreadthFirstLayoutOptions;

  private cy: GpuCore;

  constructor( cy: GpuCore, options: GpuBreadthFirstLayoutOptions ){
    this.cy = cy;
    this.options = { ...defaults, ...options };
  }

  run(): this {
    const cy = this.cy;
    const options = this.options;
    const eles = ( options.eles as GpuCollection | undefined ) ?? cy.elements();
    const nodes = eles.nodes().filter( ( n: GpuCollection ) => !n.isParent() );
    const directed = options.directed === true;
    const maximal = options.acyclic === true || options.maximal === true;

    if( rotateDegrees[ options.direction as string ] === undefined ){
      throw new Error( `Invalid direction '${ options.direction }' specified for breadthfirst layout.  ` +
        `Valid values are: ${ Object.keys( rotateDegrees ).join( ', ' ) }` );
    }

    const hasBoundingBox = options.boundingBox != null;
    const bb = math.makeBoundingBox( hasBoundingBox ? options.boundingBox : cy.extent() ) as BoundingBox;

    // resolve the roots: collection, id array, or derived
    let roots: GpuCollection;
    const optRoots = options.roots;

    if( typeof optRoots === 'string' ){
      throw new TypeError( '`roots` must be a collection or an array of node ids — v4 has no selector strings' );
    } else if( Array.isArray( optRoots ) ){
      roots = ( optRoots as string[] )
        .map( id => cy.$id( id ) )
        .reduce( ( acc, ele ) => acc.union( ele ), cy.collection() );
    } else if( optRoots != null ){
      roots = optRoots as GpuCollection;
    } else if( directed ){
      roots = nodes.roots();
    } else {
      const components = eles.components();

      roots = cy.collection();

      for( const comp of components ){
        const maxDegree = comp.maxDegree( false ) as number;
        const compRoots = comp.filter( ( ele: GpuCollection ) =>
          ele.isNode() && ele.degree( false ) === maxDegree );

        roots = roots.union( compRoots );
      }
    }

    const depths: ( GpuCollection | null )[][] = [];
    const foundByBfs = new Set<GpuCollection>();

    const addToDepth = ( ele: GpuCollection, d: number ): void => {
      if( depths[ d ] == null ){ depths[ d ] = []; }

      const i = depths[ d ].length;

      depths[ d ].push( ele );
      setInfo( ele, { index: i, depth: d } );
    };

    const changeDepth = ( ele: GpuCollection, newDepth: number ): void => {
      const { depth, index } = getInfo( ele );

      depths[ depth ][ index ] = null;
      addToDepth( ele, newDepth );
    };

    eles.bfs( {
      roots,
      directed,
      visit: ( node, _edge, _pNode, _i, depth ) => {
        addToDepth( node, depth );
        foundByBfs.add( node );
      }
    } );

    // nodes the bfs never reached
    const orphanNodes: GpuCollection[] = [];

    for( let i = 0; i < nodes.length; i++ ){
      if( !foundByBfs.has( nodes[ i ] ) ){ orphanNodes.push( nodes[ i ] ); }
    }

    const assignDepthsAt = ( i: number ): void => {
      const level = depths[ i ];

      for( let j = 0; j < level.length; j++ ){
        const ele = level[ j ];

        if( ele == null ){
          level.splice( j, 1 );
          j--;
          continue;
        }

        setInfo( ele, { depth: i, index: j } );
      }
    };

    // shift nodes down to their maximal depths (directed DAGs)
    if( directed && maximal ){
      const Q: GpuCollection[] = [];
      const shifted = new Map<GpuCollection, number>();

      const adjustMaximally = ( ele: GpuCollection ): boolean | null => {
        const eInfo = getInfo( ele );
        const incomers = ele.incomers().filter( ( el: GpuCollection ) => el.isNode() && eles.contains( el ) );
        let maxDepth = -1;

        for( let k = 0; k < incomers.length; k++ ){
          maxDepth = Math.max( maxDepth, getInfo( incomers[ k ] ).depth );
        }

        if( eInfo.depth <= maxDepth ){
          if( !options.acyclic && shifted.has( ele ) ){ return null; }

          const newDepth = maxDepth + 1;

          changeDepth( ele, newDepth );
          shifted.set( ele, newDepth );

          return true;
        }

        return false;
      };

      nodes.forEach( ( n: GpuCollection ) => { Q.push( n ); } );

      while( Q.length > 0 ){
        const ele = Q.shift() as GpuCollection;
        const didShift = adjustMaximally( ele );

        if( didShift ){
          ele.outgoers()
            .filter( ( el: GpuCollection ) => el.isNode() && eles.contains( el ) )
            .forEach( ( el: GpuCollection ) => { Q.push( el ); } );
        } else if( didShift === null ){
          console.warn( 'Detected double maximal shift for node `' + ele.id() +
            '`.  Bailing maximal adjustment due to cycle.  Use `options.maximal: true` only on DAGs.' );

          break;
        }
      }
    }

    // min distance between nodes
    let minDistance = 0;

    if( options.avoidOverlap ){
      for( let i = 0; i < nodes.length; i++ ){
        const nbb = nodes[ i ].layoutDimensions( options );

        minDistance = Math.max( minDistance, nbb.w, nbb.h );
      }
    }

    // weighted percent per node from connectivity to higher levels
    const cachedWeightedPercent = new Map<GpuCollection, number>();

    const getWeightedPercent = ( ele: GpuCollection ): number => {
      const cached = cachedWeightedPercent.get( ele );

      if( cached != null ){ return cached; }

      const eleDepth = getInfo( ele ).depth;
      const neighbors = ele.neighborhood();
      let percent = 0;
      let samples = 0;

      for( let i = 0; i < neighbors.length; i++ ){
        const neighbor = neighbors[ i ];

        if( neighbor.isEdge() || !nodes.contains( neighbor ) ){ continue; }

        const bf = getInfo( neighbor ) as BfInfo | undefined;

        if( bf == null || bf.index == null || bf.depth == null ){ continue; }

        if( bf.depth < eleDepth ){ // only influenced by levels above
          percent += bf.index / depths[ bf.depth ].length;
          samples++;
        }
      }

      samples = Math.max( 1, samples );
      percent = percent / samples;
      cachedWeightedPercent.set( ele, percent );

      return percent;
    };

    let sortFn = ( a: GpuCollection, b: GpuCollection ): number => {
      const diff = getWeightedPercent( a ) - getWeightedPercent( b );

      return diff === 0 ? ascending( a.id() as string, b.id() as string ) : diff;
    };

    if( options.depthSort !== undefined ){
      sortFn = options.depthSort as typeof sortFn;
    }

    let depthsLen = depths.length;

    for( let i = 0; i < depthsLen; i++ ){
      // compact the nulls left by maximal shifts before sorting (v3 passes
      // them into its comparator, which cannot handle them)
      depths[ i ] = depths[ i ].filter( ele => ele != null );
      ( depths[ i ] as GpuCollection[] ).sort( sortFn );
      assignDepthsAt( i );
    }

    // orphans get a new top-level depth
    if( orphanNodes.length > 0 ){
      depths.unshift( orphanNodes.slice() );
      depthsLen = depths.length;

      for( let i = 0; i < depthsLen; i++ ){ assignDepthsAt( i ); }
    }

    const center = {
      x: bb.x1 + bb.w / 2,
      y: bb.y1 + bb.h / 2
    };

    // average node size
    const aveNodeSize = { w: -1, h: -1 };

    for( let i = 0; i < nodes.length; i++ ){
      const box = nodes[ i ].boundingBox();

      aveNodeSize.w = aveNodeSize.w === -1 ? box.w : ( aveNodeSize.w + box.w ) / 2;
      aveNodeSize.h = aveNodeSize.h === -1 ? box.h : ( aveNodeSize.h + box.h ) / 2;
    }

    const padding = options.padding as number;
    const distanceY = Math.max(
      depthsLen === 1 ? 0 :
        hasBoundingBox ? ( bb.h - padding * 2 - aveNodeSize.h ) / ( depthsLen - 1 ) :
          ( bb.h - padding * 2 - aveNodeSize.h ) / ( depthsLen + 1 ),
      minDistance );

    const maxDepthSize = depths.reduce( ( max, level ) => Math.max( max, level.length ), 0 );

    const getPositionTopBottom = ( ele: GpuCollection ): Position => {
      const { depth, index } = getInfo( ele );

      if( options.circle ){
        let radiusStepSize = Math.min( bb.w / 2 / depthsLen, bb.h / 2 / depthsLen );

        radiusStepSize = Math.max( radiusStepSize, minDistance );

        let radius = radiusStepSize * depth + radiusStepSize -
          ( depthsLen > 0 && depths[ 0 ].length <= 3 ? radiusStepSize / 2 : 0 );
        const theta = 2 * Math.PI / depths[ depth ].length * index;

        if( depth === 0 && depths[ 0 ].length === 1 ){ radius = 1; }

        return {
          x: center.x + radius * Math.cos( theta ),
          y: center.y + radius * Math.sin( theta )
        };
      }

      const depthSize = depths[ depth ].length;
      const distanceX = Math.max(
        depthSize === 1 ? 0 :
          hasBoundingBox ? ( bb.w - padding * 2 - aveNodeSize.w ) / ( ( options.grid ? maxDepthSize : depthSize ) - 1 ) :
            ( bb.w - padding * 2 - aveNodeSize.w ) / ( ( options.grid ? maxDepthSize : depthSize ) + 1 ),
        minDistance );

      return {
        x: center.x + ( index + 1 - ( depthSize + 1 ) / 2 ) * distanceX,
        y: center.y + ( depth + 1 - ( depthsLen + 1 ) / 2 ) * distanceY
      };
    };

    const getPos = ( ele: GpuCollection ): Position =>
      rotatePosAndSkewByBox( getPositionTopBottom( ele ), bb, rotateDegrees[ options.direction as string ] );

    eles.nodes().layoutPositions( this, { ...options, eles }, getPos );

    return this;
  }
}
