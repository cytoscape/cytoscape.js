/*
ImagePipeline (round 15.3): the background-image compositing draw.

Imaged nodes draw one extra instanced quad off the same culled visible
lists as their bodies — the leaf stream right after the main node draw,
the parent stream right after the parent bodies — with imageless
instances collapsing in the VS (imageRef == 0), so the pass costs
nothing per imageless node and is skipped outright while the store
holds no image records at all.

Bindings: group(0) is the uniform + storage set (positions/sizes/
opacity/borderGeom/borderWidths for placement and the clip SDF, the
imageRef column, the image record blob, the image table, and the poly
blob for custom-polygon clipping) — the FS lands at exactly the base
8-storage-buffer budget; group(1) is the culled visible list; group(2)
carries the tier texture arrays + sampler (their own binding budget),
rebuilt lazily when ImageArrays reallocates.
*/

import { IMAGE_SHADER } from './shaders.mjs';
import { createQuadIndexBuffer } from './quad-index.mjs';
import { SHADER_STAGE } from './webgpu-constants.mjs';
import { PREMULTIPLIED_BLEND, DEPTH_FORMAT } from './node-pipeline.mjs';
import type { ColumnMirror } from './column-mirror.mjs';
import type { ImageArrays } from './image-arrays.mjs';
import type { CulledGroup } from './cull.mjs';
import type { ColumnId } from '../contract.mjs';

const V = SHADER_STAGE.VERTEX;
const F = SHADER_STAGE.FRAGMENT;

const IMAGE_COLUMNS: { id: ColumnId; visibility: number }[] = [
  { id: 'node.position', visibility: V },
  { id: 'node.size', visibility: V | F },
  { id: 'node.opacity', visibility: F },
  { id: 'node.borderGeom', visibility: F },
  { id: 'node.borderWidth', visibility: F },
  { id: 'node.imageRef', visibility: V | F }
];

export class ImagePipeline {
  private pipeline: GPURenderPipeline;
  private bindLayout: GPUBindGroupLayout;
  private texLayout: GPUBindGroupLayout;
  private quadIndex: GPUBuffer;
  private bindGroups = new Map<GPUBuffer, { group: GPUBindGroup; mv: number; av: number }>();
  private texGroup: { group: GPUBindGroup; version: number } | null = null;

  constructor( device: GPUDevice, format: GPUTextureFormat, visibleLayout: GPUBindGroupLayout ){
    const module = device.createShaderModule( { label: 'cy-gpu:image-shader', code: IMAGE_SHADER } );

    this.quadIndex = createQuadIndexBuffer( device );

    this.bindLayout = device.createBindGroupLayout( {
      label: 'cy-gpu:image-bind-layout',
      entries: [
        { binding: 0, visibility: V | F, buffer: { type: 'uniform' } },
        ...IMAGE_COLUMNS.map( ( column, i ) => ( {
          binding: i + 1,
          visibility: column.visibility,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType }
        } ) ),
        { binding: IMAGE_COLUMNS.length + 1, visibility: V | F,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType } }, // image blob
        { binding: IMAGE_COLUMNS.length + 2, visibility: V | F,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType } }, // image table
        { binding: IMAGE_COLUMNS.length + 3, visibility: F,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType } } // poly blob
      ]
    } );

    this.texLayout = device.createBindGroupLayout( {
      label: 'cy-gpu:image-tex-layout',
      entries: [
        { binding: 0, visibility: F, texture: { viewDimension: '2d-array' } },
        { binding: 1, visibility: F, texture: { viewDimension: '2d-array' } },
        { binding: 2, visibility: F, texture: { viewDimension: '2d-array' } },
        { binding: 3, visibility: F, sampler: {} },
        // the r8 sdf-icon array (round 15.5)
        { binding: 4, visibility: F, texture: { viewDimension: '2d-array' } }
      ]
    } );

    const layout = device.createPipelineLayout( {
      bindGroupLayouts: [ this.bindLayout, visibleLayout, this.texLayout ]
    } );

    this.pipeline = device.createRenderPipeline( {
      label: 'cy-gpu:image-pipeline',
      layout,
      vertex: { module, entryPoint: 'vsImage' },
      fragment: { module, entryPoint: 'fsImage', targets: [ { format, blend: PREMULTIPLIED_BLEND } ] },
      primitive: { topology: 'triangle-list' },
      // composites over the node bodies just drawn; never occludes
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: 'always' }
    } );
  }

  private ensureBindGroup(
    device: GPUDevice, uniform: GPUBuffer, mirror: ColumnMirror, arrays: ImageArrays
  ): GPUBindGroup {
    const cached = this.bindGroups.get( uniform );

    if( cached != null && cached.mv === mirror.version && cached.av === arrays.version ){
      return cached.group;
    }

    const group = device.createBindGroup( {
      label: 'cy-gpu:image-bind-group',
      layout: this.bindLayout,
      entries: [
        { binding: 0, resource: { buffer: uniform } },
        ...IMAGE_COLUMNS.map( ( column, i ) => ( {
          binding: i + 1, resource: { buffer: mirror.buffer( column.id ) }
        } ) ),
        { binding: IMAGE_COLUMNS.length + 1, resource: { buffer: mirror.imageBlobBuffer() } },
        { binding: IMAGE_COLUMNS.length + 2, resource: { buffer: arrays.tableBuffer() } },
        { binding: IMAGE_COLUMNS.length + 3, resource: { buffer: mirror.polyBlobBuffer() } }
      ]
    } );

    this.bindGroups.set( uniform, { group, mv: mirror.version, av: arrays.version } );

    return group;
  }

  private ensureTexGroup( device: GPUDevice, arrays: ImageArrays ): GPUBindGroup {
    if( this.texGroup != null && this.texGroup.version === arrays.version ){
      return this.texGroup.group;
    }

    const group = device.createBindGroup( {
      label: 'cy-gpu:image-tex-group',
      layout: this.texLayout,
      entries: [
        { binding: 0, resource: arrays.view( 0 ) },
        { binding: 1, resource: arrays.view( 1 ) },
        { binding: 2, resource: arrays.view( 2 ) },
        { binding: 3, resource: arrays.sampler },
        { binding: 4, resource: arrays.iconView() }
      ]
    } );

    this.texGroup = { group, version: arrays.version };

    return group;
  }

  draw(
    pass: GPURenderPassEncoder, device: GPUDevice, uniform: GPUBuffer,
    mirror: ColumnMirror, arrays: ImageArrays, instances: number, cull: CulledGroup
  ): void {
    if( instances === 0 ){ return; }

    pass.setPipeline( this.pipeline );
    pass.setBindGroup( 0, this.ensureBindGroup( device, uniform, mirror, arrays ) );
    pass.setBindGroup( 1, cull.visibleBindGroup() );
    pass.setBindGroup( 2, this.ensureTexGroup( device, arrays ) );
    pass.setIndexBuffer( this.quadIndex, 'uint16' );
    pass.drawIndexedIndirect( cull.indirect, 0 );
  }
}
