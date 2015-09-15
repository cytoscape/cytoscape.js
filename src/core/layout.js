'use strict';

var util = require('../util');
var is = require('../is');
var extension = require('../extension');

var corefn = ({

  layout: function( params ){
    var layout = this._private.prevLayout = ( params == null ? this._private.prevLayout : this.initLayout( params ) );

    layout.run();

    return this; // chaining
  },

  makeLayout: function( params ){
    return this.initLayout( params );
  },

  initLayout: function( options ){
    if( options == null ){
      util.error('Layout options must be specified to make a layout');
      return;
    }

    if( options.name == null ){
      util.error('A `name` must be specified to make a layout');
      return;
    }

    var name = options.name;
    var Layout = extension('layout', name);

    if( Layout == null ){
      util.error('Can not apply layout: No such layout `' + name + '` found; did you include its JS file?');
      return;
    }

    var eles;
    if( is.string( options.eles ) ){
      eles = this.$( options.eles );
    } else {
      eles = options.eles != null ? options.eles : this.$();
    }

    var layout = new Layout( util.extend({}, options, {
      cy: this,
      eles: eles
    }) );

    return layout;
  }

});

corefn.createLayout = corefn.makeLayout;

module.exports = corefn;
