/*
The renderer's own GPU allocation ledger (round 138, PLAN.md items 34
and 36).

WebGPU exposes no memory meter — Dawn reports nothing, and radv spills
device memory to system RAM, so real exhaustion raised no error at all
on the RX 580 (item 36, measured 2026-09-18).  So the instrumentation is
the renderer's own: the ledger wraps its device's `createBuffer` and
`createTexture` (own properties on that one device object — nothing
global is patched) and every object they return's `destroy`, and keeps
the live bytes, the counts and the cumulative allocations by label.  It
holds no reference to what it counts, so it cannot itself keep a
dropped buffer alive; a buffer dropped *without* `destroy()` stays in
the live figure, which is deliberate — the renderer frees VRAM by
destroying, and one that relies on collection is the leak the soak
(item 34) exists to show.

Two detectors ride the same wrap (item 36's step 1, "detection before
degradation"):

- every allocation is bracketed by an `out-of-memory` and a
  `validation` error scope, so a refused allocation becomes an
  `onError` report naming the label and the bytes, instead of an
  invalid object whose every later use fails quietly;
- an `uncapturederror` listener reports what nothing captured — the
  first of each distinct message, since a frame that fails validation
  fails it every frame.

The console warning the browser prints for an uncaptured error is left
alone: v4 fails loudly.
*/

import type { GpuErrorInfo, GpuMemoryStats } from '../public-types.mjs';

/** Bytes per texel of the formats the renderer creates; others read 4. */
const TEXEL_BYTES: Record<string, number> = {
  r8unorm: 1,
  rg8unorm: 2,
  r16float: 2,
  r32uint: 4,
  r32float: 4,
  rgba8unorm: 4,
  'rgba8unorm-srgb': 4,
  bgra8unorm: 4,
  depth24plus: 4,
  depth32float: 4,
  rgba16float: 8,
  rgba32float: 16,
};

/**
 * The ledger's figures before a device exists: all zero.
 *
 * @returns a fresh zeroed snapshot
 */
export const emptyGpuStats = (): GpuMemoryStats => ({
  liveBytes: 0,
  peakBytes: 0,
  buffers: 0,
  textures: 0,
  allocations: 0,
  allocationFailures: 0,
  errors: 0,
  byLabel: {},
});

/** distinct uncaptured messages remembered for the once-each rule */
const SEEN_CAP = 256;

/** The subset of a texture descriptor the byte count reads. */
interface TextureSizeDesc {
  size:
    | number[]
    | { width: number; height?: number; depthOrArrayLayers?: number };
  format: string;
  mipLevelCount?: number;
  sampleCount?: number;
  label?: string;
}

/**
 * A texture's requested bytes: every mip level of every layer, times
 * the sample count.
 *
 * @param desc — the descriptor `createTexture` was given
 * @returns bytes
 */
export const textureBytes = (desc: TextureSizeDesc): number => {
  const s = desc.size;
  const w = Array.isArray(s) ? s[0] : s.width;
  const h = Array.isArray(s) ? (s[1] ?? 1) : (s.height ?? 1);
  const layers = Array.isArray(s) ? (s[2] ?? 1) : (s.depthOrArrayLayers ?? 1);
  const texel = TEXEL_BYTES[desc.format] ?? 4;
  let bytes = 0;

  for (let level = 0; level < (desc.mipLevelCount ?? 1); level++) {
    bytes += Math.max(1, w >> level) * Math.max(1, h >> level);
  }

  return bytes * layers * texel * (desc.sampleCount ?? 1);
};

/**
 * The ledger's grouping key: the allocation's label with a trailing
 * numeric suffix dropped, so per-instance labels pool by kind.
 *
 * @param label — the descriptor's label
 * @returns the group key
 */
export const ledgerLabel = (label: string | undefined): string =>
  (label ?? '(unlabelled)').replace(/-\d+$/, '');

/** The narrow device surface the ledger wraps (a real `GPUDevice` fits). */
export interface LedgerDevice {
  createBuffer(desc: GPUBufferDescriptor): GPUBuffer;
  createTexture(desc: GPUTextureDescriptor): GPUTexture;
  destroy(): void;
  pushErrorScope(filter: GPUErrorFilter): void;
  popErrorScope(): Promise<GPUError | null>;
  addEventListener(type: 'uncapturederror', cb: (e: Event) => void): void;
  lost: Promise<unknown>;
}

/** The device error class a caught or uncaptured error belongs to. */
const kindOf = (err: GPUError): GpuErrorInfo['kind'] => {
  const name = (err as { constructor?: { name?: string } }).constructor?.name;

  return name === 'GPUOutOfMemoryError'
    ? 'out-of-memory'
    : name === 'GPUValidationError'
      ? 'validation'
      : 'internal';
};

