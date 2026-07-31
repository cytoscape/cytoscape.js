import { NODE_SHADER } from './shaders.mjs';
import { createQuadIndexBuffer } from './quad-index.mjs';
import { SHADER_STAGE } from './webgpu-constants.mjs';
import type { ColumnMirror } from './column-mirror.mjs';
import type { CulledGroup } from './cull.mjs';
import type { ColumnId } from '../contract.mjs';

/**
 * Storage-buffer bindings 1..8, in binding order (0 is the Frame uniform).
 * Geometry columns bind to the vertex stage; decoration columns bind to
 * the fragment stage (fetched via the flat instance index) so each stage
 * stays within the baseline 8-storage-buffer limit alongside the
 * @group(1) visible list.
 */
const NODE_COLUMNS: { id: ColumnId; visibility: number }[] = [
  { id: 'node.position', visibility: SHADER_STAGE.VERTEX },
  { id: 'node.size', visibility: SHADER_STAGE.VERTEX },
  { id: 'node.fillColor', visibility: SHADER_STAGE.FRAGMENT },
  { id: 'node.borderColor', visibility: SHADER_STAGE.FRAGMENT },
  // B2: the VS reads border width/position for the quad extent
  { id: 'node.borderWidth', visibility: SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT },
  { id: 'node.opacity', visibility: SHADER_STAGE.FRAGMENT },
  { id: 'node.shape', visibility: SHADER_STAGE.FRAGMENT },
  { id: 'node.flags', visibility: SHADER_STAGE.FRAGMENT },
  // ghost props (round 13 A1): the ghost VS offsets by .xy, the ghost FS
  // scales alpha by .z; the main node entry points never read it
  { id: 'node.ghost', visibility: SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT },
  // [cornerRadius | -1 auto, borderPosition] (round 13 B2)
  { id: 'node.borderGeom', visibility: SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT }
];

export const PREMULTIPLIED_BLEND: GPUBlendState = {
  color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
  alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
};

/** scene-pass depth buffer format (early-z; see the depth prepass) */
export const DEPTH_FORMAT: GPUTextureFormat = 'depth24plus';

/** Node render + depth-prepass pipelines (vertex pulling through the
 * culled visible list at @group(1); indexed quad per instance, indirect
 * draw).  Node picking is a synchronous CPU test (cpu-pick.mts), so there
 * is no node pick pipeline. */
export class NodePipeline {
  private pipeline: GPURenderPipeline;
  private depthPipeline: GPURenderPipeline;
  private ghostPipeline: GPURenderPipeline;
  private bindLayout: GPUBindGroupLayout;
  private quadIndex: GPUBuffer;
  /** one cached bind group per uniform buffer (render frame vs pick frame) */
  private bindGroups: Map<GPUBuffer, { group: GPUBindGroup; version: number }>;

  constructor( device: GPUDevice, format: GPUTextureFormat, visibleLayout: GPUBindGroupLayout ){
    const module = device.createShaderModule( { label: 'cy-gpu:node-shader', code: NODE_SHADER } );

    this.quadIndex = createQuadIndexBuffer( device );

    this.bindLayout = device.createBindGroupLayout( {
      label: 'cy-gpu:node-bind-layout',
      entries: [
        {
          binding: 0,
          visibility: SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT,
          buffer: { type: 'uniform' }
        },
        ...NODE_COLUMNS.map( ( column, i ) => ( {
          binding: i + 1,
          visibility: column.visibility,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType }
        } ) )
      ]
    } );

    const layout = device.createPipelineLayout( { bindGroupLayouts: [ this.bindLayout, visibleLayout ] } );

