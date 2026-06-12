import * as util from '../../util/index.mjs';
import * as math from '../../math.mjs';
import type { LayoutBase, LayoutOptionsBase, Collection } from './layout-base.mjs';
import type { LayoutLike, LayoutOptions, LayoutPositionFn } from '../../collection/layout.mjs';
import type { ElementPrivate } from '../../collection/eles-types.mjs';
import type { BoundingBox, Position } from '../../types.mjs';

/** A row/col position, as returned by the `position` option. */
interface RowCol {
  row?: number;
  col?: number;
}

/** Options accepted by the grid layout. */
export interface GridLayoutOptions extends LayoutOptionsBase {
  fit?: boolean;
  padding?: number;
  avoidOverlap?: boolean;
  avoidOverlapPadding?: number;
  nodeDimensionsIncludeLabels?: boolean;
  spacingFactor?: number;
  condense?: boolean;
  rows?: number;
  cols?: number;
  columns?: number;
  position?: ( node: Collection ) => RowCol | undefined;
  sort?: ( a: Collection, b: Collection ) => number;
}

/** The grid layout instance (`this`). */
export interface GridLayout extends LayoutBase {
  options: GridLayoutOptions;
}

/* eslint-disable @typescript-eslint/no-unused-vars */
let defaults = {
  fit: true, // whether to fit the viewport to the graph
  padding: 30, // padding used on fit
  boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
  avoidOverlap: true, // prevents node overlap, may overflow boundingBox if not enough space
  avoidOverlapPadding: 10, // extra spacing around nodes when avoidOverlap: true
  nodeDimensionsIncludeLabels: false, // Excludes the label when calculating node bounding boxes for the layout algorithm
  spacingFactor: undefined, // Applies a multiplicative factor (>0) to expand or compress the overall area that the nodes take up
  condense: false, // uses all available space on false, uses minimal space on true
  rows: undefined, // force num of rows in the grid
  cols: undefined, // force num of columns in the grid
  position: function( node: Collection ){}, // returns { row, col } for element
  sort: undefined, // a sorting function to order the nodes; e.g. function(a, b){ return a.data('weight') - b.data('weight') }
  animate: false, // whether to transition the node positions
  animationDuration: 500, // duration of animation in ms if enabled
  animationEasing: undefined, // easing of animation if enabled
  animateFilter: function ( node: Collection, i: number ){ return true; }, // a function that determines whether the node should be animated.  All nodes animated by default on animate enabled.  Non-animated nodes are positioned immediately when the layout starts
  ready: undefined, // callback on layoutready
  stop: undefined, // callback on layoutstop
  transform: function (node: Collection, position: Position ){ return position; } // transform a given node position. Useful for changing flow direction in discrete layouts
};
/* eslint-enable @typescript-eslint/no-unused-vars */

// eslint-disable-next-line @typescript-eslint/no-redeclare -- intentional declaration merging with the interface above
function GridLayout( this: GridLayout, options: GridLayoutOptions ){
  this.options = util.extend( {}, defaults, options ) as GridLayoutOptions;
}

