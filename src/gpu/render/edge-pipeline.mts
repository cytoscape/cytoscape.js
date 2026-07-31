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
  { id: 'edge.lineStyle', stages: F }
];

/** Edge render + picking pipelines (screen-space extruded quads). */
export class EdgePipeline {
  private pipeline: GPURenderPipeline;
  private pickPipeline: GPURenderPipeline;
  private bindLayout: GPUBindGroupLayout;
  private quadIndex: GPUBuffer;
  /** one cached bind group per uniform buffer (render frame vs pick frame) */
  private bindGroups: Map<GPUBuffer, { group: GPUBindGroup; version: number }>;

  constructor( device: GPUDevice, format: GPUTextureFormat, visibleLayout: GPUBindGroupLayout ){
    const module = device.createShaderModule( { label: 'cy-gpu:edge-shader', code: EDGE_SHADER } );

    this.quadIndex = createQuadIndexBuffer( device );

    this.bindLayout = device.createBindGroupLayout( {
      label: 'cy-gpu:edge-bind-layout',
      entries: [
        {
          binding: 0,
          visibility: SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT,
          buffer: { type: 'uniform' }
        },
        ...EDGE_COLUMNS.map( ( col, i ) => ( {
          binding: i + 1,
          visibility: col.stages,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType }
        } ) )
      ]
    } );

    const layout = device.createPipelineLayout( { bindGroupLayouts: [ this.bindLayout, visibleLayout ] } );

    this.pipeline = device.createRenderPipeline( {
      label: 'cy-gpu:edge-pipeline',
      layout,
      vertex: { module, entryPoint: 'vsEdge' },
      fragment: { module, entryPoint: 'fsEdge', targets: [ { format, blend: PREMULTIPLIED_BLEND } ] },
      primitive: { topology: 'triangle-list' },
      // early-z: edge fragments at EDGE_Z fail against opaque node
      // interiors (NODE_Z from the depth prepass) and skip blending
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: 'less' }
    } );

    this.pickPipeline = device.createRenderPipeline( {
      label: 'cy-gpu:edge-pick-pipeline',
      layout,
      vertex: { module, entryPoint: 'vsEdge' },
      fragment: { module, entryPoint: 'fsEdgePick', targets: [ { format: 'r32uint' } ] },
      primitive: { topology: 'triangle-list' }
    } );

    this.bindGroups = new Map();
  }

  private ensureBindGroup( device: GPUDevice, uniform: GPUBuffer, mirror: ColumnMirror ): GPUBindGroup {
    const cached = this.bindGroups.get( uniform );

    if( cached != null && cached.version === mirror.version ){
      return cached.group;
    }

    const group = device.createBindGroup( {
      label: 'cy-gpu:edge-bind-group',
      layout: this.bindLayout,
      entries: [
        { binding: 0, resource: { buffer: uniform } },
        ...EDGE_COLUMNS.map( ( col, i ) => ( {
          binding: i + 1,
          resource: { buffer: mirror.buffer( col.id ) }
        } ) )
      ]
    } );

    this.bindGroups.set( uniform, { group, version: mirror.version } );

    return group;
  }

  draw(
    pass: GPURenderPassEncoder, device: GPUDevice, uniform: GPUBuffer,
    mirror: ColumnMirror, instances: number, cull: CulledGroup, pick: boolean = false
  ): void {
    if( instances === 0 ){ return; }

    pass.setPipeline( pick ? this.pickPipeline : this.pipeline );
    pass.setBindGroup( 0, this.ensureBindGroup( device, uniform, mirror ) );
    pass.setBindGroup( 1, cull.visibleBindGroup() );
    pass.setIndexBuffer( this.quadIndex, 'uint16' );
    pass.drawIndexedIndirect( cull.indirect, 0 );
  }
}
