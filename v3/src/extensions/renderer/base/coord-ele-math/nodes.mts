import { warn } from '../../../../util/index.mjs';
import type { Renderer, Element, Position } from '../../renderer-types.mjs';

// The shared `Element` type leaves the style/dimension mixin surface
// loosely typed (pstyle() may be null with an `unknown` value; width()
// etc. may be undefined). In renderer code these always resolve, so we
// view elements through a narrowed local contract. Internal only.
/* eslint-disable @typescript-eslint/no-explicit-any -- parsed style values are polymorphic */
interface PStyle { value: any; pfValue: any; strValue: string; units?: string | ( string | undefined )[] }
/* eslint-enable @typescript-eslint/no-explicit-any */
type REle = Omit<Element, 'pstyle' | 'width' | 'height' | 'outerWidth' | 'outerHeight' | 'position'> & {
  pstyle( prop: string ): PStyle;
  width(): number;
  height(): number;
  outerWidth(): number;
  outerHeight(): number;
  position(): Position;
};

let BRp: Record<string, unknown> = {};

const TOO_SMALL_CUT_RECT = 28;

let warnedCutRect = false;

BRp.getNodeShape = function( this: Renderer, node: REle ){
  let r = this; // eslint-disable-line @typescript-eslint/no-this-alias
  let shape = node.pstyle( 'shape' ).value;

  if( shape === 'cutrectangle' && (node.width() < TOO_SMALL_CUT_RECT || node.height() < TOO_SMALL_CUT_RECT) ){
    if( !warnedCutRect ){
      warn('The `cutrectangle` node shape can not be used at small sizes so `rectangle` is used instead');

      warnedCutRect = true;
    }

    return 'rectangle';
  }

  if( node.isParent() ){
    if( shape === 'rectangle'
    || shape === 'roundrectangle'
    || shape === 'round-rectangle'
    || shape === 'cutrectangle'
    || shape === 'cut-rectangle'
    || shape === 'barrel' ){
      return shape;
    } else {
      return 'rectangle';
    }
  }

  if( shape === 'polygon' ){
    let points = node.pstyle( 'shape-polygon-points' ).value;

    return r.nodeShapes.makePolygon( points ).name;
  }

  return shape;
};

export default BRp;
