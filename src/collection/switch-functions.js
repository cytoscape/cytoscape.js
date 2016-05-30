'use strict';

var elesfn = {};

function defineSwitchFunction( params ){
  return function(){
    var args = arguments;
    var changedEles = [];

    // e.g. cy.nodes().select( data, handler )
    if( args.length === 2 ){
      var data = args[0];
      var handler = args[1];
      this.on( params.event, data, handler );
    }

    // e.g. cy.nodes().select( handler )
    else if( args.length === 1 ){
      var handler = args[0];
      this.on( params.event, handler );
    }

    // e.g. cy.nodes().select()
    else if( args.length === 0 ){
      for( var i = 0; i < this.length; i++ ){
        var ele = this[ i ];
        var able = !params.ableField || ele._private[ params.ableField ];
        var changed = ele._private[ params.field ] != params.value;

        if( params.overrideAble ){
          var overrideAble = params.overrideAble( ele );

          if( overrideAble !== undefined ){
            able = overrideAble;

            if( !overrideAble ){ return this; } // to save cycles assume not able for all on override
          }
        }

        if( able ){
          ele._private[ params.field ] = params.value;

          if( changed ){
            changedEles.push( ele );
          }
        }
      }

      var changedColl = this.spawn( changedEles );
      changedColl.updateStyle(); // change of state => possible change of style
      changedColl.trigger( params.event );
    }

    return this;
  };
}

function defineSwitchSet( params ){
  elesfn[ params.field ] = function(){
    var ele = this[0];

    if( ele ){
      if( params.overrideField ){
        var val = params.overrideField( ele );

        if( val !== undefined ){
          return val;
        }
      }

      return ele._private[ params.field ];
    }
  };

  elesfn[ params.on ] = defineSwitchFunction( {
    event: params.on,
    field: params.field,
    ableField: params.ableField,
    overrideAble: params.overrideAble,
    value: true
  } );

  elesfn[ params.off ] = defineSwitchFunction( {
    event: params.off,
    field: params.field,
    ableField: params.ableField,
    overrideAble: params.overrideAble,
    value: false
  } );
}

defineSwitchSet( {
  field: 'locked',
  overrideField: function( ele ){
    return ele.cy().autolock() ? true : undefined;
  },
  on: 'lock',
  off: 'unlock'
} );

defineSwitchSet( {
  field: 'grabbable',
  overrideField: function( ele ){
    return ele.cy().autoungrabify() ? false : undefined;
  },
  on: 'grabify',
  off: 'ungrabify'
} );

defineSwitchSet( {
  field: 'selected',
  ableField: 'selectable',
  overrideAble: function( ele ){
    return ele.cy().autounselectify() ? false : undefined;
  },
  on: 'select',
  off: 'unselect'
} );

defineSwitchSet( {
  field: 'selectable',
  overrideField: function( ele ){
    return ele.cy().autounselectify() ? false : undefined;
  },
  on: 'selectify',
  off: 'unselectify'
} );

elesfn.deselect = elesfn.unselect;

elesfn.grabbed = function(){
  var ele = this[0];
  if( ele ){
    return ele._private.grabbed;
  }
};

defineSwitchSet( {
  field: 'active',
  on: 'activate',
  off: 'unactivate'
} );

elesfn.inactive = function(){
  var ele = this[0];
  if( ele ){
    return !ele._private.active;
  }
};

module.exports = elesfn;
