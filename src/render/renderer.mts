import { ColumnMirror } from './column-mirror.mjs';
import { CulledGroup, CullKernels } from './cull.mjs';
import { NodeLayerPipeline } from './node-layer-pipeline.mjs';
import { NodePipeline } from './node-pipeline.mjs';
import { EdgePipeline } from './edge-pipeline.mjs';
import { CurvedEdgePipeline } from './curved-edge-pipeline.mjs';
import { CurvedArrowPipeline } from './curved-arrow-pipeline.mjs';
import { ArrowPipeline } from './arrow-pipeline.mjs';
import { Picking } from './picking.mjs';
import { GpuTimer } from './gpu-timer.mjs';
import { LabelLayer } from './label-layer.mjs';
import { LabelPipeline } from './label-pipeline.mjs';
import { MapperRuntime } from './mapper-runtime.mjs';
import { ImageArrays } from './image-arrays.mjs';
import { ImagePipeline } from './image-pipeline.mjs';
import { ChartPipeline } from './chart-pipeline.mjs';
import { GpuTweenRuntime } from './gpu-tween.mjs';
import { GpuForceRuntime } from './gpu-force.mjs';
import type { ForceInputs } from './gpu-force.mjs';
import { ScaleController } from './scale-controller.mjs';
import { Upscaler } from './upscale.mjs';
import { ExportPacker } from './export-pack.mjs';
import type { RenderHost, RenderStoreView } from './host.mjs';
import type {
  ExportOptions,
  RendererOptions,
  RendererStats,
} from '../public-types.mjs';
import { COL } from '../contract.mjs';
import type { ColumnId } from '../contract.mjs';
import * as frameImpl from './renderer/frame.mjs';
import * as pickImpl from './renderer/pick.mjs';
import * as exportImpl from './renderer/export.mjs';
import * as forceImpl from './renderer/force.mjs';
import * as targetsImpl from './renderer/targets.mjs';
import * as lifecycleImpl from './renderer/lifecycle.mjs';
export { resolveExportView } from './renderer/export-view.mjs';
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
render pass (the node depth prepass, then parents, edges and arrows,
then ghosts, node bodies and their image/chart/overlay passes, then
labels — all indirect, against a depth buffer used only for early-z).
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
export interface ExportView {
  wPx: number;
  hPx: number;
  panX: number;
  panY: number;
  zoom: number;
  /** [r, g, b] 0..255 + alpha 0..1, or null for transparent */
  bg: [number, number, number, number] | null;
}

export interface ExportJob {
  view: ExportView;
  resolve: (image: ExportedImage) => void;
  reject: (err: Error) => void;
}

/** the culled instance streams a full scene draw needs */
export interface SceneCullGroups {
  node: CulledGroup;
  /** compound parent bodies (round 14.9): permuted, drawn before edges */
  parent: CulledGroup;
  edge: CulledGroup;
  curved: CulledGroup;
  glyph: CulledGroup;
  edgeGlyph: CulledGroup;
  sourceGlyph: CulledGroup;
  targetGlyph: CulledGroup;
  ghost: CulledGroup;
  overlay: CulledGroup;
  underlay: CulledGroup;
}

export const DEFAULT_EDGE_WIDTH_FLOOR = 1; // device px
export const DEFAULT_NODE_LOD_PX = 3;
export const DEFAULT_HIDE_PX = 1;
export const DEFAULT_LABEL_FADE_PX = 6;
export const DEFAULT_IMAGE_MIN_PX = 8;
export const DEFAULT_LABEL_MIN_PX = 0; // 0 = no hard label cutoff
const DEFAULT_RENDER_SCALE_MIN = 0.5;
const DEFAULT_RENDER_SCALE_MAX = 1;
/** after this long without redraws, re-render one frame at max scale */
export const SETTLE_TO_MAX_MS = 250;

export const EMPTY_DELTA = {
  resized: { nodes: false, edges: false },
  spans: [] as { column: never; start: number; end: number }[],
};

