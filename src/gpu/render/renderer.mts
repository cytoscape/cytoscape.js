import { initGpuContext } from '../gpu-context.mjs';
import { ColumnMirror } from './column-mirror.mjs';
import { pickNodeAt } from './cpu-pick.mjs';
import { CulledGroup, CullKernels } from './cull.mjs';
import { DEPTH_FORMAT, NodePipeline } from './node-pipeline.mjs';
import { EdgePipeline } from './edge-pipeline.mjs';
import { CurvedEdgePipeline } from './curved-edge-pipeline.mjs';
import { CurvedArrowPipeline } from './curved-arrow-pipeline.mjs';
import { CURVE_SEGS } from '../curve-geometry.mjs';
import { ArrowPipeline } from './arrow-pipeline.mjs';
import { EDGE_PICK_BIT, PICK_TILE, Picking } from './picking.mjs';
import { GpuTimer } from './gpu-timer.mjs';
import { LabelLayer } from './label-layer.mjs';
import { LabelPipeline } from './label-pipeline.mjs';
import { GLYPH_BYTES } from './glyph-buffer.mjs';
import { MapperRuntime } from './mapper-runtime.mjs';
import { GpuTweenRuntime } from './gpu-tween.mjs';
import { ScaleController } from './scale-controller.mjs';
import { Upscaler } from './upscale.mjs';
import { BUFFER_USAGE, MAP_MODE, TEXTURE_USAGE } from './webgpu-constants.mjs';
import { FLAG_ALIVE } from '../contract.mjs';
import { color2tuple } from '../../util/colors.mjs';
import type { GpuCore } from '../core.mjs';
import type { GpuCollection } from '../collection.mjs';
import type { GpuExportOptions, GpuRendererOptions } from '../gpu-types.mjs';

/*
The frame graph: a render-on-dirty rAF loop.

A frame is scheduled when the store invalidates (dirty columns), on any
viewport event, on resize, or when a pick is pending; nothing renders while
clean.  Order within a frame: sync dirty spans to the GPU mirror → rebuild
dirty label glyph runs → if a pick is pending, encode + submit (in its own
command buffer, so its readback maps as soon as it executes) the pick cull
compute pass + the cursor-tile pick pass → if anything changed visually,
write the Frame uniform and encode the scene cull compute pass (compacting
each group's visible slots + indirect draw args) followed by the scene
render pass (edges then nodes then labels, all indirect, no depth buffer).
Pick-only frames skip the scene work entirely, so hover picking over a
static graph costs O(cursor region) per tick.  Frames before `.ready`
resolves are no-ops; readiness triggers the first frame.  An external
device loss is handed to the core (`onDeviceLost`), which recovers by
re-mounting a fresh renderer; without that hook the instance goes dead
with an `error` event.
*/

/** raw straight-alpha RGBA pixels of a finished export */
export interface ExportedImage {
  data: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
}

/** resolved export viewport: output px dimensions + the Frame transform */
interface ExportView {
  wPx: number;
  hPx: number;
  panX: number;
  panY: number;
  zoom: number;
  /** [r, g, b] 0..255 + alpha 0..1, or null for transparent */
  bg: [ number, number, number, number ] | null;
}

interface ExportJob {
  view: ExportView;
  resolve: ( image: ExportedImage ) => void;
  reject: ( err: Error ) => void;
}

/** the culled instance streams a full scene draw needs */
interface SceneCullGroups {
  node: CulledGroup;
  edge: CulledGroup;
  curved: CulledGroup;
  glyph: CulledGroup;
  edgeGlyph: CulledGroup;
  ghost: CulledGroup;
}

interface RendererStats {
  frames: number;
  /** CPU cost of building + submitting the last frame (encoding is fire-and-forget) */
  cpuFrameMs: number;
  /** GPU execution time of the last measured scene pass; 0 when 'timestamp-query' is unavailable */
  gpuFrameMs: number;
  /** current adaptive render scale (fraction of native resolution) */
  renderScale: number;
  uploadedBytes: number;
  nodes: number;
  edges: number;
  glyphs: number;
  pickLatencyMs: number;
  /** data bytes uploaded for GPU mapper evaluation (paint-channel restyles) */
  mapperUploadedBytes: number;
  /** mapper eval dispatches encoded */
  mapperDispatches: number;
}

const DEFAULT_EDGE_WIDTH_FLOOR = 1; // device px
const DEFAULT_NODE_LOD_PX = 3;
const DEFAULT_HIDE_PX = 1;
const DEFAULT_LABEL_FADE_PX = 6;
const DEFAULT_LABEL_MIN_PX = 0; // 0 = no hard label cutoff
const DEFAULT_RENDER_SCALE_MIN = 0.5;
const DEFAULT_RENDER_SCALE_MAX = 1;
/** after this long without redraws, re-render one frame at max scale */
const SETTLE_TO_MAX_MS = 250;

const EMPTY_DELTA = {
  resized: { nodes: false, edges: false },
  spans: [] as { column: never; start: number; end: number }[]
};

/** columns whose changes never affect pick coverage (keep the pick cache) */
const PICK_NEUTRAL_COLUMNS = new Set( [
  'node.fillColor', 'node.borderColor', 'node.borderWidth', 'node.opacity',
  'edge.lineColor', 'edge.opacity',
  // arrows are never pickable, and the pick pass draws edges only
  'edge.sourceArrow', 'edge.targetArrow'
] );

/**
 * Backpressure: at most this many scene submissions may be unfinished on
 * the GPU.  Without the cap, a GPU-bound graph accumulates an unbounded
 * queue of ~frame-sized submissions and every pick readback (and the
 * visible viewport itself) falls further and further behind; with it, a
 * behind GPU makes the loop skip encoding and coalesce viewport/model
 * state into the next frame instead.
 */
const MAX_IN_FLIGHT_FRAMES = 2;

/** v3 semantics: maxWidth/maxHeight override scale; else scale (default 1). */
const exportScale = ( w: number, h: number, opts: GpuExportOptions ): number => {
  const { maxWidth, maxHeight } = opts;
  let scale = opts.scale ?? 1;

  if( maxWidth != null || maxHeight != null ){
    const scaleW = maxWidth != null ? maxWidth / w : Infinity;
    const scaleH = maxHeight != null ? maxHeight / h : Infinity;

    scale = Math.min( scaleW, scaleH );
  }

  if( typeof scale !== 'number' || !isFinite( scale ) || scale <= 0 ){
    throw new Error( `Invalid image export scale ${String( scale )}` );
  }

  return scale;
};

export class Renderer {
  /** resolves when the device is acquired and the first frame can draw */
  ready: Promise<void>;
  canvas: HTMLCanvasElement;

