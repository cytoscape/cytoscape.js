import { COLUMN_SPECS } from '../contract.mjs';
import type {
  ColumnId,
  ColumnSpec,
  GroupName,
  LabelEntry,
  LabelStream,
} from '../contract.mjs';
import type { GraphStore } from '../store/graph-store.mjs';
import type { RendererOptions, RendererStats } from '../public-types.mjs';
import type { ExportView } from './renderer.mjs';
import type { ArrowEndFlags } from './host.mjs';

/*
The worker-renderer message contract (round 86.1, written before the
host; 86.3 implements it).  Maintained under the contract.mts
discipline: this file changes first, and both sides — the main-thread
proxy (`worker-renderer.mts`) and the worker engine
(`worker-main.mts` + `remote-view.mts`) — are written against it.

The per-frame traffic is the store's own delta made transferable: one
{@link WireSpan} per dirty column carrying the span's bytes in a fresh
buffer (86.1 measured slice + transfer round trip at 0.035 ms for the
full ndex-x-large position column — the copy design is the committed
one), plus the blob dirt, the label sidecar's dirty entries, and the
scalar/count/font snapshot the renderer reads per frame.  The initial
full-state transfer is the same {@link StoreBatch} shape built with
`full: true`, so there is exactly one apply path on the worker side.
*/

/** One dirty column span with its bytes (transferable). */
export interface WireSpan {
  column: ColumnId;
  /** [start, end) in slots */
  start: number;
  end: number;
  /** the span's bytes: `(end - start) × components` elements */
  bytes: ArrayBuffer;
}

/** One float-blob update (curve/poly/image/chart pools). */
export interface WireBlob {
  /** realloc + full re-upload when true (bytes then cover [0, length)) */
  resized: boolean;
  /** [start, end) in floats when not resized */
  start: number;
  end: number;
  /** the [start, end) floats (or the whole pool when resized) */
  bytes: ArrayBuffer;
  /** the pool's live length in floats */
  length: number;
}

/** One label sidecar change; a null entry clears the slot's label. */
export interface WireLabel {
  stream: LabelStream;
  slot: number;
  entry: LabelEntry | null;
}

/** The scalar surface the frame uniform reads every frame (model px). */
export interface WireScalars {
  curveSlack: number;
  haystackSlack: number;
  outlineSlack: number;
  arrowScaleMax: number;
  arrowWidthMax: number;
}

/** The draw-gating counts the frame reads; a zero skips a whole pass. */
export interface WireCounts {
  nodes: number;
  edges: number;
  parents: number;
  ghosts: number;
  overlays: number;
  underlays: number;
  edgeOverlays: number;
  edgeUnderlays: number;
  casings: number;
  midArrows: number;
  charts: number;
  images: number;
  curved: boolean;
}

/** Viewport state (CSS px pan, unscaled zoom), read per frame. */
export interface WireViewport {
  panX: number;
  panY: number;
  zoom: number;
}

/**
 * One store batch: the delta since the last one (or the full state when
 * built with `full: true`), plus everything else the renderer reads per
 * frame.  Applying a batch is the worker-side `RemoteModelView`'s only
 * write path.
 */
export interface StoreBatch {
  /** capacity per group; growth ⇒ the remote reallocs + expects full columns */
  capacity: { nodes: number; edges: number };
  highWater: { nodes: number; edges: number };
  /** whether each group's capacity changed (mirrors StoreDelta.resized) */
  resized: { nodes: boolean; edges: boolean };
  spans: WireSpan[];
  blobs: {
    curve?: WireBlob;
    poly?: WireBlob;
    image?: WireBlob;
    chart?: WireBlob;
  };
  labels: WireLabel[];
  /** the parent draw permutation, only when its identity changed */
  parentOrder: ArrayBuffer | null;
  compactEpoch: number;
  scalars: WireScalars;
  counts: WireCounts;
  arrows: { ends: ArrowEndFlags; mid: ArrowEndFlags };
  labelFont: string;
  labelFontStyle: string;
  labelFontWeight: string;
  viewport: WireViewport;
}

