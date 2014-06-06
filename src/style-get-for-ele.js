;(function($$){ 'use strict';

  // gets the rendered style for an element
  $$.styfn.getRenderedStyle = function( ele ){
    var ele = ele[0]; // insure it's an element

    if( ele ){
      var rstyle = {};
      var style = ele._private.style;
      var cy = this._private.cy;
      var zoom = cy.zoom();

      for( var i = 0; i < $$.style.properties.length; i++ ){
        var prop = $$.style.properties[i];
        var styleProp = style[ prop.name ];

        if( styleProp ){
          var val = styleProp.unitless ? styleProp.strValue : (styleProp.pxValue * zoom) + 'px';
          rstyle[ prop.name ] = val;
          rstyle[ $$.util.dash2camel(prop.name) ] = val;
        }
      }

      return rstyle;
    }
  };

  // gets the raw style for an element
  $$.styfn.getRawStyle = function( ele ){
    var ele = ele[0]; // insure it's an element

    if( ele ){
      var rstyle = {};
      var style = ele._private.style;

      for( var i = 0; i < $$.style.properties.length; i++ ){
        var prop = $$.style.properties[i];
        var styleProp = style[ prop.name ];

        if( styleProp ){
          rstyle[ prop.name ] = styleProp.strValue;
          rstyle[ $$.util.dash2camel(prop.name) ] = styleProp.strValue;
        }
      }

      return rstyle;
    }
  };

  // gets the value style for an element (useful for things like animations)
  $$.styfn.getValueStyle = function( ele, opts ){
    opts = opts || {};

    var rstyle = opts.array ? [] : {}; 
    var style;

    if( $$.is.element(ele) ){
      style = ele._private.style;    
    } else {
      style = ele; // just passed the style itself
    }

    if( style ){
      for( var i = 0; i < $$.style.properties.length; i++ ){
        var prop = $$.style.properties[i];
        var styleProp = style[ prop.name ] || style[ $$.util.dash2camel(prop.name) ];

        if( styleProp !== undefined && !$$.is.plainObject( styleProp ) ){ // then make a prop of it
          styleProp = this.parse(prop.name, styleProp);
        }

        if( styleProp ){
          var val = styleProp.value === undefined ? styleProp : styleProp.value;

          if( opts.array ){
            rstyle.push( styleProp );
          } else {
            rstyle[ prop.name ] = styleProp;
            rstyle[ $$.util.dash2camel(prop.name) ] = styleProp;
          }
        }
      }
    }

    return rstyle;
  };

})( cytoscape );