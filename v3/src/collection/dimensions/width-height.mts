import * as util from '../../util/index.mjs';
import type { Element, SharedCollection } from '../eles-types.mjs';
import type { ParsedStyleProperty } from '../../style/parse.mjs';

/** Width/height/padding accessors contributed to the collection prototype. */
export interface CollectionWidthHeight {
  width( this: SharedCollection ): number | undefined;
  outerWidth( this: SharedCollection ): number | undefined;
  renderedWidth( this: SharedCollection ): number | undefined;
  renderedOuterWidth( this: SharedCollection ): number | undefined;
  height( this: SharedCollection ): number | undefined;
  outerHeight( this: SharedCollection ): number | undefined;
  renderedHeight( this: SharedCollection ): number | undefined;
  renderedOuterHeight( this: SharedCollection ): number | undefined;
  /** @internal */
  padding( this: SharedCollection ): number;
  /** @internal */
  paddedHeight( this: SharedCollection ): number;
  /** @internal */
  paddedWidth( this: SharedCollection ): number;
}

// internal options bag built up by defineDimFns
interface DimOpts {
  name: string;
  uppercaseName: string;
  autoName: string;
  labelName: string;
  outerName: string;
  uppercaseOuterName: string;
}

// indexable view of an element for the dynamically-named dimension methods
type DimEle = Element & {
  [name: string]: ( () => number | undefined ) | unknown;
};

let fn: Record<string, ( this: SharedCollection ) => number | undefined> = {};
let elesfn = fn as unknown as CollectionWidthHeight;

let defineDimFns = function( opts: { name: string } ): void {
  let o = opts as DimOpts;
  o.uppercaseName = util.capitalize( o.name );
  o.autoName = 'auto' + o.uppercaseName;
  o.labelName = 'label' + o.uppercaseName;
  o.outerName = 'outer' + o.uppercaseName;
  o.uppercaseOuterName = util.capitalize( o.outerName );

  fn[ o.name ] = function dimImpl( this: SharedCollection ){
    let ele = this[0];
    let _p = ele._private;
    let cy = _p.cy;
    let styleEnabled = cy._private.styleEnabled;

    if( ele ){
      if( styleEnabled ){
        if( ele.isParent() ){
          ele.updateCompoundBounds();

          return ( _p[ o.autoName ] as number ) || 0;
        }

        let d = ele.pstyle( o.name ) as ParsedStyleProperty;

        switch( d.strValue ){
          case 'label':
            ele.recalculateRenderedStyle();

            return ( _p.rstyle[ o.labelName ] as number ) || 0;

          default:
            return d.pfValue as number;
        }
      } else {
        return 1;
      }
    }
  };

  fn[ 'outer' + o.uppercaseName ] = function outerDimImpl( this: SharedCollection ){
    let ele = this[0] as DimEle;
    let _p = ele._private;
    let cy = _p.cy;
    let styleEnabled = cy._private.styleEnabled;

    if( ele ){
      if( styleEnabled ){
        let dim = ( ele[ o.name ] as () => number )();

        let borderPos = ( ele.pstyle( 'border-position' ) as ParsedStyleProperty ).value;

        let border;
        if(borderPos === 'center') {
          border = ( ele.pstyle( 'border-width' ) as ParsedStyleProperty ).pfValue as number; // n.b. 1/2 each side
        } else if(borderPos === 'outside') {
          border = 2 * ( ( ele.pstyle( 'border-width' ) as ParsedStyleProperty ).pfValue as number );
        } else { // 'inside'
          border = 0;
        }

        let padding = 2 * ele.padding();

        return dim + border + padding;
      } else {
        return 1;
      }
    }
  };

  fn[ 'rendered' + o.uppercaseName ] = function renderedDimImpl( this: SharedCollection ){
    let ele = this[0] as DimEle;

    if( ele ){
      let d = ( ele[ o.name ] as () => number )();
      return d * this.cy().zoom();
    }
  };

  fn[ 'rendered' + o.uppercaseOuterName ] = function renderedOuterDimImpl( this: SharedCollection ){
    let ele = this[0] as DimEle;

    if( ele ){
      let od = ( ele[ o.outerName ] as () => number )();
      return od * this.cy().zoom();
    }
  };
};

defineDimFns( {
  name: 'width'
} );

defineDimFns( {
  name: 'height'
} );

elesfn.padding = function( this: SharedCollection ){
  let ele = this[0];
  let _p = ele._private;
  if( ele.isParent() ){
    ele.updateCompoundBounds();

    if( _p.autoPadding !== undefined ){
      return _p.autoPadding;
    } else {
      return ( ele.pstyle('padding') as ParsedStyleProperty ).pfValue as number;
    }
  } else {
    return ( ele.pstyle('padding') as ParsedStyleProperty ).pfValue as number;
  }
};

elesfn.paddedHeight = function( this: SharedCollection ){
  let ele = this[0];

  return ( ele.height() as number ) + (2 * ele.padding());
};

elesfn.paddedWidth = function( this: SharedCollection ){
  let ele = this[0];

  return ( ele.width() as number ) + (2 * ele.padding());
};

export default elesfn as CollectionWidthHeight;
