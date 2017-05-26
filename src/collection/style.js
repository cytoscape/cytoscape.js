'use strict';

var is = require( '../is' );

var elesfn = ({

  // fully updates (recalculates) the style for the elements
  updateStyle: function( notifyRenderer ){
    var cy = this._private.cy;

    if( !cy.styleEnabled() ){ return this; }

    if( cy._private.batchingStyle ){
      var bEles = cy._private.batchStyleEles;

      bEles.merge( this );

      return this; // chaining and exit early when batching
    }

    var hasCompounds = cy.hasCompoundNodes();
    var style = cy.style();
    var updatedEles = this;

    notifyRenderer = notifyRenderer || notifyRenderer === undefined ? true : false;

    if( hasCompounds ){ // then add everything up and down for compound selector checks
      updatedEles = this.spawnSelf().merge( this.descendants() ).merge( this.parents() );
    }

    var changedEles = style.apply( updatedEles );

    changedEles.dirtyCompoundBoundsCache();

    if( notifyRenderer ){
      changedEles.rtrigger( 'style' ); // let renderer know we changed style
    } else {
      changedEles.trigger( 'style' ); // just fire the event
    }

    return this; // chaining
  },

  // just update the mappers in the elements' styles; cheaper than eles.updateStyle()
  updateMappers: function( notifyRenderer ){
    var cy = this._private.cy;
    var style = cy.style();
    notifyRenderer = notifyRenderer || notifyRenderer === undefined ? true : false;

    if( !cy.styleEnabled() ){ return this; }

    var changedEles = style.updateMappers( this );

    changedEles.dirtyCompoundBoundsCache();

    if( notifyRenderer ){
      changedEles.rtrigger( 'style' ); // let renderer know we changed style
    } else {
      changedEles.trigger( 'style' ); // just fire the event
    }
    return this; // chaining
  },

  // get the internal parsed style object for the specified property
  parsedStyle: function( property ){
    var ele = this[0];
    var cy = ele.cy();

    if( !cy.styleEnabled() ){ return; }

    if( ele ){
      return ele._private.style[ property ] || cy.style().getDefaultProperty( property );
    }
  },

  numericStyle: function( property ){
    var ele = this[0];

    if( !ele.cy().styleEnabled() ){ return; }

    if( ele ){
      var pstyle = ele.pstyle( property );

      return pstyle.pfValue !== undefined ? pstyle.pfValue : pstyle.value;
    }
  },

  numericStyleUnits: function( property ){
    var ele = this[0];

    if( !ele.cy().styleEnabled() ){ return; }

    if( ele ){
      return ele.pstyle( property ).units;
    }
  },

  // get the specified css property as a rendered value (i.e. on-screen value)
  // or get the whole rendered style if no property specified (NB doesn't allow setting)
  renderedStyle: function( property ){
    var cy = this.cy();
    if( !cy.styleEnabled() ){ return this; }

    var ele = this[0];

    if( ele ){
      return cy.style().getRenderedStyle( ele, property );
    }
  },

  // read the calculated css style of the element or override the style (via a bypass)
  style: function( name, value ){
    var cy = this.cy();

    if( !cy.styleEnabled() ){ return this; }

    var updateTransitions = false;
    var style = cy.style();

    if( is.plainObject( name ) ){ // then extend the bypass
      var props = name;
      style.applyBypass( this, props, updateTransitions );

      this.dirtyCompoundBoundsCache();

      this.rtrigger( 'style' ); // let the renderer know we've updated style

    } else if( is.string( name ) ){

      if( value === undefined ){ // then get the property from the style
        var ele = this[0];

        if( ele ){
          return style.getStylePropertyValue( ele, name );
        } else { // empty collection => can't get any value
          return;
        }

      } else { // then set the bypass with the property value
        style.applyBypass( this, name, value, updateTransitions );

        this.dirtyCompoundBoundsCache();

        this.rtrigger( 'style' ); // let the renderer know we've updated style
      }

    } else if( name === undefined ){
      var ele = this[0];

      if( ele ){
        return style.getRawStyle( ele );
      } else { // empty collection => can't get any value
        return;
      }
    }

    return this; // chaining
  },

  removeStyle: function( names ){
    var cy = this.cy();

    if( !cy.styleEnabled() ){ return this; }

    var updateTransitions = false;
    var style = cy.style();
    var eles = this;

    if( names === undefined ){
      for( var i = 0; i < eles.length; i++ ){
        var ele = eles[ i ];

        style.removeAllBypasses( ele, updateTransitions );
      }
    } else {
      names = names.split( /\s+/ );

      for( var i = 0; i < eles.length; i++ ){
        var ele = eles[ i ];

        style.removeBypasses( ele, names, updateTransitions );
      }
    }

    this.dirtyCompoundBoundsCache();

    this.rtrigger( 'style' ); // let the renderer know we've updated style

    return this; // chaining
  },

  show: function(){
    this.css( 'display', 'element' );
    return this; // chaining
  },

  hide: function(){
    this.css( 'display', 'none' );
    return this; // chaining
  },

  effectiveOpacity: function(){
    var cy = this.cy();
    if( !cy.styleEnabled() ){ return 1; }

    var hasCompoundNodes = cy.hasCompoundNodes();
    var ele = this[0];

    if( ele ){
      var _p = ele._private;
      var parentOpacity = ele.pstyle( 'opacity' ).value;

      if( !hasCompoundNodes ){ return parentOpacity; }

      var parents = !_p.data.parent ? null : ele.parents();

      if( parents ){
        for( var i = 0; i < parents.length; i++ ){
          var parent = parents[ i ];
          var opacity = parent.pstyle( 'opacity' ).value;

          parentOpacity = opacity * parentOpacity;
        }
      }

      return parentOpacity;
    }
  },

  transparent: function(){
    var cy = this.cy();
    if( !cy.styleEnabled() ){ return false; }

    var ele = this[0];
    var hasCompoundNodes = ele.cy().hasCompoundNodes();

    if( ele ){
      if( !hasCompoundNodes ){
        return ele.pstyle( 'opacity' ).value === 0;
      } else {
        return ele.effectiveOpacity() === 0;
      }
    }
  },

  backgrounding: function(){
    var cy = this.cy();
    if( !cy.styleEnabled() ){ return false; }

    var ele = this[0];

    return ele._private.backgrounding ? true : false;
  }

});

