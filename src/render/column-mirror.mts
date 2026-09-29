import {
  GROUP_EDGES,
  GROUP_NODES,
  COL,
  COLUMN_SPECS,
  columnSpec,
} from '../contract.mjs';
import type {
  ColumnId,
  GroupName,
  ModelView,
  StoreDelta,
} from '../contract.mjs';
import type { WidestColumn } from '../device-fit.mjs';
import { BUFFER_USAGE } from '../gpu/webgpu-constants.mjs';

/*
GPU storage-buffer mirror of the CPU-canonical columns.

- Dirty spans upload via queue.writeBuffer at byte offset span.start × bps —
  byte-for-byte copies out of the backing typed arrays.
- When a group's capacity grew (delta.resized), that group's buffers are
  reallocated at the new capacity and re-uploaded in full; the old buffers'
  destroy() is deferred behind queue.onSubmittedWorkDone() so in-flight
  frames keep their bindings valid.  `version` bumps so pipelines rebuild
  their bind groups lazily.

Round 138 (PLAN.md item 36, the degradation order's third step):

- **The gradient columns are lazy.**  `node.gradient` and `edge.gradient`
  are 32 bytes a slot — the widest column in both groups, allocated for
  every scene and read by gradient fills alone.  Until some slot's meta
  word names a gradient, each is a one-record placeholder of zeros (meta
  0 = solid; a storage read past a binding's end returns a value inside
  it or zero, so every slot reads solid); the first span, realloc or
  construction that carries a gradient allocates it at capacity.  The
  group's widest column then drops from 32 to 16 bytes, which halves
  the per-slot byte ceiling's bite and saves 32 of 196 (node) and 164
  (edge) bytes a slot.
- **A buffer that would not fit is not created.**  With `maxBytes` set
  (the device's bindable size), a blob (curve, image, chart) or a
  gradient column that would outgrow it is replaced by a placeholder and
  reported through `onUnfit`; its later spans are skipped.  The poly
  blob holds one entry per distinct custom polygon, not per element, and
  is not gated.  The group columns proper never reach this: the model
  refuses the add first (`core/gpu-fit.mts`).
*/

/** The subset of GPUDevice the mirror needs (kept narrow for mock-based unit tests). */
export interface MirrorDevice {
  createBuffer(descriptor: {
    size: number;
    usage: number;
    label?: string;
  }): GPUBuffer;
  queue: {
    writeBuffer(
      buffer: GPUBuffer,
      bufferOffset: number,
      data: ArrayBufferLike | ArrayBufferView,
      dataOffset?: number,
      size?: number,
    ): void;
    onSubmittedWorkDone(): Promise<undefined>;
  };
}

/** The four blobs, by the label suffix their buffers carry. */
export type BlobKind = 'curve' | 'poly' | 'image' | 'chart';

/** What the mirror declined to allocate, for the renderer to degrade. */
export interface MirrorUnfit {
  /** the buffer's label (`'cy-gpu:chart-blob'`, `'cy-gpu:node.gradient'`) */
  label: string;
  /** the bytes it would have needed */
  bytes: number;
}

/** Limits and callbacks the renderer hands the mirror (round 138). */
export interface MirrorFitOptions {
  /** the largest buffer the device can bind whole; Infinity = unchecked */
  maxBytes?: number;
  /** a blob or gradient column would not fit and was not allocated */
  onUnfit?: (unfit: MirrorUnfit) => void;
}

/** The lazily-allocated columns (round 138). */
const LAZY: ReadonlySet<ColumnId> = new Set([
  COL.NODE_GRADIENT,
  COL.EDGE_GRADIENT,
]);

/** Words per gradient record; word 0 is the meta (kind in bits 0..1). */
const GRADIENT_WORDS = 8;

/**
 * Whether any gradient record in `[start, end)` names a gradient (a
 * non-zero kind in its meta word).
 */
const anyGradient = (
  words: Uint32Array,
  start: number,
  end: number,
): boolean => {
  for (let slot = start; slot < end; slot++) {
    if ((words[slot * GRADIENT_WORDS] & 3) !== 0) {
      return true;
    }
  }

  return false;
};

const BLOB_KINDS: readonly BlobKind[] = ['curve', 'poly', 'image', 'chart'];

export class ColumnMirror {
  /** bumps whenever buffers are reallocated ⇒ bind groups must be rebuilt */
  version: number;
  /** total bytes uploaded via writeBuffer (stats) */
  uploadedBytes: number;

