import { CURVED_ARROW_SHADER } from './shaders.mjs';
import { createQuadIndexBuffer } from './quad-index.mjs';
import { SHADER_STAGE } from './webgpu-constants.mjs';
import { DEPTH_FORMAT, PREMULTIPLIED_BLEND } from './node-pipeline.mjs';
import { QUAD_ARGS_OFFSET } from './cull.mjs';
import type { ColumnMirror } from './column-mirror.mjs';
import type { CulledGroup } from './cull.mjs';
import type { ColumnId } from '../contract.mjs';

/**
 * Arrowheads for curved edges (round 12a): one quad per visible curved
 * edge per enabled end, riding the curved cull stream's *single-quad*
 * args block (QUAD_ARGS_OFFSET — the stream's primary args draw the
 * segment strip).  The vertex shader points the tip along the curve's
 * end tangent (see CURVED_ARROW_SHADER); structure otherwise mirrors
 * ArrowPipeline.
 */
const VERTEX_COLUMNS: ColumnId[] = [
  'edge.endpoints',
  'edge.width',
  'node.position',
  'node.outerHalf', // border-inclusive halves (the 12a size-only deviation is gone)
  'node.shape',
  'edge.curveParams',
  // + the curve param blob at the next binding; this end's arrow colors
  // moved to the fragment stage (12b — the blob took their vertex slot)
];

export class CurvedArrowPipeline {
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
   * immutable End uniforms (target, source, mid-target, mid-source).
   * Unlike the straight-arrow twin this binds the curve param blob, since
   * the tip direction is the curve's end tangent rather than the
   * endpoint-to-endpoint chord.
   *
   * @param device — the device that owns the pipelines, End uniforms and
   * quad index
   * @param format — the scene colour target's format; curved arrows never
   * draw into the pick target
   * @param visibleLayout — the curved-edge culler's @group(1) layout,
   * whose stream these arrows ride
   */
  constructor(
    device: GPUDevice,
    format: GPUTextureFormat,
    visibleLayout: GPUBindGroupLayout,
  ) {
    const module = device.createShaderModule({
      label: 'cy-gpu:curved-arrow-shader',
      code: CURVED_ARROW_SHADER,
    });

    this.quadIndex = createQuadIndexBuffer(device);

    // 0 target, 1 source, 2 mid-target, 3 mid-source (C1)
    this.endUniforms = [0, 1, 2, 3].map((endId) => {
      const buffer = device.createBuffer({
        label: `cy-gpu:curved-arrow-end-${endId}`,
        size: 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      device.queue.writeBuffer(buffer, 0, new Uint32Array([endId]));

      return buffer;
    }) as [GPUBuffer, GPUBuffer, GPUBuffer, GPUBuffer];

    this.bindLayout = device.createBindGroupLayout({
      label: 'cy-gpu:curved-arrow-bind-layout',
      entries: [
        {
          // the FS reads frame.edgeDim since 12b (color moved there)
          binding: 0,
          visibility: SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        ...VERTEX_COLUMNS.map((id, i) => ({
          binding: i + 1,
          visibility: SHADER_STAGE.VERTEX,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType },
        })),
        {
          // the curve param blob (12b route families)
          binding: VERTEX_COLUMNS.length + 1,
          visibility: SHADER_STAGE.VERTEX,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType },
        },
        {
          // the End uniform: the fragment stage picks this end's shape byte
          binding: VERTEX_COLUMNS.length + 2,
          visibility: SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        {
          // this end's arrow colors, fragment-only (12b)
          binding: VERTEX_COLUMNS.length + 3,
          visibility: SHADER_STAGE.FRAGMENT,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType },
        },
        {
          // arrow shape ids, fragment-only
          binding: VERTEX_COLUMNS.length + 4,
          visibility: SHADER_STAGE.FRAGMENT,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType },
        },
        {
          // hollow stroke widths per end (B7), fragment-only
          binding: VERTEX_COLUMNS.length + 5,
          visibility: SHADER_STAGE.FRAGMENT,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType },
        },
      ],
    });

    const layout = device.createPipelineLayout({
      bindGroupLayouts: [this.bindLayout, visibleLayout],
    });

    this.pipeline = device.createRenderPipeline({
      label: 'cy-gpu:curved-arrow-pipeline',
      layout,
      vertex: { module, entryPoint: 'vsArrow' },
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

    this.midPipeline = device.createRenderPipeline({
      label: 'cy-gpu:curved-arrow-mid-pipeline',
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
        label: 'cy-gpu:curved-arrow-bind-group',
        layout: this.bindLayout,
        entries: [
          { binding: 0, resource: { buffer: uniform } },
          ...VERTEX_COLUMNS.map((id, i) => ({
            binding: i + 1,
            resource: { buffer: mirror.buffer(id) },
          })),
          {
            binding: VERTEX_COLUMNS.length + 1,
            resource: { buffer: mirror.blobBuffer() },
          },
          {
            binding: VERTEX_COLUMNS.length + 2,
            resource: { buffer: endUniform },
          },
          {
            binding: VERTEX_COLUMNS.length + 3,
            resource: { buffer: mirror.buffer(arrowColumn[end]) },
          },
          {
            binding: VERTEX_COLUMNS.length + 4,
            resource: { buffer: mirror.buffer('edge.arrowShapes') },
          },
          {
            binding: VERTEX_COLUMNS.length + 5,
            resource: { buffer: mirror.buffer('edge.arrowWidths') },
          },
        ],
      }),
    ) as [GPUBindGroup, GPUBindGroup, GPUBindGroup, GPUBindGroup];

    this.bindGroups.set(uniform, { groups, version: mirror.version });

    return groups;
  }

  /**
   * The curved-edge arrowhead draw: up to two single-quad indirect draws
   * over the curved visible list, target end first.  Reads the stream's
   * QUAD_ARGS_OFFSET args block, not offset 0 — offset 0 asks for
   * CURVE_SEGS quads' worth of indices and would draw the arrowhead
   * many times over.
   *
   * @param pass — the scene render pass being encoded
   * @param device — the device, for lazy bind group rebuilds
   * @param uniform — the Frame uniform; the four per-end bind groups are
   * cached together per uniform buffer
   * @param mirror — the column mirror; its `version` drives the rebuild
   * @param instances — the culled curved-edge count, used only to skip an
   * empty draw; the indirect buffer carries the real count
   * @param cull — the curved-edge culled group; its compute pass must
   * already be encoded
   * @param ends — which ends the stylesheet uses; a false end skips its
   * whole draw
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
      pass.drawIndexedIndirect(cull.indirect, QUAD_ARGS_OFFSET);
    }

    if (ends.source) {
      pass.setBindGroup(0, groups[1]);
      pass.drawIndexedIndirect(cull.indirect, QUAD_ARGS_OFFSET);
    }
  }

  /** Mid arrows (C1): tip at the curve/route midpoint, on the tangent. */
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
      pass.drawIndexedIndirect(cull.indirect, QUAD_ARGS_OFFSET);
    }

    if (ends.source) {
      pass.setBindGroup(0, groups[3]);
      pass.drawIndexedIndirect(cull.indirect, QUAD_ARGS_OFFSET);
    }
  }
}
