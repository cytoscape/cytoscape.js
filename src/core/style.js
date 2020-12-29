import * as is from '../is';
import Style from '../style';

let corefn = ({

    /**
   * @typedef {object} cy_style
   * @property {object} NULL
   * @property {object} stylesheet - Either a `cytoscape.stylesheet()` object, a string stylesheet, or a JSON stylesheet (the same formats accepted for [`options.style`](#style) at initialisation).
   */

    /**
   * Get the entry point to modify the visual style of the graph after initialisation.
   * @memberof cy
   * @path Core/Style
   * @param {...cy_style} newStyle - Get the current style object. | Assign a new stylesheet to replace the existing one.
   * @methodName cy.style
   */
  style: function( newStyle ){
    if( newStyle ){
      let s = this.setStyle( newStyle );

      s.update();
    }

    return this._private.style;
  },

  setStyle: function( style ){
    let _p = this._private;

    if( is.stylesheet( style ) ){
      _p.style = style.generateStyle( this );

    } else if( is.array( style ) ){
      _p.style = Style.fromJson( this, style );

    } else if( is.string( style ) ){
      _p.style = Style.fromString( this, style );

    } else {
      _p.style = Style( this );
    }

    return _p.style;
  }
});

export default corefn;
