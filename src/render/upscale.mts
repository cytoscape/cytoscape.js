import { wgsl } from './wgsl.mjs';
import { BUFFER_USAGE, SHADER_STAGE } from './webgpu-constants.mjs';

/*
The renderScale upscale pass: when the renderer draws the scene at a
fraction of native resolution (renderScale < 1), this fullscreen pass
resamples the offscreen scene texture to the swapchain with Catmull-Rom
bicubic filtering — 9 bilinear taps (Jimenez's weight-merged formulation).
The negative lobes act as mild sharpening, so SDF node borders and 1px
edges survive the upscale far better than plain bilinear.  The scene is
premultiplied alpha throughout, which filters correctly; the result is
clamped to [0, 1] to kill bicubic ringing before compositing.
*/

const UPSCALE_SHADER = wgsl`
struct UpscaleInfo {
  srcSize: vec2f,
  pad: vec2f,
}

@group(0) @binding(0) var<uniform> info: UpscaleInfo;
@group(0) @binding(1) var src: texture_2d<f32>;
@group(0) @binding(2) var srcSampler: sampler;

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vsFullscreen(@builtin(vertex_index) vi: u32) -> VSOut {
  // one clipping triangle covering the screen
  var pos = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var out: VSOut;

  out.position = vec4f(pos[vi], 0.0, 1.0);
  out.uv = pos[vi] * vec2f(0.5, -0.5) + vec2f(0.5, 0.5);
  return out;
}

// Catmull-Rom in 9 bilinear fetches: the inner 2x2 of each 4-tap axis is
// merged into one offset bilinear tap via its combined weight
fn catmullRom(uv: vec2f) -> vec4f {
  let samplePos = uv * info.srcSize;
  let texPos1 = floor(samplePos - 0.5) + 0.5;
  let f = samplePos - texPos1;

  let w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  let w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  let w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  let w3 = f * f * (-0.5 + 0.5 * f);

  let w12 = w1 + w2;
  let offset12 = w2 / w12;

  let inv = 1.0 / info.srcSize;
  let texPos0 = (texPos1 - 1.0) * inv;
  let texPos3 = (texPos1 + 2.0) * inv;
  let texPos12 = (texPos1 + offset12) * inv;

  var result = vec4f(0.0);

  result += textureSampleLevel(src, srcSampler, vec2f(texPos0.x, texPos0.y), 0.0) * w0.x * w0.y;
  result += textureSampleLevel(src, srcSampler, vec2f(texPos12.x, texPos0.y), 0.0) * w12.x * w0.y;
  result += textureSampleLevel(src, srcSampler, vec2f(texPos3.x, texPos0.y), 0.0) * w3.x * w0.y;
  result += textureSampleLevel(src, srcSampler, vec2f(texPos0.x, texPos12.y), 0.0) * w0.x * w12.y;
  result += textureSampleLevel(src, srcSampler, vec2f(texPos12.x, texPos12.y), 0.0) * w12.x * w12.y;
  result += textureSampleLevel(src, srcSampler, vec2f(texPos3.x, texPos12.y), 0.0) * w3.x * w12.y;
  result += textureSampleLevel(src, srcSampler, vec2f(texPos0.x, texPos3.y), 0.0) * w0.x * w3.y;
  result += textureSampleLevel(src, srcSampler, vec2f(texPos12.x, texPos3.y), 0.0) * w12.x * w3.y;
  result += textureSampleLevel(src, srcSampler, vec2f(texPos3.x, texPos3.y), 0.0) * w3.x * w3.y;

  return clamp(result, vec4f(0.0), vec4f(1.0)); // kill bicubic ringing
}

@fragment
fn fsUpscale(in: VSOut) -> @location(0) vec4f {
  return catmullRom(in.uv);
}
`;

export class Upscaler {
  private pipeline: GPURenderPipeline;
  private layout: GPUBindGroupLayout;
  private sampler: GPUSampler;
  private uniform: GPUBuffer;
  private bindGroup: GPUBindGroup | null;
  private boundTexture: GPUTexture | null;

  /**
   * Builds the fullscreen resample pipeline once per renderer.  The
   * bind group is deliberately not built here: it depends on the scene
   * texture, which is recreated on every resize, so draw() rebuilds it
   * lazily whenever the source identity changes.
   *
   * @param device — the device that owns the pipeline and sampler
   * @param format — the swapchain format this pass writes (it replaces,
   * never blends, so it must be the final target's format)
   */
  constructor(device: GPUDevice, format: GPUTextureFormat) {
    const module = device.createShaderModule({
      label: 'cy-gpu:upscale-shader',
      code: UPSCALE_SHADER,
    });

    this.layout = device.createBindGroupLayout({
      label: 'cy-gpu:upscale-layout',
      entries: [
        {
          binding: 0,
          visibility: SHADER_STAGE.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        {
          binding: 1,
          visibility: SHADER_STAGE.FRAGMENT,
          texture: { sampleType: 'float' },
        },
        {
          binding: 2,
          visibility: SHADER_STAGE.FRAGMENT,
          sampler: { type: 'filtering' },
        },
      ],
    });

    this.pipeline = device.createRenderPipeline({
      label: 'cy-gpu:upscale-pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [this.layout] }),
      vertex: { module, entryPoint: 'vsFullscreen' },
      fragment: { module, entryPoint: 'fsUpscale', targets: [{ format }] }, // replace-write
      primitive: { topology: 'triangle-list' },
    });

    this.sampler = device.createSampler({
      label: 'cy-gpu:upscale-sampler',
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });

    this.uniform = device.createBuffer({
      label: 'cy-gpu:upscale-uniform',
      size: 16,
      usage: BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST,
    });

    this.bindGroup = null;
    this.boundTexture = null;
  }

  /** Draw the upscale pass sampling `source` (the low-res scene target). */
  draw(
    pass: GPURenderPassEncoder,
    device: GPUDevice,
    source: GPUTexture,
  ): void {
    if (this.bindGroup == null || this.boundTexture !== source) {
      this.boundTexture = source;
      this.bindGroup = device.createBindGroup({
        label: 'cy-gpu:upscale-bind',
        layout: this.layout,
        entries: [
          { binding: 0, resource: { buffer: this.uniform } },
          { binding: 1, resource: source.createView() },
          { binding: 2, resource: this.sampler },
        ],
      });
      device.queue.writeBuffer(
        this.uniform,
        0,
        Float32Array.of(source.width, source.height, 0, 0),
      );
    }

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(3);
  }

  /**
   * Releases the uniform buffer.  The scene texture is owned by the
   * renderer, not by the upscaler, so it is left alone — only the last
   * bind group referencing it is dropped with this object.
   */
  destroy(): void {
    this.uniform.destroy();
  }
}
