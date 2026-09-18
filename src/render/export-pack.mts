import { wgsl } from './wgsl.mjs';
import { BUFFER_USAGE, SHADER_STAGE } from './webgpu-constants.mjs';

/*
The export pack pass (round 110.4).

An export renders the scene into an offscreen premultiplied target, and
the caller wants straight-alpha RGBA bytes with no row padding.  Until
round 110 that conversion ran on the CPU: `copyTextureToBuffer` into a
256-byte-row-aligned staging buffer, `mapAsync`, then a JavaScript loop
over every pixel — row un-pad, BGRA→RGBA swizzle, un-premultiply — into
a fresh array.  The copy census priced that loop at 81 ms for a 4k-wide
figure of ndex-x-large and 332 ms at 8k (a quarter of the export's
wall time, a fifth of `png()`'s), against a 5 ms memcpy of the same
bytes.

This pass moves the conversion onto the device: one compute dispatch
reads the target through `textureLoad` (the format's own swizzle makes
the channel order RGBA whatever the swapchain format is), un-premultiplies
exactly as the loop did (alpha 0 and 255 pass through; every other
alpha divides), and packs each pixel as one `u32` into a tightly packed
storage buffer, which is then copied into the mappable staging buffer.
What the map yields is the final image: the readback becomes a single
`slice()` of the mapped range — the one copy WebGPU's mapping model
cannot remove, since a mapped range dies at `unmap()`.

The storage binding limit (128 MiB by default) is smaller than the
largest export the texture limit allows (an 8192² figure is 256 MiB), so
the dispatch runs in row bands whose byte offsets stay 256-aligned: a
band is a multiple of 64 rows, because 64 × w × 4 bytes is a multiple of
256 for any width.
*/

const WG = 16;
/** rows per band must be a multiple of this so band offsets stay
 * 256-byte aligned for any width (64 × 4 bytes × w ≡ 0 mod 256) */
const ROW_QUANTUM = 64;

const PACK_SHADER = wgsl`
struct Band {
  width: u32,
  height: u32,
  rowStart: u32,
  rows: u32,
}

@group(0) @binding(0) var<uniform> band: Band;
@group(0) @binding(1) var src: texture_2d<f32>;
@group(0) @binding(2) var<storage, read_write> out: array<u32>;

@compute @workgroup_size(${WG}, ${WG})
fn main(@builtin(global_invocation_id) gid: vec3u) {
  if (gid.x >= band.width || gid.y >= band.rows) {
    return;
  }

  let y = band.rowStart + gid.y;
  let c = textureLoad(src, vec2i(i32(gid.x), i32(y)), 0);
  let a = c.a;
  // rendered colors are premultiplied; image pixels want straight alpha
  // (alpha 0 and 1 pass through, as the CPU loop's 0 and 255 did)
  let un = select(1.0 / a, 1.0, a <= 0.0 || a >= 1.0);
  let straight = vec4f(min(c.rgb * un, vec3f(1.0)), a);

  // one u32 per pixel: r in the low byte, a in the high — RGBA8 memory order
  out[gid.y * band.width + gid.x] = pack4x8unorm(straight);
}
`;

/** what one export's pack leaves for the readback to map and destroy */
export interface PackedExport {
  /** the tightly packed straight-alpha RGBA8 bytes, mappable for reading */
  staging: GPUBuffer;
  /** the device-side buffers the readback destroys once mapped */
  scratch: GPUBuffer[];
}

/**
 * The compute pipeline that turns an export target into final image
 * bytes on the device.  One per renderer (per device); compiled at
 * first use, since most sessions never export.
 */
export class ExportPacker {
  private device: GPUDevice;
  private layout: GPUBindGroupLayout;
  private pipeline: GPUComputePipeline;

  /**
   * @param device — the device the export targets live on
   */
  constructor(device: GPUDevice) {
    this.device = device;

    const module = device.createShaderModule({
      label: 'cy-gpu:export-pack-shader',
      code: PACK_SHADER,
    });

    this.layout = device.createBindGroupLayout({
      label: 'cy-gpu:export-pack-layout',
      entries: [
        {
          binding: 0,
          visibility: SHADER_STAGE.COMPUTE,
          buffer: { type: 'uniform' },
        },
        {
          binding: 1,
          visibility: SHADER_STAGE.COMPUTE,
          texture: { sampleType: 'float' },
        },
        {
          binding: 2,
          visibility: SHADER_STAGE.COMPUTE,
          buffer: { type: 'storage' },
        },
      ],
    });

    this.pipeline = device.createComputePipeline({
      label: 'cy-gpu:export-pack-pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [this.layout] }),
      compute: { module, entryPoint: 'main' },
    });
  }

  /**
   * How many rows one band may cover under the device's storage binding
   * limit, quantized so every band's byte offset is 256-aligned.
   *
   * @param width — the export width in px
   * @returns rows per band (at least one quantum)
   */
  rowsPerBand(width: number): number {
    const limit = this.device.limits.maxStorageBufferBindingSize;
    const rows = Math.floor(limit / (width * 4));

    return Math.max(ROW_QUANTUM, rows - (rows % ROW_QUANTUM));
  }

  /**
   * Encode the pack: dispatch over the target in row bands into a packed
   * storage buffer, then copy that into a fresh mappable staging buffer.
   * The caller submits the encoder; the returned buffers outlive the
   * submit and are the readback's to map and destroy.
   *
   * @param encoder — the export's command encoder, after its render pass
   * @param target — the export target texture (needs TEXTURE_BINDING)
   * @param width — the export width in px
   * @param height — the export height in px
   * @returns the staging buffer to map, plus the scratch buffers to
   *   destroy once it is mapped
   */
  encode(
    encoder: GPUCommandEncoder,
    target: GPUTexture,
    width: number,
    height: number,
  ): PackedExport {
    const device = this.device;
    const bytes = width * height * 4;
    const packed = device.createBuffer({
      label: 'cy-gpu:export-packed',
      size: bytes,
      usage: BUFFER_USAGE.STORAGE | BUFFER_USAGE.COPY_SRC,
    });
    const staging = device.createBuffer({
      label: 'cy-gpu:export-staging',
      size: bytes,
      usage: BUFFER_USAGE.MAP_READ | BUFFER_USAGE.COPY_DST,
    });
    const scratch: GPUBuffer[] = [packed];
    const view = target.createView();
    const perBand = this.rowsPerBand(width);
    const pass = encoder.beginComputePass({ label: 'cy-gpu:export-pack' });

    pass.setPipeline(this.pipeline);

    for (let rowStart = 0; rowStart < height; rowStart += perBand) {
      const rows = Math.min(perBand, height - rowStart);
      const uniform = device.createBuffer({
        label: 'cy-gpu:export-pack-band',
        size: 16,
        usage: BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST,
      });

      device.queue.writeBuffer(
        uniform,
        0,
        Uint32Array.of(width, height, rowStart, rows),
      );
      scratch.push(uniform);

      pass.setBindGroup(
        0,
        device.createBindGroup({
          label: 'cy-gpu:export-pack-bind',
          layout: this.layout,
          entries: [
            { binding: 0, resource: { buffer: uniform } },
            { binding: 1, resource: view },
            {
              binding: 2,
              resource: {
                buffer: packed,
                offset: rowStart * width * 4,
                size: rows * width * 4,
              },
            },
          ],
        }),
      );
      pass.dispatchWorkgroups(Math.ceil(width / WG), Math.ceil(rows / WG));
    }

    pass.end();
    encoder.copyBufferToBuffer(packed, 0, staging, 0, bytes);

    return { staging, scratch };
  }
}
