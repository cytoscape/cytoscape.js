;(function($$){ 'use strict';

  $$.fn.core({

    layout: function( params ){
      var layout;

      // always use a new layout w/ init opts; slightly different backwards compatibility
      // but fixes layout reuse issues like dagre #819
      if( params == null ){
        params = $$.util.extend({}, this._private.options.layout);
        params.eles = this.$();
      }

      layout = this.initLayout( params );
      layout.run();

      return this; // chaining
    },

    makeLayout: function( params ){
      return this.initLayout( params );
    },

    initLayout: function( options ){
      if( options == null ){
        $$.util.error('Layout options must be specified to make a layout');
        return;
      }

      if( options.name == null ){
        $$.util.error('A `name` must be specified to make a layout');
        return;
      }

      var name = options.name;
      var LayoutProto = $$.extension('layout', name);

      if( LayoutProto == null ){
        $$.util.error('Can not apply layout: No such layout `' + name + '` found; did you include its JS file?');
        return;
      }

      options.eles = options.eles != null ? options.eles : this.$();

      if( $$.is.string( options.eles ) ){
        options.eles = this.$( options.eles );
      }

      var layout = new LayoutProto( $$.util.extend({}, options, {
        cy: this
      }) );

      // make sure layout has _private for use w/ std apis like .on()
      if( !$$.is.plainObject(layout._private) ){
        layout._private = {};
      }

      layout._private.cy = this;
      layout._private.listeners = [];

      return layout;
    }

  });

  $$.corefn.createLayout = $$.corefn.makeLayout;

})( cytoscape );
