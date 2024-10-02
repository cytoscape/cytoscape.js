import { hashString } from '../../../../util/hash'

const OVERLAY = 'overlay';
const UNDERLAY = 'underlay';

function fillStyle(color, opacity) {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${opacity})`;
}

export class OverlayUnderlayRenderer {

  constructor(r) {
    this.r = r;
  }

  getStyleKey(type, node) {
    const { shape, opacity, color } = this.getStyle(type, node);
    if(!shape)
      return null;
    return hashString(`${shape}-${fillStyle(color, opacity)}`); // TODO not very efficient
  }

  isVisible(type, node) {
    const opacity = node.pstyle(`${type}-opacity`).value;
    return opacity > 0;
  };

  getStyle(type, node) {
    const opacity = node.pstyle(`${type}-opacity`).value;
    const color   = node.pstyle(`${type}-color`).value;
    const shape   = node.pstyle(`${type}-shape`).value;
    return { opacity, color, shape }; // TODO need to add radius at some point
  };

  getPadding(type, node) {
    return node.pstyle(`${type}-padding`).pfValue;
  }

  draw(type, context, node, bb) {
    if(!this.isVisible(type, node))
      return;

    const { r } = this;
    const size = Math.max(bb.w, bb.h);
    const center = size / 2;
    
    const { shape, color, opacity } = this.getStyle(type, node);

    context.save();
    context.fillStyle = fillStyle(color, opacity);
    if(shape === 'round-rectangle' || shape === 'roundrectangle') {
      const radius = size * 0.15;
      r.drawRoundRectanglePath(context, center, center, size, size, radius);
    } else if(shape === 'ellipse') {
      r.drawEllipsePath(context, center, center, size, size);
    }
    context.fill();
    context.restore();
  }


}