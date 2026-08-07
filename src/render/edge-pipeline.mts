import { EDGE_SHADER } from './shaders.mjs';
import { createQuadIndexBuffer } from './quad-index.mjs';
import { SHADER_STAGE } from './webgpu-constants.mjs';
import { DEPTH_FORMAT, PREMULTIPLIED_BLEND } from './node-pipeline.mjs';
import type { ColumnMirror } from './column-mirror.mjs';
import type { CulledGroup } from './cull.mjs';
import type { ColumnId } from '../contract.mjs';

/**
 * Storage-buffer bindings 1..9 (0 is the Frame uniform).  The edge vertex
 * shader reads endpoint positions straight from the node position buffer,
 * so a node drag uploads one row and its edges follow on-GPU.  Flags
 * columns are not bound: the cull pass already filtered on them.  Since
 * 12c the paint columns (line color / opacity / line-style) bind to the
 * fragment stage (flat instance fetch) so the vertex stage fits
 * curveParams + outerHalf + shape for the haystack/triangle straight-
 * stream kinds; curveParams binds both stages (the FS skips dashes on
 * triangle fills).
 */
const V = SHADER_STAGE.VERTEX;
const F = SHADER_STAGE.FRAGMENT;

const EDGE_COLUMNS: { id: ColumnId; stages: number }[] = [
  { id: 'edge.endpoints', stages: V },
  { id: 'edge.width', stages: V },
  { id: 'node.position', stages: V },
  { id: 'edge.curveParams', stages: V | F },
  { id: 'node.outerHalf', stages: V },
  { id: 'node.shape', stages: V },
  { id: 'edge.lineColor', stages: F },
  { id: 'edge.opacity', stages: F },
  { id: 'edge.lineStyle', stages: F },
  // per-edge dash pattern/offset/cap (round 13 B3)
  { id: 'edge.dashPattern', stages: F },
  { id: 'edge.dashMeta', stages: F },
];

/** Edge render + picking pipelines (screen-space extruded quads). */
export class EdgePipeline {
  private pipeline: GPURenderPipeline;
  private pickPipeline: GPURenderPipeline;
  private layerPipeline: GPURenderPipeline;
  private bindLayout: GPUBindGroupLayout;
  private quadIndex: GPUBuffer;
  /** one cached bind group per uniform buffer (render frame vs pick frame) */
  private bindGroups: Map<
    GPUBuffer,
    Map<string, { group: GPUBindGroup; version: number }>
  >;