  protected cy: GpuCore;
  protected device: GPUDevice | null;
  protected mirror: ColumnMirror | null;
  protected dpr: number;
  protected destroyed: boolean;

  private container: HTMLElement;
  private opts: GpuRendererOptions;
  private context: GPUCanvasContext | null;
  private nodePipeline: NodePipeline | null;
  private edgePipeline: EdgePipeline | null;
  private curvedEdgePipeline: CurvedEdgePipeline | null;
  private curvedArrowPipeline: CurvedArrowPipeline | null;
  private arrowPipeline: ArrowPipeline | null;
  private uniform: GPUBuffer | null;
  private frameData: Float32Array;
  private isReady: boolean;
  private frameRequested: boolean;
  private resizeObserver: ResizeObserver | null;
  private offInvalidate: () => void;
  private onViewport: () => void;
  private frameCount: number;
  private cpuFrameMs: number;
  private gpuTimer: GpuTimer | null;
  private picking: Picking | null;
  private pickUniform: GPUBuffer | null;
  private pickFrameData: Float32Array;
  private needsRedraw: boolean;
  private inFlightFrames: number;
  private labelLayer: LabelLayer | null;
  private onFontsLoadingDone: ( () => void ) | null = null;
  /** wired by the factory: an external device loss hands recovery to the core */
  onDeviceLost: ( ( message: string ) => void ) | null = null;
  private labelPipeline: LabelPipeline | null;
  private edgeLabelPipeline: LabelPipeline | null;
  private cullKernels: CullKernels | null;
  private mapperRuntime: MapperRuntime | null;
  private tweenRuntime: GpuTweenRuntime | null;
  private sceneCull: SceneCullGroups | null;
  private pickCull: { edge: CulledGroup; curved: CulledGroup } | null;
  private scaleCtl: ScaleController;
  private settleTimer: ReturnType<typeof setTimeout> | null;
  private format: GPUTextureFormat | null;
  private sceneTarget: GPUTexture | null;
  private depthTarget: GPUTexture | null;
  private upscaler: Upscaler | null;
  private pendingExports: ExportJob[];
  private exportUniform: GPUBuffer | null;
  private exportFrameData: Float32Array;
  private exportCull: SceneCullGroups | null;

  constructor( cy: GpuCore, container: HTMLElement, opts: GpuRendererOptions & { pixelRatio?: number | 'auto' } = {} ){
    this.cy = cy;
    this.container = container;
    this.opts = opts;
    this.device = null;
    this.context = null;
    this.mirror = null;
    this.nodePipeline = null;
    this.edgePipeline = null;
    this.curvedEdgePipeline = null;
    this.curvedArrowPipeline = null;
    this.arrowPipeline = null;
    this.uniform = null;
    this.frameData = new Float32Array( 16 );
    this.isReady = false;
    this.frameRequested = false;
    this.destroyed = false;
    this.frameCount = 0;
    this.cpuFrameMs = 0;
    this.gpuTimer = null;
    this.picking = null;
    this.pickUniform = null;
    this.pickFrameData = new Float32Array( 16 );
    this.needsRedraw = true;
    this.inFlightFrames = 0;
    this.labelLayer = null;
    this.labelPipeline = null;
    this.edgeLabelPipeline = null;
    this.cullKernels = null;
    this.mapperRuntime = null;
    this.tweenRuntime = null;
    this.sceneCull = null;
    this.pickCull = null;
    this.scaleCtl = new ScaleController(
      opts.renderScaleMin ?? DEFAULT_RENDER_SCALE_MIN,
      opts.renderScaleMax ?? DEFAULT_RENDER_SCALE_MAX
    );
    this.settleTimer = null;
    this.format = null;
    this.sceneTarget = null;
    this.depthTarget = null;
    this.upscaler = null;
    this.pendingExports = [];
    this.exportUniform = null;
    this.exportFrameData = new Float32Array( 16 );
    this.exportCull = null;

    // re-raster glyph runs when web fonts finish loading: glyphs cached
    // before a FontFace resolves were rasterized from the fallback face
    if( typeof document !== 'undefined' && document.fonts?.addEventListener != null ){
      this.onFontsLoadingDone = () => {
        if( this.destroyed || this.labelLayer == null ){ return; }

        this.labelLayer.reraster();
        this.requestRender();
      };
      document.fonts.addEventListener( 'loadingdone', this.onFontsLoadingDone );
    }

    this.dpr = opts.pixelRatio == null || opts.pixelRatio === 'auto'
      ? ( globalThis.devicePixelRatio || 1 )
      : opts.pixelRatio;

    const doc = container.ownerDocument as Document;

    this.canvas = doc.createElement( 'canvas' );
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';

    if( doc.defaultView != null && doc.defaultView.getComputedStyle( container ).position === 'static' ){
      container.style.position = 'relative';
    }

    container.appendChild( this.canvas );
    this.applySize();

    this.offInvalidate = cy._store.onInvalidate( () => {
      this.needsRedraw = true;
      this.schedule();
    } );
    this.onViewport = () => {
      this.needsRedraw = true;
      this.picking?.invalidateCache(); // cached pick tile is in device px
      this.schedule();
    };
    cy.on( 'viewport', this.onViewport );

    this.resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver( () => this.resize() )
      : null;
    this.resizeObserver?.observe( container );

    this.ready = this.init();
  }

  stats(): RendererStats {
    return {
      frames: this.frameCount,
      cpuFrameMs: this.cpuFrameMs,
      gpuFrameMs: this.gpuTimer?.lastMs ?? 0,
      renderScale: this.scaleCtl.scale,
      uploadedBytes: ( this.mirror?.uploadedBytes ?? 0 ) + ( this.labelLayer?.uploadedBytes() ?? 0 ),
      nodes: this.cy._store.count( 'nodes' ),
      edges: this.cy._store.count( 'edges' ),
      glyphs: this.labelLayer?.count() ?? 0,
      pickLatencyMs: this.pickLatencyMs(),
      mapperUploadedBytes: this.mapperRuntime?.uploadedBytes ?? 0,
      mapperDispatches: this.mapperRuntime?.dispatches ?? 0
    };
  }

  resize(): void {
    if( this.destroyed ){ return; }

    this.applySize();
    this.needsRedraw = true;
    this.schedule();
  }

  /** Force a redraw on the next frame (the loop is otherwise render-on-dirty). */
  requestRender(): void {
    if( this.destroyed ){ return; }

    this.needsRedraw = true;
    this.schedule();
  }

  /** Test hook: destroy the device out from under the renderer (a real loss). */
  _debugLoseDevice(): void {
    this.device?.destroy();
  }

