import type { Style } from './index.mjs';

/** A JSON stylesheet block: a selector and its style properties. */
export interface StyleJsonBlock {
  selector: string;
  style?: Record<string, unknown>;
  css?: Record<string, unknown>;
}

export interface JsonStyfn {
  appendFromJson( this: Style, json: StyleJsonBlock[] ): Style;
  fromJson( this: Style, json: StyleJsonBlock[] ): Style;
  json( this: Style ): StyleJsonBlock[];
}

let styfn = {} as JsonStyfn;

styfn.appendFromJson = function( json ){
  let style = this; // eslint-disable-line @typescript-eslint/no-this-alias

  for( let i = 0; i < json.length; i++ ){
    let context = json[ i ];
    let selector = context.selector;
    let props = ( context.style || context.css )!; // one of style/css is always present
    let names = Object.keys( props );

    style.selector( selector ); // apply selector

    for( let j = 0; j < names.length; j++ ){
      let name = names[j];
      let value = props[ name ];

      style.css( name, value ); // apply property
    }
  }

  return style;
};

// accessible cy.style() function
styfn.fromJson = function( json ){
  let style = this; // eslint-disable-line @typescript-eslint/no-this-alias

  style.resetToDefault();
  style.appendFromJson( json );

  return style;
};

// get json from cy.style() api
styfn.json = function(){
  let json: StyleJsonBlock[] = [];

  for( let i = this.defaultLength; i < this.length; i++ ){
    let cxt = this[ i ];
    let selector = cxt.selector;
    let props = cxt.properties;
    let css: Record<string, unknown> = {};

    for( let j = 0; j < props.length; j++ ){
      let prop = props[ j ];
      css[ prop.name ] = prop.strValue;
    }

    json.push( {
      selector: !selector ? 'core' : selector.toString(),
      style: css
    } );
  }

  return json;
};

export default styfn;
