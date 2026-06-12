import * as util from '../util/index.mjs';
import type { Core, RendererInstance } from './core-types.mjs';
import type { Element } from '../collection/eles-types.mjs';

let rendererDefaults = util.defaults({
  hideEdgesOnViewport: false,
  textureOnViewport: false,
  motionBlur: false,
  motionBlurOpacity: 0.05,
  pixelRatio: undefined,
  desktopTapThreshold: 4,
  touchTapThreshold: 8,
  wheelSensitivity: 1,
  debug: false,
  showFps: false,

  // webgl options
  webgl: false,
  webglDebug: false,
  webglDebugShowAtlases: false,
  // defaults good for mobile
  webglTexSize: 2048,
  webglTexRows: 36,
  webglTexRowsNodes: 18,
  webglBatchSize: 2048,
  webglTexPerBatch: 14,
  webglBgColor: [255, 255, 255]
});

/** Options accepted by `initRenderer()`. */
interface RendererInitOptions {
  name?: string;
  wheelSensitivity?: number;
  [key: string]: unknown;
}

/** A registered renderer extension constructor. */
type RendererConstructor = new ( options: Record<string, unknown> ) => RendererInstance;

// TODO(core-types): cy.extension() is added to the prototype in extension.mjs
// and is not declared on the Core interface yet; cast locally to read it.
interface CoreWithExtension {
  extension( type: string, name: string ): RendererConstructor | null | undefined;
}

export interface CoreRenderer {
  /** @internal */
  renderTo( context: CanvasRenderingContext2D, zoom?: number, pan?: { x: number; y: number }, pxRatio?: number ): Core;
  /** @internal */
  renderer(): RendererInstance | null;
  /** @internal */
  forceRender(): Core;
  resize(): Core;
  invalidateDimensions(): Core;
  /** @internal */
  initRenderer( options: RendererInitOptions ): void;
  /** @internal */
  destroyRenderer(): void;
  /** @internal */
  onRender( fn: ( ...args: unknown[] ) => void ): Core;
  /** @internal */
  offRender( fn: ( ...args: unknown[] ) => void ): Core;
}

let corefn = ({

  renderTo: function( this: Core, context: CanvasRenderingContext2D, zoom?: number, pan?: { x: number; y: number }, pxRatio?: number ){
    let r = this._private.renderer;

    ( r!.renderTo as ( context: CanvasRenderingContext2D, zoom?: number, pan?: { x: number; y: number }, pxRatio?: number ) => void )( context, zoom, pan, pxRatio );
    return this;
  },

  renderer: function( this: Core ){
    return this._private.renderer;
  },

  forceRender: function( this: Core ){
    this.notify('draw');

    return this;
  },

  resize: function( this: Core ){
    this.invalidateSize();

    this.emitAndNotify('resize');

    return this;
  },

  initRenderer: function( this: Core, options: RendererInitOptions ){
    let cy = this; // eslint-disable-line @typescript-eslint/no-this-alias

    let RendererProto = ( cy as unknown as CoreWithExtension ).extension( 'renderer', options.name! );
    if( RendererProto == null ){
      util.error( `Can not initialise: No such renderer \`${options.name}\` found. Did you forget to import it and \`cytoscape.use()\` it?` );
      return;
    }

    if( options.wheelSensitivity !== undefined ){
      util.warn(`You have set a custom wheel sensitivity.  This will make your app zoom unnaturally when using mainstream mice.  You should change this value from the default only if you can guarantee that all your users will use the same hardware and OS configuration as your current machine.`);
    }

    let rOpts = rendererDefaults(options) as Record<string, unknown>;

    rOpts.cy = cy;

    cy._private.renderer = new RendererProto( rOpts );

    this.notify('init');
  },

  destroyRenderer: function( this: Core ){
    let cy = this; // eslint-disable-line @typescript-eslint/no-this-alias

    cy.notify('destroy'); // destroy the renderer

    let domEle = cy.container() as ( HTMLElement & { _cyreg?: unknown } ) | null;
    if( domEle ){
      domEle._cyreg = null;

      while( domEle.childNodes.length > 0 ){
        domEle.removeChild( domEle.childNodes[0] );
      }
    }

    cy._private.renderer = null; // to be extra safe, remove the ref
    cy.mutableElements().forEach(function( ele: Element ){
      let _p = ele._private;
      _p.rscratch = {};
      _p.rstyle = {};
      _p.animation.current = [];
      _p.animation.queue = [];
    });
  },

  onRender: function( this: Core, fn: ( ...args: unknown[] ) => void ){
    return this.on('render', fn);
  },

  offRender: function( this: Core, fn: ( ...args: unknown[] ) => void ){
    return this.off('render', fn);
  }

}) as Record<string, unknown>;

corefn.invalidateDimensions = corefn.resize;

export default corefn as unknown as CoreRenderer;