  destroy(): void {
    if( this.destroyed ){ return; }

    this.destroyed = true;

    if( this.settleTimer != null ){
      clearTimeout( this.settleTimer );
      this.settleTimer = null;
    }

    this.resizeObserver?.disconnect();
    this.offInvalidate();
    this.cy.off( 'viewport', this.onViewport );

    if( this.onFontsLoadingDone != null ){
      document.fonts.removeEventListener( 'loadingdone', this.onFontsLoadingDone );
      this.onFontsLoadingDone = null;
    }
    this.picking?.destroy();
    this.gpuTimer?.destroy();
    this.labelLayer?.destroy();

    for( const group of [
      ...Object.values( this.sceneCull ?? {} ), ...Object.values( this.pickCull ?? {} ),
      ...Object.values( this.exportCull ?? {} )
    ] ){
      group.destroy();
    }

    for( const job of this.pendingExports ){
      job.reject( new Error( 'The renderer was destroyed before the image export completed' ) );
    }

    this.pendingExports = [];

    this.upscaler?.destroy();
    this.sceneTarget?.destroy();
    this.depthTarget?.destroy();
    this.cy._animations.detachDriver();
    this.mapperRuntime?.destroy();
    this.tweenRuntime?.destroy();
    this.mirror?.destroy();
    this.uniform?.destroy();
    this.pickUniform?.destroy();
    this.exportUniform?.destroy();
    this.device?.destroy();
    this.canvas.remove();
  }

  // -- picking --

  /**
   * Pick at a rendered (CSS px) position.  Resolves with the element under
   * the point, or null for background/unknown.  Three stages, cheapest
   * first:
   *
   * 1. nodes: synchronous CPU pick — exact, zero GPU work, answers in the
   *    same microtask (nodes draw over edges, so a node hit shadows them);
   * 2. the cached pick tile: while the cursor stays inside the last GPU
   *    tile and nothing invalidated it, edge/background answers are
   *    instant;
   * 3. GPU edge pick: draws only the cursor tile, submits ahead of scene
   *    work, so latency is ~one rAF plus bounded in-flight GPU work
   *    (latest-wins coalescing; requests never queue up).
   */
  async pick( x: number, y: number ): Promise<GpuCollection | null> {
    if( this.destroyed || !this.isReady || this.picking == null ){ return null; }

    const xPx = x * this.dpr;
    const yPx = y * this.dpr;

    const nodeSlot = this.cpuPickNode( xPx, yPx );

    if( nodeSlot != null ){ return this.cy._ele( 'nodes', nodeSlot ); }

    const cached = this.picking.cachedIdAt( xPx, yPx );

    if( cached != null ){ return this.decodePick( cached ); }

    const promise = this.picking.request( xPx, yPx );

    this.schedule(); // the pick pass runs with the next frame

    return this.decodePick( await promise );
  }

  /**
   * Synchronous CPU node pick at a rendered (CSS px) position — exact and
   * current (no in-flight staleness).  Edges are not considered; they
   * resolve through the async `pick()`.
   */
  pickNodeSync( x: number, y: number ): GpuCollection | null {
    if( this.destroyed || !this.isReady ){ return null; }

    const slot = this.cpuPickNode( x * this.dpr, y * this.dpr );

    return slot == null ? null : this.cy._ele( 'nodes', slot );
  }

  private cpuPickNode( xPx: number, yPx: number ): number | null {
    const viewport = this.cy._viewport;
    const pan = viewport.pan();
    const opts = this.opts;

    // same view state as writePickUniform: native device px, no renderScale
    return pickNodeAt( this.cy._store, {
      panXPx: pan.x * this.dpr,
      panYPx: pan.y * this.dpr,
      zoomDpr: viewport.zoom() * this.dpr,
      hidePx: opts.hidePx ?? DEFAULT_HIDE_PX,
      nodeLodPx: opts.nodeLodPx ?? DEFAULT_NODE_LOD_PX
    }, xPx, yPx );
  }

  private decodePick( id: number | null ): GpuCollection | null {
    if( id == null || id === 0 ){ return null; }

    const isEdge = ( id & EDGE_PICK_BIT ) !== 0;
    const group = isEdge ? 'edges' : 'nodes';
    const slot = ( isEdge ? ( id & ~EDGE_PICK_BIT ) : id ) - 1;
    const store = this.cy._store;

    // the pick may be up to 2 frames stale: re-validate against the model
    if( slot >= store.highWater( group ) || !store.hasFlag( group, slot, FLAG_ALIVE ) ){
      return null;
    }

    return this.cy._ele( group, slot );
  }

  private pickLatencyMs(): number {
    return this.picking?.lastLatencyMs ?? 0;
  }

  // -- image export --

  /**
   * Render the scene into an offscreen texture at the requested viewport
   * (the on-screen one, or the whole graph with `full`) and read the
   * pixels back.  Resolves with straight-alpha RGBA rows (no padding).
   *
   * The export is encoded inside the frame loop, after any pending scene
   * work for that frame, so it sees exactly the state the screen shows —
   * including GPU-owned columns mid-animation.  It always renders at
   * native resolution (the adaptive render scale never applies) and label
   * LOD thresholds evaluate at the *export* scale, so a full/high-scale
   * export is a self-consistent figure rather than a copy of the screen's
   * label culling.
   */
  async exportImage( opts: GpuExportOptions = {} ): Promise<ExportedImage> {
    await this.ready;

    if( this.destroyed || this.device == null ){
      throw new Error( 'Cannot export an image: the renderer is destroyed' );
    }

    const view = this.computeExportView( opts );

    return new Promise( ( resolve, reject ) => {
      this.pendingExports.push( { view, resolve, reject } );
      this.schedule();
    } );
  }

