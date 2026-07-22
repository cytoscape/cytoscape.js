import { NODE_SHADER } from './shaders.mjs';
import { SHADER_STAGE } from './webgpu-constants.mjs';
import type { ColumnMirror } from './column-mirror.mjs';
import type { ColumnId } from '../contract.mjs';

/** Storage-buffer bindings 1..8, in binding order (0 is the Frame uniform). */
const NODE_COLUMNS: ColumnId[] = [
  'node.position',
  'node.size',
  'node.fillColor',
  'node.borderColor',
  'node.borderWidth',
  'node.opacity',
  'node.shape',
  'node.flags'
];

export const PREMULTIPLIED_BLEND: GPUBlendState = {
  color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
  alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
};

/** Node render + picking pipelines (vertex pulling; 6 verts per instance). */
export class NodePipeline {
  private pipeline: GPURenderPipeline;
  private pickPipeline: GPURenderPipeline;
  private bindLayout: GPUBindGroupLayout;
  private bindGroup: GPUBindGroup | null;
  private bindVersion: number;

  constructor( device: GPUDevice, format: GPUTextureFormat ){
    const module = device.createShaderModule( { label: 'cy-gpu:node-shader', code: NODE_SHADER } );

    this.bindLayout = device.createBindGroupLayout( {
      label: 'cy-gpu:node-bind-layout',
      entries: [
        {
          binding: 0,
          visibility: SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT,
          buffer: { type: 'uniform' }
        },
        ...NODE_COLUMNS.map( ( id, i ) => ( {
          binding: i + 1,
          visibility: SHADER_STAGE.VERTEX,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType }
        } ) )
      ]
    } );

    const layout = device.createPipelineLayout( { bindGroupLayouts: [ this.bindLayout ] } );

    this.pipeline = device.createRenderPipeline( {
      label: 'cy-gpu:node-pipeline',
      layout,
      vertex: { module, entryPoint: 'vsNode' },
      fragment: { module, entryPoint: 'fsNode', targets: [ { format, blend: PREMULTIPLIED_BLEND } ] },
      primitive: { topology: 'triangle-list' }
    } );

    this.pickPipeline = device.createRenderPipeline( {
      label: 'cy-gpu:node-pick-pipeline',
      layout,
      vertex: { module, entryPoint: 'vsNode' },
      fragment: { module, entryPoint: 'fsNodePick', targets: [ { format: 'r32uint' } ] },
      primitive: { topology: 'triangle-list' }
    } );

    this.bindGroup = null;
    this.bindVersion = -1;
  }

  /** Lazily (re)build the bind group when the mirror reallocated buffers. */
  private ensureBindGroup( device: GPUDevice, uniform: GPUBuffer, mirror: ColumnMirror ): GPUBindGroup {
    if( this.bindGroup == null || this.bindVersion !== mirror.version ){
      this.bindGroup = device.createBindGroup( {
        label: 'cy-gpu:node-bind-group',
        layout: this.bindLayout,
        entries: [
          { binding: 0, resource: { buffer: uniform } },
          ...NODE_COLUMNS.map( ( id, i ) => ( {
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
