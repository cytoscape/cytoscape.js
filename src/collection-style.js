;(function($$){ 'use strict';

  $$.fn.eles({

    // fully updates (recalculates) the style for the elements
    updateStyle: function( notifyRenderer ){
      var cy = this._private.cy;

      if( !cy.styleEnabled() ){ return this; }

      if( cy._private.batchingStyle ){
        var bEles = cy._private.batchStyleEles;

        for( var i = 0; i < this.length; i++ ){
          var ele = this[i];

          if( !bEles.ids[ ele._private.id ] ){
            bEles.push( ele );
          }
        }

        return this; // chaining and exit early when batching
      }

      var style = cy.style();
      notifyRenderer = notifyRenderer || notifyRenderer === undefined ? true : false;

      style.apply( this );

      var updatedCompounds = this.updateCompoundBounds();
      var toNotify = updatedCompounds.length > 0 ? this.add( updatedCompounds ) : this;

      if( notifyRenderer ){
        toNotify.rtrigger('style'); // let renderer know we changed style
      } else {
        toNotify.trigger('style'); // just fire the event
      }
      return this; // chaining
    },

    // just update the mappers in the elements' styles; cheaper than eles.updateStyle()
    updateMappers: function( notifyRenderer ){
      var cy = this._private.cy;
      var style = cy.style();
      notifyRenderer = notifyRenderer || notifyRenderer === undefined ? true : false;

      if( !cy.styleEnabled() ){ return this; }

      style.updateMappers( this );

      var updatedCompounds = this.updateCompoundBounds();
      var toNotify = updatedCompounds.length > 0 ? this.add( updatedCompounds ) : this;

      if( notifyRenderer ){
        toNotify.rtrigger('style'); // let renderer know we changed style
      } else {
        toNotify.trigger('style'); // just fire the event
      }
      return this; // chaining
    },

    // get the specified css property as a rendered value (i.e. on-screen value)
    // or get the whole rendered style if no property specified (NB doesn't allow setting)
    renderedCss: function( property ){
      var cy = this.cy();
      if( !cy.styleEnabled() ){ return this; }

      var ele = this[0];

      if( ele ){
        var renstyle = ele.cy().style().getRenderedStyle( ele );

        if( property === undefined ){
          return renstyle;
        } else {
          return renstyle[ property ];
        }
      }
    },

    // read the calculated css style of the element or override the style (via a bypass)
    css: function( name, value ){
      var cy = this.cy();

      if( !cy.styleEnabled() ){ return this; }

      var updateTransitions = false;
      var style = cy.style();

      if( $$.is.plainObject(name) ){ // then extend the bypass
        var props = name;
        style.applyBypass( this, props, updateTransitions );

        var updatedCompounds = this.updateCompoundBounds();
        var toNotify = updatedCompounds.length > 0 ? this.add( updatedCompounds ) : this;
        toNotify.rtrigger('style'); // let the renderer know we've updated style

      } else if( $$.is.string(name) ){

        if( value === undefined ){ // then get the property from the style
          var ele = this[0];

          if( ele ){
            return ele._private.style[ name ].strValue;
          } else { // empty collection => can't get any value
            return;
          }

        } else { // then set the bypass with the property value
          style.applyBypass( this, name, value, updateTransitions );

          var updatedCompounds = this.updateCompoundBounds();
          var toNotify = updatedCompounds.length > 0 ? this.add( updatedCompounds ) : this;
          toNotify.rtrigger('style'); // let the renderer know we've updated style
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

    removeCss: function( names ){
      var cy = this.cy();

      if( !cy.styleEnabled() ){ return this; }

      var updateTransitions = false;
      var style = cy.style();
      var eles = this;

      if( names === undefined ){
        for( var i = 0; i < eles.length; i++ ){
          var ele = eles[i];

          style.removeAllBypasses( ele, updateTransitions );
        }
      } else {
        names = names.split(/\s+/);

        for( var i = 0; i < eles.length; i++ ){
          var ele = eles[i];

          style.removeBypasses( ele, names, updateTransitions );
        }
      }

      var updatedCompounds = this.updateCompoundBounds();
      var toNotify = updatedCompounds.length > 0 ? this.add( updatedCompounds ) : this;
      toNotify.rtrigger('style'); // let the renderer know we've updated style

      return this; // chaining
    },

    show: function(){
      this.css('display', 'element');
      return this; // chaining
    },

    hide: function(){
      this.css('display', 'none');
      return this; // chaining
    },

    visible: function(){
      var cy = this.cy();
      if( !cy.styleEnabled() ){ return true; }

      var ele = this[0];
      var hasCompoundNodes = cy.hasCompoundNodes();

      if( ele ){
        var style = ele._private.style;

        if(
          style['visibility'].value !== 'visible'
          || style['display'].value !== 'element'
        ){
          return false;
        }

        if( ele._private.group === 'nodes' ){
          if( !hasCompoundNodes ){ return true; }

          var parents = ele._private.data.parent ? ele.parents() : null;

          if( parents ){
            for( var i = 0; i < parents.length; i++ ){
              var parent = parents[i];
              var pStyle = parent._private.style;
              var pVis = pStyle['visibility'].value;
              var pDis = pStyle['display'].value;

              if( pVis !== 'visible' || pDis !== 'element' ){
                return false;
              }
            }
          }

          return true;
        } else {
          var src = ele._private.source;
          var tgt = ele._private.target;

          return src.visible() && tgt.visible();
        }

      }
    },

    hidden: function(){
      var ele = this[0];

      if( ele ){
        return !ele.visible();
      }
    },

    effectiveOpacity: function(){
      var cy = this.cy();
      if( !cy.styleEnabled() ){ return 1; }

      var hasCompoundNodes = cy.hasCompoundNodes();
      var ele = this[0];

      if( ele ){
        var _p = ele._private;
        var parentOpacity = _p.style.opacity.value;

        if( !hasCompoundNodes ){ return parentOpacity; }

        var parents = !_p.data.parent ? null : ele.parents();

        if( parents ){
          for( var i = 0; i < parents.length; i++ ){
            var parent = parents[i];
            var opacity = parent._private.style.opacity.value;

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
          return ele._private.style.opacity.value === 0;
        } else {
          return ele.effectiveOpacity() === 0;
        }
      }
    },

    isFullAutoParent: function(){
      var cy = this.cy();
      if( !cy.styleEnabled() ){ return false; }

      var ele = this[0];

      if( ele ){
        var autoW = ele._private.style['width'].value === 'auto';
        var autoH = ele._private.style['height'].value === 'auto';

        return ele.isParent() && autoW && autoH;
      }
    },

    backgrounding: function(){
      var cy = this.cy();
      if( !cy.styleEnabled() ){ return false; }

      var ele = this[0];

      return ele._private.backgrounding ? true : false;
    }

  });


  $$.elesfn.bypass = $$.elesfn.style = $$.elesfn.css;
  $$.elesfn.renderedStyle = $$.elesfn.renderedCss;
  $$.elesfn.removeBypass = $$.elesfn.removeStyle = $$.elesfn.removeCss;

})( cytoscape );