  /** Resolve the export options to output dimensions + Frame transform. */
  private computeExportView( opts: GpuExportOptions ): ExportView {
    const device = this.device as GPUDevice;
    let bg: ExportView['bg'] = null;

    if( opts.bg != null ){
      const tuple = color2tuple( opts.bg );

      if( tuple == null ){
        throw new Error( `The value '${String( opts.bg )}' is not a valid colour for 'bg'` );
      }

      bg = [ tuple[0], tuple[1], tuple[2], tuple[3] ?? 1 ];
    }

    let w: number, h: number, panX: number, panY: number, zoom: number;

    if( opts.full === true ){
      const bb = this.cy._store.boundingBox();

      if( bb == null ){
        throw new Error( 'Cannot export a full-graph image of an empty graph' );
      }

      const scale = exportScale( bb.w, bb.h, opts );

      w = bb.w * scale;
      h = bb.h * scale;
      panX = -bb.x1 * scale;
      panY = -bb.y1 * scale;
      zoom = scale;
    } else {
      const cw = this.container.clientWidth;
      const ch = this.container.clientHeight;

      if( cw === 0 || ch === 0 ){
        throw new Error( 'Cannot export the viewport of a zero-sized container' );
      }

      const scale = exportScale( cw, ch, opts );
      const viewport = this.cy._viewport;
      const pan = viewport.pan();

      w = cw * scale;
      h = ch * scale;
      panX = pan.x * scale;
      panY = pan.y * scale;
      zoom = viewport.zoom() * scale;
    }

    const wPx = Math.max( 1, Math.round( w ) );
    const hPx = Math.max( 1, Math.round( h ) );
    const limit = device.limits.maxTextureDimension2D;

    if( wPx > limit || hPx > limit ){
      throw new Error(
        `The export dimensions ${wPx}×${hPx} exceed the device's ${limit}px texture limit; ` +
        `use maxWidth/maxHeight or a smaller scale`
      );
    }

    return { wPx, hPx, panX, panY, zoom, bg };
  }

  /** The export Frame uniform: output px viewport, dpr-free transform,
   * LOD thresholds in export px (see exportImage). */
  private writeExportUniform( view: ExportView ): void {
    const device = this.device as GPUDevice;
    const opts = this.opts;
    const f = this.exportFrameData;

    if( this.exportUniform == null ){
      this.exportUniform = device.createBuffer( {
        label: 'cy-gpu:export-frame-uniform',
        size: f.byteLength,
        usage: BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST
      } );
    }

    f[0] = view.wPx;
    f[1] = view.hPx;
    f[2] = view.panX;
    f[3] = view.panY;
    f[4] = view.zoom;
    f[5] = opts.edgeWidthFloor ?? DEFAULT_EDGE_WIDTH_FLOOR;
    f[6] = opts.nodeLodPx ?? DEFAULT_NODE_LOD_PX;
    f[7] = opts.hidePx ?? DEFAULT_HIDE_PX;
    f[8] = opts.edgeDimming ? Math.min( 0.85, Math.max( 0, 1 - view.zoom ) * 0.85 ) : 0;
    f[9] = opts.labelFadePx ?? DEFAULT_LABEL_FADE_PX;
    f[10] = opts.labelMinPx ?? DEFAULT_LABEL_MIN_PX;
    f[11] = this.cy._store.curveSlack();
    f[12] = this.cy._store.haystackSlack();

    device.queue.writeBuffer( this.exportUniform, 0, f.buffer, f.byteOffset, f.byteLength );
  }

  /**
   * Encode + submit one export: cull against the export uniform, draw the
   * scene into a transient offscreen target, copy to a staging buffer.
   * Synchronous up to the submit (so per-job uniform writes order
   * correctly against per-job submits); the readback resolves async.
   */
  private renderExport( job: ExportJob ): void {
    const device = this.device as GPUDevice;
    const { wPx, hPx, bg } = job.view;

    try {
      this.writeExportUniform( job.view );

      if( this.exportCull == null ){
        const kernels = this.cullKernels as CullKernels;

        this.exportCull = {
          node: new CulledGroup( kernels, 'node', 'export-node' ),
          edge: new CulledGroup( kernels, 'edge', 'export-edge' ),
          curved: new CulledGroup( kernels, 'curvedEdge', 'export-curved-edge', 6 * CURVE_SEGS ),
          glyph: new CulledGroup( kernels, 'glyph', 'export-glyph' ),
          edgeGlyph: new CulledGroup( kernels, 'edgeGlyph', 'export-edge-glyph' ),
          ghost: new CulledGroup( kernels, 'ghost', 'export-ghost' )
        };
      }

      const format = this.format as GPUTextureFormat;
      const texture = device.createTexture( {
        label: 'cy-gpu:export-target',
        size: { width: wPx, height: hPx },
        format,
        usage: TEXTURE_USAGE.RENDER_ATTACHMENT | TEXTURE_USAGE.COPY_SRC
      } );
      const depth = device.createTexture( {
        label: 'cy-gpu:export-depth',
        size: { width: wPx, height: hPx },
        format: DEPTH_FORMAT,
        usage: TEXTURE_USAGE.RENDER_ATTACHMENT
      } );
      const bytesPerRow = Math.ceil( wPx * 4 / 256 ) * 256;
      const staging = device.createBuffer( {
        label: 'cy-gpu:export-staging',
        size: bytesPerRow * hPx,
        usage: BUFFER_USAGE.MAP_READ | BUFFER_USAGE.COPY_DST
      } );

      const encoder = device.createCommandEncoder( { label: 'cy-gpu:export' } );

      this.encodeCulls( encoder, this.exportUniform as GPUBuffer, this.exportCull, false );

      // the clear color is premultiplied, like everything the pipelines blend
      const a = bg == null ? 0 : bg[3];
      const pass = encoder.beginRenderPass( {
        label: 'cy-gpu:export-pass',
        colorAttachments: [ {
          view: texture.createView(),
          clearValue: bg == null
            ? { r: 0, g: 0, b: 0, a: 0 }
            : { r: bg[0] / 255 * a, g: bg[1] / 255 * a, b: bg[2] / 255 * a, a },
          loadOp: 'clear',
          storeOp: 'store'
        } ],
        depthStencilAttachment: {
          view: depth.createView(),
          depthClearValue: 1.0,
          depthLoadOp: 'clear',
          depthStoreOp: 'discard'
        }
      } );

      this.drawScene( pass, this.exportUniform as GPUBuffer, this.exportCull );
      pass.end();

      encoder.copyTextureToBuffer(
        { texture },
        { buffer: staging, bytesPerRow },
        { width: wPx, height: hPx }
      );

      device.queue.submit( [ encoder.finish() ] );

      void this.readbackExport( job, staging, texture, depth, bytesPerRow );
    } catch( err ){
      job.reject( err as Error );
    }
  }