/** columns whose changes never affect pick coverage (keep the pick cache) */
export const PICK_NEUTRAL_COLUMNS = new Set<ColumnId>([
  COL.NODE_FILL_COLOR,
  COL.NODE_BORDER_COLOR,
  COL.NODE_BORDER_WIDTH,
  COL.NODE_OPACITY,
  COL.EDGE_LINE_COLOR,
  COL.EDGE_OPACITY,
  // arrows are never pickable, and the pick pass draws edges only
  COL.EDGE_SOURCE_ARROW,
  COL.EDGE_TARGET_ARROW,
]);

/**
 * Backpressure: at most this many scene submissions may be unfinished on
 * the GPU.  Without the cap, a GPU-bound graph accumulates an unbounded
 * queue of ~frame-sized submissions and every pick readback (and the
 * visible viewport itself) falls further and further behind; with it, a
 * behind GPU makes the loop skip encoding and coalesce viewport/model
 * state into the next frame instead.
 */
export const MAX_IN_FLIGHT_FRAMES = 2;

/**
 * A worker mount (round 86.3): the main thread created the canvas
 * element, transferred control, and resolved the sizes — the engine
 * draws to the OffscreenCanvas and is told sizes explicitly (a worker
 * has no layout to observe and no devicePixelRatio of its own).
 */
export interface OffscreenMount {
  canvas: OffscreenCanvas;
  /** initial size in device px */
  width: number;
  height: number;
  /** the resolved device-pixel ratio (CSS px × dpr = device px) */
  dpr: number;
}

export class Renderer {
  /** resolves when the device is acquired and the first frame can draw */
  ready: Promise<void>;
  /** the canvas this renderer draws to: created inside the container and
   * removed by destroy() on the same-thread path, or the transferred
   * OffscreenCanvas under a worker mount */
  canvas: HTMLCanvasElement | OffscreenCanvas;

  /** @internal */
  host: RenderHost;
  /** @internal */
  store: RenderStoreView;
  /** @internal */
  device: GPUDevice | null;
  /** @internal */
  mirror: ColumnMirror | null;
  /** @internal */
  dpr: number;
  /** @internal */
  destroyed: boolean;

