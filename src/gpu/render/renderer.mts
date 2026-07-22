import { initGpuContext } from '../gpu-context.mjs';
import { ColumnMirror } from './column-mirror.mjs';
import { NodePipeline } from './node-pipeline.mjs';
import { EdgePipeline } from './edge-pipeline.mjs';
import { EDGE_PICK_BIT, Picking } from './picking.mjs';
import type { InFlightCopy } from './picking.mjs';
import { BUFFER_USAGE } from './webgpu-constants.mjs';
import { FLAG_ALIVE } from '../contract.mjs';
import type { GpuCore } from '../core.mjs';
import type { GpuCollection } from '../collection.mjs';
import type { GpuRendererOptions } from '../gpu-types.mjs';

/*
The frame graph: a render-on-dirty rAF loop.

A frame is scheduled when the store invalidates (dirty columns), on any
viewport event, or on resize; nothing renders while clean.  Pass order in a
frame: sync dirty spans to the GPU mirror → write the Frame uniform → one
render pass (edges then nodes, no depth buffer).  Frames before `.ready`
resolves are no-ops; readiness triggers the first frame.  Device loss makes
the instance dead (an `error` event fires; no recovery).
*/

interface RendererStats {
  frames: number;
  lastFrameMs: number;
  uploadedBytes: number;
  nodes: number;
  edges: number;
  pickLatencyMs: number;
}

