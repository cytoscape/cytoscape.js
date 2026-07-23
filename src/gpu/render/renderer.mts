import { initGpuContext } from '../gpu-context.mjs';
import { ColumnMirror } from './column-mirror.mjs';
import { pickNodeAt } from './cpu-pick.mjs';
import { CulledGroup, CullKernels } from './cull.mjs';
import { DEPTH_FORMAT, NodePipeline } from './node-pipeline.mjs';
import { EdgePipeline } from './edge-pipeline.mjs';
import { EDGE_PICK_BIT, PICK_TILE, Picking } from './picking.mjs';
import { GpuTimer } from './gpu-timer.mjs';
import { LabelLayer } from './label-layer.mjs';
import { LabelPipeline } from './label-pipeline.mjs';
import { ScaleController } from './scale-controller.mjs';
import { Upscaler } from './upscale.mjs';
import { BUFFER_USAGE, TEXTURE_USAGE } from './webgpu-constants.mjs';
import { FLAG_ALIVE } from '../contract.mjs';
import type { GpuCore } from '../core.mjs';
import type { GpuCollection } from '../collection.mjs';
import type { GpuRendererOptions } from '../gpu-types.mjs';

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
resolves are no-ops; readiness triggers the first frame.  Device loss
makes the instance dead (an `error` event fires; no recovery).
*/

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

