import define from '../../define';
import * as is from '../../is';
import * as math from '../../math';
import * as util from '../../util';

let fn, elesfn;

let beforePositionSet = function( eles, newPos, silent ){
  for( let i = 0; i < eles.length; i++ ){
    let ele = eles[i];

    if( !ele.locked() ){
      let oldPos = ele._private.position;

      let delta = {
        x: newPos.x != null ? newPos.x - oldPos.x : 0,
        y: newPos.y != null ? newPos.y - oldPos.y : 0
      };

      if( ele.isParent() && !(delta.x === 0 && delta.y === 0) ){
        ele.children().shift( delta, silent );
      }

      ele.shiftCachedBoundingBox( delta );
    }
  }
};

let positionDef = {
  field: 'position',
  bindingEvent: 'position',
  allowBinding: true,
  allowSetting: true,
  settingEvent: 'position',
  settingTriggersEvent: true,
  triggerFnName: 'emitAndNotify',
  allowGetting: true,
  validKeys: [ 'x', 'y' ],
  beforeGet: function( ele ){
    ele.updateCompoundBounds();
  },
  beforeSet: function( eles, newPos ){
    beforePositionSet( eles, newPos, false );
  },
  onSet: function( eles ){
    eles.dirtyCompoundBoundsCache();
  },
  canSet: function( ele ){
    return !ele.locked();
  }
};

