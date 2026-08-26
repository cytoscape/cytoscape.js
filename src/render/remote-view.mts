import { COLUMN_SPECS } from '../contract.mjs';
import type {
  ColumnArray,
  ColumnId,
  ColumnSpec,
  GroupName,
  LabelEntry,
  LabelStream,
  StoreDelta,
} from '../contract.mjs';
import { DirtyTracker } from '../store/dirty.mjs';
import { ImageRegistry } from '../image-registry.mjs';
import type { NodeImageRecord } from '../store/graph-store.mjs';
import type { MapperSpan } from '../store/graph-store.mjs';
import { LABEL_STREAMS, SPEC_BY_ID } from './worker-protocol.mjs';
import type { StoreBatch, WireBlob } from './worker-protocol.mjs';
import type { RenderStoreView } from './host.mjs';

/*
The worker-side model view (round 86.3): a `RenderStoreView` over local
typed arrays fed by {@link StoreBatch} messages.  The renderer and its
label layer consume it exactly as they consume the canonical
`GraphStore` on the same-thread path — the seam (86.2) is what makes
the two interchangeable.  Applying a batch is the only write path, and
it re-expresses the batch as local dirty state through the same
`DirtyTracker` class the store uses, so the renderer's frame drains an
ordinary `StoreDelta`.
*/

interface BlobState {
  pool: Float32Array;
  length: number;
  dirt: { resized: boolean; start: number; end: number } | null;
}

const emptyBlob = (): BlobState => ({
  pool: new Float32Array(0),
  length: 0,
  dirt: null,
});

const applyBlob = (state: BlobState, wire: WireBlob | undefined): void => {
  if (wire == null) {
    return;
  }

  if (wire.resized || wire.length > state.pool.length) {
    state.pool = new Float32Array(Math.max(wire.length, 1));
    state.pool.set(new Float32Array(wire.bytes), 0);
    state.dirt = { resized: true, start: 0, end: wire.length };
  } else {
    state.pool.set(new Float32Array(wire.bytes), wire.start);

    const dirt = state.dirt ?? {
      resized: false,
      start: wire.start,
      end: wire.end,
    };

    dirt.start = Math.min(dirt.start, wire.start);
    dirt.end = Math.max(dirt.end, wire.end);
    state.dirt = dirt;
  }

  state.length = wire.length;
};

/**
 * The worker-hosted renderer's store: local columns, blobs, labels and
 * scalars mirrored from the main thread's canonical store, one batch at
 * a time.  Implements the full {@link RenderStoreView} seam.
 */
export class RemoteModelView implements RenderStoreView {
  /** the label font family, mirrored from the canonical store */
  labelFont = 'sans-serif';
  /** the label CSS font-style, mirrored from the canonical store */
  labelFontStyle = 'normal';
  /** the label CSS font-weight, mirrored from the canonical store */
  labelFontWeight = 'normal';
  /** an empty registry: pass 1 does not decode images in the worker,
   * and the proxy forces the image count to zero (recorded deferral) */
  images = new ImageRegistry();

  private columns = new Map<ColumnId, ColumnArray>();
  private capacities = { nodes: 0, edges: 0 };
  private highWaters = { nodes: 0, edges: 0 };
  private tracker = new DirtyTracker();
  private blobs = {
    curve: emptyBlob(),
    poly: emptyBlob(),
    image: emptyBlob(),
    chart: emptyBlob(),
  };
  private labels = new Map<LabelStream, Map<number, LabelEntry>>();
  private labelDirty = new Map<LabelStream, Set<number>>();
  private parentOrderArr = new Uint32Array(0);
  private scalars = {
    curveSlack: 0,
    haystackSlack: 0,
    outlineSlack: 0,
    arrowScaleMax: 0,
    arrowWidthMax: 0,
  };
  private counts: StoreBatch['counts'] = {
    nodes: 0,
    edges: 0,
    parents: 0,
    ghosts: 0,
    overlays: 0,
    underlays: 0,
    edgeOverlays: 0,
    edgeUnderlays: 0,
    casings: 0,
    midArrows: 0,
    charts: 0,
    images: 0,
    curved: false,
  };
  private epoch = 0;
  /** measured label dims flow back to the canonical store (nodeLabelBox
   * and label bounds live main-side) */
  private postDims: (dims: [LabelStream, number, number, number][]) => void;
  private pendingDims: [LabelStream, number, number, number][] = [];

  /**
   * @param postDims — called once per microtask burst with the label
   *   dims the layer measured, for the proxy to write back into the
   *   canonical store
   */
  constructor(
    postDims: (dims: [LabelStream, number, number, number][]) => void,
  ) {
    this.postDims = postDims;

    for (const stream of LABEL_STREAMS) {
      this.labels.set(stream, new Map());
      this.labelDirty.set(stream, new Set());
    }
  }

