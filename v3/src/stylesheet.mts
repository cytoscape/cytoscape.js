import * as is from './is.mjs';
import Style from './style/index.mjs';
import { dash2camel } from './util/index.mjs';
import type { Css } from './style/css-types.mjs';

export interface StylesheetProperty {
  name: string;
  value: unknown;
}

export interface StylesheetContext {
  selector: string;
  properties: StylesheetProperty[];
}

// the prototype surface of the dummy stylesheet
export interface Stylesheet {
  length: number;
  [index: number]: StylesheetContext;
  instanceString(): string;
  selector( selector: string ): Stylesheet;
  css( name: string | Css.Node | Css.Edge | Css.Core, value?: unknown ): Stylesheet;
  style( name: string | Css.Node | Css.Edge | Css.Core, value?: unknown ): Stylesheet;
  generateStyle( cy: unknown ): unknown;
  appendToStyle<S>( style: S ): S;
}

// callable with or without `new` (it guards internally), so it must stay a
// constructor function rather than become an ES class
export interface StylesheetStatic {
  ( this: unknown ): Stylesheet;
  new (): Stylesheet;
  prototype: Stylesheet;
}

// minimal structural view of a Style instance (refined when src/style is converted)
interface StyleLike {
  selector( selector: string ): unknown;
  css( name: string, value: unknown ): unknown;
}

// a dummy stylesheet object that doesn't need a reference to the core
// (useful for init)
// eslint-disable-next-line @typescript-eslint/no-redeclare -- intentional type/value pairing under one exported name
let Stylesheet = function( this: Stylesheet ){
  if( !(this instanceof Stylesheet) ){
    return new Stylesheet();
  }

  this.length = 0;
} as StylesheetStatic;

let sheetfn = Stylesheet.prototype;

sheetfn.instanceString = function(){
  return 'stylesheet';
};

// just store the selector to be parsed later
sheetfn.selector = function( selector ){
  let i = this.length++;

  this[ i ] = {
    selector: selector,
    properties: []
  };

  return this; // chaining
};

// just store the property to be parsed later
sheetfn.css = function( name, value ){
  let i = this.length - 1;

  if( is.string( name ) ){
    this[ i ].properties.push( {
      name: name,
      value: value
    } );
  } else if( is.plainObject( name ) ){
    let map = name;
    let propNames = Object.keys( map );

    for( let j = 0; j < propNames.length; j++ ){
      let key = propNames[ j ];
      let mapVal = map[ key ];

      if( mapVal == null ){ continue; }

      let styleProps = ( Style as unknown as { properties: Record<string, { name: string } | undefined> } ).properties;
      let prop = styleProps[key] || styleProps[dash2camel(key)];

      if( prop == null ){ continue; }

      let name = prop.name;
      let value = mapVal;

      this[ i ].properties.push( {
        name: name,
        value: value
      } );
    }
  }

  return this; // chaining
};

sheetfn.style = sheetfn.css;

// generate a real style object from the dummy stylesheet
sheetfn.generateStyle = function( cy ){
  let style = new ( Style as unknown as new ( cy: unknown ) => StyleLike )( cy );

  return this.appendToStyle( style );
};

// append a dummy stylesheet object on a real style object
sheetfn.appendToStyle = function<S>( style: S ){
  for( let i = 0; i < this.length; i++ ){
    let context = this[ i ];
    let selector = context.selector;
    let props = context.properties;

    let s = style as unknown as StyleLike;

    s.selector( selector ); // apply selector

    for( let j = 0; j < props.length; j++ ){
      let prop = props[ j ];

      s.css( prop.name, prop.value ); // apply property
    }
  }

  return style;
};

export default Stylesheet;