  /** @internal */
  container: HTMLElement | null;
  /** @internal */
  opts: RendererOptions;
  /** @internal */
  context: GPUCanvasContext | null;
  /** @internal */
  nodePipeline: NodePipeline | null;
  /** @internal */
  imagePipeline: ImagePipeline | null = null;
  /** @internal */
  chartPipeline: ChartPipeline | null = null;
  /** @internal */
  imageArrays: ImageArrays | null = null;
  /** @internal */
  overlayPipeline: NodeLayerPipeline | null = null;
  /** @internal */
  underlayPipeline: NodeLayerPipeline | null = null;
  /** @internal */
  edgePipeline: EdgePipeline | null;
  /** @internal */
  curvedEdgePipeline: CurvedEdgePipeline | null = null;
  /** @internal */
  curvedArrowPipeline: CurvedArrowPipeline | null = null;
  /** @internal */
  arrowPipeline: ArrowPipeline | null;
  /** @internal */
  uniform: GPUBuffer | null;
  /** @internal */
  frameData: Float32Array;
  /** @internal */
  isReady: boolean;
  private frameRequested: boolean;
  /** @internal */
  resizeObserver: ResizeObserver | null;
  /** live device-pixel-ratio tracking (91.2): true when the ctor left
   * `pixelRatio` 'auto', so every measure re-reads `devicePixelRatio`
   * @internal */
  autoDpr: boolean;
  /** tears down the armed matchMedia resolution listener (91.2) @internal */
  offDprChange: (() => void) | null = null;
  /** re-entrancy latch (91.1): a `cy.resize()` from inside a 'render'
   * handler must schedule rather than recurse into frame()
   * @internal */
  inFrame = false;
  /** @internal */
  offInvalidate: () => void;
  /** @internal */
  offViewport: () => void;
  /** @internal */
  frameCount: number;
  /** @internal */
  cpuFrameMs: number;
  /** @internal */
  gpuTimer: GpuTimer | null;
  /** @internal */
  picking: Picking | null;
  /** @internal */
  pickUniform: GPUBuffer | null;
  /** @internal */
  pickFrameData: Float32Array;
  /** @internal */
  needsRedraw: boolean;
  /** @internal */
  inFlightFrames: number;
  /** the store compaction epoch this renderer last synced against (19.4) @internal */
  seenCompactEpoch = 0;
  /** @internal */
  labelLayer: LabelLayer | null;
  /** @internal */
  onFontsLoadingDone: (() => void) | null = null;
  /** wired by the factory: an external device loss hands recovery to the core */
  onDeviceLost: ((message: string) => void) | null = null;
  /** @internal */
  labelPipeline: LabelPipeline | null = null;
  /** @internal */
  edgeLabelPipeline: LabelPipeline | null = null;
  /** @internal */
  cullKernels: CullKernels | null;
  /** @internal */
  mapperRuntime: MapperRuntime | null;
  /** @internal */
  tweenRuntime: GpuTweenRuntime | null;
  /** @internal */
  sceneCull: SceneCullGroups | null;
  /** @internal */
  pickCull: { edge: CulledGroup; curved: CulledGroup } | null;
  /** @internal */
  scaleCtl: ScaleController;
  /** @internal */
  settleTimer: ReturnType<typeof setTimeout> | null;
  /** @internal */
  format: GPUTextureFormat | null;
  /** @internal */
  sceneTarget: GPUTexture | null;
  /** @internal */
  depthTarget: GPUTexture | null;
  /** @internal */
  upscaler: Upscaler | null;
  /** @internal */
  pendingExports: ExportJob[];
  /** @internal */
  exportUniform: GPUBuffer | null;
  /** the device-side straight-alpha pack an export's readback maps (110.4) @internal */
  exportPacker: ExportPacker | null;
  /** @internal */
  exportFrameData: Float32Array;
  /** @internal */
  exportCull: SceneCullGroups | null;
  /** the parent draw permutation on-GPU (round 14.9): re-uploaded when
   * the hierarchy's (depth, slot) order object changes identity
   * @internal */
  parentOrderBuf: GPUBuffer | null = null;
  /** @internal */
  parentOrderRef: Uint32Array | null = null;
  /** @internal */
  parentOrderVersion = 0;

  /**
   * Creates and mounts the canvas, subscribes to store invalidation,
   * viewport events, container resizes and font loading, then starts
   * device acquisition.  Device-dependent state (mirror, pipelines,
   * cull kernels, label layer, picking) is all null until `ready`
   * resolves, and frames scheduled before then are no-ops — so nothing
   * here throws when WebGPU is unavailable; the failure surfaces through
   * `ready` instead.
   *
   * The container gets `position: relative` when it is statically
   * positioned, since the canvas is absolutely positioned within it.
   *
   * @param cy — the core this renderer draws; its store, animations and
   * viewport are read every frame and its `viewport` event is subscribed
   * @param container — the element the canvas is appended to and whose
   * size the canvas follows
   * @param opts — renderer options; `pixelRatio` ('auto' or a number)
   * fixes the device-px scale, and renderScaleMin/Max bound the adaptive
   * render scale
   */
  constructor(
    host: RenderHost,
    mount: HTMLElement | OffscreenMount,
    opts: RendererOptions & { pixelRatio?: number | 'auto' } = {},
  ) {
    const offscreen = 'canvas' in mount ? (mount as OffscreenMount) : null;

    this.host = host;
    this.store = host.store;
    this.container = offscreen == null ? (mount as HTMLElement) : null;
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
    // 19 Frame fields; WGSL rounds the struct to 80 bytes (align 8), so
    // the arrays carry 20 floats and the buffers bind the full 80
    this.frameData = new Float32Array(20);
    this.isReady = false;
    this.frameRequested = false;
    this.destroyed = false;
    this.frameCount = 0;
    this.cpuFrameMs = 0;
    this.gpuTimer = null;
    this.picking = null;
    this.pickUniform = null;
    this.pickFrameData = new Float32Array(20);
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
      opts.renderScaleMax ?? DEFAULT_RENDER_SCALE_MAX,
    );
    this.settleTimer = null;
    this.format = null;
    this.sceneTarget = null;
    this.depthTarget = null;
    this.upscaler = null;
    this.pendingExports = [];
    this.exportUniform = null;
    this.exportPacker = null;
    this.exportFrameData = new Float32Array(20);
    this.exportCull = null;

