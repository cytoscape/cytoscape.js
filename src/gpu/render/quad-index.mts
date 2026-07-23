import { BUFFER_USAGE } from './webgpu-constants.mjs';

/**
 * The shared per-instance quad index list: two triangles over quadCorner's
 * four corners.  Drawing indexed lets vertex reuse collapse the 6 index
 * entries per instance to 4 vertex-shader invocations.
 */
export const QUAD_INDICES = new Uint16Array( [ 0, 1, 2, 2, 1, 3 ] );

export function createQuadIndexBuffer( device: GPUDevice ): GPUBuffer {
  const buffer = device.createBuffer( {
    label: 'cy-gpu:quad-index',
    size: QUAD_INDICES.byteLength, // 12 B, 4-byte aligned
    usage: BUFFER_USAGE.INDEX | BUFFER_USAGE.COPY_DST
  } );

  device.queue.writeBuffer( buffer, 0, QUAD_INDICES.buffer, 0, QUAD_INDICES.byteLength );

  return buffer;
}
