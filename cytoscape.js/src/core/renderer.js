'use strict';

var util = require( '../util' );

var corefn = ({

  renderTo: function( context, zoom, pan, pxRatio ){
    var r = this._private.renderer;

    r.renderTo( context, zoom, pan, pxRatio );
    return this;
  },

  renderer: function(){
    return this._private.renderer;
  },

  forceRender: function(){
    this.notify( {
      type: 'draw'
    } );

    return this;
  },

  resize: function(){
    this.invalidateSize();

    this.notify( {
      type: 'resize'
    } );

    this.trigger( 'resize' );

    return this;
  },

  initRenderer: function( options ){
    var cy = this;

    var RendererProto = cy.extension( 'renderer', options.name );
    if( RendererProto == null ){
      util.error( 'Can not initialise: No such renderer `%s` found; did you include its JS file?', options.name );
      return;
    }

    var rOpts = util.extend( {}, options, {
      cy: cy
    } );

    cy._private.renderer = new RendererProto( rOpts );
  },

  destroyRenderer: function(){
    var cy = this;

    cy.notify( { type: 'destroy' } ); // destroy the renderer

    var domEle = cy.container();
    if( domEle ){
      domEle._cyreg = null;

      while( domEle.childNodes.length > 0 ){
        domEle.removeChild( domEle.childNodes[0] );
      }
    }

    cy._private.renderer = null; // to be extra safe, remove the ref
  },

  onRender: function( fn ){
    return this.on('render', fn);
  },

  offRender: function( fn ){
    return this.off('render', fn);
  }

});

corefn.invalidateDimensions = corefn.resize;

module.exports = corefn;
