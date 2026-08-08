import { NODE_LAYER_SHADER } from './shaders.mjs';
import { createQuadIndexBuffer } from './quad-index.mjs';
import { SHADER_STAGE } from './webgpu-constants.mjs';
import { DEPTH_FORMAT, PREMULTIPLIED_BLEND } from './node-pipeline.mjs';
import type { ColumnMirror } from './column-mirror.mjs';
import type { CulledGroup } from './cull.mjs';
import type { ColumnId } from '../contract.mjs';

/**
 * Overlay/underlay draws (round 13 A2): one pipeline, instantiated per
 * layer — the bind group carries that layer's record column
 * (node.overlay or node.underlay).  The underlay draws after ghosts and
 * before the node bodies (depth-tested 'less', so fragments under
 * opaque node interiors are killed — v3 hides them under the body
 * anyway); the overlay draws after the bodies with the test off (it
 * washes over its node, v3's layering).
 */
export class NodeLayerPipeline {
  private pipeline: GPURenderPipeline;
  private testedPipeline: GPURenderPipeline;
  private bindLayout: GPUBindGroupLayout;
  private quadIndex: GPUBuffer;
  private column: ColumnId;
  private bindGroups: Map<GPUBuffer, { group: GPUBindGroup; version: number }>;

  /**
   * Builds the depth-tested and untested variants for one layer.  The
   * layer column is fixed at construction and baked into the bind group,
   * so the renderer holds two instances of this class — one per column —
   * rather than switching a column at draw time.
   *
   * @param device — the device that owns the pipelines and quad index
   * @param format — the scene colour target's format
   * @param visibleLayout — the culler's @group(1) layout, shared with the
   * node pipelines
   * @param column — which layer this instance draws; also names its
   * labels and bind groups
   */
  constructor(
    device: GPUDevice,
    format: GPUTextureFormat,
    visibleLayout: GPUBindGroupLayout,
    column: 'node.overlay' | 'node.underlay',
  ) {
    const module = device.createShaderModule({
      label: 'cy-gpu:node-layer-shader',
      code: NODE_LAYER_SHADER,
    });

    this.column = column;
    this.quadIndex = createQuadIndexBuffer(device);

    this.bindLayout = device.createBindGroupLayout({
      label: `cy-gpu:${column}-bind-layout`,
      entries: [
        {
          binding: 0,
          visibility: SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        // 1..3 positions/sizes/the layer record
        ...[1, 2, 3].map((binding) => ({
          binding,
          visibility: SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType },
        })),
      ],
    });

    const layout = device.createPipelineLayout({
      bindGroupLayouts: [this.bindLayout, visibleLayout],
    });
    const make = (
      label: string,
      depthCompare: GPUCompareFunction,
    ): GPURenderPipeline =>
      device.createRenderPipeline({
        label,
        layout,
        vertex: {
          module,
          entryPoint: 'vsLayer',
        },
        fragment: {
          module,
          entryPoint: 'fsLayer',
          targets: [{ format, blend: PREMULTIPLIED_BLEND }],
        },
        primitive: { topology: 'triangle-list' },
        depthStencil: {
          format: DEPTH_FORMAT,
          depthWriteEnabled: false,
          depthCompare,
        },
      });

    // overlay: over the bodies (no test); underlay: early-z applies
    this.pipeline = make(`cy-gpu:${column}-pipeline`, 'always');
    this.testedPipeline = make(`cy-gpu:${column}-tested-pipeline`, 'less');
    this.bindGroups = new Map();
  }

  private ensureBindGroup(
    device: GPUDevice,
    uniform: GPUBuffer,
    mirror: ColumnMirror,
  ): GPUBindGroup {
    const cached = this.bindGroups.get(uniform);

    if (cached != null && cached.version === mirror.version) {
      return cached.group;
    }

    const group = device.createBindGroup({
      label: `cy-gpu:${this.column}-bind-group`,
      layout: this.bindLayout,
      entries: [
        { binding: 0, resource: { buffer: uniform } },
        { binding: 1, resource: { buffer: mirror.buffer('node.position') } },
        { binding: 2, resource: { buffer: mirror.buffer('node.size') } },
        { binding: 3, resource: { buffer: mirror.buffer(this.column) } },
      ],
    });

    this.bindGroups.set(uniform, { group, version: mirror.version });

    return group;
  }

  /**
   * Draws one rounded-rect wash per visible node from this instance's
   * layer column.  Called twice per frame with the two instances: the
   * underlay before the node bodies with depthTested true, the overlay
   * after them with it false.
   *
   * @param pass — the scene render pass being encoded
   * @param device — the device, for lazy bind group rebuilds
   * @param uniform — the Frame uniform; bind groups are cached per buffer
   * @param mirror — the column mirror; its `version` drives the rebuild
   * @param instances — the culled node count, used only to skip an empty
   * draw; the indirect buffer carries the real count
   * @param cull — the culled node group; its compute pass must already be
   * encoded
   * @param depthTested — true to reject fragments under opaque node
   * interiors (the underlay's layering), false to wash over them
   */
  draw(
    pass: GPURenderPassEncoder,
    device: GPUDevice,
    uniform: GPUBuffer,
    mirror: ColumnMirror,
    instances: number,
    cull: CulledGroup,
    depthTested: boolean,
  ): void {
    if (instances === 0) {
      return;
    }

    pass.setPipeline(depthTested ? this.testedPipeline : this.pipeline);
    pass.setBindGroup(0, this.ensureBindGroup(device, uniform, mirror));
    pass.setBindGroup(1, cull.visibleBindGroup());
    pass.setIndexBuffer(this.quadIndex, 'uint16');
    pass.drawIndexedIndirect(cull.indirect, 0);
  }
}