    // re-raster glyph runs when web fonts finish loading: glyphs cached
    // before a FontFace resolves were rasterized from the fallback face
    if (
      typeof document !== 'undefined' &&
      document.fonts?.addEventListener != null
    ) {
      this.onFontsLoadingDone = () => {
        if (this.destroyed || this.labelLayer == null) {
          return;
        }

        this.labelLayer.reraster();
        this.requestRender();
      };
      document.fonts.addEventListener('loadingdone', this.onFontsLoadingDone);
    }

    if (offscreen != null) {
      // worker mount: the canvas came transferred and pre-sized; the
      // main thread resolved the dpr (a worker has none of its own) and
      // re-resolves it per resize (setSize carries the ratio, 91.2)
      this.autoDpr = false;
      this.dpr = offscreen.dpr;
      this.canvas = offscreen.canvas;
      this.canvas.width = Math.max(1, offscreen.width);
      this.canvas.height = Math.max(1, offscreen.height);
    } else {
      const container = mount as HTMLElement;

      this.autoDpr = opts.pixelRatio == null || opts.pixelRatio === 'auto';
      this.dpr = this.autoDpr
        ? globalThis.devicePixelRatio || 1
        : (opts.pixelRatio as number);

      const doc = container.ownerDocument as Document;
      const canvas = doc.createElement('canvas');

      // no width/height CSS here: applySize below writes the fixed-px
      // box (91.1) — see its doc for why fixed px rather than `100%`
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.display = 'block';

      if (
        doc.defaultView != null &&
        doc.defaultView.getComputedStyle(container).position === 'static'
      ) {
        container.style.position = 'relative';
      }

      container.appendChild(canvas);
      this.canvas = canvas;
      this.applySize();
    }

    this.offInvalidate = host.store.onInvalidate(() => {
      this.needsRedraw = true;
      this.schedule();
    });
    this.offViewport = host.onViewportChange(() => {
      this.needsRedraw = true;
      this.picking?.invalidateCache(); // cached pick tile is in device px
      this.schedulePromotionCheck(); // svg zoom-promotion meter (15.6)
      this.schedule();
    });