  /** Map the staging buffer, strip row padding, convert to straight-alpha RGBA. */
  private async readbackExport(
    job: ExportJob, staging: GPUBuffer, texture: GPUTexture, depth: GPUTexture, bytesPerRow: number
  ): Promise<void> {
    const { wPx, hPx } = job.view;

    try {
      await staging.mapAsync( MAP_MODE.READ );

      const mapped = new Uint8Array( staging.getMappedRange() );
      const data = new Uint8ClampedArray( wPx * hPx * 4 );
      const bgra = ( this.format as string ).startsWith( 'bgra' );

      for( let y = 0; y < hPx; y++ ){
        const src = y * bytesPerRow;
        const dst = y * wPx * 4;

        for( let x = 0; x < wPx; x++ ){
          const s = src + x * 4;
          const d = dst + x * 4;
          const a = mapped[ s + 3 ];
          // rendered colors are premultiplied; image pixels want straight alpha
          const un = a === 0 || a === 255 ? 1 : 255 / a;

          data[ d ] = mapped[ s + ( bgra ? 2 : 0 ) ] * un;
          data[ d + 1 ] = mapped[ s + 1 ] * un;
          data[ d + 2 ] = mapped[ s + ( bgra ? 0 : 2 ) ] * un;
          data[ d + 3 ] = a;
        }
      }

      staging.unmap();
      job.resolve( { data, width: wPx, height: hPx } );
    } catch( err ){
      job.reject( err as Error ); // device lost or destroyed mid-flight
    } finally {
      staging.destroy();
      texture.destroy();
      depth.destroy();
    }
  }

  // -- internals --

  private async init(): Promise<void> {
    const { device, context, format } = await initGpuContext( this.canvas, info => {
      // our own teardown destroys the device after flagging `destroyed`;
      // anything else is a real external loss
      if( this.destroyed ){ return; }

      this.isReady = false;

      if( this.onDeviceLost != null ){
        this.onDeviceLost( info.message );
      } else {
        this.cy.emit( { type: 'error' }, [ `WebGPU device lost: ${info.message}` ] );
      }
    } );

    if( this.destroyed ){
      device.destroy();

      return;
    }

    this.device = device;
    this.context = context;
    this.uniform = device.createBuffer( {
      label: 'cy-gpu:frame-uniform',
      size: this.frameData.byteLength,
      usage: BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST
    } );

    // the mirror constructor uploads the full backing arrays, so any delta
    // accumulated before readiness is already covered — pending curve
    // derivations must land in the backing arrays first, though (their
    // usual flush point is takeDelta, whose result is discarded here)
    this.cy._store.curves.flush();
    this.mirror = new ColumnMirror( device, this.cy._store );
    this.cy._store.takeDelta();

    // the CPU-applied base is current at init, so pre-ready data spans are
    // covered too; the runtime's first update() configures + fully evaluates
    this.mapperRuntime = new MapperRuntime( device, this.cy._store, this.cy._styleEngine, this.mirror );

    // GPU tweens: any mirrored column + the mirror version (rebinds on
    // realloc).  Attaching makes the animation manager route position and
    // paint animations here and cede its clock to this frame loop.
    this.tweenRuntime = new GpuTweenRuntime(
      device, id => ( this.mirror as ColumnMirror ).buffer( id ), () => ( this.mirror as ColumnMirror ).version );
    this.cy._animations.attachDriver( this.tweenRuntime );
    this.cy._store.takeMapperSpans();

    this.pickUniform = device.createBuffer( {
      label: 'cy-gpu:pick-frame-uniform',
      size: this.pickFrameData.byteLength,
      usage: BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST
    } );

    const kernels = new CullKernels( device );

    this.cullKernels = kernels;
    this.sceneCull = {
      node: new CulledGroup( kernels, 'node', 'scene-node' ),
      edge: new CulledGroup( kernels, 'edge', 'scene-edge' ),
      curved: new CulledGroup( kernels, 'curvedEdge', 'scene-curved-edge', 6 * CURVE_SEGS ),
      glyph: new CulledGroup( kernels, 'glyph', 'scene-glyph' ),
      edgeGlyph: new CulledGroup( kernels, 'edgeGlyph', 'scene-edge-glyph' ),
      ghost: new CulledGroup( kernels, 'ghost', 'scene-ghost' )
    };
    this.pickCull = {
      // nodes pick synchronously on the CPU; only edges need the GPU pass
      edge: new CulledGroup( kernels, 'edge', 'pick-edge' ),
      curved: new CulledGroup( kernels, 'curvedEdge', 'pick-curved-edge', 6 * CURVE_SEGS )
    };

    this.nodePipeline = new NodePipeline( device, format, kernels.visibleLayout );
    this.edgePipeline = new EdgePipeline( device, format, kernels.visibleLayout );
    this.curvedEdgePipeline = new CurvedEdgePipeline( device, format, kernels.visibleLayout );
    this.curvedArrowPipeline = new CurvedArrowPipeline( device, format, kernels.visibleLayout );
    this.arrowPipeline = new ArrowPipeline( device, format, kernels.visibleLayout );
    this.labelLayer = new LabelLayer( device, this.cy._store );
    this.labelPipeline = new LabelPipeline( device, format, kernels.visibleLayout );
    this.edgeLabelPipeline = new LabelPipeline( device, format, kernels.visibleLayout, 'edge' );
    this.picking = new Picking( device );
    this.format = format;
    this.upscaler = this.scaleCtl.min < 1 ? new Upscaler( device, format ) : null;
    this.gpuTimer = GpuTimer.isSupported( device ) ? new GpuTimer( device ) : null;

    this.isReady = true;
    this.needsRedraw = true;
    this.schedule(); // first frame
  }

  private schedule(): void {
    if( this.frameRequested || this.destroyed || !this.isReady ){ return; }

    this.frameRequested = true;

    requestAnimationFrame( () => {
      this.frameRequested = false;
      this.frame();
    } );
  }