    this.pipeline = device.createRenderPipeline( {
      label: 'cy-gpu:node-pipeline',
      layout,
      vertex: { module, entryPoint: 'vsNode' },
      fragment: { module, entryPoint: 'fsNode', targets: [ { format, blend: PREMULTIPLIED_BLEND } ] },
      primitive: { topology: 'triangle-list' },
      // nodes composite in slot order over everything below (no test)
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: 'always' }
    } );

    // early-z prepass: opaque node interiors write NODE_Z (color masked off)
    this.depthPipeline = device.createRenderPipeline( {
      label: 'cy-gpu:node-depth-pipeline',
      layout,
      vertex: { module, entryPoint: 'vsNodeDepth' },
      fragment: { module, entryPoint: 'fsNodeDepth', targets: [ { format, writeMask: 0 } ] },
      primitive: { topology: 'triangle-list' },
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: 'always' }
    } );

    // ghost pass (round 13 A1): the node body duplicated at the ghost
    // offset, drawn after edges/arrows and under the nodes.  Depth-tested
    // 'less' at NODE_Z, so ghost fragments under opaque node interiors
    // (typically the ghost's own node) are killed before blending —
    // exactly v3's node-over-ghost layering.
    this.ghostPipeline = device.createRenderPipeline( {
      label: 'cy-gpu:node-ghost-pipeline',
      layout,
      vertex: { module, entryPoint: 'vsGhost' },
      fragment: { module, entryPoint: 'fsGhost', targets: [ { format, blend: PREMULTIPLIED_BLEND } ] },
      primitive: { topology: 'triangle-list' },
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: 'less' }
    } );

    this.bindGroups = new Map();
  }

  /** Lazily (re)build the bind group when the mirror reallocated buffers. */
  private ensureBindGroup( device: GPUDevice, uniform: GPUBuffer, mirror: ColumnMirror ): GPUBindGroup {
    const cached = this.bindGroups.get( uniform );

    if( cached != null && cached.version === mirror.version ){
      return cached.group;
    }

    const group = device.createBindGroup( {
      label: 'cy-gpu:node-bind-group',
      layout: this.bindLayout,
      entries: [
        { binding: 0, resource: { buffer: uniform } },
        ...NODE_COLUMNS.map( ( column, i ) => ( {
          binding: i + 1,
          resource: { buffer: mirror.buffer( column.id ) }
        } ) )
      ]
    } );

    this.bindGroups.set( uniform, { group, version: mirror.version } );

    return group;
  }

  draw(
    pass: GPURenderPassEncoder, device: GPUDevice, uniform: GPUBuffer,
    mirror: ColumnMirror, instances: number, cull: CulledGroup
  ): void {
    if( instances === 0 ){ return; }

    pass.setPipeline( this.pipeline );
    pass.setBindGroup( 0, this.ensureBindGroup( device, uniform, mirror ) );
    pass.setBindGroup( 1, cull.visibleBindGroup() );
    pass.setIndexBuffer( this.quadIndex, 'uint16' );
    pass.drawIndexedIndirect( cull.indirect, 0 );
  }

  /** The ghost draw (round 13 A1): after edges/arrows, before the nodes. */
  drawGhost(
    pass: GPURenderPassEncoder, device: GPUDevice, uniform: GPUBuffer,
    mirror: ColumnMirror, instances: number, cull: CulledGroup
  ): void {
    if( instances === 0 ){ return; }

    pass.setPipeline( this.ghostPipeline );
    pass.setBindGroup( 0, this.ensureBindGroup( device, uniform, mirror ) );
    pass.setBindGroup( 1, cull.visibleBindGroup() );
    pass.setIndexBuffer( this.quadIndex, 'uint16' );
    pass.drawIndexedIndirect( cull.indirect, 0 );
  }

  /** The early-z depth prepass draw (before edges in the scene pass). */
  drawDepthPrepass(
    pass: GPURenderPassEncoder, device: GPUDevice, uniform: GPUBuffer,
    mirror: ColumnMirror, instances: number, cull: CulledGroup
  ): void {
    if( instances === 0 ){ return; }

    pass.setPipeline( this.depthPipeline );
    pass.setBindGroup( 0, this.ensureBindGroup( device, uniform, mirror ) );
    pass.setBindGroup( 1, cull.visibleBindGroup() );
    pass.setIndexBuffer( this.quadIndex, 'uint16' );
    pass.drawIndexedIndirect( cull.indirect, 0 );
  }
}
