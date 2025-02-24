import { getCornerRadius } from './webgl-util.mjs';
import { hashString } from '../../../../util/hash.mjs';


export const StyleProps = {
  NodeBody: {
    shape:   'shape',
    color:   'background-color',
    opacity: 'background-opacity',
    padding: 'padding'
  },
  Overlay: {
    shape:   'overlay-shape',
    color:   'overlay-color',
    opacity: 'overlay-opacity',
    padding: 'overlay-padding'
  },
  Underlay: {
    shape:   'underlay-shape',
    color:   'underlay-color',
    opacity: 'underlay-opacity',
    padding: 'underlay-padding'
  }
}


export class SimpleShapeHelper {

  constructor(r, props) {
    this.r = r;
    this.props = props;
  }

  getSimpleShape(node) {
    // TODO: Maybe should check the shape name first?
    const simple = (
      node.pstyle('background-fill').value === 'solid' &&
      node.pstyle('border-width').pfValue === 0 &&
      node.pstyle('background-image').strValue === 'none'
    );

    if(simple) {
      const shape = this.getShape(node);
      switch(shape) {
        case 'rectangle': 
        case 'ellipse': 
        case 'roundrectangle':
        case 'round-rectangle':
        case 'bottom-round-rectangle':
          return shape;
        default:
          return undefined;
      }
    }
    return undefined;
  }

  getColor(node) {
    const color   = node.pstyle(this.props.color).value;
    const opacity = node.pstyle(this.props.opacity).value;
    return { color, opacity };
  }

  getShape(node) {
    return node.pstyle(this.props.shape).value;
  }

  getPadding(node) {
    return node.pstyle(this.props.padding).pfValue;
  }

  isVisible(node) {
    return node.pstyle(this.props.opacity).value > 0; 
  }

  getStyleKey(node) { // don't use for node-body, just for overlay/underlay
    const w = node.width();
    const h = node.height();
    const radius = getCornerRadius(node, { w, h });
    const shape = this.getShape(node);
    const { color, opacity } = this.getColor(node);
    const c = colorCSS(color, opacity);
    return hashString(`${shape}-${w}-${h}-${c}-${radius}`); // TODO hack, not very efficient
  }


  // Fallback if overlay/underlay can't be rendered as a simple shape, for example if using color gradient.
  // Note: Drawing shapes in the fragment shader using SDFs. Should be able to support gradients and borders in the future.
  draw(context, node, bb) {
    if(!this.isVisible(node))
      return;

    const { r } = this;

    const w = bb.w;
    const h = bb.h;
    const x = w / 2;
    const y = h / 2;

    const radius = getCornerRadius(node, { w, h });
    const shape = this.getShape(node);
    const { color, opacity } = this.getColor(node);

    context.save();
    context.fillStyle = colorCSS(color, opacity);
    if(shape === 'round-rectangle' || shape === 'roundrectangle') {
      r.drawRoundRectanglePath(context, x, y, w, h, radius);
    } else if(shape === 'ellipse') {
      r.drawEllipsePath(context, x, y, w, h);
    }
    context.fill();
    context.restore();
  }

}


function colorCSS(color, opacity) {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${opacity})`;
}