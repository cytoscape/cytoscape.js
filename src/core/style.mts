import * as is from '../is.mjs';
import Style from '../style/index.mjs';
import type { Style as StyleType, StyleCore } from '../style/index.mjs';
import type { StyleJsonBlock } from '../style/json.mjs';
import type { Core } from './core-types.mjs';
import type { CoreStyleAccess } from '../collection/eles-types.mjs';

// The public surface accepted by `style()`/`setStyle()`: a stylesheet
// object, a json block array, a css string, or nothing (=> default style).
interface Stylesheet { generateStyle( cy: StyleCore ): StyleType }

let corefn = ({

  style: function( this: Core, newStyle?: unknown ){
    if( newStyle ){
      let s = this.setStyle( newStyle );

      s.update();
    }

    return this._private.style as unknown as StyleType;
  },

  setStyle: function( this: Core, style?: unknown ){
    let _p = this._private;

    // the style engine (Style) is stored structurally as CoreStyleAccess
    if( is.stylesheet( style ) ){
      _p.style = ( style as Stylesheet ).generateStyle( this as unknown as StyleCore ) as unknown as CoreStyleAccess;

    } else if( is.array( style ) ){
      _p.style = Style.fromJson( this as unknown as StyleCore, style as unknown as StyleJsonBlock[] ) as unknown as CoreStyleAccess;

    } else if( is.string( style ) ){
      _p.style = Style.fromString( this as unknown as StyleCore, style ) as unknown as CoreStyleAccess;

    } else {
      _p.style = Style( this as unknown as StyleCore ) as unknown as CoreStyleAccess;
    }

    return _p.style as unknown as StyleType;
  },

  // e.g. cy.data() changed => recalc ele mappers
  updateStyle: function( this: Core ){
    this.mutableElements().updateStyle(); // just send to all eles
  }
}) as CoreStyle;

/** Style engine accessor methods contributed to the core prototype. */
export interface CoreStyle {
  style( this: Core, newStyle?: unknown ): StyleType;
  setStyle( this: Core, style?: unknown ): StyleType;
  updateStyle( this: Core ): void;
}

export default corefn as CoreStyle;
