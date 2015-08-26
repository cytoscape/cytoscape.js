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
  $$.styfn.getValueStyle = function( ele ){
    var rstyle = {};
    var style;
    var isEle = $$.is.element(ele);

    if( isEle ){
      style = ele._private.style;
    } else {
      style = ele; // just passed the style itself
    }

    if( style ){
      for( var i = 0; i < $$.style.properties.length; i++ ){
        var prop = $$.style.properties[i];
        var styleProp = style[ prop.name ] || style[ $$.util.dash2camel(prop.name) ];

        if( styleProp !== undefined ){ // then make a prop of it
          if( $$.is.plainObject( styleProp ) ){
            styleProp = this.parse( prop.name, styleProp.strValue );
          } else {
            styleProp = this.parse( prop.name, styleProp );
          }
        }

        if( styleProp ){
          rstyle[ prop.name ] = styleProp;
          rstyle[ $$.util.dash2camel(prop.name) ] = styleProp;
        }
      }
    }

    return rstyle;
  };

  $$.styfn.getPropsList = function( propsObj ){
    var rstyle = [];
    var style = propsObj;
    var props = $$.style.properties;

    if( style ){
      for( var name in style ){
        var val = style[name];
        var prop = props[name] || props[ $$.util.camel2dash(name) ];
        var styleProp = this.parse( prop.name, val );

        rstyle.push( styleProp );
      }
    }

    return rstyle;
  };

})( cytoscape );