/** One label's live figures and cumulative allocations. */
interface Row {
  bytes: number;
  count: number;
}

export class GpuLedger {
  /** the device was destroyed or lost: every allocation went with it */
  closed = false;

  private rows = new Map<string, Row>();
  private liveBytes = 0;
  private peakBytes = 0;
  private buffers = 0;
  private textures = 0;
  private allocations = 0;
  private allocationFailures = 0;
  private errors = 0;
  private seen = new Set<string>();
  private onError: (info: GpuErrorInfo) => void;

  /**
   * Wrap the device.  From here on every buffer and texture it creates
   * is counted, and every refusal and uncaptured error reported.
   *
   * @param device — the device to instrument (its methods are shadowed
   *   by own properties; the prototype is untouched)
   * @param onError — called per refused allocation, and once per
   *   distinct uncaptured error message
   */
  constructor(device: LedgerDevice, onError: (info: GpuErrorInfo) => void) {
    this.onError = onError;

    const createBuffer = device.createBuffer.bind(device);
    const createTexture = device.createTexture.bind(device);
    const destroyDevice = device.destroy.bind(device);

    device.createBuffer = (desc) =>
      this.scoped(device, desc.label, desc.size, false, () =>
        createBuffer(desc),
      );
    device.createTexture = (desc) =>
      this.scoped(
        device,
        desc.label,
        textureBytes(desc as unknown as TextureSizeDesc),
        true,
        () => createTexture(desc),
      );
    device.destroy = () => {
      this.close();
      destroyDevice();
    };
    device.lost.then(
      () => this.close(),
      () => this.close(),
    );
    device.addEventListener('uncapturederror', (e) => {
      const err = (e as GPUUncapturedErrorEvent).error;

      this.errors++;

      if (this.seen.has(err.message) || this.seen.size >= SEEN_CAP) {
        return;
      }

      this.seen.add(err.message);
      this.onError({ kind: kindOf(err), message: err.message });
    });
  }

  /**
   * The ledger's figures now.  Cheap: the live table is kept, not
   * recomputed.
   *
   * @returns a fresh snapshot
   */
  snapshot(): GpuMemoryStats {
    const byLabel: GpuMemoryStats['byLabel'] = {};

    for (const [label, row] of this.rows) {
      if (row.count > 0) {
        byLabel[label] = { bytes: row.bytes, count: row.count };
      }
    }

    return {
      liveBytes: this.liveBytes,
      peakBytes: this.peakBytes,
      buffers: this.buffers,
      textures: this.textures,
      allocations: this.allocations,
      allocationFailures: this.allocationFailures,
      errors: this.errors,
      byLabel,
    };
  }

  /** Create inside the two error scopes, count it, and wrap its destroy. */
  private scoped<T extends GPUBuffer | GPUTexture>(
    device: LedgerDevice,
    label: string | undefined,
    bytes: number,
    texture: boolean,
    create: () => T,
  ): T {
    device.pushErrorScope('out-of-memory');
    device.pushErrorScope('validation');

    let obj: T;

    try {
      obj = create();
    } finally {
      const invalid = device.popErrorScope();
      const oom = device.popErrorScope();

      Promise.all([invalid, oom]).then(
        ([v, o]) => {
          const err = o ?? v;

          if (err != null) {
            this.allocationFailures++;
            this.onError({
              kind: kindOf(err),
              message: err.message,
              label,
              bytes,
            });
          }
        },
        // a scope popped on a lost device rejects: the loss is reported
        // on its own path
        () => {},
      );
    }

    this.track(obj, label, bytes, texture);

    return obj;
  }

  /** Count a new allocation and make its destroy uncount it, once. */
  private track(
    obj: GPUBuffer | GPUTexture,
    label: string | undefined,
    bytes: number,
    texture: boolean,
  ): void {
    const key = ledgerLabel(label);
    const row = this.rows.get(key) ?? { bytes: 0, count: 0 };

    this.rows.set(key, row);
    row.bytes += bytes;
    row.count++;
    this.liveBytes += bytes;
    this.peakBytes = Math.max(this.peakBytes, this.liveBytes);
    this.allocations++;

    if (texture) {
      this.textures++;
    } else {
      this.buffers++;
    }

    const destroy = obj.destroy.bind(obj);
    let live = true;

    obj.destroy = () => {
      if (live && !this.closed) {
        row.bytes -= bytes;
        row.count--;
        this.liveBytes -= bytes;

        if (texture) {
          this.textures--;
        } else {
          this.buffers--;
        }
      }

      live = false;
      destroy();
    };
  }

  /** The device is gone, and every allocation with it. */
  private close(): void {
    if (this.closed) {
      return;
    }

    this.closed = true;
    this.liveBytes = 0;
    this.buffers = 0;
    this.textures = 0;
    this.rows.clear();
  }
}
