import { wgsl } from '../gpu/wgsl.mjs';
import { DEPTH_FORMAT } from './node-pipeline.mjs';
import { BUFFER_USAGE, SHADER_STAGE } from '../gpu/webgpu-constants.mjs';

/*
The emphasis veil (round 102): one fullscreen triangle drawn between the
two tiers of an emphasized frame, taking the colour attachment from
"the rest of the graph over the background" to "the rest of the graph at
opacity k over the background":

  out = dst × k + under × (1 − k)

where `under` is the premultiplied background the target was cleared
to.  Over a background B, the first tier left R = S + (1 − Sa)·B for
the rest's premultiplied scene S; k·R + (1 − k)·B = k·S + (1 − k·Sa)·B,
which is S composited at opacity k over B — exact for any B, opaque or
not.  On screen the canvas clears to transparent, so `under` is zero and
the veil is a plain scale: the page shows through a dimmed region as it
would through any translucent element.  An export with a `bg` clears to
it, and passes it here, so the figure matches the screen.

The blend does the arithmetic — destination × the blend constant (k),
source × (1 − k) — and the fragment only supplies `under` from a
16-byte uniform.  It runs inside the first tier's render pass, which
carries the depth attachment, so it declares the depth format and
neither tests nor writes it.
*/

const VEIL_SHADER = wgsl`
@group(0) @binding(0) var<uniform> under: vec4f;

@vertex
fn vsVeil(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
  // one clipping triangle covering the screen
  var pos = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));

  return vec4f(pos[vi], 0.0, 1.0);
}

@fragment
fn fsVeil() -> @location(0) vec4f {
  return under; // premultiplied background; the blend weighs it by 1 - k
}
`;

/** dst × k + src × (1 − k), for colour and alpha alike (k: the blend constant). */
const VEIL_BLEND: GPUBlendState = {
  color: {
    srcFactor: 'one-minus-constant',
    dstFactor: 'constant',
    operation: 'add',
  },
  alpha: {
    srcFactor: 'one-minus-constant',
    dstFactor: 'constant',
    operation: 'add',
  },
};

/** The fullscreen dim between an emphasized frame's two tiers. */
export class EmphasisVeil {
  private pipeline: GPURenderPipeline;
  private uniform: GPUBuffer;
  private bindGroup: GPUBindGroup;
  private device: GPUDevice;
  private readonly under = new Float32Array(4);

  /**
   * Builds the fullscreen pipeline and its uniform, once per renderer, on
   * the first emphasized frame or export.
   *
   * @param device — the device that owns the pipeline
   * @param format — the scene target's format (the tiers' colour attachment)
   */
  constructor(device: GPUDevice, format: GPUTextureFormat) {
    const module = device.createShaderModule({
      label: 'cy-gpu:emphasis-veil-shader',
      code: VEIL_SHADER,
    });
    const layout = device.createBindGroupLayout({
      label: 'cy-gpu:emphasis-veil-layout',
      entries: [
        {
          binding: 0,
          visibility: SHADER_STAGE.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    });

    this.device = device;
    this.pipeline = device.createRenderPipeline({
      label: 'cy-gpu:emphasis-veil-pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
      vertex: { module, entryPoint: 'vsVeil' },
      fragment: {
        module,
        entryPoint: 'fsVeil',
        targets: [{ format, blend: VEIL_BLEND }],
      },
      primitive: { topology: 'triangle-list' },
      depthStencil: {
        format: DEPTH_FORMAT,
        depthWriteEnabled: false,
        depthCompare: 'always',
      },
    });
    this.uniform = device.createBuffer({
      label: 'cy-gpu:emphasis-veil-uniform',
      size: 16,
      usage: BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST,
    });
    this.bindGroup = device.createBindGroup({
      label: 'cy-gpu:emphasis-veil-bind-group',
      layout,
      entries: [{ binding: 0, resource: { buffer: this.uniform } }],
    });
  }

  /**
   * Composite everything drawn so far in `pass` at `opacity` over
   * `under`.  The uniform write is queued ahead of the pass's submit, and
   * the screen frame and an export are separate submits, so one buffer
   * serves both.
   *
   * @param pass — the first tier's render pass, after its scene draw
   * @param opacity — the core `dim-opacity`, in [0, 1]
   * @param under — the premultiplied RGBA the target was cleared to
   *   (zero on screen; an export's `bg`)
   */
  draw(
    pass: GPURenderPassEncoder,
    opacity: number,
    under: readonly [number, number, number, number],
  ): void {
    this.under.set(under);
    this.device.queue.writeBuffer(
      this.uniform,
      0,
      this.under.buffer,
      this.under.byteOffset,
      this.under.byteLength,
    );
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.setBlendConstant({ r: opacity, g: opacity, b: opacity, a: opacity });
    pass.draw(3);
  }

  /** Release the uniform (the pipeline dies with the device). */
  destroy(): void {
    this.uniform.destroy();
  }
}