GridLayout.prototype.run = function( this: GridLayout ){
  let params = this.options;
  let options = params;

  let cy = params.cy;
  let eles = options.eles;
  let nodes = eles.nodes().not( ':parent' );

  if( options.sort ){
    nodes = nodes.sort( options.sort );
  }

  let bb = math.makeBoundingBox( options.boundingBox ? options.boundingBox : {
    x1: 0, y1: 0, w: cy.width(), h: cy.height()
  } ) as BoundingBox; // input always yields a valid bounding box

  if( bb.h === 0 || bb.w === 0 ){
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    eles.nodes().layoutPositions( this as unknown as LayoutLike, options as unknown as LayoutOptions, function( ele ){
      return { x: bb.x1, y: bb.y1 };
    } );

  } else {

    // width/height * splits^2 = cells where splits is number of times to split width
    let cells = nodes.size();
    let splits = Math.sqrt( cells * bb.h / bb.w );
    let rows = Math.round( splits );
    let cols = Math.round( bb.w / bb.h * splits );

    let small = function( val?: number ): number | undefined {
      if( val == null ){
        return Math.min( rows, cols );
      } else {
        let min = Math.min( rows, cols );
        if( min == rows ){
          rows = val;
        } else {
          cols = val;
        }
      }
    };

    let large = function( val?: number ): number | undefined {
      if( val == null ){
        return Math.max( rows, cols );
      } else {
        let max = Math.max( rows, cols );
        if( max == rows ){
          rows = val;
        } else {
          cols = val;
        }
      }
    };

    let oRows = options.rows;
    let oCols = options.cols != null ? options.cols : options.columns;

    // if rows or columns were set in options, use those values
    if( oRows != null && oCols != null ){
      rows = oRows;
      cols = oCols;
    } else if( oRows != null && oCols == null ){
      rows = oRows;
      cols = Math.ceil( cells / rows );
    } else if( oRows == null && oCols != null ){
      cols = oCols;
      rows = Math.ceil( cells / cols );
    }

    // otherwise use the automatic values and adjust accordingly

    // if rounding was up, see if we can reduce rows or columns
    else if( cols * rows > cells ){
      let sm = small()!;
      let lg = large()!;

      // reducing the small side takes away the most cells, so try it first
      if( (sm - 1) * lg >= cells ){
        small( sm - 1 );
      } else if( (lg - 1) * sm >= cells ){
        large( lg - 1 );
      }
    } else {

      // if rounding was too low, add rows or columns
      while( cols * rows < cells ){
        let sm = small()!;
        let lg = large()!;

        // try to add to larger side first (adds less in multiplication)
        if( (lg + 1) * sm >= cells ){
          large( lg + 1 );
        } else {
          small( sm + 1 );
        }
      }
    }

    let cellWidth = bb.w / cols;
    let cellHeight = bb.h / rows;

    if( options.condense ){
      cellWidth = 0;
      cellHeight = 0;
    }

    if( options.avoidOverlap ){
      for( let i = 0; i < nodes.length; i++ ){
        let node = nodes[ i ];
        let pos = ( node._private as ElementPrivate ).position;

        if( pos.x == null || pos.y == null ){ // for bb
          pos.x = 0;
          pos.y = 0;
        }

        let nbb = node.layoutDimensions( options );
        let p = options.avoidOverlapPadding!;

        let w = nbb.w + p;
        let h = nbb.h + p;

        cellWidth = Math.max( cellWidth, w );
        cellHeight = Math.max( cellHeight, h );
      }
    }

    let cellUsed: Record<string, boolean> = {}; // e.g. 'c-0-2' => true

    let used = function( row: number, col: number ){
      return cellUsed[ 'c-' + row + '-' + col ] ? true : false;
    };

    let use = function( row: number, col: number ){
      cellUsed[ 'c-' + row + '-' + col ] = true;
    };

    // to keep track of current cell position
    let row = 0;
    let col = 0;
    let moveToNextCell = function(){
      col++;
      if( col >= cols ){
        col = 0;
        row++;
      }
    };

    // get a cache of all the manual positions
    let id2manPos: Record<string, { row: number; col: number }> = {};
    for( let i = 0; i < nodes.length; i++ ){
      let node = nodes[ i ];
      let rcPos = options.position!( node );

      if( rcPos && (rcPos.row !== undefined || rcPos.col !== undefined) ){ // must have at least row or col def'd
        let pos = {
          row: rcPos.row,
          col: rcPos.col
        } as { row: number; col: number };

        if( pos.col === undefined ){ // find unused col
          pos.col = 0;

          while( used( pos.row, pos.col ) ){
            pos.col++;
          }
        } else if( pos.row === undefined ){ // find unused row
          pos.row = 0;

          while( used( pos.row, pos.col ) ){
            pos.row++;
          }
        }

        id2manPos[ node.id()! ] = pos;
        use( pos.row, pos.col );
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let getPos = function( element: Collection, i: number ): Position | false {
      let x, y;

      if( element.locked() || element.isParent() ){
        return false;
      }

      // see if we have a manual position set
      let rcPos = id2manPos[ element.id()! ];
      if( rcPos ){
        x = rcPos.col * cellWidth + cellWidth / 2 + bb.x1;
        y = rcPos.row * cellHeight + cellHeight / 2 + bb.y1;

      } else { // otherwise set automatically

        while( used( row, col ) ){
          moveToNextCell();
        }

        x = col * cellWidth + cellWidth / 2 + bb.x1;
        y = row * cellHeight + cellHeight / 2 + bb.y1;
        use( row, col );

        moveToNextCell();
      }

      return { x: x, y: y };

    };

    nodes.layoutPositions( this as unknown as LayoutLike, options as unknown as LayoutOptions, getPos as unknown as LayoutPositionFn ); // getPos may return false to skip a node
  }

  return this; // chaining

};

export default GridLayout;