/** Main → worker messages. */
export type MainMessage =
  | {
      kind: 'init';
      canvas: OffscreenCanvas;
      /** initial canvas size in device px */
      width: number;
      height: number;
      /** the main thread's resolved device-pixel ratio */
      dpr: number;
      opts: RendererOptions;
      batch: StoreBatch;
    }
  | { kind: 'batch'; batch: StoreBatch }
  | { kind: 'viewport'; viewport: WireViewport }
  | { kind: 'resize'; width: number; height: number }
  | {
      kind: 'pick';
      id: number;
      x: number;
      y: number;
      edgePadPx: number;
      nodePadPx: number;
    }
  | { kind: 'export'; id: number; view: ExportView }
  | { kind: 'render' }
  | { kind: 'destroy' };

/** Worker → main messages. */
export type WorkerMessage =
  | { kind: 'ready' }
  | { kind: 'initerror'; message: string }
  | { kind: 'frame'; stats: RendererStats }
  | { kind: 'pickresult'; id: number; hit: number | null }
  | {
      kind: 'exportresult';
      id: number;
      ok: boolean;
      width: number;
      height: number;
      /** straight-alpha RGBA rows (transferred) when ok */
      data: ArrayBuffer | null;
      message: string | null;
    }
  | { kind: 'labeldims'; dims: [LabelStream, number, number, number][] }
  | { kind: 'devicelost'; message: string }
  | { kind: 'error'; message: string };

/** The four label streams, in the order batches drain them. */
export const LABEL_STREAMS: readonly LabelStream[] = [
  'nodes',
  'edges',
  'edgeSource',
  'edgeTarget',
];

/** Column specs by id, for wire (de)serialization on both sides. */
export const SPEC_BY_ID: ReadonlyMap<ColumnId, ColumnSpec> = new Map(
  COLUMN_SPECS.map((spec) => [spec.id, spec]),
);

/** Mutable state the batch builder keeps between drains. */
export interface BatchBuilderState {
  /** the last-sent parent permutation, by identity */
  parentOrderRef: Uint32Array | null;
}

const blobWire = (
  pool: Float32Array,
  length: number,
  dirt: { resized: boolean; start: number; end: number } | undefined,
  full: boolean,
): WireBlob | undefined => {
  if (full) {
    return {
      resized: true,
      start: 0,
      end: length,
      bytes: pool.slice(0, length).buffer,
      length,
    };
  }

  if (dirt == null) {
    return undefined;
  }

  if (dirt.resized) {
    return {
      resized: true,
      start: 0,
      end: length,
      bytes: pool.slice(0, length).buffer,
      length,
    };
  }

  return {
    resized: false,
    start: dirt.start,
    end: dirt.end,
    bytes: pool.slice(dirt.start, dirt.end).buffer,
    length,
  };
};

/**
 * Build a batch from the canonical store: the full state (`full: true`,
 * the init transfer) or a drain of the accumulated delta.  Draining
 * consumes the store's dirty state — the proxy is the tracker's one
 * consumer, exactly as the renderer is on the same-thread path.
 *
 * @param store — the canonical main-thread store
 * @param arrows — the style engine's arrow-end tables, snapshotted
 * @param viewport — the current viewport state
 * @param state — carry between drains (parent-order identity)
 * @param full — build the full state instead of draining the delta
 * @returns the batch; `collectTransfers` lists its transferable buffers
 */