  /**
   * Compiles the edge shader and builds the three pipelines that share
   * one bind group layout: the scene draw, the r32uint pick draw and the
   * overlay/underlay/casing stroke draw.  The pick pipeline has no
   * depthStencil — the pick pass renders without a depth attachment, and
   * its topmost-wins ordering comes from overwrite order alone.
   *
   * @param device — the device that owns the pipelines and quad index
   * @param format — the scene colour target's format (the pick target is
   * always r32uint)
   * @param visibleLayout — the edge culler's @group(1) layout
   */
  constructor(
    device: GPUDevice,
    format: GPUTextureFormat,
    visibleLayout: GPUBindGroupLayout,
  ) {
    const module = device.createShaderModule({
      label: 'cy-gpu:edge-shader',
      code: EDGE_SHADER,
    });

    this.quadIndex = createQuadIndexBuffer(device);

    this.bindLayout = device.createBindGroupLayout({
      label: 'cy-gpu:edge-bind-layout',
      entries: [
        {
          binding: 0,
          visibility: SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        ...EDGE_COLUMNS.map((col, i) => ({
          binding: i + 1,
          visibility: col.stages,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType },
        })),
        {
          // the overlay/underlay record the layer entry points read (A2)
          binding: EDGE_COLUMNS.length + 1,
          visibility: V | F,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType },
        },
        {
          // the line-fill gradient record (C2), fragment-only
          binding: EDGE_COLUMNS.length + 2,
          visibility: F,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType },
        },
      ],
    });

    const layout = device.createPipelineLayout({
      bindGroupLayouts: [this.bindLayout, visibleLayout],
    });

    this.pipeline = device.createRenderPipeline({
      label: 'cy-gpu:edge-pipeline',
      layout,
      vertex: { module, entryPoint: 'vsEdge' },
      fragment: {
        module,
        entryPoint: 'fsEdge',
        targets: [{ format, blend: PREMULTIPLIED_BLEND }],
      },
      primitive: { topology: 'triangle-list' },
      // early-z: edge fragments at EDGE_Z fail against opaque node
      // interiors (NODE_Z from the depth prepass) and skip blending
      depthStencil: {
        format: DEPTH_FORMAT,
        depthWriteEnabled: false,
        depthCompare: 'less',
      },
    });

    this.pickPipeline = device.createRenderPipeline({
      label: 'cy-gpu:edge-pick-pipeline',
      layout,
      vertex: { module, entryPoint: 'vsEdge' },
      fragment: {
        module,
        entryPoint: 'fsEdgePick',
        targets: [{ format: 'r32uint' }],
      },
      primitive: { topology: 'triangle-list' },
    });

    // overlay/underlay strokes (round 13 A2): one pipeline, two bind
    // groups (each layer's record column at the last binding)
    this.layerPipeline = device.createRenderPipeline({
      label: 'cy-gpu:edge-layer-pipeline',
      layout,
      vertex: { module, entryPoint: 'vsEdgeLayer' },
      fragment: {
        module,
        entryPoint: 'fsEdgeLayer',
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

  private ensureBindGroup(
    device: GPUDevice,
    uniform: GPUBuffer,
    mirror: ColumnMirror,
    layer: 'edge.overlay' | 'edge.underlay' | 'edge.casing' = 'edge.overlay',
  ): GPUBindGroup {
    const key = `${layer}`;
    let perUniform = this.bindGroups.get(uniform);

    if (perUniform == null) {
      perUniform = new Map();
      this.bindGroups.set(uniform, perUniform);
    }

    const cached = perUniform.get(key);

    if (cached != null && cached.version === mirror.version) {
      return cached.group;
    }

    const group = device.createBindGroup({
      label: 'cy-gpu:edge-bind-group',
      layout: this.bindLayout,
      entries: [
        { binding: 0, resource: { buffer: uniform } },
        ...EDGE_COLUMNS.map((col, i) => ({
          binding: i + 1,
          resource: { buffer: mirror.buffer(col.id) },
        })),
        {
          binding: EDGE_COLUMNS.length + 1,
          resource: { buffer: mirror.buffer(layer) },
        },
        {
          binding: EDGE_COLUMNS.length + 2,
          resource: { buffer: mirror.buffer('edge.gradient') },
        },
      ],
    });

    perUniform.set(key, { group, version: mirror.version });

    return group;
  }

  /**
   * The straight-edge draw: one screen-space extruded quad per visible
   * edge (haystack and triangle stream kinds included).  In the scene
   * pass it must follow the node depth prepass, since it relies on
   * early-z to skip fragments hidden by opaque node interiors; in the
   * pick pass it stands alone.
   *
   * @param pass — the render pass being encoded
   * @param device — the device, for lazy bind group rebuilds
   * @param uniform — the Frame uniform; the render and pick frames each
   * get their own cached bind group
   * @param mirror — the column mirror; its `version` drives the rebuild
   * @param instances — the culled edge count, used only to skip an empty
   * draw; the indirect buffer carries the real count
   * @param cull — the culled edge group; its compute pass must already be
   * encoded
   * @param pick — true to write edge ids to the r32uint pick target
   * instead of shaded colour
   */
  draw(
    pass: GPURenderPassEncoder,
    device: GPUDevice,
    uniform: GPUBuffer,
    mirror: ColumnMirror,
    instances: number,
    cull: CulledGroup,
    pick: boolean = false,
  ): void {
    if (instances === 0) {
      return;
    }

    pass.setPipeline(pick ? this.pickPipeline : this.pipeline);
    pass.setBindGroup(0, this.ensureBindGroup(device, uniform, mirror));
    pass.setBindGroup(1, cull.visibleBindGroup());
    pass.setIndexBuffer(this.quadIndex, 'uint16');
    pass.drawIndexedIndirect(cull.indirect, 0);
  }

  /** The overlay/underlay stroke draw (round 13 A2), off the same
   * visible list — disabled instances collapse in the VS. */
  drawLayer(
    pass: GPURenderPassEncoder,
    device: GPUDevice,
    uniform: GPUBuffer,
    mirror: ColumnMirror,
    instances: number,
    cull: CulledGroup,
    layer: 'edge.overlay' | 'edge.underlay' | 'edge.casing',
  ): void {
    if (instances === 0) {
      return;
    }

    pass.setPipeline(this.layerPipeline);
    pass.setBindGroup(0, this.ensureBindGroup(device, uniform, mirror, layer));
    pass.setBindGroup(1, cull.visibleBindGroup());
    pass.setIndexBuffer(this.quadIndex, 'uint16');
    pass.drawIndexedIndirect(cull.indirect, 0);
  }
}
