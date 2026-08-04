import * as math from '../math.mjs';
import type { BoundingBox, Position } from '../types.mjs';
import type { ConcentricLayoutOptions } from '../public-types.mjs';
import type { Collection } from '../collection.mjs';
import type { Core } from '../core.mjs';

/*
Concentric layout: v3's level-binning and radius math verbatim over the
collection scope.  The concentric value is recorded in each node's scratch
(`concentric` key) as v3 does; v4 has no style functions, so there is no
updateStyle() pass.
*/

const defaults: Omit<ConcentricLayoutOptions, 'name'> = {
  fit: true,
  padding: 30,
  startAngle: 3 / 2 * Math.PI,
  sweep: undefined,
  clockwise: true,
  equidistant: false,
  minNodeSpacing: 10,
  boundingBox: undefined,
  avoidOverlap: true,
  height: undefined,
  width: undefined,
  spacingFactor: undefined,
  concentric: node => ( node as Collection ).degree() ?? 0,
  levelWidth: nodes => ( ( nodes as Collection ).maxDegree() ?? 0 ) / 4,
  animate: false,
  animationDuration: 500,
  animationEasing: undefined,
  animateFilter: undefined,
  ready: undefined,
  stop: undefined,
  transform: undefined
};

type Level = { value: number; node: Collection }[] & { dTheta?: number; r?: number };

/**
 * Place nodes on concentric rings, most important innermost.
 *
 * `concentric` scores each node (degree by default) and `levelWidth` decides how wide a score band a ring covers.
 */
export class ConcentricLayout {
  /** the resolved options this layout was created with */
  options: ConcentricLayoutOptions;

  private cy: Core;

  /**
   * Reached through `cy.layout( { name: 'concentric' } )` /
   * `eles.layout( … )` rather than constructed directly.
   *
   * @param cy — the core to lay out
   * @param options — this layout's options merged over its defaults,
   *   plus the shared plumbing (`fit`, `padding`, `spacingFactor`,
   *   `transform`, `animate`, the lifecycle callbacks)
   */
  constructor( cy: Core, options: ConcentricLayoutOptions ){
    this.cy = cy;
    this.options = { ...defaults, ...options };
  }

  /**
   * Run the layout: emits `layoutstart`, writes the positions, then
   * emits `layoutready`/`layoutstop`.  Under `animate: true` the nodes
   * tween to their targets and a `fit` animates the viewport to the box
   * at the *final* positions, concurrently.
   *
   * @returns this layout, for chaining
   */
  run(): this {
    const cy = this.cy;
    const options = this.options;
    const eles = ( options.eles as Collection | undefined ) ?? cy.elements();
    const clockwise = options.counterclockwise !== undefined ? !options.counterclockwise : options.clockwise;
    const nodes = eles.nodes().filter( ( n: Collection ) => !n.isParent() );

    const bb = math.makeBoundingBox( options.boundingBox ?? {
      x1: 0, y1: 0, w: cy.width(), h: cy.height()
    } ) as BoundingBox;

    const center = {
      x: bb.x1 + bb.w / 2,
      y: bb.y1 + bb.h / 2
    };

    const nodeValues: { value: number; node: Collection }[] = [];
    let maxNodeSize = 0;

    for( let i = 0; i < nodes.length; i++ ){
      const node = nodes[ i ];
      const value = ( options.concentric as ( node: Collection ) => number )( node );

      nodeValues.push( { value, node } );
      node.scratch( 'concentric', value );
    }

    for( let i = 0; i < nodes.length; i++ ){
      const nbb = nodes[ i ].layoutDimensions( options );

      maxNodeSize = Math.max( maxNodeSize, nbb.w, nbb.h );
    }

    // decreasing order
    nodeValues.sort( ( a, b ) => b.value - a.value );

    const levelWidth = ( options.levelWidth as ( nodes: Collection ) => number )( nodes );

    // bin the values into levels
    const levels: Level[] = [ [] ];
    let currentLevel: Level = levels[ 0 ];

    for( const val of nodeValues ){
      if( currentLevel.length > 0 ){
        const diff = Math.abs( currentLevel[ 0 ].value - val.value );

        if( diff >= levelWidth ){
          currentLevel = [];
          levels.push( currentLevel );
        }
      }

      currentLevel.push( val );
    }

    let minDist = maxNodeSize + ( options.minNodeSpacing as number );

    if( !options.avoidOverlap ){ // then strictly constrain to bb
      const firstLvlHasMulti = levels.length > 0 && levels[ 0 ].length > 1;
      const maxR = Math.min( bb.w, bb.h ) / 2 - minDist;
      const rStep = maxR / ( levels.length + ( firstLvlHasMulti as unknown as number ) ? 1 : 0 ); // preserve v3's coercion

      minDist = Math.min( minDist, rStep );
    }

    // find each level's metrics
    let r = 0;

    for( const level of levels ){
      const sweep = options.sweep === undefined
        ? 2 * Math.PI - 2 * Math.PI / level.length
        : options.sweep;

      level.dTheta = sweep / Math.max( 1, level.length - 1 );

      if( level.length > 1 && options.avoidOverlap ){
        const dcos = Math.cos( level.dTheta ) - Math.cos( 0 );
        const dsin = Math.sin( level.dTheta ) - Math.sin( 0 );
        const rMin = Math.sqrt( minDist * minDist / ( dcos * dcos + dsin * dsin ) );

        r = Math.max( rMin, r );
      }

      level.r = r;
      r += minDist;
    }

    if( options.equidistant ){
      let rDeltaMax = 0;
      let rr = 0;

      for( const level of levels ){
        rDeltaMax = Math.max( rDeltaMax, ( level.r as number ) - rr );
      }

      rr = 0;

      for( let i = 0; i < levels.length; i++ ){
        const level = levels[ i ];

        if( i === 0 ){ rr = level.r as number; }

        level.r = rr;
        rr += rDeltaMax;
      }
    }

    // positions per node handle
    const pos = new Map<Collection, Position>();

    for( const level of levels ){
      const dTheta = level.dTheta as number;
      const levelR = level.r as number;

      for( let j = 0; j < level.length; j++ ){
        const val = level[ j ];
        const theta = ( options.startAngle as number ) + ( clockwise ? 1 : -1 ) * dTheta * j;

        pos.set( val.node, {
          x: center.x + levelR * Math.cos( theta ),
          y: center.y + levelR * Math.sin( theta )
        } );
      }
    }

    nodes.layoutPositions( this, { ...options, eles }, ele => pos.get( ele ) as Position );

    return this;
  }
}
