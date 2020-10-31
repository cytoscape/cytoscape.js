import * as util from '../util';
import Promise from '../promise';
import * as math from '../math';

const getLayoutDimensionOptions = util.defaults({
  nodeDimensionsIncludeLabels: false
});

let elesfn = ({
  // Calculates and returns node dimensions { x, y } based on options given
  /**
 * @typedef {object} node_layoutDimensions
 * @property {object} options - The layout options object.
 */

  /**
 * Get the node width and height. This function is intended for use in layout positioning to do overlap detection.
 * @memberof node
 * @extFn true
 * @param {...node_layoutDimensions} options - The node layoutDimensionsing function.
 * @namespace node.layoutDimensions
 */
  layoutDimensions: function( options ){
    options = getLayoutDimensionOptions( options );

    let dims;

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
        w: this.outerWidth(),
        h: this.outerHeight()
      };
    }

    // sanitise the dimensions for external layouts (avoid division by zero)
    if( dims.w === 0 || dims.h === 0 ){
      dims.w = dims.h = 1;
    }

    return dims;
  },

  // using standard layout options, apply position function (w/ or w/o animation)
  /**
 * layout, options, function(ele, i)
 * @typedef {object} nodes_layoutPositions_callback_type
 * @property {object} ele - The node being iterated over for which the function should return a position to set.
 * @property {object} i - The index of the current node while iterating over the nodes in the layout.
 */

/**
 * @callback nodes_layoutPositions_callback
 * @property {nodes_layoutPositions_callback_type} function(ele,i) - nodes_layoutPositions_callback_type
 */

/**
 * @typedef {object} nodes_layouts_layoutPositions
 * @property {object} layout - The layout.
 * @property {object} options - The layout options object.
 * @property {function(nodes_layoutPositions_callback):any} nodes_layoutPositions_callback - A function that returns the new position for the specified node.
 */

/**
 * @typedef {object} nodes_layoutPositions
 * @property {nodes_layouts_layoutPositions} nodes_layouts_layoutPositions
 */

  /**
 * Position the nodes for a discrete/synchronous layout.
 * @memberof nodes
 * @extFn true
 * @param {...nodes_layoutPositions} options - Position the nodes.
 * @namespace nodes.layoutPositions
 */
  layoutPositions: function( layout, options, fn ){
    let nodes = this.nodes();
    let cy = this.cy();
    let layoutEles = options.eles; // nodes & edges
    let getMemoizeKey = node => node.id();
    let fnMem = util.memoize( fn, getMemoizeKey ); // memoized version of position function

    layout.emit( { type: 'layoutstart', layout: layout } );

    layout.animations = [];

    let calculateSpacing = function( spacing, nodesBb, pos ){
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

    let spacingBb = function(){
      if( !useSpacingFactor ){ return null; }

      let bb = math.makeBoundingBox();

      for( let i = 0; i < nodes.length; i++ ){
        let node = nodes[i];
        let pos = fnMem( node, i );

        math.expandBoundingBoxByPoint( bb, pos.x, pos.y );
      }

      return bb;
    };

    let bb = spacingBb();

    let getFinalPos = util.memoize( function( node, i ){
      let newPos = fnMem( node, i );

      if( useSpacingFactor ){
        let spacing = Math.abs( options.spacingFactor );

        newPos = calculateSpacing( spacing, bb, newPos );
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
          } );

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

  /**
 * @typedef {object} eles_layout
 * @property {object} options - The layout options.
 */

  /**
 * Get a new layout, which can be used to algorithmically position the nodes in the collection.
 * @memberof eles
 * @alias eles.createLayout|eles.makeLayout
 * @param {...eles_layout} options - The layouting comparison function.
 * @namespace eles.layout
 */
  layout: function( options ){
    let cy = this.cy();

    return cy.makeLayout( util.extend( {}, options, {
      eles: this
    } ) );
  }

});

// aliases:
elesfn.createLayout = elesfn.makeLayout = elesfn.layout;

export default elesfn;