  private device: MirrorDevice;
  private view: ModelView;
  private buffers: Map<ColumnId, GPUBuffer>;
  private capacities: { nodes: number; edges: number };
  private destroyed: boolean;
  private gpuOwned: ReadonlySet<ColumnId>;
  private tweenOwned: ReadonlySet<ColumnId>;
  /** the four blob buffers (curve 12b, poly 13 C3, image 15.3, chart 23) */
  private blobs: Map<BlobKind, GPUBuffer>;
  /** lazy columns allocated at capacity (the rest are placeholders) */
  private materialised: Set<ColumnId>;
  /** buffers declined as too large, by label: their spans are skipped */
  private unfit: Set<string>;
  private maxBytes: number;
  private onUnfit: ((unfit: MirrorUnfit) => void) | null;

  /**
   * Allocates a buffer per column at the view's current capacity and
   * uploads every backing array in full, so the mirror is coherent with
   * the view the moment the constructor returns — no initial sync() is
   * needed.  The four blobs (curve, poly, image, chart) are allocated
   * the same way.  A lazy gradient column starts as a placeholder unless
   * the view already carries a gradient.
   *
   * @param device — the device (or narrow mock) that owns every buffer
   * @param view — the CPU-canonical columns this mirror shadows; held by
   * reference, so later capacity growth is picked up by sync()
   * @param fit — the device's bindable size and the unfit callback
   *   (round 138); omitted, nothing is checked
   */
  constructor(
    device: MirrorDevice,
    view: ModelView,
    fit: MirrorFitOptions = {},
  ) {
    this.device = device;
    this.view = view;
    this.version = 0;
    this.uploadedBytes = 0;
    this.buffers = new Map();
    this.capacities = { nodes: 0, edges: 0 };
    this.destroyed = false;
    this.gpuOwned = new Set();
    this.tweenOwned = new Set();
    this.blobs = new Map();
    this.materialised = new Set();
    this.unfit = new Set();
    this.maxBytes = fit.maxBytes ?? Infinity;
    this.onUnfit = fit.onUnfit ?? null;

    for (const kind of BLOB_KINDS) {
      this.reallocBlob(kind);
    }

    this.realloc(GROUP_NODES);
    this.realloc(GROUP_EDGES);
  }

  /**
   * Columns whose bytes the mapper eval kernel owns on-GPU: span uploads
   * skip them, so CPU-side fallback writes never clobber evaluated bytes.
   * realloc() still uploads the CPU base in full — the caller schedules a
   * full re-eval for owned columns whenever a group resizes.
   *
   * A column that *leaves* ownership is re-uploaded whole from the
   * CPU-canonical view (round 143).  While the kernel owned it, every
   * CPU span written to it was skipped — including the whole-group
   * re-derivation that demoting a channel runs (a first bypass on a
   * mapped colour, a data column promoted to mixed) — so the buffer
   * still held the kernel's last bytes, and a bypassed element drew its
   * mapped value while `style()` read the bypass.  Found by the golden
   * degrade control: a bypass on the `mapped-colors` scene's viridis
   * fill moved no pixel.
   */
  setGpuOwned(ids: Iterable<ColumnId>): void {
    const next = new Set(ids);

    for (const id of this.gpuOwned) {
      if (!next.has(id) && !this.tweenOwned.has(id)) {
        this.uploadWhole(id);
      }
    }

    this.gpuOwned = next;
  }

  /** Write a column's whole CPU backing array to its buffer. */
  private uploadWhole(id: ColumnId): void {
    if (this.destroyed || this.unfit.has(`cy-gpu:${id}`)) {
      return;
    }

    if (LAZY.has(id) && !this.materialised.has(id)) {
      return; // a placeholder holds no slots
    }

    const spec = columnSpec(id);
    const arr = this.view.column(id);
    const byteLength = Math.min(
      arr.byteLength,
      this.capacities[spec.group] * spec.bytesPerSlot,
    );

    if (byteLength <= 0) {
      return;
    }

    this.device.queue.writeBuffer(
      this.buffer(id),
      0,
      arr.buffer,
      arr.byteOffset,
      byteLength,
    );
    this.uploadedBytes += byteLength;
  }