function checkCompound( ele, parentOk ){
  var _p = ele._private;
  var parents = _p.data.parent ? ele.parents() : null;

  if( parents ){ for( var i = 0; i < parents.length; i++ ){
    var parent = parents[ i ];

    if( !parentOk( parent ) ){ return false; }
  } }

  return true;
}

function defineDerivedStateFunction( specs ){
  var ok = specs.ok;
  var edgeOkViaNode = specs.edgeOkViaNode || specs.ok;
  var parentOk = specs.parentOk || specs.ok;

  return function(){
    var cy = this.cy();
    if( !cy.styleEnabled() ){ return true; }

    var ele = this[0];
    var _p = ele._private;
    var hasCompoundNodes = cy.hasCompoundNodes();

    if( ele ){
      if( !ok( ele ) ){ return false; }

      if( ele.isNode() ){
        return !hasCompoundNodes || checkCompound( ele, parentOk );
      } else {
        var src = _p.source;
        var tgt = _p.target;

        return ( edgeOkViaNode(src) && (!hasCompoundNodes || checkCompound(src, edgeOkViaNode)) ) &&
          ( _p.source === _p.target || ( edgeOkViaNode(tgt) && (!hasCompoundNodes || checkCompound(tgt, edgeOkViaNode)) ) );
      }
    }
  }
}

var eleTakesUpSpace = function( ele ){
  return (
    ele.pstyle( 'display' ).value === 'element'
    && ele.width() !== 0
    && ( ele.isNode() ? ele.height() !== 0 : true )
  );
};

elesfn.takesUpSpace = defineDerivedStateFunction({
  ok: eleTakesUpSpace
});

var eleInteractive = function( ele ){
  return (
    ele.pstyle('events').value === 'yes'
    && ele.pstyle('visibility').value === 'visible'
    && eleTakesUpSpace( ele )
  );
};

var parentInteractive = function( parent ){
  return (
    parent.pstyle('visibility').value === 'visible'
    && eleTakesUpSpace( parent )
  );
};

elesfn.interactive = defineDerivedStateFunction({
  ok: eleInteractive,
  parentOk: parentInteractive,
  edgeOkViaNode: eleTakesUpSpace
});

elesfn.noninteractive = function(){
  var ele = this[0];

  if( ele ){
    return !ele.interactive();
  }
};

var eleVisible = function( ele ){
  return (
    ele.pstyle( 'visibility' ).value === 'visible'
    && ele.pstyle( 'opacity' ).pfValue !== 0
    && eleTakesUpSpace( ele )
  );
};

var edgeVisibleViaNode = eleTakesUpSpace;

elesfn.visible = defineDerivedStateFunction({
  ok: eleVisible,
  edgeOkViaNode: edgeVisibleViaNode
});

elesfn.hidden = function(){
  var ele = this[0];

  if( ele ){
    return !ele.visible();
  }
};


elesfn.bypass = elesfn.css = elesfn.style;
elesfn.renderedCss = elesfn.renderedStyle;
elesfn.removeBypass = elesfn.removeCss = elesfn.removeStyle;
elesfn.pstyle = elesfn.parsedStyle;

module.exports = elesfn;
