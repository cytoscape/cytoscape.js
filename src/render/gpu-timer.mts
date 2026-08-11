import { BUFFER_USAGE, MAP_MODE } from './webgpu-constants.mjs';

/*
Measures real GPU execution time of the scene work (cull compute pass +
render pass + the optional renderScale upscale pass) via the optional
'timestamp-query' feature (requested at device creation when the adapter
supports it).  Begin/end timestamps are written by each pass, resolved
into a query buffer and read back through a small staging ring — the same
latest-wins, skip-when-busy pattern as picking, so timing never stalls the
frame loop.  Values are quantized by the browser (Chrome: ~100 µs) which
is plenty for profiling.

Every timed pass must run (even empty) whenever the frame is timed:
timestamp queries persist across resolves, so a skipped pass would leave
stale values behind and corrupt the reading.  The post (upscale) pair is
per-frame optional — the renderer flags at encodeResolve() whether the
upscale pass ran that frame (the adaptive render scale turns it on and
off at runtime), and unflagged readings ignore the pair.

This exists because CPU-side timing around queue.submit() only measures
command encoding (~0.1 ms): submission is fire-and-forget and the actual
vertex/raster work lands on the GPU timeline, invisible to
performance.now().
*/

const RING = 2;

interface RingSlot {
  buffer: GPUBuffer;
  busy: boolean;
  /** whether the frame this slot is reading included the upscale pass */
  post: boolean;
}

export class GpuTimer {
  /** most recent per-frame GPU duration (cull + render passes); 0 until the first reading */
  lastMs: number;

  /**
   * How many readings have resolved.  `lastMs` is latest-wins and quantized
   * (Chrome: ~100 µs), so a sampler keying off the *value* cannot tell a
   * repeated measurement from a stale one — which is what the renderer
   * benchmark did until round 65.12.  A monotonic counter is what a sampler
   * needs: it says "this is a new measurement", which the value cannot.
   *
   * Stated precisely, because 65.11 first claimed more than this: on the
   * scenes measured, the value-keyed sampler was already yielding ~one sample
   * per frame (120 of 121), so removing it did *not* explain the peak-slot
   * device row's flip between 0.46 and 1.17 ms.  That remains open; see
   * PLAN.md's 65.11 entry, whose leading hypothesis is that `read()` below
   * reports a span over fewer passes in the fast mode.
   */
  readings: number;

  private querySet: GPUQuerySet;
  private resolveBuffer: GPUBuffer;
  private ring: RingSlot[];
  private destroyed: boolean;

  /**
   * Whether this device can be timed.  The feature has to be requested at
   * device creation, so a device that could have supported it but did not
   * ask reports false here; construct a GpuTimer only when this passes.
   *
   * @param device — the device to test
   */
  static isSupported(device: GPUDevice): boolean {
    return device.features.has('timestamp-query');
  }

  /**
   * Allocates the six-timestamp query set, its resolve buffer and the
   * two-slot staging ring.  Only call after isSupported() — creating a
   * timestamp query set on a device without the feature is a validation
   * error.
   *
   * @param device — the device that owns the query set and buffers
   */
  constructor(device: GPUDevice) {
    this.lastMs = 0;
    this.readings = 0;
    this.destroyed = false;

    this.querySet = device.createQuerySet({
      label: 'cy-gpu:frame-timestamps',
      type: 'timestamp',
      count: 6, // render, cull-compute and upscale begin/end pairs
    });

    this.resolveBuffer = device.createBuffer({
      label: 'cy-gpu:timestamp-resolve',
      size: 48, // six u64 timestamps
      usage: BUFFER_USAGE.QUERY_RESOLVE | BUFFER_USAGE.COPY_SRC,
    });

    this.ring = Array.from({ length: RING }, (_, i) => ({
      buffer: device.createBuffer({
        label: `cy-gpu:timestamp-staging-${i}`,
        size: 48,
        usage: BUFFER_USAGE.MAP_READ | BUFFER_USAGE.COPY_DST,
      }),
      busy: false,
      post: false,
    }));
  }

  /** Attach to the scene render pass descriptor. */
  timestampWrites(): GPURenderPassTimestampWrites {
    return {
      querySet: this.querySet,
      beginningOfPassWriteIndex: 0,
      endOfPassWriteIndex: 1,
    };
  }

  /** Attach to the cull compute pass descriptor. */
  computeTimestampWrites(): GPUComputePassTimestampWrites {
    return {
      querySet: this.querySet,
      beginningOfPassWriteIndex: 2,
      endOfPassWriteIndex: 3,
    };
  }

  /** Attach to the renderScale upscale pass descriptor. */
  postTimestampWrites(): GPURenderPassTimestampWrites {
    return {
      querySet: this.querySet,
      beginningOfPassWriteIndex: 4,
      endOfPassWriteIndex: 5,
    };
  }

  /**
   * Encode the query resolve + staging copy (call after pass.end(), before
   * submit).  `hasPost` flags whether this frame ran the upscale pass (its
   * timestamp pair is otherwise stale and ignored).  Returns an
   * after-submit finisher, or null when the ring is busy (that frame just
   * goes unmeasured).
   */
  encodeResolve(
    encoder: GPUCommandEncoder,
    hasPost: boolean = false,
  ): (() => void) | null {
    if (this.destroyed) {
      return null;
    }

    const slot = this.ring.find((s) => !s.busy);

    if (slot == null) {
      return null;
    }

    slot.busy = true;
    slot.post = hasPost;
    encoder.resolveQuerySet(this.querySet, 0, 6, this.resolveBuffer, 0);
    encoder.copyBufferToBuffer(this.resolveBuffer, 0, slot.buffer, 0, 48);

    return () => {
      void this.read(slot);
    };
  }

  /**
   * Destroys the query set and every buffer, and latches encodeResolve()
   * to null so no further frame is timed.  Readings already in flight
   * fail their mapAsync and are swallowed, so destroying mid-frame is
   * safe; `lastMs` keeps its final value.
   */
  destroy(): void {
    this.destroyed = true;
    this.querySet.destroy();
    this.resolveBuffer.destroy();

    for (const slot of this.ring) {
      slot.buffer.destroy();
    }
  }

  private async read(slot: RingSlot): Promise<void> {
    try {
      await slot.buffer.mapAsync(MAP_MODE.READ);

      const stamps = new BigUint64Array(slot.buffer.getMappedRange());

      // Report the span from the earliest begin to the latest end across
      // the frame's timed passes.  Summing per-pass deltas would double
      // count on backends that emulate pass-boundary timestamps at
      // command-buffer granularity (e.g. Dawn on Metal); the queue
      // serializes the passes, so the span is the honest frame GPU time
      // under either implementation.
      const pairs = slot.post ? 3 : 2;
      const zero = BigInt(0); // no 0n literal: predates the build target
      let begin = zero;
      let end = zero;

      for (let i = 0; i < pairs; i++) {
        const b = stamps[2 * i];
        const e = stamps[2 * i + 1];

        if (b === zero && e === zero) {
          continue;
        } // pass unavailable this frame

        if (begin === zero || b < begin) {
          begin = b;
        }
        if (e > end) {
          end = e;
        }
      }

      const ns = begin === zero ? 0 : Number(end - begin);

      slot.buffer.unmap();

      if (ns > 0) {
        // quantization can yield 0/negative deltas; keep the last real reading
        this.lastMs = ns / 1e6;
        this.readings++;
      }
    } catch {
      // device lost or destroyed mid-flight
    } finally {
      slot.busy = false;
    }
  }
}