  /**
   * Columns the GPU tween runtime owns while an animation runs (a
   * separate set from the mapper-owned one so the two can't clobber each
   * other); span uploads skip a column owned by either.
   */
  setTweenOwned(ids: Iterable<ColumnId>): void {
    this.tweenOwned = new Set(ids);
  }

  /**
   * The storage buffer mirroring one column.  The identity is only valid
   * until the next realloc, so callers must re-read it (and rebuild any
   * bind group holding it) whenever `version` changes.
   *
   * @param id — the column to look up
   * @returns the current buffer for that column
   * @throws if the column has no mirror buffer — a spec/group mismatch,
   * never a capacity condition
   */
  buffer(id: ColumnId): GPUBuffer {
    const buffer = this.buffers.get(id);

    if (buffer == null) {
      throw new Error(`No mirror buffer for column '${id}'`);
    }

    return buffer;
  }

  /** The curve param blob's storage buffer (12b route families). */
  blobBuffer(): GPUBuffer {
    return this.blobs.get('curve') as GPUBuffer;
  }

  /** The custom-polygon point blob's storage buffer (round 13 C3). */
  polyBlobBuffer(): GPUBuffer {
    return this.blobs.get('poly') as GPUBuffer;
  }

  /** The background-image record blob's storage buffer (round 15.3). */
  imageBlobBuffer(): GPUBuffer {
    return this.blobs.get('image') as GPUBuffer;
  }

  /** The chart record blob's storage buffer (round 23). */
  chartBlobBuffer(): GPUBuffer {
    return this.blobs.get('chart') as GPUBuffer;
  }

  /**
   * The widest column a group cannot draw without (round 138) — what
   * the model's add pre-flight multiplies the capacity by.  The lazy
   * gradient columns do not count: a group that outgrows its gradient
   * column keeps growing, and its gradients degrade to solid fills.
   *
   * @param group — `'nodes'` or `'edges'`
   * @returns the column and its bytes per slot
   */
  widest(group: GroupName): WidestColumn {
    return essentialWidest(group);
  }

  /**
   * Whether a lazy column is allocated at capacity (round 138).
   *
   * @param id — a lazy column (`node.gradient`, `edge.gradient`)
   * @returns true once some slot carried a gradient and the column fit
   */
  isMaterialised(id: ColumnId): boolean {
    return this.materialised.has(id);
  }

  /**
   * Swap a buffer that failed to allocate for a placeholder (round 138):
   * the device refused it (out of memory), so every bind group holding
   * it would be invalid and every frame rejected.  A blob or a lazy
   * column becomes a one-record buffer of zeros and stops taking spans;
   * `version` bumps so the bind groups rebuild on the valid buffer.
   *
   * @param label — the failed allocation's label
   * @returns true when the label names a buffer this mirror can drop
   */
  dropFailed(label: string): boolean {
    for (const kind of BLOB_KINDS) {
      if (label === blobLabel(kind)) {
        this.unfit.add(label);
        this.replaceBlob(kind, this.placeholder(label, 4));
        this.version++;

        return true;
      }
    }

    for (const id of LAZY) {
      if (label === `cy-gpu:${id}`) {
        this.unfit.add(label);
        this.materialised.delete(id);
        this.swapColumn(id, this.placeholder(label, GRADIENT_WORDS * 4));
        this.version++;

        return true;
      }
    }

    return false;
  }