/** columns whose changes never affect pick coverage (keep the pick cache) */
const PICK_NEUTRAL_COLUMNS = new Set( [
  'node.fillColor', 'node.borderColor', 'node.borderWidth', 'node.opacity',
  'edge.lineColor', 'edge.opacity'
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
  private cpuFrameMs: number;
  private gpuTimer: GpuTimer | null;
  private picking: Picking | null;
  private pickUniform: GPUBuffer | null;
  private pickFrameData: Float32Array;
  private needsRedraw: boolean;
  private inFlightFrames: number;
  private labelLayer: LabelLayer | null;
  private labelPipeline: LabelPipeline | null;
  private cullKernels: CullKernels | null;
  private sceneCull: { node: CulledGroup; edge: CulledGroup; glyph: CulledGroup } | null;
  private pickCull: { edge: CulledGroup } | null;
  private scaleCtl: ScaleController;
  private settleTimer: ReturnType<typeof setTimeout> | null;
  private format: GPUTextureFormat | null;
  private sceneTarget: GPUTexture | null;
  private depthTarget: GPUTexture | null;
  private upscaler: Upscaler | null;

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
    this.cpuFrameMs = 0;
    this.gpuTimer = null;
    this.picking = null;
    this.pickUniform = null;
    this.pickFrameData = new Float32Array( 12 );
    this.needsRedraw = true;
    this.inFlightFrames = 0;
    this.labelLayer = null;
    this.labelPipeline = null;
    this.cullKernels = null;
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
      pickLatencyMs: this.pickLatencyMs()
    };
  }

  resize(): void {
    if( this.destroyed ){ return; }

    this.applySize();
    this.needsRedraw = true;
    this.schedule();
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
    this.picking?.destroy();
    this.gpuTimer?.destroy();
    this.labelLayer?.destroy();

    for( const group of [
      ...Object.values( this.sceneCull ?? {} ), ...Object.values( this.pickCull ?? {} )
    ] ){
      group.destroy();
    }

    this.upscaler?.destroy();
    this.sceneTarget?.destroy();
    this.depthTarget?.destroy();
    this.mirror?.destroy();
    this.uniform?.destroy();
    this.pickUniform?.destroy();
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
      glyph: new CulledGroup( kernels, 'glyph', 'scene-glyph' )
    };
    this.pickCull = {
      // nodes pick synchronously on the CPU; only edges need the GPU pass
      edge: new CulledGroup( kernels, 'edge', 'pick-edge' )
    };

    this.nodePipeline = new NodePipeline( device, format, kernels.visibleLayout );
    this.edgePipeline = new EdgePipeline( device, format, kernels.visibleLayout );
    this.labelLayer = new LabelLayer( device, this.cy._store );
    this.labelPipeline = new LabelPipeline( device, format, kernels.visibleLayout );
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

    if( store.hasDirty() ){
      this.needsRedraw = true;

      const delta = store.takeDelta();

      // color/opacity-only changes can't alter pick coverage; anything
      // else (geometry, flags, growth) drops the cached pick tile
      if( delta.resized.nodes || delta.resized.edges ||
          delta.spans.some( span => !PICK_NEUTRAL_COLUMNS.has( span.column ) ) ){
        this.picking?.invalidateCache();
      }

      mirror.sync( delta );
    }

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

      // compact each group's visible slots + indirect args before drawing
      this.encodeCulls( encoder, this.uniform as GPUBuffer, this.sceneCull, true );

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

      // z-order: single pass, edges under nodes under labels, slot order
      // within each group (the cull compaction preserves slot order).
      // The node depth prepass runs first so edge fragments under opaque
      // node interiors are killed by early-z before blending.
      const uniform = this.uniform as GPUBuffer;

      this.nodePipeline?.drawDepthPrepass( pass, device, uniform, mirror, store.highWater( 'nodes' ), this.sceneCull.node );
      this.edgePipeline?.draw( pass, device, uniform, mirror, store.highWater( 'edges' ), this.sceneCull.edge );
      this.nodePipeline?.draw( pass, device, uniform, mirror, store.highWater( 'nodes' ), this.sceneCull.node );

      if( this.labelLayer != null && this.labelPipeline != null ){
        this.labelPipeline.draw(
          pass, device, uniform, this.labelLayer.glyphs, mirror, this.labelLayer.atlas, this.sceneCull.glyph
        );
      }

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

    this.cpuFrameMs = performance.now() - t0;

    if( store.hasDirty() || this.needsRedraw || ( picking?.hasPending() ?? false ) ){
      this.schedule();
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
    groups: { node?: CulledGroup; edge: CulledGroup; glyph?: CulledGroup }, timed: boolean
  ): void {
    const mirror = this.mirror as ColumnMirror;
    const store = this.cy._store;
    const labelLayer = this.labelLayer;
    const mv = `${mirror.version}`;

    groups.node?.ensure( uniform, Math.max( 1, store.capacity( 'nodes' ) ), [
      mirror.buffer( 'node.position' ), mirror.buffer( 'node.size' ), mirror.buffer( 'node.flags' )
    ], mv );
    groups.edge.ensure( uniform, Math.max( 1, store.capacity( 'edges' ) ), [
      mirror.buffer( 'edge.endpoints' ), mirror.buffer( 'edge.width' ), mirror.buffer( 'edge.flags' ),
      mirror.buffer( 'node.position' ), mirror.buffer( 'node.flags' )
    ], mv );

    if( groups.glyph != null && labelLayer != null ){
      const glyphs = labelLayer.glyphs;

      groups.glyph.ensure( uniform, Math.max( 1, glyphs.buffer().size / 40 ), [
        glyphs.buffer(), mirror.buffer( 'node.position' ), mirror.buffer( 'node.flags' )
      ], `${mv}:${glyphs.version}` );
    }

    const pass = encoder.beginComputePass( {
      label: 'cy-gpu:cull-pass',
      ...( timed && this.gpuTimer != null ? { timestampWrites: this.gpuTimer.computeTimestampWrites() } : {} )
    } );

    groups.node?.encode( pass, store.highWater( 'nodes' ) );
    groups.edge.encode( pass, store.highWater( 'edges' ) );

    if( groups.glyph != null && labelLayer != null ){
      groups.glyph.encode( pass, labelLayer.glyphs.highWater );
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
    // f[11]: padding

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

    ( this.device as GPUDevice ).queue.writeBuffer(
      this.pickUniform as GPUBuffer, 0, f.buffer, f.byteOffset, f.byteLength
    );
  }
}
