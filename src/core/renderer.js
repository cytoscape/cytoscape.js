let util = require( '../util' );

let corefn = ({

  renderTo: function( context, zoom, pan, pxRatio ){
    let r = this._private.renderer;

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

    this.emit( 'resize' );

    return this;
  },

  initRenderer: function( options ){
    let cy = this;

    let RendererProto = cy.extension( 'renderer', options.name );
    if( RendererProto == null ){
      util.error( 'Can not initialise: No such renderer `%s` found; did you include its JS file?', options.name );
      return;
    }

    cy._private.renderer = new RendererProto( util.extend( {}, options, { cy } ) );

    this.notify({ type: 'init' });
  },

  destroyRenderer: function(){
    let cy = this;

    cy.notify( { type: 'destroy' } ); // destroy the renderer

    let domEle = cy.container();
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
