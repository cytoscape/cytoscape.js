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
  // + this end's arrow color column at the next binding, then curveParams
];

export class CurvedArrowPipeline {
  private pipeline: GPURenderPipeline;
  private bindLayout: GPUBindGroupLayout;
  private quadIndex: GPUBuffer;
  private endUniforms: [ GPUBuffer, GPUBuffer ]; // [target, source]
  /** cached bind groups per (frame uniform, end) */
  private bindGroups: Map<GPUBuffer, { groups: [ GPUBindGroup, GPUBindGroup ]; version: number }>;

  constructor( device: GPUDevice, format: GPUTextureFormat, visibleLayout: GPUBindGroupLayout ){
    const module = device.createShaderModule( { label: 'cy-gpu:curved-arrow-shader', code: CURVED_ARROW_SHADER } );

    this.quadIndex = createQuadIndexBuffer( device );

    this.endUniforms = [ 0, 1 ].map( isSource => {
      const buffer = device.createBuffer( {
        label: `cy-gpu:curved-arrow-end-${isSource === 1 ? 'source' : 'target'}`,
        size: 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      } );

      device.queue.writeBuffer( buffer, 0, new Uint32Array( [ isSource ] ) );

      return buffer;
    } ) as [ GPUBuffer, GPUBuffer ];

    this.bindLayout = device.createBindGroupLayout( {
      label: 'cy-gpu:curved-arrow-bind-layout',
      entries: [
        { binding: 0, visibility: SHADER_STAGE.VERTEX, buffer: { type: 'uniform' } },
        ...VERTEX_COLUMNS.map( ( id, i ) => ( {
          binding: i + 1,
          visibility: SHADER_STAGE.VERTEX,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType }
        } ) ),
        { // this end's arrow colors
          binding: VERTEX_COLUMNS.length + 1,
          visibility: SHADER_STAGE.VERTEX,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType }
        },
        { // per-edge curve params
          binding: VERTEX_COLUMNS.length + 2,
          visibility: SHADER_STAGE.VERTEX,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType }
        },
        { // the End uniform: the fragment stage picks this end's shape byte
          binding: VERTEX_COLUMNS.length + 3,
          visibility: SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT,
          buffer: { type: 'uniform' }
        },
        { // arrow shape ids, fragment-only
          binding: VERTEX_COLUMNS.length + 4,
          visibility: SHADER_STAGE.FRAGMENT,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType }
        }
      ]
    } );

    const layout = device.createPipelineLayout( { bindGroupLayouts: [ this.bindLayout, visibleLayout ] } );

    this.pipeline = device.createRenderPipeline( {
      label: 'cy-gpu:curved-arrow-pipeline',
      layout,
      vertex: { module, entryPoint: 'vsArrow' },
      fragment: { module, entryPoint: 'fsArrow', targets: [ { format, blend: PREMULTIPLIED_BLEND } ] },
      primitive: { topology: 'triangle-list' },
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: 'less' }
    } );

    this.bindGroups = new Map();
  }

  private ensureBindGroups( device: GPUDevice, uniform: GPUBuffer, mirror: ColumnMirror ): [ GPUBindGroup, GPUBindGroup ] {
    const cached = this.bindGroups.get( uniform );

    if( cached != null && cached.version === mirror.version ){
      return cached.groups;
    }

    const arrowColumn: [ ColumnId, ColumnId ] = [ 'edge.targetArrow', 'edge.sourceArrow' ];
    const groups = this.endUniforms.map( ( endUniform, end ) => device.createBindGroup( {
      label: 'cy-gpu:curved-arrow-bind-group',
      layout: this.bindLayout,
      entries: [
        { binding: 0, resource: { buffer: uniform } },
        ...VERTEX_COLUMNS.map( ( id, i ) => ( {
          binding: i + 1,
          resource: { buffer: mirror.buffer( id ) }
        } ) ),
        { binding: VERTEX_COLUMNS.length + 1, resource: { buffer: mirror.buffer( arrowColumn[ end ] ) } },
        { binding: VERTEX_COLUMNS.length + 2, resource: { buffer: mirror.buffer( 'edge.curveParams' ) } },
        { binding: VERTEX_COLUMNS.length + 3, resource: { buffer: endUniform } },
        { binding: VERTEX_COLUMNS.length + 4, resource: { buffer: mirror.buffer( 'edge.arrowShapes' ) } }
      ]
    } ) ) as [ GPUBindGroup, GPUBindGroup ];

    this.bindGroups.set( uniform, { groups, version: mirror.version } );

    return groups;
  }

  draw(
    pass: GPURenderPassEncoder, device: GPUDevice, uniform: GPUBuffer,
    mirror: ColumnMirror, instances: number, cull: CulledGroup,
    ends: { source: boolean; target: boolean }
  ): void {
    if( instances === 0 || ( !ends.source && !ends.target ) ){ return; }

    const groups = this.ensureBindGroups( device, uniform, mirror );

    pass.setPipeline( this.pipeline );
    pass.setBindGroup( 1, cull.visibleBindGroup() );
    pass.setIndexBuffer( this.quadIndex, 'uint16' );

    if( ends.target ){
      pass.setBindGroup( 0, groups[ 0 ] );
      pass.drawIndexedIndirect( cull.indirect, QUAD_ARGS_OFFSET );
    }

    if( ends.source ){
      pass.setBindGroup( 0, groups[ 1 ] );
      pass.drawIndexedIndirect( cull.indirect, QUAD_ARGS_OFFSET );
    }
  }
}
