import * as math from '../../math.mjs';
import type { BoundingBox, Position } from '../../types.mjs';
import type { GpuGridLayoutOptions } from '../gpu-types.mjs';
import type { GpuCollection } from '../collection.mjs';
import type { GpuCore } from '../core.mjs';

/*
Grid layout for the GPU prototype: the cell-packing math is ported verbatim
from src/extensions/layout/grid.mts (lines 76-277); the plumbing is replaced
with a bulk position write (one dirty span via eles.positions()) plus
layoutstart/layoutready/layoutstop events.  Animation, label-aware sizing
and compound handling are dropped.
*/

const defaults: Omit<GpuGridLayoutOptions, 'name'> = {
  fit: true, // whether to fit the viewport to the graph
  padding: 30, // padding used on fit
  boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
  avoidOverlap: true, // prevents node overlap, may overflow boundingBox if not enough space
  avoidOverlapPadding: 10, // extra spacing around nodes when avoidOverlap: true
  spacingFactor: undefined, // applies a multiplicative factor (>0) to expand or compress the overall area that the nodes take up
  condense: false, // uses all available space on false, uses minimal space on true
  rows: undefined, // force num of rows in the grid
  cols: undefined, // force num of columns in the grid
  position: undefined, // returns { row, col } for element
  sort: undefined // a sorting function to order the nodes
};

export class GridLayout {
  options: GpuGridLayoutOptions;

  private cy: GpuCore;

  constructor( cy: GpuCore, options: GpuGridLayoutOptions ){
    this.cy = cy;
    this.options = { ...defaults, ...options };
  }

  run(): this {
    const cy = this.cy;
    const options = this.options;

    let nodeList = cy.nodes().toArray();

    if( options.sort != null ){
      nodeList = nodeList.sort( options.sort as ( a: GpuCollection, b: GpuCollection ) => number );
    }

    cy.emit( { type: 'layoutstart', layout: this } );

    const bb = math.makeBoundingBox( options.boundingBox ?? {
      x1: 0, y1: 0, w: cy.width(), h: cy.height()
    } ) as BoundingBox;

    const positions = this.cellPositions( nodeList, bb );

    // bulk write: one coalesced dirty span; per-node position events only
    // fire when position listeners exist
    const indexOf = new Map<GpuCollection, number>( nodeList.map( ( node, i ) => [ node, i ] ) );

    cy.nodes().positions( ( ele: GpuCollection ) => {
      const index = indexOf.get( ele );

      return index == null ? false : positions[ index ];
    } );

    if( options.fit !== false ){
      cy.fit( undefined, options.padding ?? 30 );
    }

    cy.emit( { type: 'layoutready', layout: this } );
    cy.emit( { type: 'layoutstop', layout: this } );

    return this;
  }

  /** The ported v3 grid cell-packing math. */
  private cellPositions( nodes: GpuCollection[], bb: BoundingBox ): Position[] {
    const options = this.options;
    const cells = nodes.length;

    if( bb.h === 0 || bb.w === 0 || cells === 0 ){
      return nodes.map( () => ( { x: bb.x1, y: bb.y1 } ) );
    }

    // width/height * splits^2 = cells where splits is number of times to split width
    const splits = Math.sqrt( cells * bb.h / bb.w );
    let rows = Math.round( splits );
    let cols = Math.round( bb.w / bb.h * splits );

    const small = ( val?: number ): number | undefined => {
      if( val == null ){
        return Math.min( rows, cols );
      } else {
        const min = Math.min( rows, cols );

        if( min == rows ){
          rows = val;
        } else {
          cols = val;
        }
      }
    };

    const large = ( val?: number ): number | undefined => {
      if( val == null ){
        return Math.max( rows, cols );
      } else {
        const max = Math.max( rows, cols );

        if( max == rows ){
          rows = val;
        } else {
          cols = val;
        }
      }
    };

    const oRows = options.rows;
    const oCols = options.cols;

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
      const sm = small() as number;
      const lg = large() as number;

      // reducing the small side takes away the most cells, so try it first
      if( ( sm - 1 ) * lg >= cells ){
        small( sm - 1 );
      } else if( ( lg - 1 ) * sm >= cells ){
        large( lg - 1 );
      }
    } else {

      // if rounding was too low, add rows or columns
      while( cols * rows < cells ){
        const sm = small() as number;
        const lg = large() as number;

        // try to add to larger side first (adds less in multiplication)
        if( ( lg + 1 ) * sm >= cells ){
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

    if( options.avoidOverlap !== false ){
      for( const node of nodes ){
        const p = options.avoidOverlapPadding ?? 0;
        const w = ( node.outerWidth() ?? 0 ) + p;
        const h = ( node.outerHeight() ?? 0 ) + p;

        cellWidth = Math.max( cellWidth, w );
        cellHeight = Math.max( cellHeight, h );
      }
    }

    const cellUsed: Record<string, boolean> = {}; // e.g. 'c-0-2' => true

    const used = ( row: number, col: number ): boolean => {
      return cellUsed[ 'c-' + row + '-' + col ] ? true : false;
    };

    const use = ( row: number, col: number ): void => {
      cellUsed[ 'c-' + row + '-' + col ] = true;
    };

    // to keep track of current cell position
    let row = 0;
    let col = 0;
    const moveToNextCell = (): void => {
      col++;

      if( col >= cols ){
        col = 0;
        row++;
      }
    };

    // get a cache of all the manual positions
    const id2manPos: Record<string, { row: number; col: number }> = {};

    for( const node of nodes ){
      const rcPos = options.position?.( node );

      if( rcPos && ( rcPos.row !== undefined || rcPos.col !== undefined ) ){ // must have at least row or col def'd
        const pos = { row: rcPos.row, col: rcPos.col } as { row: number; col: number };

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

        id2manPos[ node.id() as string ] = pos;
        use( pos.row, pos.col );
      }
    }

    const raw: Position[] = nodes.map( node => {
      let x: number;
      let y: number;

      // see if we have a manual position set
      const rcPos = id2manPos[ node.id() as string ];

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

      return { x, y };
    } );

    return this.applySpacing( raw );
  }

  /** Scale positions about their bounding-box center (as v3 layoutPositions does). */
  private applySpacing( positions: Position[] ): Position[] {
    const factor = this.options.spacingFactor;

    if( factor == null || factor === 1 || positions.length === 0 ){
      return positions;
    }

    const spacing = Math.abs( factor );
    const bb = math.makeBoundingBox() as BoundingBox;

    for( const pos of positions ){
      math.expandBoundingBoxByPoint( bb, pos.x, pos.y );
    }

    const center = {
      x: bb.x1 + bb.w / 2,
      y: bb.y1 + bb.h / 2
    };

    return positions.map( pos => ( {
      x: center.x + ( pos.x - center.x ) * spacing,
      y: center.y + ( pos.y - center.y ) * spacing
    } ) );
  }
}
