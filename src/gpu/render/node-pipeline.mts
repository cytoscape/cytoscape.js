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
const V = SHADER_STAGE.VERTEX;
const F = SHADER_STAGE.FRAGMENT;

/**
 * Columns by binding number (0 is the Frame uniform; 11 is the C3
 * custom-polygon blob).  The per-stage 8-storage-buffer budget forces
 * two bind group layouts (round 13 C3): the main/prepass pipelines
 * exclude the ghost column (their entry points never read it), the
 * ghost pipeline excludes node.flags (no accent/hover on ghosts) —
 * each lands at exactly 8 fragment-visible storage buffers.
 */
const NODE_COLUMNS: { id: ColumnId; visibility: number; ghostOnly?: boolean; mainOnly?: boolean }[] = [
  { id: 'node.position', visibility: V },
  { id: 'node.size', visibility: V },
  { id: 'node.fillColor', visibility: F },
  { id: 'node.borderColor', visibility: F },
  { id: 'node.borderWidth', visibility: V | F },
  { id: 'node.opacity', visibility: F },
  { id: 'node.gradient', visibility: F },
  { id: 'node.flags', visibility: F, mainOnly: true },
  { id: 'node.ghost', visibility: V | F, ghostOnly: true },
  { id: 'node.borderGeom', visibility: V | F }
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
  private ghostBindLayout!: GPUBindGroupLayout;
  private quadIndex: GPUBuffer;
  /** one cached bind group per uniform buffer (render frame vs pick frame) */
  private bindGroups: Map<GPUBuffer, Map<string, { group: GPUBindGroup; version: number }>>;

  /**
   * Compiles the node shader once and builds all three pipelines (main,
   * depth prepass, ghost) plus the two bind group layouts the C3
   * storage-buffer budget forces.  The @group(1) visible-list layout is
   * supplied by the culler rather than created here, so every pipeline in
   * the scene pass shares one layout and one culled list.
   *
   * @param device — the device that owns the pipelines and quad index
   * @param format — the scene colour target's format
   * @param visibleLayout — the culler's @group(1) layout; the CulledGroup
   * bound at draw time must have been created against it
   */
  constructor( device: GPUDevice, format: GPUTextureFormat, visibleLayout: GPUBindGroupLayout ){
    const module = device.createShaderModule( { label: 'cy-gpu:node-shader', code: NODE_SHADER } );

    this.quadIndex = createQuadIndexBuffer( device );

    // two layouts under the per-stage budget (C3): main/prepass skip
    // the ghost column, the ghost pipeline skips node.flags; both bind
    // the poly blob at NODE_COLUMNS.length + 1
    const makeLayout = ( label: string, ghost: boolean ): GPUBindGroupLayout =>
      device.createBindGroupLayout( {
        label,
        entries: [
          {
            binding: 0,
            visibility: SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT,
            buffer: { type: 'uniform' }
          },
          ...NODE_COLUMNS
            .map( ( column, i ) => ( { column, binding: i + 1 } ) )
            .filter( e => ghost ? !e.column.mainOnly : !e.column.ghostOnly )
            .map( e => ( {
              binding: e.binding,
              visibility: e.column.visibility,
              buffer: { type: 'read-only-storage' as GPUBufferBindingType }
            } ) ),
          { // the C3 custom-polygon point blob
            binding: NODE_COLUMNS.length + 1,
            visibility: SHADER_STAGE.FRAGMENT,
            buffer: { type: 'read-only-storage' as GPUBufferBindingType }
          }
        ]
      } );

    this.bindLayout = makeLayout( 'cy-gpu:node-bind-layout', false );
    this.ghostBindLayout = makeLayout( 'cy-gpu:node-ghost-bind-layout', true );

    const layout = device.createPipelineLayout( { bindGroupLayouts: [ this.bindLayout, visibleLayout ] } );
    const ghostLayout = device.createPipelineLayout( {
      bindGroupLayouts: [ this.ghostBindLayout, visibleLayout ]
    } );

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
      layout: ghostLayout,
      vertex: { module, entryPoint: 'vsGhost' },
      fragment: { module, entryPoint: 'fsGhost', targets: [ { format, blend: PREMULTIPLIED_BLEND } ] },
      primitive: { topology: 'triangle-list' },
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: 'less' }
    } );

    this.bindGroups = new Map();
  }

  /** Lazily (re)build the bind group when the mirror reallocated buffers. */
  private ensureBindGroup(
    device: GPUDevice, uniform: GPUBuffer, mirror: ColumnMirror, ghost: boolean = false
  ): GPUBindGroup {
    const key = ghost ? 'ghost' : 'main';
    let perUniform = this.bindGroups.get( uniform );

    if( perUniform == null ){
      perUniform = new Map();
      this.bindGroups.set( uniform, perUniform );
    }

    const cached = perUniform.get( key );

    if( cached != null && cached.version === mirror.version ){
      return cached.group;
    }

    const group = device.createBindGroup( {
      label: 'cy-gpu:node-bind-group',
      layout: ghost ? this.ghostBindLayout : this.bindLayout,
      entries: [
        { binding: 0, resource: { buffer: uniform } },
        ...NODE_COLUMNS
          .map( ( column, i ) => ( { column, binding: i + 1 } ) )
          .filter( e => ghost ? !e.column.mainOnly : !e.column.ghostOnly )
          .map( e => ( {
            binding: e.binding,
            resource: { buffer: mirror.buffer( e.column.id ) }
          } ) ),
        { binding: NODE_COLUMNS.length + 1, resource: { buffer: mirror.polyBlobBuffer() } }
      ]
    } );

    perUniform.set( key, { group, version: mirror.version } );

    return group;
  }

  /**
   * The node body draw: one SDF-shaded quad per visible node, composited
   * in slot order with the depth test off.  Must be encoded after the
   * depth prepass, the edges/arrows and the ghost/underlay draws, and
   * before overlays and labels.
   *
   * @param pass — the scene render pass being encoded
   * @param device — the device, for lazy bind group rebuilds
   * @param uniform — the Frame uniform for this pass; bind groups are
   * cached per uniform buffer, so passing a different one is cheap
   * @param mirror — the column mirror; its `version` drives the rebuild
   * @param instances — the culled node count, used only to skip encoding
   * an empty draw; the real count comes from the indirect buffer
   * @param cull — the culled node group whose compute pass must already
   * be encoded and whose indirect args this draw reads
   */
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
    pass.setBindGroup( 0, this.ensureBindGroup( device, uniform, mirror, true ) );
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
