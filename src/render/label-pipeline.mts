import { EDGE_LABEL_SHADER, LABEL_SHADER } from './shaders.mjs';
import { createQuadIndexBuffer } from './quad-index.mjs';
import { SHADER_STAGE } from './webgpu-constants.mjs';
import { DEPTH_FORMAT, PREMULTIPLIED_BLEND } from './node-pipeline.mjs';
import type { ColumnMirror } from './column-mirror.mjs';
import type { CulledGroup } from './cull.mjs';
import type { GlyphBuffer } from './glyph-buffer.mjs';
import type { GlyphAtlas } from './glyph-atlas.mjs';

/** Which of the round-95 label phases a draw encodes. */
export type LabelPhase = 'fill' | 'outline';

/**
 * SDF label render pipeline: one instance per glyph, pulled from the
 * GlyphBuffer, with node positions/flags read from the column mirror so
 * labels track their nodes on-GPU.  Labels draw after nodes and are not
 * pickable.
 *
 * Round 95: the shader is specialized (LABEL_PHASE override constant)
 * into a fill variant and an outline-coverage variant, so the renderer
 * can draw every stream's outlines under every stream's fill — v3's
 * stroke-the-line-then-fill order, which is what keeps a glyph's
 * outline ring from cutting notches into the previous letter's ink.
 * The outline variant is compiled lazily on first use, so a graph
 * without text outlines never pays for it.
 */
export class LabelPipeline {
  private fillPipeline: GPURenderPipeline;
  private outlinePipeline: GPURenderPipeline | null;
  private bindLayout: GPUBindGroupLayout;
  private layout: GPUPipelineLayout;
  private module: GPUShaderModule;
  private format: GPUTextureFormat;
  private variant: 'node' | 'edge';
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
    this.variant = variant;
    this.format = format;

    this.module = device.createShaderModule({
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
    // node labels add the element opacity column (115.6), so a dimmed
    // node dims its label on-GPU — 3 storage buffers
    const storageCount = this.edge ? 7 : 3;

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

    this.layout = device.createPipelineLayout({
      bindGroupLayouts: [this.bindLayout, visibleLayout],
    });
    this.fillPipeline = this.createPhasePipeline(device, 'fill');
    this.outlinePipeline = null; // lazily built on the first outlined draw
    this.bindGroups = new Map();
  }

  /** One phase's specialization of the shared module (round 95). */
  private createPhasePipeline(
    device: GPUDevice,
    phase: LabelPhase,
  ): GPURenderPipeline {
    return device.createRenderPipeline({
      label: `cy-gpu:${this.variant}-label-pipeline:${phase}`,
      layout: this.layout,
      vertex: { module: this.module, entryPoint: 'vsLabel' },
      fragment: {
        module: this.module,
        entryPoint: 'fsLabel',
        constants: { LABEL_PHASE: phase === 'outline' ? 1 : 0 },
        targets: [{ format: this.format, blend: PREMULTIPLIED_BLEND }],
      },
      primitive: { topology: 'triangle-list' },
      // labels draw over everything (no depth test)
      depthStencil: {
        format: DEPTH_FORMAT,
        depthWriteEnabled: false,
        depthCompare: 'always',
      },
    });
  }

  private ensureBindGroup(
    device: GPUDevice,
    uniform: GPUBuffer,
    glyphs: GlyphBuffer,
    mirror: ColumnMirror,
    atlas: GlyphAtlas,
  ): GPUBindGroup {
    // the atlas generation joins the key (round 94): a tier promotion
    // replaces the texture object, and a cached group would keep the
    // destroyed one bound
    const key = `${mirror.version}:${glyphs.version}:${atlas.generation}`;
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
      : [
          glyphs.buffer(),
          mirror.buffer('node.position'),
          mirror.buffer('node.opacity'),
        ];

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
   * Round 95: `phase` picks the shader specialization.  The renderer
   * encodes an `'outline'` draw for every stream that holds an outlined
   * glyph, then a `'fill'` draw for every stream, so all outline
   * coverage lands under all ink — v3's per-line stroke-then-fill
   * order, globalized (the recorded deviation: where two *distinct*
   * labels overlap, v3 strokes the later label over the earlier one's
   * ink and v4 does not).
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
   * @param phase — which round-95 phase to encode (default `'fill'`)
   */
  draw(
    pass: GPURenderPassEncoder,
    device: GPUDevice,
    uniform: GPUBuffer,
    glyphs: GlyphBuffer,
    mirror: ColumnMirror,
    atlas: GlyphAtlas,
    cull: CulledGroup,
    phase: LabelPhase = 'fill',
  ): void {
    if (glyphs.highWater === 0) {
      return;
    }

    if (phase === 'outline' && this.outlinePipeline == null) {
      this.outlinePipeline = this.createPhasePipeline(device, 'outline');
    }

    pass.setPipeline(
      phase === 'outline'
        ? (this.outlinePipeline as GPURenderPipeline)
        : this.fillPipeline,
    );
    pass.setBindGroup(
      0,
      this.ensureBindGroup(device, uniform, glyphs, mirror, atlas),
    );
    pass.setBindGroup(1, cull.visibleBindGroup());
    pass.setIndexBuffer(this.quadIndex, 'uint16');
    pass.drawIndexedIndirect(cull.indirect, 0);
  }
}
