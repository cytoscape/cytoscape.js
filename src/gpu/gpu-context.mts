/*
WebGPU adapter/device acquisition and canvas configuration.

`cytoscapeGpu()` already hard-errors synchronously when a container is given
and `navigator.gpu` is missing; this module covers the async half: a null
adapter rejects the instance's `.ready` promise with a clear message.
Device loss is surfaced via the `onLost` callback for every loss —
including reason 'destroyed', so the *caller* distinguishes its own
teardown (renderer.destroy() flags itself first) from an external loss,
which the core recovers from by re-mounting (round 10).
*/

export interface GpuContext {
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
}

/**
 * Acquire a device and configure the canvas for presentation.  Requests
 * `timestamp-query` when the adapter offers it, so `stats()` can report
 * real GPU frame times; its absence is not an error.
 *
 * @param canvas — the canvas to configure with the preferred format
 * @param onLost — called for *every* device loss, reason 'destroyed'
 *   included, so the caller distinguishes its own teardown from an
 *   external loss it must re-mount from (round 10)
 * @returns the device, the configured canvas context, and the format
 * @throws if `navigator.gpu` is missing, or no adapter can be acquired
 */
export const initGpuContext = async (
  canvas: HTMLCanvasElement,
  onLost: ( info: GPUDeviceLostInfo ) => void
): Promise<GpuContext> => {
  const gpu = navigator.gpu;

  if( gpu == null ){
    throw new Error( 'WebGPU is required to render but is unavailable in this browser' );
  }

  const adapter = await gpu.requestAdapter();

  if( adapter == null ){
    throw new Error(
      'WebGPU is available but no adapter could be acquired; ' +
      'the GPU may be blocklisted or unsupported'
    );
  }

  // optional profiling feature: real GPU frame times for stats() (see gpu-timer.mts)
  const requiredFeatures: GPUFeatureName[] =
    adapter.features.has( 'timestamp-query' ) ? [ 'timestamp-query' ] : [];

  const device = await adapter.requestDevice( { requiredFeatures } );

  device.lost.then( info => {
    onLost( info );
  } );

  const context = canvas.getContext( 'webgpu' );

  if( context == null ){
    throw new Error( 'Could not get a webgpu canvas context' );
  }

  const format = gpu.getPreferredCanvasFormat();

  context.configure( { device, format, alphaMode: 'premultiplied' } );

  return { device, context, format };
};