  /**
   * Apply one batch from the canonical store: realloc on capacity
   * growth, copy spans, merge blob dirt, update labels and the scalar
   * surface — and re-express all of it as local dirty state so the
   * renderer's next frame uploads exactly what changed.
   *
   * @param batch — the batch to apply (the init transfer included)
   */
  applyBatch(batch: StoreBatch): void {
    for (const group of ['nodes', 'edges'] as GroupName[]) {
      if (batch.capacity[group] !== this.capacities[group]) {
        this.capacities[group] = batch.capacity[group];

        for (const spec of COLUMN_SPECS) {
          if (spec.group === group) {
            this.columns.set(
              spec.id,
              new spec.ctor(
                Math.max(1, batch.capacity[group]) * spec.components,
              ) as ColumnArray,
            );
          }
        }

        this.tracker.markResized(group);
      } else if (batch.resized[group]) {
        this.tracker.markResized(group);
      }
    }

    this.highWaters = { ...batch.highWater };

    for (const span of batch.spans) {
      const spec = SPEC_BY_ID.get(span.column) as ColumnSpec;
      const local = this.columns.get(span.column) as ColumnArray;
      const src = new spec.ctor(span.bytes);

      (local as Float32Array).set(
        src as Float32Array,
        span.start * spec.components,
      );
      this.tracker.mark(span.column, span.start, span.end);
    }

    applyBlob(this.blobs.curve, batch.blobs.curve);
    applyBlob(this.blobs.poly, batch.blobs.poly);
    applyBlob(this.blobs.image, batch.blobs.image);
    applyBlob(this.blobs.chart, batch.blobs.chart);

    for (const { stream, slot, entry } of batch.labels) {
      const map = this.labels.get(stream) as Map<number, LabelEntry>;

      if (entry == null) {
        map.delete(slot);
      } else {
        map.set(slot, entry);
      }

      (this.labelDirty.get(stream) as Set<number>).add(slot);
    }

    if (batch.parentOrder != null) {
      this.parentOrderArr = new Uint32Array(batch.parentOrder);
    }

    this.epoch = batch.compactEpoch;
    this.scalars = { ...batch.scalars };
    this.counts = { ...batch.counts };
    this.labelFont = batch.labelFont;
    this.labelFontStyle = batch.labelFontStyle;
    this.labelFontWeight = batch.labelFontWeight;

    // schedule a frame even when the batch carried only labels/blobs
    this.tracker.touch();
  }

  // -- ModelView --

  /** @returns the group's slot capacity */
  capacity(group: GroupName): number {
    return this.capacities[group];
  }

  /** @returns the group's high water mark */
  highWater(group: GroupName): number {
    return this.highWaters[group];
  }

  /** @returns the local mirror of the column */
  column(id: ColumnId): ColumnArray {
    let col = this.columns.get(id);

    if (col == null) {
      const spec = SPEC_BY_ID.get(id) as ColumnSpec;

      col = new spec.ctor(
        Math.max(1, this.capacities[spec.group]) * spec.components,
      ) as ColumnArray;
      this.columns.set(id, col);
    }

    return col;
  }

  /** @returns whether any batch state is waiting for a frame */
  hasDirty(): boolean {
    return this.tracker.hasDirty();
  }

  /** @returns the accumulated delta (blob dirt attached), cleared */
  takeDelta(): StoreDelta {
    const delta = this.tracker.take(
      this.highWaters.nodes,
      this.highWaters.edges,
    );

    if (this.blobs.curve.dirt != null) {
      delta.curveBlob = this.blobs.curve.dirt;
      this.blobs.curve.dirt = null;
    }

    if (this.blobs.poly.dirt != null) {
      delta.polyBlob = this.blobs.poly.dirt;
      this.blobs.poly.dirt = null;
    }

    if (this.blobs.image.dirt != null) {
      delta.imageBlob = this.blobs.image.dirt;
      this.blobs.image.dirt = null;
    }

    if (this.blobs.chart.dirt != null) {
      delta.chartBlob = this.blobs.chart.dirt;
      this.blobs.chart.dirt = null;
    }

    return delta;
  }

  /** @returns the unsubscribe fn; fires once per applied-batch burst */
  onInvalidate(cb: () => void): () => void {
    return this.tracker.onInvalidate(cb);
  }

  /** @returns the curve param pool */
  curveBlob(): Float32Array {
    return this.blobs.curve.pool;
  }

  /** @returns the curve pool's live float length */
  curveBlobLength(): number {
    return this.blobs.curve.length;
  }

  /** @returns the custom-polygon point pool */
  polyBlob(): Float32Array {
    return this.blobs.poly.pool;
  }

  /** @returns the polygon pool's live float length */
  polyBlobLength(): number {
    return this.blobs.poly.length;
  }

  /** @returns the image record pool */
  imageBlob(): Float32Array {
    return this.blobs.image.pool;
  }

  /** @returns the image pool's live float length */
  imageBlobLength(): number {
    return this.blobs.image.length;
  }

  /** @returns the chart record pool */
  chartBlob(): Float32Array {
    return this.blobs.chart.pool;
  }

