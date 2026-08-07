import { ARROW_SHADER } from './shaders.mjs';
import { createQuadIndexBuffer } from './quad-index.mjs';
import { SHADER_STAGE } from './webgpu-constants.mjs';
import { DEPTH_FORMAT, PREMULTIPLIED_BLEND } from './node-pipeline.mjs';
import type { ColumnMirror } from './column-mirror.mjs';
import type { CulledGroup } from './cull.mjs';
import type { ColumnId } from '../contract.mjs';

/**
 * Edge arrowheads: one quad per visible edge per enabled end, reusing
 * the edge cull pass's visible list and indirect args.  The two ends
 * draw as two calls distinguished by a tiny End uniform; edges without
 * an arrow at that end (arrow color a=0) collapse to degenerate quads
 * in the vertex shader.  Arrows are not pickable (the GPU pick pass
 * stays edges-only).
 */
// this end's arrow color column binds separately per end, and edge
// opacity is folded into the stored arrow alpha at style-write time:
// with the visible list in group 1, the vertex stage stays within
// WebGPU's base limit of 8 storage buffers (node size and border ride
// the derived node.outerHalf column)
const ARROW_COLUMNS: ColumnId[] = [
  'edge.endpoints',
  'edge.width',
  'node.position',
  'node.outerHalf',
  'node.shape',
];

export class ArrowPipeline {
  private pipeline: GPURenderPipeline;
  private midPipeline: GPURenderPipeline;
  private bindLayout: GPUBindGroupLayout;
  private quadIndex: GPUBuffer;
  private endUniforms: [GPUBuffer, GPUBuffer, GPUBuffer, GPUBuffer]; // [tgt, src, midTgt, midSrc]
  /** cached bind groups per (frame uniform, end) */
  private bindGroups: Map<
    GPUBuffer,
    {
      groups: [GPUBindGroup, GPUBindGroup, GPUBindGroup, GPUBindGroup];
      version: number;
    }
  >;

  /**
   * Builds the endpoint and mid-arrow pipelines and writes the four
   * one-word End uniforms (target, source, mid-target, mid-source) once —
   * they are immutable for the pipeline's lifetime, so the per-end bind
   * groups differ only in that uniform and the matching arrow colour
   * column.
   *
   * @param device — the device that owns the pipelines, End uniforms and
   * quad index
   * @param format — the scene colour target's format; arrows never draw
   * into the pick target
   * @param visibleLayout — the edge culler's @group(1) layout, since
   * arrows ride the edge visible list
   */
  constructor(
    device: GPUDevice,
    format: GPUTextureFormat,
    visibleLayout: GPUBindGroupLayout,
  ) {
    const module = device.createShaderModule({
      label: 'cy-gpu:arrow-shader',
      code: ARROW_SHADER,
    });

    this.quadIndex = createQuadIndexBuffer(device);

    // 0 target, 1 source, 2 mid-target, 3 mid-source (C1)
    this.endUniforms = [0, 1, 2, 3].map((endId) => {
      const buffer = device.createBuffer({
        label: `cy-gpu:arrow-end-${endId}`,
        size: 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      device.queue.writeBuffer(buffer, 0, new Uint32Array([endId]));

      return buffer;
    }) as [GPUBuffer, GPUBuffer, GPUBuffer, GPUBuffer];

    this.bindLayout = device.createBindGroupLayout({
      label: 'cy-gpu:arrow-bind-layout',
      entries: [
        // the FS reads frame.zoomDpr for hollow strokes since B7
        {
          binding: 0,
          visibility: SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        ...ARROW_COLUMNS.map((id, i) => ({
          binding: i + 1,
          visibility: SHADER_STAGE.VERTEX,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType },
        })),
        {
          // this end's arrow colors
          binding: ARROW_COLUMNS.length + 1,
          visibility: SHADER_STAGE.VERTEX,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType },
        },
        {
          // the End uniform: the fragment stage picks this end's shape byte
          binding: ARROW_COLUMNS.length + 2,
          visibility: SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        {
          // arrow shape ids, fragment-only: keeps the vertex stage at its 8-buffer budget
          binding: ARROW_COLUMNS.length + 3,
          visibility: SHADER_STAGE.FRAGMENT,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType },
        },
        {
          // hollow stroke widths per end (B7), fragment-only
          binding: ARROW_COLUMNS.length + 4,
          visibility: SHADER_STAGE.FRAGMENT,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType },
        },
        {
          // curve params: the mid entry point reads the haystack kind (C1)
          binding: ARROW_COLUMNS.length + 5,
          visibility: SHADER_STAGE.VERTEX,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType },
        },
      ],
    });

    const layout = device.createPipelineLayout({
      bindGroupLayouts: [this.bindLayout, visibleLayout],
    });

    this.pipeline = device.createRenderPipeline({
      label: 'cy-gpu:arrow-pipeline',
      layout,
      vertex: { module, entryPoint: 'vsArrow' },
      fragment: {
        module,
        entryPoint: 'fsArrow',
        targets: [{ format, blend: PREMULTIPLIED_BLEND }],
      },
      primitive: { topology: 'triangle-list' },
      // same early-z rank as edges: occluded by opaque node interiors
      depthStencil: {
        format: DEPTH_FORMAT,
        depthWriteEnabled: false,
        depthCompare: 'less',
      },
    });

