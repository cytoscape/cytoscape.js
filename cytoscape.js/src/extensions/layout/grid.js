'use strict';

var util = require( '../../util' );
var math = require( '../../math' );

var defaults = {
  fit: true, // whether to fit the viewport to the graph
  padding: 30, // padding used on fit
  boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
  avoidOverlap: true, // prevents node overlap, may overflow boundingBox if not enough space
  avoidOverlapPadding: 10, // extra spacing around nodes when avoidOverlap: true
  condense: false, // uses all available space on false, uses minimal space on true
  rows: undefined, // force num of rows in the grid
  cols: undefined, // force num of columns in the grid
  position: function( node ){}, // returns { row, col } for element
  sort: undefined, // a sorting function to order the nodes; e.g. function(a, b){ return a.data('weight') - b.data('weight') }
  animate: false, // whether to transition the node positions
  animationDuration: 500, // duration of animation in ms if enabled
  animationEasing: undefined, // easing of animation if enabled
  ready: undefined, // callback on layoutready
  stop: undefined // callback on layoutstop
};

function GridLayout( options ){
  this.options = util.extend( {}, defaults, options );
}

GridLayout.prototype.run = function(){
  var params = this.options;
  var options = params;

  var cy = params.cy;
  var eles = options.eles;
  var nodes = eles.nodes().not( ':parent' );

  if( options.sort ){
    nodes = nodes.sort( options.sort );
  }

  var bb = math.makeBoundingBox( options.boundingBox ? options.boundingBox : {
    x1: 0, y1: 0, w: cy.width(), h: cy.height()
  } );

  if( bb.h === 0 || bb.w === 0 ){
    nodes.layoutPositions( this, options, function(){
      return { x: bb.x1, y: bb.y1 };
    } );

  } else {

    // width/height * splits^2 = cells where splits is number of times to split width
    var cells = nodes.size();
    var splits = Math.sqrt( cells * bb.h / bb.w );
    var rows = Math.round( splits );
    var cols = Math.round( bb.w / bb.h * splits );

    var small = function( val ){
      if( val == null ){
        return Math.min( rows, cols );
      } else {
        var min = Math.min( rows, cols );
        if( min == rows ){
          rows = val;
        } else {
          cols = val;
        }
      }
    };

    var large = function( val ){
      if( val == null ){
        return Math.max( rows, cols );
      } else {
        var max = Math.max( rows, cols );
        if( max == rows ){
          rows = val;
        } else {
          cols = val;
        }
      }
    };

    var oRows = options.rows;
    var oCols = options.cols != null ? options.cols : options.columns;

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
      var sm = small();
      var lg = large();

      // reducing the small side takes away the most cells, so try it first
      if( (sm - 1) * lg >= cells ){
        small( sm - 1 );
      } else if( (lg - 1) * sm >= cells ){
        large( lg - 1 );
      }
    } else {

      // if rounding was too low, add rows or columns
      while( cols * rows < cells ){
        var sm = small();
        var lg = large();

        // try to add to larger side first (adds less in multiplication)
        if( (lg + 1) * sm >= cells ){
          large( lg + 1 );
        } else {
          small( sm + 1 );
        }
      }
    }

    var cellWidth = bb.w / cols;
    var cellHeight = bb.h / rows;

    if( options.condense ){
      cellWidth = 0;
      cellHeight = 0;
    }

    if( options.avoidOverlap ){
      for( var i = 0; i < nodes.length; i++ ){
        var node = nodes[ i ];
        var pos = node._private.position;

        if( pos.x == null || pos.y == null ){ // for bb
          pos.x = 0;
          pos.y = 0;
        }

        var nbb = node.boundingBox();
        var p = options.avoidOverlapPadding;

        var w = nbb.w + p;
        var h = nbb.h + p;

        cellWidth = Math.max( cellWidth, w );
        cellHeight = Math.max( cellHeight, h );
      }
    }

    var cellUsed = {}; // e.g. 'c-0-2' => true

    var used = function( row, col ){
      return cellUsed[ 'c-' + row + '-' + col ] ? true : false;
    };

    var use = function( row, col ){
      cellUsed[ 'c-' + row + '-' + col ] = true;
    };

    // to keep track of current cell position
    var row = 0;
    var col = 0;
    var moveToNextCell = function(){
      col++;
      if( col >= cols ){
        col = 0;
        row++;
      }
    };

    // get a cache of all the manual positions
    var id2manPos = {};
    for( var i = 0; i < nodes.length; i++ ){
      var node = nodes[ i ];
      var rcPos = options.position( node );

      if( rcPos && (rcPos.row !== undefined || rcPos.col !== undefined) ){ // must have at least row or col def'd
        var pos = {
          row: rcPos.row,
          col: rcPos.col
        };

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

        id2manPos[ node.id() ] = pos;
        use( pos.row, pos.col );
      }
    }

    var getPos = function( i, element ){
      var x, y;

      if( element.locked() || element.isParent() ){
        return false;
      }

      // see if we have a manual position set
      var rcPos = id2manPos[ element.id() ];
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

    nodes.layoutPositions( this, options, getPos );
  }

  return this; // chaining

};

module.exports = GridLayout;