  /** @returns the chart pool's live float length */
  chartBlobLength(): number {
    return this.blobs.chart.length;
  }

  /** @returns the slot's label on the stream, or undefined */
  labelAt(slot: number, group: LabelStream = 'nodes'): LabelEntry | undefined {
    return this.labels.get(group)?.get(slot);
  }

  /** @returns slots whose labels changed since the last call (cleared) */
  takeLabelDirty(group: LabelStream = 'nodes'): number[] {
    const set = this.labelDirty.get(group) as Set<number>;
    const out = [...set];

    set.clear();

    return out;
  }

  /** @returns the parent draw permutation (stable identity between changes) */
  parentOrder(): Uint32Array {
    return this.parentOrderArr;
  }

  /**
   * Node label boxes live main-side, where the canonical label dims are
   * (the CPU pick that consumes them runs on the main thread).
   *
   * @returns null always
   */
  nodeLabelBox(): { x1: number; y1: number; x2: number; y2: number } | null {
    return null;
  }

  // -- RenderStoreView --

  /** @returns the live element count (stats reporting) */
  count(group: GroupName): number {
    return group === 'nodes' ? this.counts.nodes : this.counts.edges;
  }

  /** Derived geometry is flushed by the producer before every batch. */
  flushDerived(): void {}

  /**
   * Export views are resolved on the main thread, where the canonical
   * bounds live.
   *
   * @returns null always
   */
  boundingBox(): {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    w: number;
    h: number;
  } | null {
    return null;
  }

  /** @returns the compaction epoch forwarded from the canonical store */
  get compactEpoch(): number {
    return this.epoch;
  }

  /** @returns an empty list — no GPU mapper runtime exists in the worker */
  takeMapperSpans(): MapperSpan[] {
    return [];
  }

  /** @returns the curve slack scalar (model px) */
  curveSlack(): number {
    return this.scalars.curveSlack;
  }

  /** @returns the haystack slack scalar (model px) */
  haystackSlack(): number {
    return this.scalars.haystackSlack;
  }

  /** @returns the outline slack scalar (model px) */
  outlineSlack(): number {
    return this.scalars.outlineSlack;
  }

  /** @returns the largest arrow scale in use */
  arrowScaleMax(): number {
    return this.scalars.arrowScaleMax;
  }

  /** @returns the widest arrow-bearing edge width in use */
  arrowWidthMax(): number {
    return this.scalars.arrowWidthMax;
  }

  /** @returns the compound parent count */
  parentCount(): number {
    return this.counts.parents;
  }

  /** @returns the ghost-styled node count */
  ghostCount(): number {
    return this.counts.ghosts;
  }

  /** @returns the overlay-styled (or pressed) node count */
  overlayCount(): number {
    return this.counts.overlays;
  }

  /** @returns the underlay-styled node count */
  underlayCount(): number {
    return this.counts.underlays;
  }

  /** @returns the overlay-styled edge count */
  edgeOverlayCount(): number {
    return this.counts.edgeOverlays;
  }

  /** @returns the underlay-styled edge count */
  edgeUnderlayCount(): number {
    return this.counts.edgeUnderlays;
  }

  /** @returns the casing-styled edge count */
  casingCount(): number {
    return this.counts.casings;
  }

  /** @returns the mid-arrow-styled edge count */
  midArrowCount(): number {
    return this.counts.midArrows;
  }

  /** @returns the chart-styled node count */
  chartCount(): number {
    return this.counts.charts;
  }

  /** @returns the image-styled node count (always 0 in pass 1) */
  imageCount(): number {
    return this.counts.images;
  }

  /** @returns whether any edge is curved */
  hasCurvedEdges(): boolean {
    return this.counts.curved;
  }

  /**
   * Image records are not mirrored (pass 1 has no worker images).
   *
   * @returns null always
   */
  nodeImagesAt(): NodeImageRecord[] | null {
    return null;
  }

  /** Mark every labelled slot dirty (label-layer construction/compaction). */
  markAllLabelsDirty(): void {
    for (const stream of LABEL_STREAMS) {
      const dirty = this.labelDirty.get(stream) as Set<number>;

      for (const slot of (
        this.labels.get(stream) as Map<number, LabelEntry>
      ).keys()) {
        dirty.add(slot);
      }
    }

    this.tracker.touch();
  }

  /**
   * Queue a measured label dim for the main thread; the queue flushes
   * once per microtask so a rebuild pass posts one message.
   *
   * @param slot — the labelled slot
   * @param group — the label stream
   * @param w — measured width, model px
   * @param h — measured height, model px
   */
  setLabelDims(slot: number, group: LabelStream, w: number, h: number): void {
    if (this.pendingDims.length === 0) {
      queueMicrotask(() => {
        const dims = this.pendingDims;

        this.pendingDims = [];

        if (dims.length > 0) {
          this.postDims(dims);
        }
      });
    }

    this.pendingDims.push([group, slot, w, h]);
  }
}