  /** Apply a StoreDelta: reallocate resized groups, upload dirty spans for the rest. */
  sync(delta: StoreDelta): void {
    if (this.destroyed) {
      return;
    }

    for (const group of [GROUP_NODES, GROUP_EDGES] as GroupName[]) {
      if (
        delta.resized[group] ||
        this.view.capacity(group) !== this.capacities[group]
      ) {
        this.realloc(group);
      }
    }

    for (const span of delta.spans) {
      const spec = columnSpec(span.column);

      if (delta.resized[spec.group]) {
        continue;
      } // covered by the full re-upload

      if (this.gpuOwned.has(span.column) || this.tweenOwned.has(span.column)) {
        continue;
      } // owned on-GPU

      if (LAZY.has(span.column) && !this.materialised.has(span.column)) {
        // a placeholder takes no spans; a span that brings the first
        // gradient allocates the column in full (which uploads it)
        if (
          !this.unfit.has(`cy-gpu:${span.column}`) &&
          anyGradient(
            this.view.column(span.column) as Uint32Array,
            span.start,
            span.end,
          )
        ) {
          this.materialise(span.column);
        }

        continue;
      }

      const arr = this.view.column(span.column);
      const byteStart = span.start * spec.bytesPerSlot;
      const byteLength = (span.end - span.start) * spec.bytesPerSlot;

      this.device.queue.writeBuffer(
        this.buffer(span.column),
        byteStart,
        arr.buffer,
        arr.byteOffset + byteStart,
        byteLength,
      );

      this.uploadedBytes += byteLength;
    }

    const blobSpans: [BlobKind, StoreDelta['curveBlob']][] = [
      ['curve', delta.curveBlob],
      ['poly', delta.polyBlob],
      ['image', delta.imageBlob],
      ['chart', delta.chartBlob],
    ];

    for (const [kind, span] of blobSpans) {
      if (span == null) {
        continue;
      }

      if (span.resized) {
        this.reallocBlob(kind);
        continue;
      }

      if (this.unfit.has(blobLabel(kind))) {
        continue; // a placeholder: nothing past its one word to write
      }

      const data = this.blobData(kind);
      const byteStart = span.start * 4;
      const byteLength = (span.end - span.start) * 4;

      this.device.queue.writeBuffer(
        this.blobs.get(kind) as GPUBuffer,
        byteStart,
        data.buffer,
        data.byteOffset + byteStart,
        byteLength,
      );
      this.uploadedBytes += byteLength;
    }
  }

  /**
   * Destroys every column and blob buffer immediately and latches the
   * mirror closed: later sync() calls are no-ops.  Unlike the deferred
   * destroys in realloc(), this does not wait on submitted work, so the
   * caller must already have stopped encoding frames against it.
   */
  destroy(): void {
    this.destroyed = true;

    for (const buffer of this.buffers.values()) {
      buffer.destroy();
    }

    this.buffers.clear();

    for (const buffer of this.blobs.values()) {
      buffer.destroy();
    }

    this.blobs.clear();
  }

  /** A blob's CPU backing array. */
  private blobData(kind: BlobKind): Float32Array {
    return kind === 'curve'
      ? this.view.curveBlob()
      : kind === 'poly'
        ? this.view.polyBlob()
        : kind === 'image'
          ? this.view.imageBlob()
          : this.view.chartBlob();
  }

  /** A small zeroed buffer standing in for one that does not exist. */
  private placeholder(label: string, bytes: number): GPUBuffer {
    return this.device.createBuffer({
      label,
      size: bytes,
      usage: BUFFER_USAGE.STORAGE | BUFFER_USAGE.COPY_DST,
    });
  }

  /** Install a blob buffer, destroying the one it replaces behind the
   * submitted work that may still bind it. */
  private replaceBlob(kind: BlobKind, buffer: GPUBuffer): void {
    const old = this.blobs.get(kind);

    this.blobs.set(kind, buffer);

    if (old != null) {
      this.device.queue.onSubmittedWorkDone().then(() => old.destroy());
    }
  }

  /** Install a column buffer, the same way. */
  private swapColumn(id: ColumnId, buffer: GPUBuffer): void {
    const old = this.buffers.get(id);

    this.buffers.set(id, buffer);

    if (old != null) {
      this.device.queue.onSubmittedWorkDone().then(() => old.destroy());
    }
  }

  /** (Re)allocate a blob at its pool's backing capacity and upload it in
   * full — or, past the device's bindable size, stand a placeholder in
   * and report it.  Bumps version so bind groups rebuild. */
  private reallocBlob(kind: BlobKind): void {
    const data = this.blobData(kind);
    const label = blobLabel(kind);
    const size = Math.max(data.byteLength, 4);

    if (kind !== 'poly' && size > this.maxBytes) {
      if (!this.unfit.has(label)) {
        this.unfit.add(label);
        this.replaceBlob(kind, this.placeholder(label, 4));
        this.version++;
        this.onUnfit?.({ label, bytes: size });
      }

      return;
    }

    this.unfit.delete(label);

    const buffer = this.device.createBuffer({
      label,
      size,
      usage: BUFFER_USAGE.STORAGE | BUFFER_USAGE.COPY_DST,
    });

    if (data.byteLength > 0) {
      this.device.queue.writeBuffer(
        buffer,
        0,
        data.buffer,
        data.byteOffset,
        data.byteLength,
      );
      this.uploadedBytes += data.byteLength;
    }

    this.replaceBlob(kind, buffer);
    this.version++;
  }

