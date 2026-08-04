import type { Renderer } from '../renderer-types.mjs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- internal node-shape mixin object assembled onto the renderer prototype
let CRp: any = {};

CRp.nodeShapeImpl = function( this: Renderer, name: string, context: CanvasRenderingContext2D, centerX: number, centerY: number, width: number, height: number, points: number[], corners: unknown ){
  switch( name ){
    case 'ellipse':
      return this.drawEllipsePath( context, centerX, centerY, width, height );
    case 'polygon':
      return this.drawPolygonPath( context, centerX, centerY, width, height, points );
    case 'round-polygon':
      return this.drawRoundPolygonPath(context, centerX, centerY, width, height, points, corners );
    case 'roundrectangle':
    case 'round-rectangle':
      return this.drawRoundRectanglePath( context, centerX, centerY, width, height, corners );
    case 'cutrectangle':
    case 'cut-rectangle':
      return this.drawCutRectanglePath( context, centerX, centerY, width, height, points, corners );
    case 'bottomroundrectangle':
    case 'bottom-round-rectangle':
      return this.drawBottomRoundRectanglePath( context, centerX, centerY, width, height, corners );
    case 'barrel':
      return this.drawBarrelPath( context, centerX, centerY, width, height );
  }
};

export default CRp;