  private frame(): void {
    const device = this.device;
    const context = this.context;
    const mirror = this.mirror;

    if( this.destroyed || !this.isReady || device == null || context == null || mirror == null ){ return; }
    if( this.canvas.width === 0 || this.canvas.height === 0 ){ return; }

    const t0 = performance.now();
    const store = this.cy._store;
    let delta: ReturnType<typeof store.takeDelta> | null = null;

    // advance animations on our frame clock (CPU tweens write columns →
    // dirty; GPU tweens register/settle here).  A tweened column is
    // GPU-owned while its batch runs so the mirror won't clobber it; the
    // settle in tick() releases ownership before setTweenOwned below, so
    // the settled values upload on this same frame
    this.cy._animations.tick( t0 );
    mirror.setTweenOwned( this.tweenRuntime?.ownedColumns() ?? [] );

    if( this.cy._animations.active() ){ this.needsRedraw = true; }

    if( store.hasDirty() ){
      this.needsRedraw = true;

      delta = store.takeDelta();

      // color/opacity-only changes can't alter pick coverage; anything
      // else (geometry, flags, growth) drops the cached pick tile
      if( delta.resized.nodes || delta.resized.edges ||
          delta.spans.some( span => !PICK_NEUTRAL_COLUMNS.has( span.column ) ) ){
        this.picking?.invalidateCache();
      }

      mirror.sync( delta );
    }

    // unconditional: a sheet change reconfigures on the next frame even
    // when the store itself is clean
    this.mapperRuntime?.update( delta ?? EMPTY_DELTA );

    this.labelLayer?.process(); // rebuild glyph runs for label-dirty nodes

    // pick pass first, in its own submit: a tiny cursor-centered tile whose
    // readback maps as soon as it executes, never queued behind a scene draw
    const picking = this.picking;
    const pending = picking?.peekPending() ?? null;

    if( picking != null && pending != null && this.pickCull != null ){
      this.writePickUniform( pending.xPx, pending.yPx );

      const pickEncoder = device.createCommandEncoder( { label: 'cy-gpu:pick' } );

      // the pick-tile Frame uniform turns the cull predicates' viewport
      // test into cursor-region culling: the pick draw stays O(region)
      this.encodeCulls( pickEncoder, this.pickUniform as GPUBuffer, this.pickCull, false );
      this.drawPickPasses( pickEncoder, picking.targetView() );

      const copy = picking.encodeCopy( pickEncoder );

      device.queue.submit( [ pickEncoder.finish() ] );

      if( copy != null ){
        void picking.finish( copy );
      }
    }

    // scene pass only when something actually changed: render-on-dirty is
    // preserved while hover picking runs over a static graph.  When the GPU
    // is behind, keep needsRedraw and retry next rAF rather than queueing
    // deeper (state coalesces; latency stays bounded).
    if( this.needsRedraw && this.inFlightFrames < MAX_IN_FLIGHT_FRAMES && this.sceneCull != null ){
      this.needsRedraw = false;
      this.writeFrameUniform();

      const encoder = device.createCommandEncoder( { label: 'cy-gpu:frame' } );

      // GPU position tweens: their own compute pass, before cull — the
      // pass boundary is the barrier so cull (and the edge shaders) read
      // the freshly-tweened node.position.  Paint tweens don't need it and
      // ride the cull pass instead (see encodeCulls).
      if( this.tweenRuntime != null && this.tweenRuntime.hasPositions() ){
        const tweenPass = encoder.beginComputePass( { label: 'cy-gpu:tween-pass' } );

        this.tweenRuntime.encode( tweenPass, t0, 'position' );
        tweenPass.end();
      }

      // compact each group's visible slots + indirect args before drawing
      this.encodeCulls( encoder, this.uniform as GPUBuffer, this.sceneCull, true, t0 );

      // render scale < 1: draw into a low-res offscreen target, then a
      // Catmull-Rom upscale pass resamples it to the swapchain
      const scaled = this.upscaler != null && this.scaleCtl.scale < 1;
      const view = scaled
        ? ( this.ensureSceneTarget() as GPUTexture ).createView()
        : context.getCurrentTexture().createView();
      const pass = encoder.beginRenderPass( {
        label: 'cy-gpu:render-pass',
        colorAttachments: [ {
          view,
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear',
          storeOp: 'store'
        } ],
        depthStencilAttachment: {
          view: this.ensureDepthTarget().createView(),
          depthClearValue: 1.0,
          depthLoadOp: 'clear',
          depthStoreOp: 'discard' // only consumed within this pass
        },
        ...( this.gpuTimer != null ? { timestampWrites: this.gpuTimer.timestampWrites() } : {} )
      } );

      this.drawScene( pass, this.uniform as GPUBuffer, this.sceneCull );
      pass.end();

      if( scaled ){
        const upscalePass = encoder.beginRenderPass( {
          label: 'cy-gpu:upscale-pass',
          colorAttachments: [ {
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: 'clear',
            storeOp: 'store'
          } ],
          ...( this.gpuTimer != null ? { timestampWrites: this.gpuTimer.postTimestampWrites() } : {} )
        } );

        ( this.upscaler as Upscaler ).draw( upscalePass, device, this.sceneTarget as GPUTexture );
        upscalePass.end();
      }

      const finishTiming = this.gpuTimer?.encodeResolve( encoder, scaled ) ?? null;

      device.queue.submit( [ encoder.finish() ] );
      finishTiming?.();

      this.inFlightFrames++;
      device.queue.onSubmittedWorkDone()
        .then( () => { this.inFlightFrames--; }, () => { this.inFlightFrames--; } );

      this.frameCount++;
      this.cy.emit( 'render' );

      // adaptive resolution: feed the drawn frame's GPU cost to the
      // controller and rearm the idle settle-to-max timer
      if( this.scaleCtl.frameDrawn( t0, this.gpuTimer?.lastMs ?? 0 ) != null ){
        this.needsRedraw = true;
      }

      this.armSettleTimer();
    } else if( this.needsRedraw ){
      // wanted to draw but the GPU is behind: a stall tick is the
      // adaptive-scale fallback signal when GPU timing is unavailable
      if( this.scaleCtl.frameStalled( t0 ) != null ){
        this.needsRedraw = true;
      }
    }

    // exports see exactly this frame's state: when the scene drew, the
    // mapper/tween dispatches above are already encoded ahead of the
    // export submit; when nothing was dirty, the buffers were already
    // current.  A skipped scene pass (backpressure) leaves needsRedraw
    // set, deferring the export to a coherent later frame.
    if( this.pendingExports.length > 0 && !this.needsRedraw ){
      const jobs = this.pendingExports;

      this.pendingExports = [];

      for( const job of jobs ){
        this.renderExport( job );
      }
    }

    this.cpuFrameMs = performance.now() - t0;

    if( store.hasDirty() || this.needsRedraw || this.cy._animations.active()
        || ( picking?.hasPending() ?? false ) || this.pendingExports.length > 0 ){
      this.schedule();
    }
  }