    this.midPipeline = device.createRenderPipeline({
      label: 'cy-gpu:arrow-mid-pipeline',
      layout,
      vertex: { module, entryPoint: 'vsMidArrow' },
      fragment: {
        module,
        entryPoint: 'fsArrow',
        targets: [{ format, blend: PREMULTIPLIED_BLEND }],
      },
      primitive: { topology: 'triangle-list' },
      depthStencil: {
        format: DEPTH_FORMAT,
        depthWriteEnabled: false,
        depthCompare: 'less',
      },
    });

    this.bindGroups = new Map();
  }

  private ensureBindGroups(
    device: GPUDevice,
    uniform: GPUBuffer,
    mirror: ColumnMirror,
  ): [GPUBindGroup, GPUBindGroup, GPUBindGroup, GPUBindGroup] {
    const cached = this.bindGroups.get(uniform);

    if (cached != null && cached.version === mirror.version) {
      return cached.groups;
    }

    const arrowColumn: [ColumnId, ColumnId, ColumnId, ColumnId] = [
      'edge.targetArrow',
      'edge.sourceArrow',
      'edge.midTargetArrow',
      'edge.midSourceArrow',
    ];
    const groups = this.endUniforms.map((endUniform, end) =>
      device.createBindGroup({
        label: 'cy-gpu:arrow-bind-group',
        layout: this.bindLayout,
        entries: [
          { binding: 0, resource: { buffer: uniform } },
          ...ARROW_COLUMNS.map((id, i) => ({
            binding: i + 1,
            resource: { buffer: mirror.buffer(id) },
          })),
          {
            binding: ARROW_COLUMNS.length + 1,
            resource: { buffer: mirror.buffer(arrowColumn[end]) },
          },
          {
            binding: ARROW_COLUMNS.length + 2,
            resource: { buffer: endUniform },
          },
          {
            binding: ARROW_COLUMNS.length + 3,
            resource: { buffer: mirror.buffer('edge.arrowShapes') },
          },
          {
            binding: ARROW_COLUMNS.length + 4,
            resource: { buffer: mirror.buffer('edge.arrowWidths') },
          },
          {
            binding: ARROW_COLUMNS.length + 5,
            resource: { buffer: mirror.buffer('edge.curveParams') },
          },
        ],
      }),
    ) as [GPUBindGroup, GPUBindGroup, GPUBindGroup, GPUBindGroup];

    this.bindGroups.set(uniform, { groups, version: mirror.version });

    return groups;
  }

  /**
   * The endpoint arrowhead draw: up to two indirect draws over the edge
   * visible list, target end first so a source arrow composites over it
   * where they overlap.  Encoded after the edges and under the nodes.
   *
   * @param pass — the scene render pass being encoded
   * @param device — the device, for lazy bind group rebuilds
   * @param uniform — the Frame uniform; the four per-end bind groups are
   * cached together per uniform buffer
   * @param mirror — the column mirror; its `version` drives the rebuild
   * @param instances — the culled edge count, used only to skip an empty
   * draw; the indirect buffer carries the real count
   * @param cull — the culled edge group; its compute pass must already be
   * encoded
   * @param ends — which ends the stylesheet actually uses; a false end
   * skips its whole draw rather than collapsing quads in the VS
   */
  draw(
    pass: GPURenderPassEncoder,
    device: GPUDevice,
    uniform: GPUBuffer,
    mirror: ColumnMirror,
    instances: number,
    cull: CulledGroup,
    ends: { source: boolean; target: boolean },
  ): void {
    if (instances === 0 || (!ends.source && !ends.target)) {
      return;
    }

    const groups = this.ensureBindGroups(device, uniform, mirror);

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(1, cull.visibleBindGroup());
    pass.setIndexBuffer(this.quadIndex, 'uint16');

    if (ends.target) {
      pass.setBindGroup(0, groups[0]);
      pass.drawIndexedIndirect(cull.indirect, 0);
    }

    if (ends.source) {
      pass.setBindGroup(0, groups[1]);
      pass.drawIndexedIndirect(cull.indirect, 0);
    }
  }

  /** Mid arrows (C1): tip at the edge midpoint along the tangent. */
  drawMid(
    pass: GPURenderPassEncoder,
    device: GPUDevice,
    uniform: GPUBuffer,
    mirror: ColumnMirror,
    instances: number,
    cull: CulledGroup,
    ends: { source: boolean; target: boolean },
  ): void {
    if (instances === 0 || (!ends.source && !ends.target)) {
      return;
    }

    const groups = this.ensureBindGroups(device, uniform, mirror);

    pass.setPipeline(this.midPipeline);
    pass.setBindGroup(1, cull.visibleBindGroup());
    pass.setIndexBuffer(this.quadIndex, 'uint16');

    if (ends.target) {
      pass.setBindGroup(0, groups[2]);
      pass.drawIndexedIndirect(cull.indirect, 0);
    }

    if (ends.source) {
      pass.setBindGroup(0, groups[3]);
      pass.drawIndexedIndirect(cull.indirect, 0);
    }
  }
}
