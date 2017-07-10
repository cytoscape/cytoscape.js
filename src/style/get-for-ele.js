let util = require( '../util' );
let is = require( '../is' );

let styfn = {};

// gets the rendered style for an element
styfn.getRenderedStyle = function( ele, prop ){
  if( prop ){
    return this.getStylePropertyValue( ele, prop, true );
  } else {
    return this.getRawStyle( ele, true );
  }
};

// gets the raw style for an element
styfn.getRawStyle = function( ele, isRenderedVal ){
  let self = this;

  ele = ele[0]; // insure it's an element

  if( ele ){
    let rstyle = {};

    for( let i = 0; i < self.properties.length; i++ ){
      let prop = self.properties[ i ];
      let val = self.getStylePropertyValue( ele, prop.name, isRenderedVal );

      if( val != null ){
        rstyle[ prop.name ] = val;
        rstyle[ util.dash2camel( prop.name ) ] = val;
      }
    }

    return rstyle;
  }
};

styfn.getIndexedStyle = function( ele, property, subproperty, index ){
  let pstyle = ele.pstyle( property )[subproperty][index];
  return pstyle != null ? pstyle : ele.cy().style().getDefaultProperty( property )[subproperty][0];
};

styfn.getStylePropertyValue = function( ele, propName, isRenderedVal ){
  let self = this;

  ele = ele[0]; // insure it's an element

  if( ele ){
    let prop = self.properties[ propName ];

    if( prop.alias ){
      prop = prop.pointsTo;
    }

    let type = prop.type;
    let styleProp = ele.pstyle( prop.name );
    let zoom = ele.cy().zoom();

    if( styleProp ){
      let units = styleProp.units ? type.implicitUnits || 'px' : null;
      let val = units ? [].concat( styleProp.pfValue ).map( function( pfValue ){
        return ( pfValue * (isRenderedVal ? zoom : 1) ) + units;
      } ).join( ' ' ) : styleProp.strValue;

      return val;
    }
  }
};

styfn.getAnimationStartStyle = function( ele, aniProps ){
  let rstyle = {};

  for( let i = 0; i < aniProps.length; i++ ){
    let aniProp = aniProps[ i ];
    let name = aniProp.name;

    let styleProp = ele.pstyle( name );

    if( styleProp !== undefined ){ // then make a prop of it
      if( is.plainObject( styleProp ) ){
        styleProp = this.parse( name, styleProp.strValue );
      } else {
        styleProp = this.parse( name, styleProp );
      }
    }

    if( styleProp ){
      rstyle[ name ] = styleProp;
    }
  }

  return rstyle;
};

styfn.getPropsList = function( propsObj ){
  let self = this;
  let rstyle = [];
  let style = propsObj;
  let props = self.properties;

  if( style ){
    let names = Object.keys( style );

    for( let i = 0; i < names.length; i++ ){
      let name = names[i];
      let val = style[ name ];
      let prop = props[ name ] || props[ util.camel2dash( name ) ];
      let styleProp = this.parse( prop.name, val );

      if( styleProp ){
        rstyle.push( styleProp );
      }
    }
  }

  return rstyle;
};

module.exports = styfn;
