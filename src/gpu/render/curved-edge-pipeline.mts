import { CURVED_EDGE_SHADER } from './shaders.mjs';
import { createQuadStripIndexBuffer } from './quad-index.mjs';
import { SHADER_STAGE } from './webgpu-constants.mjs';
import { DEPTH_FORMAT, PREMULTIPLIED_BLEND } from './node-pipeline.mjs';
import { CURVE_SEGS } from '../curve-geometry.mjs';
import type { ColumnMirror } from './column-mirror.mjs';
import type { CulledGroup } from './cull.mjs';
import type { ColumnId } from '../contract.mjs';

/**
 * Curved-edge render + picking pipelines (round 12a): one instance per
 * curved edge, drawn as a strip of CURVE_SEGS quads whose vertex shader
 * evaluates the curve from live positions + per-edge params (see
 * CURVED_EDGE_SHADER).  The vertex stage binds 6 columns + the curve
 * param blob + the visible list — exactly WebGPU's base
 * 8-storage-buffer budget (node size and border ride the derived
 * node.outerHalf column); the paint columns bind fragment-only (flat
 * instance fetch).
 */

/** vertex-stage columns, bindings 1..6 (0 is the Frame uniform; the
 * curve param blob binds at 7) */
const VERTEX_COLUMNS: ColumnId[] = [
  'edge.endpoints',
  'edge.width',
  'node.position',
  'node.outerHalf',
  'node.shape',
  'edge.curveParams'
];

/** fragment-stage columns, bindings 8..10 */
const FRAGMENT_COLUMNS: ColumnId[] = [
  'edge.lineColor',
  'edge.opacity',
  'edge.lineStyle'
];

export class CurvedEdgePipeline {
  private pipeline: GPURenderPipeline;
  private pickPipeline: GPURenderPipeline;
  private bindLayout: GPUBindGroupLayout;
  private stripIndex: GPUBuffer;
  /** one cached bind group per uniform buffer (render frame vs pick frame) */
  private bindGroups: Map<GPUBuffer, { group: GPUBindGroup; version: number }>;

  constructor( device: GPUDevice, format: GPUTextureFormat, visibleLayout: GPUBindGroupLayout ){
    const module = device.createShaderModule( { label: 'cy-gpu:curved-edge-shader', code: CURVED_EDGE_SHADER } );

    this.stripIndex = createQuadStripIndexBuffer( device, CURVE_SEGS );

    this.bindLayout = device.createBindGroupLayout( {
      label: 'cy-gpu:curved-edge-bind-layout',
      entries: [
        {
          binding: 0,
          visibility: SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT,
          buffer: { type: 'uniform' }
        },
        ...VERTEX_COLUMNS.map( ( id, i ) => ( {
          binding: i + 1,
          visibility: SHADER_STAGE.VERTEX,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType }
        } ) ),
        { // the curve param blob (12b route families)
          binding: VERTEX_COLUMNS.length + 1,
          visibility: SHADER_STAGE.VERTEX,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType }
        },
        ...FRAGMENT_COLUMNS.map( ( id, i ) => ( {
          binding: VERTEX_COLUMNS.length + 2 + i,
          visibility: SHADER_STAGE.FRAGMENT,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType }
        } ) )
      ]
    } );

    const layout = device.createPipelineLayout( { bindGroupLayouts: [ this.bindLayout, visibleLayout ] } );

    this.pipeline = device.createRenderPipeline( {
      label: 'cy-gpu:curved-edge-pipeline',
      layout,
      vertex: { module, entryPoint: 'vsCurvedEdge' },
      fragment: { module, entryPoint: 'fsCurvedEdge', targets: [ { format, blend: PREMULTIPLIED_BLEND } ] },
      primitive: { topology: 'triangle-list' },
      // early-z against opaque node interiors, like the straight edges
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: 'less' }
    } );

    this.pickPipeline = device.createRenderPipeline( {
      label: 'cy-gpu:curved-edge-pick-pipeline',
      layout,
      vertex: { module, entryPoint: 'vsCurvedEdge' },
      fragment: { module, entryPoint: 'fsCurvedEdgePick', targets: [ { format: 'r32uint' } ] },
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
      label: 'cy-gpu:curved-edge-bind-group',
      layout: this.bindLayout,
      entries: [
        { binding: 0, resource: { buffer: uniform } },
        ...VERTEX_COLUMNS.map( ( id, i ) => ( {
          binding: i + 1,
          resource: { buffer: mirror.buffer( id ) }
        } ) ),
        { binding: VERTEX_COLUMNS.length + 1, resource: { buffer: mirror.blobBuffer() } },
        ...FRAGMENT_COLUMNS.map( ( id, i ) => ( {
          binding: VERTEX_COLUMNS.length + 2 + i,
          resource: { buffer: mirror.buffer( id ) }
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
    pass.setIndexBuffer( this.stripIndex, 'uint16' );
    pass.drawIndexedIndirect( cull.indirect, 0 );
  }
}
