'use strict';

var util = require('../util');

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
    this.notify({
      type: 'draw'
    });

    return this;
  },

  resize: function(){
    this.notify({
      type: 'resize'
    });

    this.trigger('resize');

    return this;
  },

  initRenderer: function( options ){
    var cy = this;

    var RendererProto = cy.extension('renderer', options.name);
    if( RendererProto == null ){
      util.error('Can not initialise: No such renderer `%s` found; did you include its JS file?', options.name);
      return;
    }

    var rOpts = util.extend({}, options, {
      cy: cy
    });
    var renderer = cy._private.renderer = new RendererProto( rOpts );

    renderer.init( rOpts );

  },

  triggerOnRender: function(){
    var cbs = this._private.onRenders;

    for( var i = 0; i < cbs.length; i++ ){
      var cb = cbs[i];

      cb();
    }

    return this;
  },

  onRender: function( cb ){
    this._private.onRenders.push( cb );

    return this;
  },

  offRender: function( fn ){
    var cbs = this._private.onRenders;

    if( fn == null ){ // unbind all
      this._private.onRenders = [];
      return this;
    }

    for( var i = 0; i < cbs.length; i++ ){ // unbind specified
      var cb = cbs[i];

      if( fn === cb ){
        cbs.splice( i, 1 );
        break;
      }
    }

    return this;
  }

});

module.exports = corefn;
