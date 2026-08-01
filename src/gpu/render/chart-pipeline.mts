/*
ChartPipeline (round 23): the pie/stripe background draw.

Charted nodes draw one extra instanced quad off the same culled visible
lists as their bodies — the leaf stream right after the image pass, the
parent stream after its — with chartless instances collapsing in the VS
(chartRef == 0), so the pass costs nothing per chartless node and is
skipped outright while the store holds no chart records at all.

Bindings: group(0) is the uniform + storage set (positions/sizes/
opacity/borderGeom/borderWidths for placement and the clip SDF, the
chartRef column, the chart record blob, and the poly blob for
custom-polygon clipping); group(1) is the culled visible list.
*/

import { CHART_SHADER } from './shaders.mjs';
import { createQuadIndexBuffer } from './quad-index.mjs';
import { SHADER_STAGE } from './webgpu-constants.mjs';
import { PREMULTIPLIED_BLEND, DEPTH_FORMAT } from './node-pipeline.mjs';
import type { ColumnMirror } from './column-mirror.mjs';
import type { CulledGroup } from './cull.mjs';
import type { ColumnId } from '../contract.mjs';

const V = SHADER_STAGE.VERTEX;
const F = SHADER_STAGE.FRAGMENT;

const CHART_COLUMNS: { id: ColumnId; visibility: number }[] = [
  { id: 'node.position', visibility: V },
  { id: 'node.size', visibility: V | F },
  { id: 'node.opacity', visibility: F },
  { id: 'node.borderGeom', visibility: F },
  { id: 'node.borderWidth', visibility: F },
  { id: 'node.chartRef', visibility: V | F }
];

export class ChartPipeline {
  private pipeline: GPURenderPipeline;
  private bindLayout: GPUBindGroupLayout;
  private quadIndex: GPUBuffer;
  private bindGroups = new Map<GPUBuffer, { group: GPUBindGroup; mv: number }>();

  constructor( device: GPUDevice, format: GPUTextureFormat, visibleLayout: GPUBindGroupLayout ){
    const module = device.createShaderModule( { label: 'cy-gpu:chart-shader', code: CHART_SHADER } );

    this.quadIndex = createQuadIndexBuffer( device );

    this.bindLayout = device.createBindGroupLayout( {
      label: 'cy-gpu:chart-bind-layout',
      entries: [
        { binding: 0, visibility: V | F, buffer: { type: 'uniform' } },
        ...CHART_COLUMNS.map( ( column, i ) => ( {
          binding: i + 1,
          visibility: column.visibility,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType }
        } ) ),
        { binding: CHART_COLUMNS.length + 1, visibility: V | F,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType } }, // chart blob
        { binding: CHART_COLUMNS.length + 2, visibility: F,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType } } // poly blob
      ]
    } );

    const layout = device.createPipelineLayout( {
      bindGroupLayouts: [ this.bindLayout, visibleLayout ]
    } );

    this.pipeline = device.createRenderPipeline( {
      label: 'cy-gpu:chart-pipeline',
      layout,
      vertex: { module, entryPoint: 'vsChart' },
      fragment: { module, entryPoint: 'fsChart', targets: [ { format, blend: PREMULTIPLIED_BLEND } ] },
      primitive: { topology: 'triangle-list' },
      // composites over the bodies/images just drawn; never occludes
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: 'always' }
    } );
  }

  private ensureBindGroup( device: GPUDevice, uniform: GPUBuffer, mirror: ColumnMirror ): GPUBindGroup {
    const cached = this.bindGroups.get( uniform );

    if( cached != null && cached.mv === mirror.version ){ return cached.group; }

    const group = device.createBindGroup( {
      label: 'cy-gpu:chart-bind-group',
      layout: this.bindLayout,
      entries: [
        { binding: 0, resource: { buffer: uniform } },
        ...CHART_COLUMNS.map( ( column, i ) => ( {
          binding: i + 1, resource: { buffer: mirror.buffer( column.id ) }
        } ) ),
        { binding: CHART_COLUMNS.length + 1, resource: { buffer: mirror.chartBlobBuffer() } },
        { binding: CHART_COLUMNS.length + 2, resource: { buffer: mirror.polyBlobBuffer() } }
      ]
    } );

    this.bindGroups.set( uniform, { group, mv: mirror.version } );

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
}
