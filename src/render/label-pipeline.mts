import { EDGE_LABEL_SHADER, LABEL_SHADER } from './shaders.mjs';
import { createQuadIndexBuffer } from './quad-index.mjs';
import { SHADER_STAGE } from './webgpu-constants.mjs';
import { DEPTH_FORMAT, PREMULTIPLIED_BLEND } from './node-pipeline.mjs';
import type { ColumnMirror } from './column-mirror.mjs';
import type { CulledGroup } from './cull.mjs';
import type { GlyphBuffer } from './glyph-buffer.mjs';
import type { GlyphAtlas } from './glyph-atlas.mjs';

/**
 * SDF label render pipeline: one instance per glyph, pulled from the
 * GlyphBuffer, with node positions/flags read from the column mirror so
 * labels track their nodes on-GPU.  Labels draw after nodes and are not
 * pickable.
 */
export class LabelPipeline {
  private pipeline: GPURenderPipeline;
  private bindLayout: GPUBindGroupLayout;
  private quadIndex: GPUBuffer;
  private edge: boolean;
  /** cached per (uniform buffer, glyph stream) — the edge pipeline
   * draws three streams (mid/source/target labels — round 13 D4) */
  private bindGroups: Map<
    GPUBuffer,
    Map<GlyphBuffer, { group: GPUBindGroup; key: string }>
  >;

  /**
   * Compiles the node or edge label shader and its pipeline.  The
   * variant is fixed at construction because it changes the bind group
   * layout's shape (2 storage buffers for node labels, 7 for edge
   * labels, which resolve their anchor from the curve on-GPU), so the
   * renderer holds one instance per variant.
   *
   * @param device — the device that owns the pipeline and quad index
   * @param format — the scene colour target's format
   * @param visibleLayout — the @group(1) layout of the culler whose
   * stream this variant draws (node or edge)
   * @param variant — which label kind this instance draws
   */
  constructor(
    device: GPUDevice,
    format: GPUTextureFormat,
    visibleLayout: GPUBindGroupLayout,
    variant: 'node' | 'edge' = 'node',
  ) {
    this.edge = variant === 'edge';

    const module = device.createShaderModule({
      label: `cy-gpu:${variant}-label-shader`,
      code: this.edge ? EDGE_LABEL_SHADER : LABEL_SHADER,
    });

    this.quadIndex = createQuadIndexBuffer(device);

    // edge labels bind the edge endpoints + widths (the arrow-trim
    // word) + curve inputs (incl. the 12b param blob) ahead of the
    // atlas, so the VS can compute the trimmed curve/route midpoint
    // anchor on-GPU — 7 storage buffers + the visible list, exactly the
    // vertex-stage budget (node geometry rides the fused outerGeom
    // column since round 58, which is what freed the widths slot)
    const storageCount = this.edge ? 7 : 2;

    this.bindLayout = device.createBindGroupLayout({
      label: `cy-gpu:${variant}-label-bind-layout`,
      entries: [
        {
          binding: 0,
          visibility: SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        ...Array.from({ length: storageCount }, (_, i) => ({
          binding: i + 1,
          visibility: SHADER_STAGE.VERTEX,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType },
        })),
        {
          binding: storageCount + 1,
          visibility: SHADER_STAGE.FRAGMENT,
          texture: { sampleType: 'float' as GPUTextureSampleType },
        },
        {
          binding: storageCount + 2,
          visibility: SHADER_STAGE.FRAGMENT,
          sampler: { type: 'filtering' as GPUSamplerBindingType },
        },
      ],
    });

    this.pipeline = device.createRenderPipeline({
      label: `cy-gpu:${variant}-label-pipeline`,
      layout: device.createPipelineLayout({
        bindGroupLayouts: [this.bindLayout, visibleLayout],
      }),
      vertex: { module, entryPoint: 'vsLabel' },
      fragment: {
        module,
        entryPoint: 'fsLabel',
        targets: [{ format, blend: PREMULTIPLIED_BLEND }],
      },
      primitive: { topology: 'triangle-list' },
      // labels draw over everything (no depth test)
      depthStencil: {
        format: DEPTH_FORMAT,
        depthWriteEnabled: false,
        depthCompare: 'always',
      },
    });

    this.bindGroups = new Map();
  }

  private ensureBindGroup(
    device: GPUDevice,
    uniform: GPUBuffer,
    glyphs: GlyphBuffer,
    mirror: ColumnMirror,
    atlas: GlyphAtlas,
  ): GPUBindGroup {
    const key = `${mirror.version}:${glyphs.version}`;
    let perUniform = this.bindGroups.get(uniform);

    if (perUniform == null) {
      perUniform = new Map();
      this.bindGroups.set(uniform, perUniform);
    }

    const cached = perUniform.get(glyphs);

    if (cached != null && cached.key === key) {
      return cached.group;
    }

    const storages: GPUBuffer[] = this.edge
      ? [
          glyphs.buffer(),
          mirror.buffer('edge.endpoints'),
          mirror.buffer('edge.width'),
          mirror.buffer('node.position'),
          mirror.buffer('edge.curveParams'),
          mirror.buffer('node.outerGeom'),
          mirror.blobBuffer(),
        ]
      : [glyphs.buffer(), mirror.buffer('node.position')];

    const group = device.createBindGroup({
      label: 'cy-gpu:label-bind-group',
      layout: this.bindLayout,
      entries: [
        { binding: 0, resource: { buffer: uniform } },
        ...storages.map((buffer, i) => ({
          binding: i + 1,
          resource: { buffer },
        })),
        { binding: storages.length + 1, resource: atlas.texture.createView() },
        { binding: storages.length + 2, resource: atlas.sampler },
      ],
    });

    perUniform.set(glyphs, { group, key });

    return group;
  }

  /**
   * Draws one SDF quad per glyph in the stream, over everything already
   * in the pass (no depth test), so labels are encoded last.  The glyph
   * buffer must have been rebuilt for this frame before the call: the
   * draw reads its contents through the bind group, and `highWater` of 0
   * is the only skip condition.  The edge variant is called once per
   * glyph stream (mid, source, target — round 13 D4), each with its own
   * cached bind group.
   *
   * @param pass — the scene render pass being encoded
   * @param device — the device, for lazy bind group rebuilds
   * @param uniform — the Frame uniform; bind groups are cached per buffer
   * @param glyphs — this stream's laid-out glyphs; its `version` and the
   * mirror's together key the cache
   * @param mirror — the column mirror supplying the anchor columns
   * @param atlas — the glyph atlas the quads sample; its texture must
   * already hold every glyph the stream references
   * @param cull — the culled group whose visible list and indirect args
   * this draw uses
   */
  draw(
    pass: GPURenderPassEncoder,
    device: GPUDevice,
    uniform: GPUBuffer,
    glyphs: GlyphBuffer,
    mirror: ColumnMirror,
    atlas: GlyphAtlas,
    cull: CulledGroup,
  ): void {
    if (glyphs.highWater === 0) {
      return;
    }

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(
      0,
      this.ensureBindGroup(device, uniform, glyphs, mirror, atlas),
    );
    pass.setBindGroup(1, cull.visibleBindGroup());
    pass.setIndexBuffer(this.quadIndex, 'uint16');
    pass.drawIndexedIndirect(cull.indirect, 0);
  }
}