  /** Allocate a lazy column at capacity (its first gradient arrived),
   * or report it unfit. */
  private materialise(id: ColumnId): void {
    const spec = columnSpec(id);
    const size = this.view.capacity(spec.group) * spec.bytesPerSlot;
    const label = `cy-gpu:${id}`;

    if (size > this.maxBytes) {
      this.unfit.add(label);
      this.onUnfit?.({ label, bytes: size });

      return;
    }

    this.materialised.add(id);
    this.swapColumn(id, this.columnBuffer(spec.id, spec.group));
    this.version++;
  }

  /** A column's buffer at its group's capacity, uploaded in full. */
  private columnBuffer(id: ColumnId, group: GroupName): GPUBuffer {
    const spec = columnSpec(id);
    const cap = this.view.capacity(group);
    const buffer = this.device.createBuffer({
      label: `cy-gpu:${spec.id}`,
      size: Math.max(cap * spec.bytesPerSlot, 4),
      usage: BUFFER_USAGE.STORAGE | BUFFER_USAGE.COPY_DST,
    });
    // full upload of the backing array (byte-identical, sized to capacity)
    const arr = this.view.column(spec.id);

    this.device.queue.writeBuffer(
      buffer,
      0,
      arr.buffer,
      arr.byteOffset,
      arr.byteLength,
    );
    this.uploadedBytes += arr.byteLength;

    return buffer;
  }

  private realloc(group: GroupName): void {
    const olds: GPUBuffer[] = [];
    const cap = this.view.capacity(group);

    for (const spec of COLUMN_SPECS) {
      if (spec.group !== group) {
        continue;
      }

      if (LAZY.has(spec.id) && !this.materialised.has(spec.id)) {
        if (!this.buffers.has(spec.id)) {
          this.buffers.set(
            spec.id,
            this.placeholder(`cy-gpu:${spec.id}`, spec.bytesPerSlot),
          );
        }

        // a gradient already in the backing array (a graph built, or
        // re-mounted, with one) allocates the column now
        if (
          !this.unfit.has(`cy-gpu:${spec.id}`) &&
          anyGradient(this.view.column(spec.id) as Uint32Array, 0, cap)
        ) {
          this.materialise(spec.id);
        }

        continue;
      }

      if (LAZY.has(spec.id) && cap * spec.bytesPerSlot > this.maxBytes) {
        // a materialised gradient column the group outgrew: back to the
        // placeholder, reported — the model's pre-flight holds only the
        // columns a group cannot draw without, so the graph grows on
        // and its gradients degrade to solid fills
        const label = `cy-gpu:${spec.id}`;

        this.materialised.delete(spec.id);
        this.unfit.add(label);
        this.swapColumn(spec.id, this.placeholder(label, spec.bytesPerSlot));
        this.onUnfit?.({ label, bytes: cap * spec.bytesPerSlot });
        continue;
      }

      const old = this.buffers.get(spec.id);

      if (old != null) {
        olds.push(old);
      }

      this.buffers.set(spec.id, this.columnBuffer(spec.id, group));
    }

    this.capacities[group] = cap;
    this.version++;

    if (olds.length > 0) {
      // defer destroy until submitted work (still binding the old buffers) completes
      this.device.queue.onSubmittedWorkDone().then(() => {
        for (const old of olds) {
          old.destroy();
        }
      });
    }
  }
}

/** A blob buffer's label. */
const blobLabel = (kind: BlobKind): string => `cy-gpu:${kind}-blob`;

/**
 * The widest column a group cannot draw without (round 138): every
 * contract column but the lazy gradients.  16 bytes a slot in both
 * groups (`node.outerGeom` and its peers; `edge.dashPattern`,
 * `edge.curveParams`).
 *
 * @param group — `'nodes'` or `'edges'`
 * @returns the column and its bytes per slot
 */
export const essentialWidest = (group: GroupName): WidestColumn => {
  let widest: WidestColumn = { column: '', bytes: 0 };

  for (const spec of COLUMN_SPECS) {
    if (
      spec.group === group &&
      !LAZY.has(spec.id) &&
      spec.bytesPerSlot > widest.bytes
    ) {
      widest = { column: spec.id, bytes: spec.bytesPerSlot };
    }
  }

  return widest;
};