  /**
   * The scene draw sequence against a Frame uniform + culled groups —
   * shared by the on-screen frame and image export.  Z-order: edges under
   * arrows under nodes under labels, slot order within each group (the
   * cull compaction preserves slot order).  The node depth prepass runs
   * first so edge fragments under opaque node interiors are killed by
   * early-z before blending; arrow draws are skipped per end when no
   * style block enables that end.
   */
  private drawScene(
    pass: GPURenderPassEncoder, uniform: GPUBuffer, cull: SceneCullGroups
  ): void {
    const device = this.device as GPUDevice;
    const mirror = this.mirror as ColumnMirror;
    const store = this.cy._store;

    this.nodePipeline?.drawDepthPrepass( pass, device, uniform, mirror, store.highWater( 'nodes' ), cull.node );
    this.edgePipeline?.draw( pass, device, uniform, mirror, store.highWater( 'edges' ), cull.edge );
    // curved edges draw after straight ones (two streams; within each,
    // slot order — a recorded z-order deviation)
    this.curvedEdgePipeline?.draw( pass, device, uniform, mirror, store.highWater( 'edges' ), cull.curved );
    this.arrowPipeline?.draw(
      pass, device, uniform, mirror, store.highWater( 'edges' ), cull.edge,
      this.cy._styleEngine.arrowEnds
    );
    this.curvedArrowPipeline?.draw(
      pass, device, uniform, mirror, store.highWater( 'edges' ), cull.curved,
      this.cy._styleEngine.arrowEnds
    );
    if( store.ghostCount() > 0 && cull.ghost != null ){
      this.nodePipeline?.drawGhost(
        pass, device, uniform, mirror, store.highWater( 'nodes' ), cull.ghost );
    }

    this.nodePipeline?.draw( pass, device, uniform, mirror, store.highWater( 'nodes' ), cull.node );

    if( this.labelLayer != null && this.labelPipeline != null ){
      this.labelPipeline.draw(
        pass, device, uniform, this.labelLayer.glyphs, mirror, this.labelLayer.atlas, cull.glyph
      );
    }

    if( this.labelLayer != null && this.edgeLabelPipeline != null ){
      this.edgeLabelPipeline.draw(
        pass, device, uniform, this.labelLayer.edgeGlyphs, mirror, this.labelLayer.atlas, cull.edgeGlyph
      );
    }
  }

  /** Shortly after drawing stops, re-render one frame at max scale so
   * the still image the user actually inspects is full-resolution. */
  private armSettleTimer(): void {
    if( this.settleTimer != null ){
      clearTimeout( this.settleTimer );
    }

    this.settleTimer = setTimeout( () => {
      this.settleTimer = null;

      if( this.destroyed || !this.isReady || this.needsRedraw ){ return; }

      if( this.scaleCtl.settleToMax() != null ){
        this.needsRedraw = true;
        this.schedule();
      }
    }, SETTLE_TO_MAX_MS );
  }

  /**
   * Ensure + encode the cull compaction for a set of groups against a
   * Frame uniform (the scene frame or the pick tile).  The compute pass is
   * always opened when it may be timed — timestamp queries persist, so a
   * skipped pass would leave stale values in the frame timing sum.
   */
  private encodeCulls(
    encoder: GPUCommandEncoder, uniform: GPUBuffer,
    groups: {
      node?: CulledGroup; edge: CulledGroup; curved: CulledGroup;
      glyph?: CulledGroup; edgeGlyph?: CulledGroup; ghost?: CulledGroup;
    },
    timed: boolean, now: number = 0
  ): void {
    const mirror = this.mirror as ColumnMirror;
    const store = this.cy._store;
    const labelLayer = this.labelLayer;
    const mv = `${mirror.version}`;

    groups.node?.ensure( uniform, Math.max( 1, store.capacity( 'nodes' ) ), [
      mirror.buffer( 'node.position' ), mirror.buffer( 'node.size' ), mirror.buffer( 'node.flags' )
    ], mv );

    // ghosts (round 13 A1): zero-cost until some node styles a ghost
    const anyGhosts = store.ghostCount() > 0;

    if( anyGhosts && groups.ghost != null ){
      groups.ghost.ensure( uniform, Math.max( 1, store.capacity( 'nodes' ) ), [
        mirror.buffer( 'node.position' ), mirror.buffer( 'node.size' ),
        mirror.buffer( 'node.flags' ), mirror.buffer( 'node.ghost' )
      ], mv );
    }
    const edgeCullInputs = [
      mirror.buffer( 'edge.endpoints' ), mirror.buffer( 'edge.width' ), mirror.buffer( 'edge.flags' ),
      mirror.buffer( 'node.position' ), mirror.buffer( 'node.flags' )
    ];

    groups.edge.ensure( uniform, Math.max( 1, store.capacity( 'edges' ) ), edgeCullInputs, mv );
    // the curved stream culls over the same inputs; FLAG_CURVED splits them
    groups.curved.ensure( uniform, Math.max( 1, store.capacity( 'edges' ) ), edgeCullInputs, mv );

    if( groups.glyph != null && labelLayer != null ){
      const glyphs = labelLayer.glyphs;

      groups.glyph.ensure( uniform, Math.max( 1, glyphs.buffer().size / GLYPH_BYTES ), [
        glyphs.buffer(), mirror.buffer( 'node.position' ), mirror.buffer( 'node.flags' )
      ], `${mv}:${glyphs.version}` );
    }

    if( groups.edgeGlyph != null && labelLayer != null ){
      const glyphs = labelLayer.edgeGlyphs;

      groups.edgeGlyph.ensure( uniform, Math.max( 1, glyphs.buffer().size / GLYPH_BYTES ), [
        glyphs.buffer(), mirror.buffer( 'edge.endpoints' ), mirror.buffer( 'node.position' ),
        mirror.buffer( 'edge.flags' ), mirror.buffer( 'node.flags' )
      ], `${mv}:${glyphs.version}` );
    }

    const pass = encoder.beginComputePass( {
      label: 'cy-gpu:cull-pass',
      ...( timed && this.gpuTimer != null ? { timestampWrites: this.gpuTimer.computeTimestampWrites() } : {} )
    } );

    // mapper eval first (scene invocation only): paint channels must be
    // evaluated before the render pass reads them; pick frames skip it
    // (paint never affects pick coverage).  Paint tweens dispatch straight
    // after, in the same pass — dispatches within a pass see each other's
    // writes, so an animation's slots outrank a mapper writing the same
    // channel for as long as it holds the lease
    if( timed ){
      this.mapperRuntime?.encode( pass );
      this.tweenRuntime?.encode( pass, now, 'paint' );
    }

    groups.node?.encode( pass, store.highWater( 'nodes' ) );
    groups.edge.encode( pass, store.highWater( 'edges' ) );
    groups.curved.encode( pass, store.highWater( 'edges' ) );

    if( anyGhosts && groups.ghost != null ){
      groups.ghost.encode( pass, store.highWater( 'nodes' ) );
    }

    if( groups.glyph != null && labelLayer != null ){
      groups.glyph.encode( pass, labelLayer.glyphs.highWater );
    }

    if( groups.edgeGlyph != null && labelLayer != null ){
      groups.edgeGlyph.encode( pass, labelLayer.edgeGlyphs.highWater );
    }

    pass.end();
  }

