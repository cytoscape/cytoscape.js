import type { ModelView, GroupName } from '../contract.mjs';
import type {
  GraphStore,
  MapperSpan,
  NodeImageRecord,
} from '../store/graph-store.mjs';
import type { StyleEngine } from '../style.mjs';
import type { GpuTweenSink } from '../animation.mjs';
import type { Position } from '../public-types.mjs';
import type { LabelStream } from '../contract.mjs';
import type { Core } from '../core.mjs';
import type { ImageDecoder } from '../image-registry.mjs';

/*
The model↔renderer seam (round 86.2).

The renderer used to reach into the core (`cy._store`, `cy._styleEngine`,
`cy._viewport`, `cy._animations`, `cy._ele`, `cy.on`/`cy.emit`); this
module is the enumerated replacement.  Everything the renderer consumes
now arrives through one {@link RenderHost} handed to its constructor, so
the renderer never imports the core and the host is the complete census
of what crosses the model↔renderer boundary — which is what a worker
host (86.3), a WebGL fallback renderer (round 73) or a headless-Node
renderer would mount through.

The same-thread host ({@link coreRenderHost}) is a thin closure over the
core and must stay behaviourally identical to the direct reads it
replaced; the worker host implements the same surface over mirrored
state fed by span messages.
*/

/** Which arrow ends (source/target) any styled record can enable. */
export interface ArrowEndFlags {
  source: boolean;
  target: boolean;
}

/**
 * The store surface the renderer and its label layer actually consume,
 * beyond the column/delta/label/blob surface {@link ModelView} already
 * pins.  `GraphStore` satisfies it structurally; the worker host's
 * remote view implements it over local mirrors.  Kept as an explicit
 * interface — rather than typing against `GraphStore` — because this
 * list *is* the 86.1 coupling audit's store column, and a new renderer
 * read has to be added here, visibly, before it can compile.
 */
export interface RenderStoreView extends ModelView {
  /** live element count (stats reporting only) */
  count(group: GroupName): number;
  /** flush derived geometry (parent auto-bounds, curve params) so reads
   * are current; a no-op on a remote view (the producer flushed) */
  flushDerived(): void;
  /** model-space bounds, for full-graph export views */
  boundingBox(includeLabels?: boolean): {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    w: number;
    h: number;
  } | null;
  /** epoch bumped by slot compaction: glyph owner words are stale wholesale */
  readonly compactEpoch: number;
  /** data spans for the GPU mapper runtime; drained by its update() */
  takeMapperSpans(): MapperSpan[];

  // -- frame-uniform scalars (all model px) --
  curveSlack(): number;
  haystackSlack(): number;
  outlineSlack(): number;
  arrowScaleMax(): number;
  arrowWidthMax(): number;

  // -- draw-gating counts: a zero skips the feature's whole pass --
  parentCount(): number;
  ghostCount(): number;
  overlayCount(): number;
  underlayCount(): number;
  edgeOverlayCount(): number;
  edgeUnderlayCount(): number;
  casingCount(): number;
  midArrowCount(): number;
  chartCount(): number;
  imageCount(): number;
  hasCurvedEdges(): boolean;

  // -- background images (the promotion meter reads records directly) --
  nodeImagesAt(slot: number): NodeImageRecord[] | null;

  // -- the label layer's write-back and font surface --
  markAllLabelsDirty(): void;
  setLabelDims(slot: number, group: LabelStream, w: number, h: number): void;
  labelFont: string;
  labelFontStyle: string;
  labelFontWeight: string;
}

/**
 * The animation clock surface: the renderer ticks CPU animations on its
 * frame clock and offers its GPU tween runtime as the sink.  The worker
 * host stubs all four — the animation manager keeps its own main-side
 * rAF loop and every tween takes the CPU path (its column writes cross
 * as ordinary spans).
 */
export interface AnimationClock {
  /** advance CPU tweens; register/settle GPU tweens against the sink */
  tick(now: number): void;
  /** whether anything is animating (keeps the frame loop scheduled) */
  active(): boolean;
  /** the renderer takes over the clock and provides the GPU tween sink */
  attachDriver(sink: GpuTweenSink): void;
  /** release GPU-owned columns and drop the sink (renderer teardown) */
  detachDriver(): void;
}

/** Read-only viewport state, read per frame. */
export interface ViewportView {
  pan(): Position;
  zoom(): number;
}

/**
 * Everything the renderer consumes from the model side, in one place.
 * Constructed by {@link coreRenderHost} for the same-thread path and by
 * the worker host over mirrored state.
 */
export interface RenderHost {
  store: RenderStoreView;
  viewport: ViewportView;
  animations: AnimationClock;
  /** which endpoint arrow ends any style block enables (skips draws) */
  arrowEnds(): ArrowEndFlags;
  /** which mid-edge arrow ends any style block enables */
  midArrowEnds(): ArrowEndFlags;
  /** subscribe to viewport changes; returns the unsubscribe fn */
  onViewportChange(cb: () => void): () => void;
  /** a frame was drawn (the core's 'render' event) */
  emitRender(): void;
  /** the viewport re-measured without `cy.resize()` — a device-pixel-
   * ratio change re-rasterized (the core's 'resize' event, 91.2) */
  emitResize(): void;
  /** a fatal renderer error with no better channel (the 'error' event) */
  emitError(message: string): void;
  /**
   * The GPU style-mapper seam: present on the same-thread host, where
   * the mapper runtime reads compiled paint programs and the user-data
   * columns directly; null under a worker host, where no mapper runtime
   * exists and the CPU-applied style columns stay canonical (their spans
   * cross like any other column).
   */
  gpuMappers: { store: GraphStore; styleEngine: StyleEngine } | null;
  /**
   * The image decoder this environment can offer the registry, or null
   * when image decoding is unavailable (the worker host, pass 1).  The
   * renderer sets it on the registry at init and clears it at destroy.
   */
  createImageDecoder(): ImageDecoder | null;
}

/**
 * The same-thread host: a thin closure over the core, replacing the
 * renderer's former direct `cy._*` reads one for one.  Behaviour must
 * stay byte-identical to those reads — this function is wiring, never
 * policy.
 */
export function coreRenderHost(
  cy: Core,
  createImageDecoder: () => ImageDecoder | null,
): RenderHost {
  return {
    store: cy._store,
    viewport: cy._viewport,
    animations: cy._animations,
    arrowEnds: () => cy._styleEngine.arrowEnds,
    midArrowEnds: () => cy._styleEngine.midArrowEnds,
    onViewportChange: (cb) => {
      cy.on('viewport', cb);

      return () => cy.off('viewport', cb);
    },
    emitRender: () => cy.emit('render'),
    emitResize: () => cy.emit('resize'),
    emitError: (message) => cy.emit({ type: 'error' }, [message]),
    gpuMappers: { store: cy._store, styleEngine: cy._styleEngine },
    createImageDecoder,
  };
}