    this.resizeObserver =
      this.container != null && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => this.resize())
        : null;

    if (this.container != null) {
      this.resizeObserver?.observe(this.container);
    }

    this.armDprListener();

    this.ready = frameImpl.init(this);
  }

  /**
   * A snapshot of the frame counters and subsystem meters.  Cheap and
   * side-effect free, so it is safe to poll every frame; the counters
   * are cumulative and never reset, and everything device-dependent
   * reads 0 before `ready` resolves.  `gpuFrameMs` stays 0 on adapters
   * without 'timestamp-query'.
   */
  stats(): RendererStats {
    return lifecycleImpl.stats(this);
  }

  /**
   * Resize the canvas to the container and redraw — synchronously
   * (91.1).  Wired to a ResizeObserver on the container, so callers only
   * need this when the size changes without one firing (no
   * ResizeObserver, or a device-pixel ratio change).  The scene and
   * depth targets are not reallocated here — the frame notices the new
   * size and rebuilds them.
   *
   * The frame is drawn inside this call rather than scheduled because
   * ResizeObserver callbacks run *after* this rendering update's rAF and
   * *before* its paint: a `schedule()`d redraw lands a frame late, and
   * with any stale presentation the compositor scales old content to the
   * new layout — every step of a live window drag showed the graph
   * stretched.  Drawing here means the frame that composites the new
   * layout composites new content; the stretched frame never exists.
   * Before readiness, or re-entrantly from a 'render' handler, it falls
   * back to the scheduler.
   */
  resize(): void {
    lifecycleImpl.resize(this);
  }

  /**
   * Watch for device-pixel-ratio changes (91.2): browser zoom or a move
   * to a different-density monitor changes `devicePixelRatio` without
   * changing `clientWidth` (CSS px), so the ResizeObserver never fires —
   * the standing hook is a matchMedia resolution query, re-armed per
   * change because a query only matches the ratio it was built with.
   * Armed only while the ratio is 'auto'; an explicit `pixelRatio`
   * number stays pinned, and a worker mount has no matchMedia (the main
   * thread re-resolves and setSize carries the ratio).  The change
   * handler re-measures through `resize()` (applySize re-reads the live
   * ratio) and emits `resize` on the core — v3's `cy.resize()`
   * semantics for a re-rasterizing viewport.
   * @internal
   */
  armDprListener(): void {
    lifecycleImpl.armDprListener(this);
  }

  /** True while a GPU force-layout run owns the position column (18.3) —
   * a slot compaction must defer rather than move slots under the sim. */
  forceActive(): boolean {
    return this.forceRuntime != null && !this.forceRuntime.converged();
  }

  /** Force a redraw on the next frame (the loop is otherwise render-on-dirty). */
  requestRender(): void {
    if (this.destroyed) {
      return;
    }

    this.needsRedraw = true;
    this.schedule();
  }

  /** Test hook: destroy the device out from under the renderer (a real loss). */
  _debugLoseDevice(): void {
    this.device?.destroy();
  }

  /**
   * Tear the renderer down: unsubscribe every listener and timer, reject
   * any pending image export, destroy every owned GPU object and finally
   * the device itself, and remove the canvas from the DOM.  Idempotent,
   * and safe to call before `ready` resolves — the in-flight init sees
   * the destroyed flag and abandons.
   *
   * The core is not destroyed, but it is left renderer-less: the
   * animation driver is detached and the image decoder is unset, so the
   * store goes headless again.  Everything after this is a no-op; a new
   * renderer must be mounted to draw again (which is how device-loss
   * recovery works).
   */
  destroy(): void {
    lifecycleImpl.destroy(this);
  }

  // -- picking --

  /**
   * Pick at a rendered (CSS px) position.  Resolves with the packed pick
   * id of the element under the point — a node's `slot + 1`, or an edge's
   * `slot + 1` with {@link EDGE_PICK_BIT} set — or null for
   * background/unknown.  Decoding an id to an element (and re-validating
   * it against the live model, since a GPU pick can be up to two frames
   * stale) is the core's job (`Core._decodePick`, round 86.2): the
   * renderer speaks slots and ids only, so a worker host can answer
   * picks over a message channel.  Three stages, cheapest first:
   *
   * 1. nodes: synchronous CPU pick — exact, zero GPU work, answers in the
   *    same microtask;
   * 2. the cached pick tile: while the cursor stays inside the last GPU
   *    tile and nothing invalidated it, edge/background answers are
   *    instant;
   * 3. GPU edge pick: draws only the cursor tile, submits ahead of scene
   *    work, so latency is ~one rAF plus bounded in-flight GPU work
   *    (latest-wins coalescing; requests never queue up — a saturated
   *    staging ring defers the coalesced request a frame, never drops it).
   *
   * **The tiers resolve leaf > edge > parent** (round 97.1), which is the
   * reverse of what v4 draws — every compound parent draws in one
   * *pre-edge* stream (`cull.mts`, `HierarchyIndex.parentOrder()`), then
   * edges, then leaves — so what you see is what you pick, the pick
   * pass's own contract.  A leaf hit therefore answers from stage 1 and
   * skips the GPU entirely; a *parent* hit is held while stages 2–3
   * answer and is returned only over background.  The cost lands where
   * the defect was: a click or hover inside a parent body now awaits the
   * edge tile once, where it used to answer synchronously.
   *
   * v3 resolves the same three by its own draw order, which interleaves
   * parents and edges by compound depth (`zsort.mts`, driven by `z-index`
   * / `z-compound-depth` — both dropped in v4, 2026-08-01), so a deeply
   * nested v3 parent can beat a shallower edge.  v4's flat tier is the
   * deviation that follows, recorded in `src/README.md`.
   */
  async pick(
    x: number,
    y: number,
    pads?: { edgePadPx?: number; nodePadPx?: number },
  ): Promise<number | null> {
    return pickImpl.pick(this, x, y, pads);
  }

  /**
   * Synchronous CPU node pick at a rendered (CSS px) position — exact and
   * current (no in-flight staleness).  Answers the node's slot; wrapping
   * it into a Collection is the caller's job (round 86.2).  Edges are not
   * considered; they resolve through the async `pick()`.
   *
   * @param padPx — hit halo in CSS px (57.9): v3's nodeThreshold,
   *   inflating every node's tested size by the halo on each side;
   *   0 (the default) picks exactly what is drawn
   */
  pickNodeSync(x: number, y: number, padPx: number = 0): number | null {
    if (this.destroyed || !this.isReady) {
      return null;
    }

    return pickImpl.cpuPickNode(
      this,
      x * this.dpr,
      y * this.dpr,
      padPx * this.dpr,
    );
  }

  /** @internal */
  pickLatencyMs(): number {
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
  async exportImage(opts: ExportOptions = {}): Promise<ExportedImage> {
    return exportImpl.exportImage(this, opts);
  }

  /**
   * Queue an export of a pre-resolved view (round 86.3): the worker
   * proxy computes the view on the main thread — where the container's
   * CSS size and the model bounding box live — and the engine validates
   * it against the device and renders it.  The same-thread
   * `exportImage` funnels through here too.
   *
   * @param view — output px dimensions + the Frame transform
   * @returns straight-alpha RGBA pixels, as `exportImage`
   */
  async exportFromView(view: ExportView): Promise<ExportedImage> {
    return exportImpl.exportFromView(this, view);
  }

  /** @internal */
  imagePromoteTimer: ReturnType<typeof setTimeout> | null = null;

  /** the live GPU force integrator (round 18.3), while a run holds it @internal */
  forceRuntime: GpuForceRuntime | null = null;
  /** @internal */
  forceStepsPerFrame = 3;
  /** @internal */
  forcePresents = true;
  /** the iterations this frame encodes (119): `forceStepsPerFrame` for
   * a presenting run — the watchable rate — and an adaptive batch for
   * a silent or tweened one, which nobody watches mid-run
   * @internal */
  forceBatch = 3;
  /** the last frame skipped its scene pass under backpressure while a
   * force run was encoding (119): the device is behind, and a
   * non-presenting run's batch should shrink
   * @internal */
  forceFrameSkipped = false;
  /** the device's own price of the last non-presenting batch (121.5):
   * the GPU time its frame took — from the later of its submit and the
   * previous frame's completion to its own — and the iterations it
   * carried.  The frame's wall clock cannot see this: a vsync-paced
   * frame submits and returns while the queue absorbs the work, until
   * the frames in flight fill and the stall lands all at once
   * @internal */
  forcePriceMs = 0;
  /** @internal */
  forcePriceBatch = 0;
  /** @internal */
  forceDoneAt = 0;

  /**
   * Start the GPU force integrator (18.3): returns null when the device
   * isn't ready (the layout falls back to the CPU executor).  The frame
   * loop encodes the sim ahead of the cull pass either way; `present`
   * decides what the run publishes into (87.2).  Presenting —
   * `animate: true` — publishes into the mirror's position column, so
   * node.position is GPU-owned for the run (the tween lease machinery)
   * and the graph moves on screen.  A silent run publishes into a
   * runtime-owned scratch buffer instead: the mirror column is never
   * touched, no ownership is taken, and the screen holds the pre-run
   * frame until the settle readback lands the final positions through
   * the normal dirty-span upload.
   */
  startForce(
    inputs: ForceInputs,
    stepsPerFrame: number,
    present: boolean = true,
  ): GpuForceRuntime | null {
    return forceImpl.startForce(this, inputs, stepsPerFrame, present);
  }

  /** Detach + destroy the integrator (after the settle readback). */
  finishForce(): void {
    this.forceRuntime?.destroy();
    this.forceRuntime = null;
  }

  /**
   * Wake an idle force run (118.3): an infinite run's runtime reports
   * `idle()` once the field is at rest, the frame loop stops encoding
   * it and the clock stops with it, so a reheat — a drag, a moved
   * node — has to ask for a frame.
   */
  wakeForce(): void {
    if (this.forceRuntime != null) {
      this.needsRedraw = true;
      this.schedule();
    }
  }

  /** Debounced zoom-promotion check: the svg re-raster meter (15.6)
   * and the label atlas tier meter (round 94) share one settle timer —
   * both run shortly after the viewport settles, never per wheel tick.
   * @internal */
  schedulePromotionCheck(): void {
    forceImpl.schedulePromotionCheck(this);
  }

  // -- internals --

  /** @internal */
  schedule(): void {
    if (this.frameRequested || this.destroyed || !this.isReady) {
      return;
    }

    this.frameRequested = true;

    requestAnimationFrame(() => {
      this.frameRequested = false;
      this.frame();
    });
  }

  /** @internal */
  frame(): void {
    this.inFrame = true;

    try {
      frameImpl.frameBody(this);
    } finally {
      this.inFrame = false;
    }
  }

  // -- deferred pipelines --

  /*
   * A GPURenderPipeline costs nothing to *create* — Dawn returns from
   * createRenderPipeline immediately and compiles the shader when the
   * pipeline is first used — so building the whole set at init does not
   * pay for itself: it moves that compilation onto the first frame,
   * including for every feature the graph does not use.
   *
   * Measured on the SwiftShader adapter CI pins, with a one-node graph,
   * as the wall time of the first presented frame: 4.6 s for the full set
   * against 1.06 s with no draw pipelines at all.  The feature pipelines
   * below are 1.8 s of that — curved edges 0.68, curved arrows 0.28, edge
   * labels 0.22, images 0.17, charts 0.13, node labels/overlay/underlay
   * the rest — and a graph with no curved edge, no label and no image
   * never draws one of them.  A real adapter shows the same shape an
   * order of magnitude smaller (0.53 s), so this is first-frame latency
   * for every consumer, not only a CI cost.
   *
   * Each accessor below is called from inside the guard that decides
   * whether its draw runs at all, so the pipeline is built on the frame
   * that first needs it and never before.  They are not cleared when the
   * feature goes away again: compiling twice costs more than holding one.
   */

  /**
   * Measure the container and size both halves of the canvas from it:
   * the backing store in device px (clientWidth × dpr) and the CSS box
   * in fixed px (91.1).  Fixed px rather than `100%` is v3's shape:
   * whenever a redraw is late behind a layout change, a wrongly-*sized*
   * canvas letterboxes where a `100%` canvas stretches whatever was last
   * presented — stale coverage reads as lag; stale stretch reads as the
   * graph deforming.  It also covers the no-ResizeObserver path, where
   * nothing re-measures until `cy.resize()`.
   *
   * With `pixelRatio: 'auto'` the device-pixel ratio is re-read per
   * measure (91.2), so a browser-zoom or monitor-density change
   * re-rasterizes rather than blurring at the construction-time ratio; a
   * ratio change drops the cached pick tile (device px).
   * @internal
   */
  applySize(): void {
    targetsImpl.applySize(this);
  }

  /**
   * Explicit device-px resize for the worker mount (round 86.3), where
   * the main thread observes the container and messages the new size.
   * The same-thread path keeps its ResizeObserver + applySize.
   *
   * @param wPx — canvas width in device px (floored to 1)
   * @param hPx — canvas height in device px (floored to 1)
   * @param dpr — the main thread's re-resolved device-pixel ratio
   *   (91.2); omitted, the current ratio stands
   */
  setSize(wPx: number, hPx: number, dpr?: number): void {
    targetsImpl.setSize(this, wPx, hPx, dpr);
  }

  /** Low-res scene target dimensions (must match writeFrameUniform). @internal */
  scaledSize(): { w: number; h: number } {
    const scale = this.scaleCtl.scale;

    return {
      w: Math.max(1, Math.round(this.canvas.width * scale)),
      h: Math.max(1, Math.round(this.canvas.height * scale)),
    };
  }
}