export function buildBatch(
  store: GraphStore,
  arrows: { ends: ArrowEndFlags; mid: ArrowEndFlags },
  viewport: WireViewport,
  state: BatchBuilderState,
  full: boolean,
): StoreBatch {
  // takeDelta flushes derived geometry first (its documented contract),
  // so the columns are current before anything is sliced
  const delta = store.takeDelta();
  const resized = full
    ? { nodes: true, edges: true }
    : { nodes: delta.resized.nodes, edges: delta.resized.edges };
  const spans: WireSpan[] = [];

  for (const spec of COLUMN_SPECS) {
    if (full || resized[spec.group]) {
      // capacity change invalidates the group's remote arrays wholesale:
      // send every column of the group in full, exactly as the mirror
      // re-uploads [0, highWater) on its side
      const col = store.column(spec.id);

      spans.push({
        column: spec.id,
        start: 0,
        end: store.capacity(spec.group),
        bytes: col.slice(0, store.capacity(spec.group) * spec.components)
          .buffer,
      });
    }
  }

  if (!full) {
    for (const span of delta.spans) {
      const spec = SPEC_BY_ID.get(span.column) as ColumnSpec;

      if (resized[spec.group]) {
        continue; // already sent in full above
      }

      const col = store.column(span.column);

      spans.push({
        column: span.column,
        start: span.start,
        end: span.end,
        bytes: col.slice(
          span.start * spec.components,
          span.end * spec.components,
        ).buffer,
      });
    }
  }

  const labels: WireLabel[] = [];

  for (const stream of LABEL_STREAMS) {
    const dirty = full
      ? null // full: walk every labelled slot below
      : store.takeLabelDirty(stream);

    if (dirty != null) {
      for (const slot of dirty) {
        labels.push({
          stream,
          slot,
          entry: store.labelAt(slot, stream) ?? null,
        });
      }
    } else {
      const high = store.highWater(stream === 'nodes' ? 'nodes' : 'edges');

      // the full transfer sends every labelled slot once; the drain the
      // store accumulated before init is subsumed and cleared
      store.takeLabelDirty(stream);

      for (let slot = 0; slot < high; slot++) {
        const entry = store.labelAt(slot, stream);

        if (entry != null) {
          labels.push({ stream, slot, entry });
        }
      }
    }
  }

  const order = store.parentOrder();
  let parentOrder: ArrayBuffer | null = null;

  if (full || order !== state.parentOrderRef) {
    state.parentOrderRef = order;
    parentOrder = order.slice(0).buffer;
  }

  return {
    capacity: {
      nodes: store.capacity('nodes'),
      edges: store.capacity('edges'),
    },
    highWater: {
      nodes: store.highWater('nodes'),
      edges: store.highWater('edges'),
    },
    resized,
    spans,
    blobs: {
      curve: blobWire(
        store.curveBlob(),
        store.curveBlobLength(),
        delta.curveBlob,
        full,
      ),
      poly: blobWire(
        store.polyBlob(),
        store.polyBlobLength(),
        delta.polyBlob,
        full,
      ),
      image: blobWire(
        store.imageBlob(),
        store.imageBlobLength(),
        delta.imageBlob,
        full,
      ),
      chart: blobWire(
        store.chartBlob(),
        store.chartBlobLength(),
        delta.chartBlob,
        full,
      ),
    },
    labels,
    parentOrder,
    compactEpoch: store.compactEpoch,
    scalars: {
      curveSlack: store.curveSlack(),
      haystackSlack: store.haystackSlack(),
      outlineSlack: store.outlineSlack(),
      arrowScaleMax: store.arrowScaleMax(),
      arrowWidthMax: store.arrowWidthMax(),
    },
    counts: {
      nodes: store.count('nodes'),
      edges: store.count('edges'),
      parents: store.parentCount(),
      ghosts: store.ghostCount(),
      overlays: store.overlayCount(),
      underlays: store.underlayCount(),
      edgeOverlays: store.edgeOverlayCount(),
      edgeUnderlays: store.edgeUnderlayCount(),
      casings: store.casingCount(),
      midArrows: store.midArrowCount(),
      charts: store.chartCount(),
      images: store.imageCount(),
      curved: store.hasCurvedEdges(),
    },
    arrows,
    labelFont: store.labelFont,
    labelFontStyle: store.labelFontStyle,
    labelFontWeight: store.labelFontWeight,
    viewport,
  };
}

/**
 * The transferable buffers of a batch, for postMessage's transfer list —
 * every span, blob and parent-order buffer is a fresh slice, so
 * transferring costs nothing and frees the sender's copy (the 86.1
 * measurement: transfer beats clone 2–3× at every size).
 *
 * @param batch — the batch about to be posted
 * @returns the buffers to transfer
 */
export function collectTransfers(batch: StoreBatch): ArrayBuffer[] {
  const out: ArrayBuffer[] = [];

  for (const span of batch.spans) {
    out.push(span.bytes);
  }

  for (const blob of Object.values(batch.blobs)) {
    if (blob != null) {
      out.push(blob.bytes);
    }
  }

  if (batch.parentOrder != null) {
    out.push(batch.parentOrder);
  }

  return out;
}
