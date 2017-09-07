let is = require( '../is' );
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

    let defaults = {
      motionBlur: false,
      motionBlurOpacity: 0.05,
      pixelRatio: undefined,
      desktopTapThreshold: 4,
      touchTapThreshold: 8,
      wheelSensitivity: 1
    };

    let rOpts = util.extend( {}, defaults, options, {
      cy: cy,
      wheelSensitivity: is.number( options.wheelSensitivity ) && options.wheelSensitivity > 0 ? options.wheelSensitivity : defaults.wheelSensitivity,
      pixelRatio: is.number( options.pixelRatio ) && options.pixelRatio > 0 ? options.pixelRatio : defaults.pixelRatio
     } );

    cy._private.renderer = new RendererProto( rOpts );
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
    cy.mutableElements().forEach(function( ele ){
      let _p = ele._private;
      _p.rscratch = {};
      _p.rstyle = {};
      _p.animation.current = [];
      _p.animation.queue = [];
    });
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
