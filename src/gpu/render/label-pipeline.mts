import { EDGE_LABEL_SHADER, LABEL_SHADER } from './shaders.mjs';
import { createQuadIndexBuffer } from './quad-index.mjs';
import { SHADER_STAGE } from './webgpu-constants.mjs';
import { DEPTH_FORMAT, PREMULTIPLIED_BLEND } from './node-pipeline.mjs';
import type { ColumnMirror } from './column-mirror.mjs';
import type { CulledGroup } from './cull.mjs';
import type { GlyphBuffer } from './glyph-buffer.mjs';
import type { GlyphAtlas } from './glyph-atlas.mjs';

/**
 * SDF label render pipeline: one instance per glyph, pulled from the
 * GlyphBuffer, with node positions/flags read from the column mirror so
 * labels track their nodes on-GPU.  Labels draw after nodes and are not
 * pickable.
 */
export class LabelPipeline {
  private pipeline: GPURenderPipeline;
  private bindLayout: GPUBindGroupLayout;
  private quadIndex: GPUBuffer;
  private edge: boolean;
  /** one cached bind group per uniform buffer (scene frame vs export frame) */
  private bindGroups: Map<GPUBuffer, { group: GPUBindGroup; key: string }>;

  constructor(
    device: GPUDevice, format: GPUTextureFormat, visibleLayout: GPUBindGroupLayout,
    variant: 'node' | 'edge' = 'node'
  ){
    this.edge = variant === 'edge';

    const module = device.createShaderModule( {
      label: `cy-gpu:${variant}-label-shader`,
      code: this.edge ? EDGE_LABEL_SHADER : LABEL_SHADER
    } );

    this.quadIndex = createQuadIndexBuffer( device );

    // edge labels bind the edge endpoints + curve inputs (incl. the 12b
    // param blob) ahead of the atlas, so the VS can compute the
    // curve/route midpoint anchor on-GPU — 7 storage buffers + the
    // visible list, exactly the vertex-stage budget (node size and
    // border ride the derived outerHalf column)
    const storageCount = this.edge ? 7 : 2;

    this.bindLayout = device.createBindGroupLayout( {
      label: `cy-gpu:${variant}-label-bind-layout`,
      entries: [
        { binding: 0, visibility: SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT, buffer: { type: 'uniform' } },
        ...Array.from( { length: storageCount }, ( _, i ) => ( {
          binding: i + 1,
          visibility: SHADER_STAGE.VERTEX,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType }
        } ) ),
        { binding: storageCount + 1, visibility: SHADER_STAGE.FRAGMENT, texture: { sampleType: 'float' as GPUTextureSampleType } },
        { binding: storageCount + 2, visibility: SHADER_STAGE.FRAGMENT, sampler: { type: 'filtering' as GPUSamplerBindingType } }
      ]
    } );

    this.pipeline = device.createRenderPipeline( {
      label: `cy-gpu:${variant}-label-pipeline`,
      layout: device.createPipelineLayout( { bindGroupLayouts: [ this.bindLayout, visibleLayout ] } ),
      vertex: { module, entryPoint: 'vsLabel' },
      fragment: { module, entryPoint: 'fsLabel', targets: [ { format, blend: PREMULTIPLIED_BLEND } ] },
      primitive: { topology: 'triangle-list' },
      // labels draw over everything (no depth test)
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: 'always' }
    } );

    this.bindGroups = new Map();
  }

  private ensureBindGroup(
    device: GPUDevice, uniform: GPUBuffer,
    glyphs: GlyphBuffer, mirror: ColumnMirror, atlas: GlyphAtlas
  ): GPUBindGroup {
    const key = `${mirror.version}:${glyphs.version}`;
    const cached = this.bindGroups.get( uniform );

    if( cached != null && cached.key === key ){
      return cached.group;
    }

    const storages: GPUBuffer[] = this.edge
      ? [
        glyphs.buffer(), mirror.buffer( 'edge.endpoints' ), mirror.buffer( 'node.position' ),
        mirror.buffer( 'edge.curveParams' ), mirror.buffer( 'node.outerHalf' ),
        mirror.buffer( 'node.shape' ), mirror.blobBuffer()
      ]
      : [ glyphs.buffer(), mirror.buffer( 'node.position' ) ];

    const group = device.createBindGroup( {
      label: 'cy-gpu:label-bind-group',
      layout: this.bindLayout,
      entries: [
        { binding: 0, resource: { buffer: uniform } },
        ...storages.map( ( buffer, i ) => ( { binding: i + 1, resource: { buffer } } ) ),
        { binding: storages.length + 1, resource: atlas.texture.createView() },
        { binding: storages.length + 2, resource: atlas.sampler }
      ]
    } );

    this.bindGroups.set( uniform, { group, key } );

    return group;
  }

  draw(
    pass: GPURenderPassEncoder, device: GPUDevice, uniform: GPUBuffer,
    glyphs: GlyphBuffer, mirror: ColumnMirror, atlas: GlyphAtlas, cull: CulledGroup
  ): void {
    if( glyphs.highWater === 0 ){ return; }

    pass.setPipeline( this.pipeline );
    pass.setBindGroup( 0, this.ensureBindGroup( device, uniform, glyphs, mirror, atlas ) );
    pass.setBindGroup( 1, cull.visibleBindGroup() );
    pass.setIndexBuffer( this.quadIndex, 'uint16' );
    pass.drawIndexedIndirect( cull.indirect, 0 );
  }
}
