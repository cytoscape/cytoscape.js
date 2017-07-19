let define = require('../../define');
let is = require('../../is');
let math = require('../../math');
let fn, elesfn;

let beforePositionSet = function( eles, newPos ){
  for( let i = 0; i < eles.length; i++ ){
    let ele = eles[i];

    if( ele.isParent() && !ele.locked() ){
      let oldPos = ele._private.position;
      let delta = {
        x: newPos.x - oldPos.x,
        y: newPos.y - oldPos.y
      };

      eles.children().shift( delta );
    }
  }
};

fn = elesfn = ({

  position: define.data( {
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
    beforeSet: beforePositionSet,
    onSet: function( eles ){
      eles.dirtyCompoundBoundsCache();
    },
    canSet: function( ele ){
      return !ele.locked();
    }
  } ),

  // position but no notification to renderer
  silentPosition: define.data( {
    field: 'position',
    bindingEvent: 'position',
    allowBinding: false,
    allowSetting: true,
    settingEvent: 'position',
    settingTriggersEvent: false,
    triggerFnName: 'trigger',
    allowGetting: false,
    validKeys: [ 'x', 'y' ],
    beforeSet: beforePositionSet,
    onSet: function( eles ){
      eles.dirtyCompoundBoundsCache();
    },
    canSet: function( ele ){
      return !ele.locked();
    }
  } ),

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

  shift: function( dim, val ){
    let delta;

    if( is.plainObject( dim ) ){
      delta = dim;
    } else if( is.string( dim ) && is.number( val ) ){
      delta = { x: 0, y: 0 };

      delta[ dim ] = val;
    }

    if( delta != null ){
      for( let i = 0; i < this.length; i++ ){
        let ele = this[i];
        let pos = ele.position();

        ele.position({
          x: pos.x + delta.x,
          y: pos.y + delta.y
        });
      }
    }

    return this;
  },

  // get/set the rendered (i.e. on screen) positon of the element
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

module.exports = elesfn;
