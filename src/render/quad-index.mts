import { BUFFER_USAGE } from './webgpu-constants.mjs';

/**
 * The shared per-instance quad index list: two triangles over quadCorner's
 * four corners.  Drawing indexed lets vertex reuse collapse the 6 index
 * entries per instance to 4 vertex-shader invocations.
 */
export const QUAD_INDICES = new Uint16Array([0, 1, 2, 2, 1, 3]);

/**
 * Uploads QUAD_INDICES into an INDEX buffer.  One such buffer is shared
 * by every single-quad instanced pipeline (nodes, arrows, labels,
 * images, charts), so the renderer creates it once and hands the same
 * buffer to all of them; nobody else may destroy it.
 *
 * @param device — the device that owns the buffer
 * @returns a 12-byte index buffer, already written
 */
export function createQuadIndexBuffer(device: GPUDevice): GPUBuffer {
  const buffer = device.createBuffer({
    label: 'cy-gpu:quad-index',
    size: QUAD_INDICES.byteLength, // 12 B, 4-byte aligned
    usage: BUFFER_USAGE.INDEX | BUFFER_USAGE.COPY_DST,
  });

  device.queue.writeBuffer(
    buffer,
    0,
    QUAD_INDICES.buffer,
    0,
    QUAD_INDICES.byteLength,
  );

  return buffer;
}

/**
 * Index list for a strip of `quads` independent quads per instance
 * (vertex ids 4q..4q+3 for quad q): the curved-edge segment strip.  The
 * vertex shader derives (segment, corner) as (vi >> 2, vi & 3), and
 * adjacent quads compute identical geometry for their shared subdivision
 * point, so the strip renders watertight without shared indices.
 */
export function createQuadStripIndexBuffer(
  device: GPUDevice,
  quads: number,
): GPUBuffer {
  const indices = new Uint16Array(quads * 6);

  for (let q = 0; q < quads; q++) {
    const v = q * 4;
    const at = q * 6;

    indices[at] = v;
    indices[at + 1] = v + 1;
    indices[at + 2] = v + 2;
    indices[at + 3] = v + 2;
    indices[at + 4] = v + 1;
    indices[at + 5] = v + 3;
  }

  const buffer = device.createBuffer({
    label: `cy-gpu:quad-strip-index-${quads}`,
    size: indices.byteLength,
    usage: BUFFER_USAGE.INDEX | BUFFER_USAGE.COPY_DST,
  });

  device.queue.writeBuffer(buffer, 0, indices.buffer, 0, indices.byteLength);

  return buffer;
}
