/*
WebGPU adapter/device acquisition and canvas configuration.

`cytoscapeGpu()` already hard-errors synchronously when a container is given
and `navigator.gpu` is missing; this module covers the async half: a null
adapter rejects the instance's `.ready` promise with a clear message.
Device loss is surfaced via the `onLost` callback — the instance goes dead
(no recovery in pass 1).
*/

export interface GpuContext {
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
}

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

  const device = await adapter.requestDevice();

  device.lost.then( info => {
    if( info.reason !== 'destroyed' ){
      onLost( info );
    }
  } );

  const context = canvas.getContext( 'webgpu' );

  if( context == null ){
    throw new Error( 'Could not get a webgpu canvas context' );
  }

  const format = gpu.getPreferredCanvasFormat();

  context.configure( { device, format, alphaMode: 'premultiplied' } );

  return { device, context, format };
};
