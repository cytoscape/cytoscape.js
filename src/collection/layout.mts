import * as util from '../util/index.mjs';
import Promise from '../promise.mjs';
import * as math from '../math.mjs';
import type { Position, BoundingBox } from '../types.mjs';
import type Animation from '../animation.mjs';
import type { LayoutInstance } from '../core/core-types.mjs';
import type { Collection, SharedCollection, Element } from './eles-types.mjs';

/**
 * A layout instance as driven by the collection layout code: the public
 * `LayoutInstance` (run/stop/emit/on/… — see core-types) plus the internal
 * `animations` array that `layoutPositions` populates. The built-in layout
 * extensions pass themselves here.
 */
export interface LayoutLike extends LayoutInstance {
  /** @internal */
  animations: Animation[];
}

/** A node-positioning function used by `layoutPositions`. */
export type LayoutPositionFn = ( node: Element, i: number ) => Position;

/** Options read by `layoutPositions` / `layout` / `makeLayout`. */
export interface LayoutOptions {
  eles: Collection;
  spacingFactor?: number;
  transform?: ( node: Element, pos: Position ) => Position;
  animate?: boolean;
  animateFilter?: ( node: Element, i: number ) => boolean;
  animationDuration?: number;
  animationEasing?: string;
  fit?: boolean;
  padding?: number;
  zoom?: number;
  pan?: Position;
  ready?: () => void;
  stop?: () => void;
  [key: string]: unknown;
}

/** Options read by `layoutDimensions`. */
export interface LayoutDimensionsOptions {
  nodeDimensionsIncludeLabels?: boolean;
}

/** Node dimensions returned by `layoutDimensions`. */
export interface LayoutDimensions {
  w: number;
  h: number;
}

const getLayoutDimensionOptions = util.defaults({
  nodeDimensionsIncludeLabels: false
});

