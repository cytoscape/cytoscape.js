import * as util from '../util/index.mjs';
import * as is from '../is.mjs';

import type { Style, StyleElement } from './index.mjs';
import type { ParsedStyleProperty, ParseResult } from './parse.mjs';

export interface GetForEleStyfn {
  getRenderedStyle( this: Style, ele: StyleElement, prop?: string ): string | Record<string, string> | null | undefined;
  getRawStyle( this: Style, ele: StyleElement, isRenderedVal?: boolean ): Record<string, string> | undefined;
  getIndexedStyle( this: Style, ele: StyleElement, property: string, subproperty: string, index: number ): unknown;
  getStylePropertyValue( this: Style, ele: StyleElement, propName: string, isRenderedVal?: boolean ): string | null | undefined;
  getAnimationStartStyle( this: Style, ele: StyleElement, aniProps: { name: string }[] ): Record<string, ParsedStyleProperty>;
  getPropsList( this: Style, propsObj: Record<string, unknown> | null | undefined ): ParsedStyleProperty[];
  getNonDefaultPropertiesHash( this: Style, ele: StyleElement, propNames: string[], seed: number[] ): number[];
  getPropertiesHash( this: Style, ele: StyleElement, propNames: string[], seed: number[] ): number[];
}

let styfn = {} as GetForEleStyfn;

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
  let self = this; // eslint-disable-line @typescript-eslint/no-this-alias

  ele = ele[0]; // insure it's an element

  if( ele ){
    let rstyle: Record<string, string> = {};

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
  let pstyle = ( ele.pstyle( property ) as unknown as Record<string, unknown[]> )[subproperty][index]; // index into a value/pfValue array
  return pstyle != null ? pstyle : ( ele.cy().style().getDefaultProperty( property ) as unknown as Record<string, unknown[]> )[subproperty][0];
};

styfn.getStylePropertyValue = function( ele, propName, isRenderedVal ){
  let self = this; // eslint-disable-line @typescript-eslint/no-this-alias

  ele = ele[0]; // insure it's an element

  if( ele ){
    let prop = self.properties[ propName ]!; // only called with valid property names

    if( prop.alias ){
      prop = prop.pointsTo!; // alias entries always point to a concrete property
    }

    let type = prop.type!;
    let styleProp = ele.pstyle( prop.name );

    if( styleProp ){
      let { value, units, strValue } = styleProp;

      if( isRenderedVal && type.number && value != null && is.number(value) ){
        let zoom = ele.cy().zoom();
        let getRenderedValue = ( val: number ) => val * zoom;
        let getValueStringWithUnits = ( val: number, units: string ) => getRenderedValue(val) + units;
        let isArrayValue = is.array(value);
        let haveUnits = isArrayValue ? ( units as ( string | undefined )[] ).every( u => u != null ) : units != null;

        if( haveUnits ){
          if( isArrayValue ){
            return ( value as unknown as number[] ).map( (v, i) => getValueStringWithUnits(v, ( units as string[] )[i]) ).join(' ');
          } else {
            return getValueStringWithUnits(value, units as string);
          }
        } else {
          if( isArrayValue ){
            return ( value as unknown as ( number | string )[] ).map( v => is.string(v) ? v : '' + getRenderedValue(v as number) ).join(' ');
          } else {
            return '' + getRenderedValue(value);
          }
        }
      } else if( strValue != null ){
        return strValue;
      }
    }

    return null;
  }
};

styfn.getAnimationStartStyle = function( ele, aniProps ){
  let rstyle: Record<string, ParsedStyleProperty> = {};

  for( let i = 0; i < aniProps.length; i++ ){
    let aniProp = aniProps[ i ];
    let name = aniProp.name;

    let styleProp: ParseResult = ele.pstyle( name );

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
  let self = this; // eslint-disable-line @typescript-eslint/no-this-alias
  let rstyle: ParsedStyleProperty[] = [];
  let style = propsObj;
  let props = self.properties;

  if( style ){
    let names = Object.keys( style );

    for( let i = 0; i < names.length; i++ ){
      let name = names[i];
      let val = style[ name ];
      let prop = props[ name ] || props[ util.camel2dash( name ) ];
      let styleProp = this.parse( prop!.name, val ); // an invalid name would throw at runtime, as before

      if( styleProp ){
        rstyle.push( styleProp );
      }
    }
  }

  return rstyle;
};

styfn.getNonDefaultPropertiesHash = function( ele, propNames, seed ){
  let hash = seed.slice();
  let name, val, strVal, chVal;
  let i, j;

  for( i = 0; i < propNames.length; i++ ){
    name = propNames[i];
    val = ele.pstyle( name, false );

    if( val == null ){
      continue;
    } else if( val.pfValue != null ){
      hash[0] = util.hashInt( chVal as number, hash[0] ); // NB chVal may be stale here, as in the original
      hash[1] = util.hashIntAlt( chVal as number, hash[1] );
    } else {
      strVal = val.strValue!;

      for( j = 0; j < strVal.length; j++ ){
        chVal = strVal.charCodeAt(j);
        hash[0] = util.hashInt( chVal, hash[0] );
        hash[1] = util.hashIntAlt( chVal, hash[1] );
      }
    }
  }

  return hash;
};

styfn.getPropertiesHash = styfn.getNonDefaultPropertiesHash;

export default styfn;
