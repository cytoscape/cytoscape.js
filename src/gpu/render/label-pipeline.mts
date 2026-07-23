import { LABEL_SHADER } from './shaders.mjs';
import { SHADER_STAGE } from './webgpu-constants.mjs';
import { PREMULTIPLIED_BLEND } from './node-pipeline.mjs';
import type { ColumnMirror } from './column-mirror.mjs';
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
  private bindGroup: GPUBindGroup | null;
  private bindKey: string;

  constructor( device: GPUDevice, format: GPUTextureFormat ){
    const module = device.createShaderModule( { label: 'cy-gpu:label-shader', code: LABEL_SHADER } );

    this.bindLayout = device.createBindGroupLayout( {
      label: 'cy-gpu:label-bind-layout',
      entries: [
        { binding: 0, visibility: SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: SHADER_STAGE.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: SHADER_STAGE.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: SHADER_STAGE.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 4, visibility: SHADER_STAGE.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 5, visibility: SHADER_STAGE.FRAGMENT, sampler: { type: 'filtering' } }
      ]
    } );

    this.pipeline = device.createRenderPipeline( {
      label: 'cy-gpu:label-pipeline',
      layout: device.createPipelineLayout( { bindGroupLayouts: [ this.bindLayout ] } ),
      vertex: { module, entryPoint: 'vsLabel' },
      fragment: { module, entryPoint: 'fsLabel', targets: [ { format, blend: PREMULTIPLIED_BLEND } ] },
      primitive: { topology: 'triangle-list' }
    } );

    this.bindGroup = null;
    this.bindKey = '';
  }

  private ensureBindGroup(
    device: GPUDevice, uniform: GPUBuffer,
    glyphs: GlyphBuffer, mirror: ColumnMirror, atlas: GlyphAtlas
  ): GPUBindGroup {
    const key = `${mirror.version}:${glyphs.version}`;

    if( this.bindGroup == null || this.bindKey !== key ){
      this.bindGroup = device.createBindGroup( {
        label: 'cy-gpu:label-bind-group',
        layout: this.bindLayout,
        entries: [
          { binding: 0, resource: { buffer: uniform } },
          { binding: 1, resource: { buffer: glyphs.buffer() } },
          { binding: 2, resource: { buffer: mirror.buffer( 'node.position' ) } },
          { binding: 3, resource: { buffer: mirror.buffer( 'node.flags' ) } },
          { binding: 4, resource: atlas.texture.createView() },
          { binding: 5, resource: atlas.sampler }
        ]
      } );

      this.bindKey = key;
    }

    return this.bindGroup;
  }

  draw(
    pass: GPURenderPassEncoder, device: GPUDevice, uniform: GPUBuffer,
    glyphs: GlyphBuffer, mirror: ColumnMirror, atlas: GlyphAtlas
  ): void {
    if( glyphs.highWater === 0 ){ return; }

    pass.setPipeline( this.pipeline );
    pass.setBindGroup( 0, this.ensureBindGroup( device, uniform, glyphs, mirror, atlas ) );
    pass.draw( 6, glyphs.highWater );
  }
}
