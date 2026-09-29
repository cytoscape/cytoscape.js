/*
The device's limits, as the model and the renderer both read them (round
138, PLAN.md items 35–36).

Until round 138 no device requested a limit, so every instance ran under
WebGPU's *defaults* — a 128 MiB storage binding — and a store whose
largest column outgrew it (4,194,305 slots of the 32-byte gradient
column) produced an invalid bind group and a frame `queue.submit`
rejected, every frame, silently.  Two changes close that:

- **Every device requests its adapter's own buffer limits**
  ({@link adapterBufferLimits}): the renderer's (both hosts — they share
  `initGpuContext`) and the algorithm device.  On the RX 580 that moves
  the storage binding from 128 MiB to 4 GiB.
- **Growth past what the device can bind is refused before the store
  changes.**  The renderer reports a {@link DeviceFit} — the device's
  limits and the widest column it allocates per group — to the model
  side, and `cy.add()` / `cy.load()` / `cy.patch()` check the capacity
  the store would grow to against it ({@link groupUnfit}), throwing a
  `GpuUnfitError` (the algorithm executors' "does not fit the device"
  class) with the store untouched.

Pure and GPU-free: the core imports this, and the core tier reaches no
device code (`test/modules/import-graph.mjs`).
*/

/** The subset of `GPUSupportedLimits` the fit checks read. */
export interface DeviceLimits {
  /** the largest buffer `createBuffer` accepts */
  maxBufferSize: number;
  /** the largest range one storage binding may cover */
  maxStorageBufferBindingSize: number;
  /** the most workgroups one dispatch dimension may launch */
  maxComputeWorkgroupsPerDimension: number;
}

/** A group's widest GPU column: the one that reaches a limit first. */
export interface WidestColumn {
  /** the column id (e.g. `'edge.curveParams'`) */
  column: string;
  /** its bytes per slot */
  bytes: number;
}

/**
 * What the renderer tells the model about its device (round 138): the
 * limits, and per group the widest column it allocates — which is not
 * always the widest column the contract declares, since the 32-byte
 * gradient columns are allocated only once some element uses a gradient.
 */
export interface DeviceFit {
  limits: DeviceLimits;
  nodes: WidestColumn;
  edges: WidestColumn;
}

/**
 * The workgroup width of every per-slot kernel the renderer dispatches
 * over a group — the cull, the mapper evaluation and the tweens all run
 * 256-wide — so one dispatch covers at most
 * `maxComputeWorkgroupsPerDimension × 256` slots.
 */
export const SLOT_KERNEL_WG = 256;

/**
 * The limits to pass as `requiredLimits` at device creation: the
 * adapter's own, where the default device would get the spec's base
 * values (a 256 MiB buffer, a 128 MiB storage binding).  Requesting an
 * adapter's own value is always valid.
 *
 * @param adapter — the adapter the device is requested from
 * @returns the three limits, at the adapter's values
 */
export const adapterBufferLimits = (adapter: {
  limits: DeviceLimits;
}): Record<keyof DeviceLimits, number> => ({
  maxBufferSize: adapter.limits.maxBufferSize,
  maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
  maxComputeWorkgroupsPerDimension:
    adapter.limits.maxComputeWorkgroupsPerDimension,
});

/**
 * The three limits read off a device, as plain numbers — the shape that
 * crosses the worker boundary and that the model keeps.
 *
 * @param device — anything carrying `limits`
 * @returns a plain copy of the three limits
 */
export const readLimits = (device: { limits: DeviceLimits }): DeviceLimits => ({
  maxBufferSize: device.limits.maxBufferSize,
  maxStorageBufferBindingSize: device.limits.maxStorageBufferBindingSize,
  maxComputeWorkgroupsPerDimension:
    device.limits.maxComputeWorkgroupsPerDimension,
});

/**
 * The largest storage buffer a pipeline can bind whole: every mirror
 * column, blob and glyph stream is bound without a size, so its binding
 * is the buffer.
 *
 * @param limits — the device's limits
 * @returns bytes
 */
export const bindableBytes = (limits: DeviceLimits): number =>
  Math.min(limits.maxBufferSize, limits.maxStorageBufferBindingSize);

/**
 * The most slots one per-slot dispatch covers ({@link SLOT_KERNEL_WG}).
 *
 * @param limits — the device's limits
 * @returns slots
 */
export const dispatchableSlots = (limits: DeviceLimits): number =>
  limits.maxComputeWorkgroupsPerDimension * SLOT_KERNEL_WG;

/**
 * Why a group of `slots` live slots in a table of `capacity` does not
 * fit the device, or null when it does.  Two limits bind: the widest
 * column's buffer (`capacity × bytes`) against {@link bindableBytes},
 * and the slots a dispatch must cover against {@link dispatchableSlots}.
 *
 * @param group — `'nodes'` or `'edges'`, for the message
 * @param slots — the slots the kernels would iterate (the high water)
 * @param capacity — the capacity the buffers would be sized to
 * @param widest — the group's widest allocated column
 * @param limits — the device's limits
 * @returns the reason, phrased to follow "…would", or null
 */
export const groupUnfit = (
  group: string,
  slots: number,
  capacity: number,
  widest: WidestColumn,
  limits: DeviceLimits,
): string | null => {
  const bytes = capacity * widest.bytes;
  const bindable = bindableBytes(limits);

  if (bytes > bindable) {
    const which =
      limits.maxStorageBufferBindingSize <= limits.maxBufferSize
        ? 'storage binding'
        : 'buffer';

    return (
      `grow the ${group} table to ${capacity} slots, and its ` +
      `'${widest.column}' column to a ${bytes}-byte buffer — past this ` +
      `device's ${bindable}-byte ${which} limit`
    );
  }

  const dispatchable = dispatchableSlots(limits);

  if (slots > dispatchable) {
    return (
      `put ${slots} slots in the ${group} table — past the ` +
      `${dispatchable} one dispatch can cover on this device ` +
      `(${limits.maxComputeWorkgroupsPerDimension} workgroups of ` +
      `${SLOT_KERNEL_WG})`
    );
  }

  return null;
};
