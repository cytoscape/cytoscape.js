import { EDGE_SHADER } from './shaders.mjs';
import { SHADER_STAGE } from './webgpu-constants.mjs';
import { PREMULTIPLIED_BLEND } from './node-pipeline.mjs';
import type { ColumnMirror } from './column-mirror.mjs';
import type { ColumnId } from '../contract.mjs';

/**
 * Storage-buffer bindings 1..7 (0 is the Frame uniform).  The edge vertex
 * shader reads endpoint positions straight from the node position buffer,
 * so a node drag uploads one row and its edges follow on-GPU.
 */
const EDGE_COLUMNS: ColumnId[] = [
  'edge.endpoints',
  'edge.lineColor',
  'edge.width',
  'edge.opacity',
  'edge.flags',
  'node.position',
  'node.flags'
];

/** Edge render + picking pipelines (screen-space extruded quads). */
export class EdgePipeline {
  private pipeline: GPURenderPipeline;
  private pickPipeline: GPURenderPipeline;
  private bindLayout: GPUBindGroupLayout;
  private bindGroup: GPUBindGroup | null;
  private bindVersion: number;

  constructor( device: GPUDevice, format: GPUTextureFormat ){
    const module = device.createShaderModule( { label: 'cy-gpu:edge-shader', code: EDGE_SHADER } );

    this.bindLayout = device.createBindGroupLayout( {
      label: 'cy-gpu:edge-bind-layout',
      entries: [
        {
          binding: 0,
          visibility: SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT,
          buffer: { type: 'uniform' }
        },
        ...EDGE_COLUMNS.map( ( id, i ) => ( {
          binding: i + 1,
          visibility: SHADER_STAGE.VERTEX,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType }
        } ) )
      ]
    } );

    const layout = device.createPipelineLayout( { bindGroupLayouts: [ this.bindLayout ] } );

    this.pipeline = device.createRenderPipeline( {
      label: 'cy-gpu:edge-pipeline',
      layout,
      vertex: { module, entryPoint: 'vsEdge' },
      fragment: { module, entryPoint: 'fsEdge', targets: [ { format, blend: PREMULTIPLIED_BLEND } ] },
      primitive: { topology: 'triangle-list' }
    } );

    this.pickPipeline = device.createRenderPipeline( {
      label: 'cy-gpu:edge-pick-pipeline',
      layout,
      vertex: { module, entryPoint: 'vsEdge' },
      fragment: { module, entryPoint: 'fsEdgePick', targets: [ { format: 'r32uint' } ] },
      primitive: { topology: 'triangle-list' }
    } );

    this.bindGroup = null;
    this.bindVersion = -1;
  }

  private ensureBindGroup( device: GPUDevice, uniform: GPUBuffer, mirror: ColumnMirror ): GPUBindGroup {
    if( this.bindGroup == null || this.bindVersion !== mirror.version ){
      this.bindGroup = device.createBindGroup( {
        label: 'cy-gpu:edge-bind-group',
        layout: this.bindLayout,
        entries: [
          { binding: 0, resource: { buffer: uniform } },
          ...EDGE_COLUMNS.map( ( id, i ) => ( {
            binding: i + 1,
            resource: { buffer: mirror.buffer( id ) }
          } ) )
        ]
      } );

      this.bindVersion = mirror.version;
    }

    return this.bindGroup;
  }

  draw(
    pass: GPURenderPassEncoder, device: GPUDevice, uniform: GPUBuffer,
    mirror: ColumnMirror, instances: number, pick: boolean = false
  ): void {
    if( instances === 0 ){ return; }

    pass.setPipeline( pick ? this.pickPipeline : this.pipeline );
    pass.setBindGroup( 0, this.ensureBindGroup( device, uniform, mirror ) );
    pass.draw( 6, instances );
  }
}