const DEFAULT_EDGE_WIDTH_FLOOR = 1; // device px
const DEFAULT_NODE_LOD_PX = 3;
const DEFAULT_HIDE_PX = 1;

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
  private uniform: GPUBuffer | null;
  private frameData: Float32Array;
  private isReady: boolean;
  private frameRequested: boolean;
  private resizeObserver: ResizeObserver | null;
  private offInvalidate: () => void;
  private onViewport: () => void;
  private frameCount: number;
  private lastFrameMs: number;
  private picking: Picking | null;
  private inFlightCopy: InFlightCopy | null;

  constructor( cy: GpuCore, container: HTMLElement, opts: GpuRendererOptions & { pixelRatio?: number | 'auto' } = {} ){
    this.cy = cy;
    this.container = container;
    this.opts = opts;
    this.device = null;
    this.context = null;
    this.mirror = null;
    this.nodePipeline = null;
    this.edgePipeline = null;
    this.uniform = null;
    this.frameData = new Float32Array( 12 );
    this.isReady = false;
    this.frameRequested = false;
    this.destroyed = false;
    this.frameCount = 0;
    this.lastFrameMs = 0;
    this.picking = null;
    this.inFlightCopy = null;

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

    this.offInvalidate = cy._store.onInvalidate( () => this.schedule() );
    this.onViewport = () => this.schedule();
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
      lastFrameMs: this.lastFrameMs,
      uploadedBytes: this.mirror?.uploadedBytes ?? 0,
      nodes: this.cy._store.count( 'nodes' ),
      edges: this.cy._store.count( 'edges' ),
      pickLatencyMs: this.pickLatencyMs()
    };
  }

  resize(): void {
    if( this.destroyed ){ return; }

    this.applySize();
    this.onResized();
    this.schedule();
  }

  destroy(): void {
    if( this.destroyed ){ return; }

    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.offInvalidate();
    this.cy.off( 'viewport', this.onViewport );
    this.picking?.destroy();
    this.mirror?.destroy();
    this.uniform?.destroy();
    this.device?.destroy();
    this.canvas.remove();
  }

  // -- picking --

  /**
   * Async GPU pick at a rendered (CSS px) position.  Resolves with the
   * element under the point, or null for background/unknown.  Latency is
   * 1–2 frames (latest-wins coalescing).
   */
  async pick( x: number, y: number ): Promise<GpuCollection | null> {
    if( this.destroyed || !this.isReady || this.picking == null ){ return null; }

    const promise = this.picking.request( x * this.dpr, y * this.dpr );

    this.schedule(); // the pick pass runs with the next frame

    return this.decodePick( await promise );
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

  private onReady(): void {
    this.picking = new Picking( this.device as GPUDevice );
    this.picking.resize( this.canvas.width, this.canvas.height );
  }

  private onResized(): void {
    this.picking?.resize( this.canvas.width, this.canvas.height );
  }

  private encodeExtraPasses( encoder: GPUCommandEncoder ): void {
    const picking = this.picking;

    if( picking == null || !picking.hasPending() ){ return; }

    const targetView = picking.targetView();

    if( targetView == null ){ return; }

    this.drawPickPasses( encoder, targetView );
    this.inFlightCopy = picking.encodeCopy( encoder );
  }

  private afterSubmit(): void {
    if( this.inFlightCopy != null && this.picking != null ){
      void this.picking.finish( this.inFlightCopy );
      this.inFlightCopy = null;
    }
  }

  private hasExtraWork(): boolean {
    return this.picking?.hasPending() ?? false;
  }

  private pickLatencyMs(): number {
    return this.picking?.lastLatencyMs ?? 0;
  }

  // -- internals --

  private async init(): Promise<void> {
    const { device, context, format } = await initGpuContext( this.canvas, info => {
      this.isReady = false;
      this.cy.emit( { type: 'error' }, [ `WebGPU device lost: ${info.message}` ] );
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
    // accumulated before readiness is already covered
    this.mirror = new ColumnMirror( device, this.cy._store );
    this.cy._store.takeDelta();

    this.nodePipeline = new NodePipeline( device, format );
    this.edgePipeline = new EdgePipeline( device, format );

    this.isReady = true;
    this.onReady();
    this.schedule(); // first frame
  }

  protected schedule(): void {
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

    if( store.hasDirty() ){
      mirror.sync( store.takeDelta() );
    }

    this.writeFrameUniform();

    const encoder = device.createCommandEncoder( { label: 'cy-gpu:frame' } );
    const view = context.getCurrentTexture().createView();
    const pass = encoder.beginRenderPass( {
      label: 'cy-gpu:render-pass',
      colorAttachments: [ {
        view,
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'clear',
        storeOp: 'store'
      } ]
    } );

    // z-order: single pass, edges under nodes, slot order within each group
    const nodeCount = store.highWater( 'nodes' );
    const edgeCount = store.highWater( 'edges' );
    const uniform = this.uniform as GPUBuffer;

    this.edgePipeline?.draw( pass, device, uniform, mirror, edgeCount );
    this.nodePipeline?.draw( pass, device, uniform, mirror, nodeCount );
    pass.end();

    this.encodeExtraPasses( encoder );

    device.queue.submit( [ encoder.finish() ] );
    this.afterSubmit();

    this.frameCount++;
    this.lastFrameMs = performance.now() - t0;
    this.cy.emit( 'render' );

    if( store.hasDirty() || this.hasExtraWork() ){
      this.schedule();
    }
  }

  protected drawPickPasses( encoder: GPUCommandEncoder, targetView: GPUTextureView ): void {
    const device = this.device;
    const mirror = this.mirror;
    const uniform = this.uniform;

    if( device == null || mirror == null || uniform == null ){ return; }

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

    this.edgePipeline?.draw( pass, device, uniform, mirror, store.highWater( 'edges' ), true );
    this.nodePipeline?.draw( pass, device, uniform, mirror, store.highWater( 'nodes' ), true );
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

  private writeFrameUniform(): void {
    const viewport = this.cy._viewport;
    const zoom = viewport.zoom();
    const pan = viewport.pan();
    const f = this.frameData;
    const opts = this.opts;

    f[0] = this.canvas.width;
    f[1] = this.canvas.height;
    f[2] = pan.x * this.dpr;
    f[3] = pan.y * this.dpr;
    f[4] = zoom * this.dpr;
    f[5] = opts.edgeWidthFloor ?? DEFAULT_EDGE_WIDTH_FLOOR;
    f[6] = opts.nodeLodPx ?? DEFAULT_NODE_LOD_PX;
    f[7] = opts.hidePx ?? DEFAULT_HIDE_PX;
    f[8] = opts.edgeDimming ? Math.min( 0.85, Math.max( 0, 1 - zoom ) * 0.85 ) : 0;
    // f[9..11]: padding

    ( this.device as GPUDevice ).queue.writeBuffer( this.uniform as GPUBuffer, 0, f.buffer, f.byteOffset, f.byteLength );
  }
}