let elesfn = ({
  // Calculates and returns node dimensions { x, y } based on options given
  layoutDimensions: function( this: Collection, options: LayoutDimensionsOptions ): LayoutDimensions {
    options = getLayoutDimensionOptions( options ) as LayoutDimensionsOptions;

    let dims: LayoutDimensions;

    if( !this.takesUpSpace() ){
      dims = { w: 0, h: 0 };
    } else if( options.nodeDimensionsIncludeLabels ){
      let bbDim = this.boundingBox();

      dims = {
        w: bbDim.w,
        h: bbDim.h
      };
    } else {
      dims = {
        w: this.outerWidth() as number,
        h: this.outerHeight() as number
      };
    }

    // sanitise the dimensions for external layouts (avoid division by zero)
    if( dims.w === 0 || dims.h === 0 ){
      dims.w = dims.h = 1;
    }

    return dims;
  },

  // using standard layout options, apply position function (w/ or w/o animation)
  layoutPositions: function( this: Collection, layout: LayoutLike, options: LayoutOptions, fn: LayoutPositionFn ): Collection {
    let nodes = this.nodes().filter(( n: Element ) => !n.isParent());
    let cy = this.cy();
    let layoutEles = options.eles; // nodes & edges
    let getMemoizeKey = ( node: Element ): string => node.id() as string;
    let fnMem = util.memoize( fn, getMemoizeKey ); // memoized version of position function

    layout.emit( { type: 'layoutstart', layout: layout } );

    layout.animations = [];

    let calculateSpacing = function( spacing: number, nodesBb: BoundingBox, pos: Position ): Position {
      let center = {
        x: nodesBb.x1 + nodesBb.w / 2,
        y: nodesBb.y1 + nodesBb.h / 2
      };

      let spacingVector = { // scale from center of bounding box (not necessarily 0,0)
        x: (pos.x - center.x) * spacing,
        y: (pos.y - center.y) * spacing
      };

      return {
        x: center.x + spacingVector.x,
        y: center.y + spacingVector.y
      };
    };

    let useSpacingFactor = options.spacingFactor && options.spacingFactor !== 1;

    let spacingBb = function(): BoundingBox | null {
      if( !useSpacingFactor ){ return null; }

      let bb = math.makeBoundingBox() as BoundingBox;

      for( let i = 0; i < nodes.length; i++ ){
        let node = nodes[i];
        let pos = fnMem( node, i );

        math.expandBoundingBoxByPoint( bb, pos.x, pos.y );
      }

      return bb;
    };

    let bb = spacingBb();

    let getFinalPos = util.memoize( function( node: Element, i: number ): Position {
      let newPos = fnMem( node, i );

      if( useSpacingFactor ){
        let spacing = Math.abs( options.spacingFactor as number );

        newPos = calculateSpacing( spacing, bb as BoundingBox, newPos );
      }

      if( options.transform != null ){
        newPos = options.transform( node, newPos );
      }

      return newPos;
    }, getMemoizeKey );

    if( options.animate ){
      for( let i = 0; i < nodes.length; i++ ){
        let node = nodes[ i ];
        let newPos = getFinalPos( node, i );
        let animateNode = options.animateFilter == null || options.animateFilter( node, i );

        if( animateNode ){
          let ani = node.animation( {
            position: newPos,
            duration: options.animationDuration,
            easing: options.animationEasing
          } ) as Animation;

          layout.animations.push( ani );
        } else {
          node.position( newPos );
        }

      }

      if( options.fit ){
        let fitAni = cy.animation({
          fit: {
            boundingBox: layoutEles.boundingBoxAt( getFinalPos ),
            padding: options.padding
          },
          duration: options.animationDuration,
          easing: options.animationEasing
        });

        layout.animations.push( fitAni );
      } else if( options.zoom !== undefined && options.pan !== undefined ){
        let zoomPanAni = cy.animation({
          zoom: options.zoom,
          pan: options.pan,
          duration: options.animationDuration,
          easing: options.animationEasing
        });

        layout.animations.push( zoomPanAni );
      }

      layout.animations.forEach(ani => ani.play());

      layout.one( 'layoutready', options.ready );
      layout.emit( { type: 'layoutready', layout: layout } );

      Promise.all( layout.animations.map(function( ani ){
        return ani.promise();
      }) ).then(function(){
        layout.one( 'layoutstop', options.stop );
        layout.emit( { type: 'layoutstop', layout: layout } );
      });
    } else {

      nodes.positions( getFinalPos );

      if( options.fit ){
        cy.fit( options.eles, options.padding );
      }

      if( options.zoom != null ){
        cy.zoom( options.zoom );
      }

      if( options.pan ){
        cy.pan( options.pan );
      }

      layout.one( 'layoutready', options.ready );
      layout.emit( { type: 'layoutready', layout: layout } );

      layout.one( 'layoutstop', options.stop );
      layout.emit( { type: 'layoutstop', layout: layout } );
    }

    return this; // chaining
  },

  layout: function( this: Collection, options: Partial<LayoutOptions> ): LayoutLike {
    let cy = this.cy();

    return cy.makeLayout( util.extend( {}, options, {
      eles: this
    } ) as LayoutOptions );
  }

}) as Omit<CollectionLayout, 'createLayout' | 'makeLayout'> as CollectionLayout;

// aliases:
elesfn.createLayout = elesfn.makeLayout = elesfn.layout;

/** Layout methods contributed to the collection prototype. */
export interface CollectionLayout {
  layoutDimensions( this: SharedCollection, options: LayoutDimensionsOptions ): LayoutDimensions;
  layoutPositions( this: SharedCollection, layout: LayoutLike, options: LayoutOptions, fn: LayoutPositionFn ): Collection;
  layout( this: SharedCollection, options?: Partial<LayoutOptions> ): LayoutLike;
  createLayout( this: SharedCollection, options?: Partial<LayoutOptions> ): LayoutLike;
  makeLayout( this: SharedCollection, options?: Partial<LayoutOptions> ): LayoutLike;
}

export default elesfn as CollectionLayout;