  private drawPickPasses( encoder: GPUCommandEncoder, targetView: GPUTextureView ): void {
    const device = this.device;
    const mirror = this.mirror;
    const uniform = this.pickUniform;
    const pickCull = this.pickCull;

    if( device == null || mirror == null || uniform == null || pickCull == null ){ return; }

    const pass = encoder.beginRenderPass( {
      label: 'cy-gpu:pick-pass',
      colorAttachments: [ {
        view: targetView,
        clearValue: { r: 0, g: 0, b: 0, a: 0 }, // 0 = background
        loadOp: 'clear',
        storeOp: 'store'
      } ]
    } );

    const store = this.cy._store;

    // edges only: node picks are answered synchronously on the CPU
    this.edgePipeline?.draw( pass, device, uniform, mirror, store.highWater( 'edges' ), pickCull.edge, true );
    this.curvedEdgePipeline?.draw( pass, device, uniform, mirror, store.highWater( 'edges' ), pickCull.curved, true );
    pass.end();
  }

  private applySize(): void {
    const w = Math.max( 1, Math.round( this.container.clientWidth * this.dpr ) );
    const h = Math.max( 1, Math.round( this.container.clientHeight * this.dpr ) );

    if( this.canvas.width !== w || this.canvas.height !== h ){
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  /** Low-res scene target dimensions (must match writeFrameUniform). */
  private scaledSize(): { w: number; h: number } {
    const scale = this.scaleCtl.scale;

    return {
      w: Math.max( 1, Math.round( this.canvas.width * scale ) ),
      h: Math.max( 1, Math.round( this.canvas.height * scale ) )
    };
  }

  private ensureSceneTarget(): GPUTexture {
    const device = this.device as GPUDevice;
    const { w, h } = this.scaledSize();
    let target = this.sceneTarget;

    if( target == null || target.width !== w || target.height !== h ){
      const old = target;

      target = device.createTexture( {
        label: 'cy-gpu:scene-target',
        size: { width: w, height: h },
        format: this.format as GPUTextureFormat,
        usage: TEXTURE_USAGE.RENDER_ATTACHMENT | TEXTURE_USAGE.TEXTURE_BINDING
      } );
      this.sceneTarget = target;

      if( old != null ){ // may still be referenced by in-flight frames
        void device.queue.onSubmittedWorkDone().then( () => old.destroy() );
      }
    }

    return target;
  }

  private ensureDepthTarget(): GPUTexture {
    const device = this.device as GPUDevice;
    const { w, h } = this.scaledSize(); // matches the scene color target
    let target = this.depthTarget;

    if( target == null || target.width !== w || target.height !== h ){
      const old = target;

      target = device.createTexture( {
        label: 'cy-gpu:depth-target',
        size: { width: w, height: h },
        format: DEPTH_FORMAT,
        usage: TEXTURE_USAGE.RENDER_ATTACHMENT
      } );
      this.depthTarget = target;

      if( old != null ){ // may still be referenced by in-flight frames
        void device.queue.onSubmittedWorkDone().then( () => old.destroy() );
      }
    }

    return target;
  }

  private writeFrameUniform(): void {
    const viewport = this.cy._viewport;
    const zoom = viewport.zoom();
    const pan = viewport.pan();
    const f = this.frameData;
    const opts = this.opts;

    // with render scale < 1 the scene renders in scaled device px; LOD
    // thresholds stay in render px (a floored 1px edge is 1 low-res px)
    const { w, h } = this.scaledSize();
    const dprScale = this.dpr * this.scaleCtl.scale;

    f[0] = w;
    f[1] = h;
    f[2] = pan.x * dprScale;
    f[3] = pan.y * dprScale;
    f[4] = zoom * dprScale;
    f[5] = opts.edgeWidthFloor ?? DEFAULT_EDGE_WIDTH_FLOOR;
    f[6] = opts.nodeLodPx ?? DEFAULT_NODE_LOD_PX;
    f[7] = opts.hidePx ?? DEFAULT_HIDE_PX;
    f[8] = opts.edgeDimming ? Math.min( 0.85, Math.max( 0, 1 - zoom ) * 0.85 ) : 0;
    // label thresholds are readability criteria, so they live in *displayed*
    // px regardless of the adaptive render scale: scaling them into render
    // px here makes the shader/cull comparisons (which are in render px)
    // equivalent to native-px ones.  The node/edge raster floors above stay
    // in render px on purpose — sub-render-pixel geometry can't rasterize.
    f[9] = ( opts.labelFadePx ?? DEFAULT_LABEL_FADE_PX ) * this.scaleCtl.scale;
    f[10] = ( opts.labelMinPx ?? DEFAULT_LABEL_MIN_PX ) * this.scaleCtl.scale;
    f[11] = this.cy._store.curveSlack(); // model px; shaders scale by zoomDpr
    f[12] = this.cy._store.haystackSlack();

    ( this.device as GPUDevice ).queue.writeBuffer( this.uniform as GPUBuffer, 0, f.buffer, f.byteOffset, f.byteLength );
  }

  /**
   * The pick pass reuses the render shaders with a Frame whose viewport is
   * the cursor-centered tile: pan is offset by the tile origin, so the
   * shaders' own conservative viewport culling collapses every instance
   * that doesn't overlap the cursor region — the pick pass costs
   * O(region), not O(scene).  LOD values match the render frame so what
   * you see is what you pick.
   */
  private writePickUniform( xPx: number, yPx: number ): void {
    const viewport = this.cy._viewport;
    const zoom = viewport.zoom();
    const pan = viewport.pan();
    const f = this.pickFrameData;
    const opts = this.opts;

    // floor keeps the cursor inside the center texel [TILE/2, TILE/2 + 1)
    const tileX = Math.floor( xPx ) - PICK_TILE / 2;
    const tileY = Math.floor( yPx ) - PICK_TILE / 2;

    f[0] = PICK_TILE;
    f[1] = PICK_TILE;
    f[2] = pan.x * this.dpr - tileX;
    f[3] = pan.y * this.dpr - tileY;
    f[4] = zoom * this.dpr;
    f[5] = opts.edgeWidthFloor ?? DEFAULT_EDGE_WIDTH_FLOOR;
    f[6] = opts.nodeLodPx ?? DEFAULT_NODE_LOD_PX;
    f[7] = opts.hidePx ?? DEFAULT_HIDE_PX;
    f[8] = 0; // edge dimming never affects pick coverage
    f[9] = opts.labelFadePx ?? DEFAULT_LABEL_FADE_PX; // labels aren't picked
    f[10] = opts.labelMinPx ?? DEFAULT_LABEL_MIN_PX;
    f[11] = this.cy._store.curveSlack();
    f[12] = this.cy._store.haystackSlack();

    ( this.device as GPUDevice ).queue.writeBuffer(
      this.pickUniform as GPUBuffer, 0, f.buffer, f.byteOffset, f.byteLength
    );
  }
}
