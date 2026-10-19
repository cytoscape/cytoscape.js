/*
Pipelines built on first use.

Every pipeline a renderer creates is compiled when the first frame
submits, whether or not the frame draws with it — on a software adapter
(SwiftShader) that is 0.1–1 s of shader compilation per pipeline, and
most scenes never draw a pick, casing, layer or mid-arrow variant.  The
ghost pipeline was the first deferred this way (round 52); this module is
the same idea for the rest: hold the descriptor, create on the first call.
*/

/** A render pipeline created on the first call, then reused. */
export const lazyRenderPipeline = (
  device: Pick<GPUDevice, 'createRenderPipeline'>,
  descriptor: GPURenderPipelineDescriptor,
): (() => GPURenderPipeline) => {
  let pipeline: GPURenderPipeline | null = null;

  return () => (pipeline ??= device.createRenderPipeline(descriptor));
};

/** A compute pipeline created on the first call, then reused. */
export const lazyComputePipeline = (
  device: Pick<GPUDevice, 'createComputePipeline'>,
  descriptor: GPUComputePipelineDescriptor,
): (() => GPUComputePipeline) => {
  let pipeline: GPUComputePipeline | null = null;

  return () => (pipeline ??= device.createComputePipeline(descriptor));
};