fn = elesfn = ({

  /**
 *  dimension, value
 * @typedef {object} node_position_dimension_val
 * @property {object} dimension - The position dimension to set.
 * @property {object} value - The value to set to the dimension.
 */

/**
 * @typedef {object} node_position
 * @property {object} NULL
 * @property {object} dimension - The position dimension to get.
 * @property {node_position_dimension_val} node_position_dimension_val
 * @property {object} pos - An object specifying name-value pairs representing dimensions to set.
 */

  /**
 * Get or set the [model position](#notation/position) of a node.
 * @memberof node
 * @path Collection/Position & dimensions
 * @pureAliases node.modelPosition|node.point
 * @param {...node_position} value - Get the entire position object. | Get the value of a specified position dimension. | Set the value of a specified position dimension. | Set the position using name-value pairs in the specified object.
 * @methodName node.position
 */
  position: define.data( positionDef ),

  // position but no notification to renderer
  silentPosition: define.data( util.assign( {}, positionDef, {
    allowBinding: false,
    allowSetting: true,
    settingTriggersEvent: false,
    allowGetting: false,
    beforeSet: function( eles, newPos ){
      beforePositionSet( eles, newPos, true );
    }
  } ) ),


  /**
 * @callback nodes_positions_callback
 * @property {nodes_positions_callback_type} function(ele,i) - nodes_positions_callback_type
 */

/**
 * function(ele, i, eles)
 * @typedef {object} nodes_positions_callback_type
 * @property {object} ele - The element being iterated over for which the function should return a position to set.
 * @property {object} i - The index of the element when iterating over the elements in the collection.
 */

/**
 * @typedef {object} nodes_positions
 * @property {function(nodes_positions_callback):any} nodes_positions_callback - A callback function that returns the position to set for each element.
 * @property {object} pos - An object specifying name-value pairs representing dimensions to set.
 */

  /**
 * Set the [model positions](#notation/position) of several nodes with a function.
 * @memberof nodes
 * @path Collection/Position & dimensions
 * @pureAliases nodes.modelPositions|nodes.points
 * @param {...nodes_positions} val - Set the positions via a function. | Set positions for all nodes based on a single position object.
 * @methodName nodes.positions
 */
  positions: function( pos, silent ){
    if( is.plainObject( pos ) ){
      if( silent ){
        this.silentPosition( pos );
      } else {
        this.position( pos );
      }

    } else if( is.fn( pos ) ){
      let fn = pos;
      let cy = this.cy();

      cy.startBatch();

      for( let i = 0; i < this.length; i++ ){
        let ele = this[ i ];
        let pos;

        if( ( pos = fn(ele, i) ) ){
          if( silent ){
            ele.silentPosition( pos );
          } else {
            ele.position( pos );
          }
        }
      }

      cy.endBatch();
    }

    return this; // chaining
  },

  silentPositions: function( pos ){
    return this.positions( pos, true );
  },

    /**
 *  dimension, value
 * @typedef {object} nodes_shift_dimension_val
 * @property {object} dimension - The position dimension to shift.
 * @property {object} value - The value to shift the dimension.
 */

/**
 * @typedef {object} nodes_shift
 * @property {nodes_shift_dimension_val} nodes_shift_dimension_val
 * @property {object} pos - An object specifying name-value pairs representing dimensions to shift.
 */

  /**
 * Shift the positions of the nodes by a given [model position](#notation/position) vector.
 * @memberof nodes
 * @path Collection/Position & dimensions
 * @param {...nodes_shift} value - Shift the nodes by one of `'x'` or `'y'`. | Shift the nodes by a position vector.
 * @methodName nodes.shift
 */
  shift: function( dim, val, silent ){
    let delta;

    if( is.plainObject( dim ) ){
      delta = {
        x: is.number(dim.x) ? dim.x : 0,
        y: is.number(dim.y) ? dim.y : 0
      };

      silent = val;
    } else if( is.string( dim ) && is.number( val ) ){
      delta = { x: 0, y: 0 };

      delta[ dim ] = val;
    }

    if( delta != null ){
      let cy = this.cy();

      cy.startBatch();

      for( let i = 0; i < this.length; i++ ){
        let ele = this[i];
        let pos = ele.position();
        let newPos = {
          x: pos.x + delta.x,
          y: pos.y + delta.y
        };

        if( silent ){
          ele.silentPosition( newPos );
        } else {
          ele.position( newPos );
        }
      }

      cy.endBatch();
    }

    return this;
  },

  silentShift: function( dim, val ){
    if( is.plainObject( dim ) ){
      this.shift( dim, true );
    } else if( is.string( dim ) && is.number( val ) ){
      this.shift( dim, val, true );
    }

    return this;
  },

  // get/set the rendered (i.e. on screen) positon of the element

   /**
 *  dimension, value
 * @typedef {object} node_renderedPosition_dimension_val
 * @property {object} dimension - The position dimension to set.
 * @property {object} value - The value to set to the dimension.
 */

/**
 * @typedef {object} node_renderedPosition
 * @property {object} NULL
 * @property {object} dimension - The position dimension to get.
 * @property {node_renderedPosition_dimension_val} node_renderedPosition_dimension_val
 * @property {object} pos - An object specifying name-value pairs representing dimensions to set.
 */

  /**
 * Get or set the [rendered (on-screen) position](#notation/position) of a node.
 * @memberof node
 * @path Collection/Position & dimensions
 * @pureAliases node.renderedPoint
 * @param {...node_renderedPosition} value - Get the entire rendered position object. | Get the value of a specified rendered position dimension. | Set the value of a specified rendered position dimension. | Set the rendered position using name-value pairs in the specified object.
 * @methodName node.renderedPosition
 */
  renderedPosition: function( dim, val ){
    let ele = this[0];
    let cy = this.cy();
    let zoom = cy.zoom();
    let pan = cy.pan();
    let rpos = is.plainObject( dim ) ? dim : undefined;
    let setting = rpos !== undefined || ( val !== undefined && is.string( dim ) );

    if( ele && ele.isNode() ){ // must have an element and must be a node to return position
      if( setting ){
        for( let i = 0; i < this.length; i++ ){
          let ele = this[ i ];

          if( val !== undefined ){ // set one dimension
            ele.position( dim, ( val - pan[ dim ] ) / zoom );
          } else if( rpos !== undefined ){ // set whole position
            ele.position( math.renderedToModelPosition( rpos, zoom, pan ) );
          }
        }
      } else { // getting
        let pos = ele.position();
        rpos = math.modelToRenderedPosition( pos, zoom, pan );

        if( dim === undefined ){ // then return the whole rendered position
          return rpos;
        } else { // then return the specified dimension
          return rpos[ dim ];
        }
      }
    } else if( !setting ){
      return undefined; // for empty collection case
    }

    return this; // chaining
  },

  // get/set the position relative to the parent

     /**
 *  dimension, value
 * @typedef {object} node_relativePosition_dimension_val
 * @property {object} dimension - The position dimension to set.
 * @property {object} value - The value to set to the dimension.
 */

/**
 * @typedef {object} node_relativePosition
 * @property {object} NULL
 * @property {object} dimension - The position dimension to get.
 * @property {node_relativePosition_dimension_val} node_relativePosition_dimension_val
 * @property {object} pos - An object specifying name-value pairs representing dimensions to set.
 */

  /**
 * Get or set the [model position](#notation/position) of a node, relative to its compound parent.
 * @memberof node
 * @path Collection/Position & dimensions
 * @pureAliases node.relativePoint
 * @param {...node_relativePosition} value - Get the entire relative position object. | Get the value of a specified relative position dimension. | Set the value of a specified relative position dimension. | Set the relative position using name-value pairs in the specified object.
 * @methodName node.relativePosition
 */
  relativePosition: function( dim, val ){
    let ele = this[0];
    let cy = this.cy();
    let ppos = is.plainObject( dim ) ? dim : undefined;
    let setting = ppos !== undefined || ( val !== undefined && is.string( dim ) );
    let hasCompoundNodes = cy.hasCompoundNodes();

    if( ele && ele.isNode() ){ // must have an element and must be a node to return position
      if( setting ){
        for( let i = 0; i < this.length; i++ ){
          let ele = this[ i ];
          let parent = hasCompoundNodes ? ele.parent() : null;
          let hasParent = parent && parent.length > 0;
          let relativeToParent = hasParent;

          if( hasParent ){
            parent = parent[0];
          }

          let origin = relativeToParent ? parent.position() : { x: 0, y: 0 };

          if( val !== undefined ){ // set one dimension
            ele.position( dim, val + origin[ dim ] );
          } else if( ppos !== undefined ){ // set whole position
            ele.position({
              x: ppos.x + origin.x,
              y: ppos.y + origin.y
            });
          }
        }

      } else { // getting
        let pos = ele.position();
        let parent = hasCompoundNodes ? ele.parent() : null;
        let hasParent = parent && parent.length > 0;
        let relativeToParent = hasParent;

        if( hasParent ){
          parent = parent[0];
        }

        let origin = relativeToParent ? parent.position() : { x: 0, y: 0 };

        ppos = {
          x: pos.x - origin.x,
          y: pos.y - origin.y
        };

        if( dim === undefined ){ // then return the whole rendered position
          return ppos;
        } else { // then return the specified dimension
          return ppos[ dim ];
        }
      }
    } else if( !setting ){
      return undefined; // for empty collection case
    }

    return this; // chaining
  }
});

// aliases
fn.modelPosition = fn.point = fn.position;
fn.modelPositions = fn.points = fn.positions;
fn.renderedPoint = fn.renderedPosition;
fn.relativePoint = fn.relativePosition;

export default elesfn;
