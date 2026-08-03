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
  'edge.lineStyle',
  // per-edge dash pattern/offset/cap (round 13 B3)
  'edge.dashPattern',
  'edge.dashMeta'
];

export class CurvedEdgePipeline {
  private pipeline: GPURenderPipeline;
  private pickPipeline: GPURenderPipeline;
  private layerPipeline: GPURenderPipeline;
  private layerBindLayout: GPUBindGroupLayout;
  private bindLayout: GPUBindGroupLayout;
  private stripIndex: GPUBuffer;
  /** one cached bind group per uniform buffer (render frame vs pick frame) */
  private bindGroups: Map<GPUBuffer, Map<string, { group: GPUBindGroup; version: number }>>;

  /**
   * Compiles the curved-edge shader, allocates the CURVE_SEGS-quad strip
   * index buffer and builds the scene, pick and layer pipelines.  Two
   * bind group layouts are needed rather than one: the layer draw's
   * vertex stage would exceed the 8-storage-buffer budget if it kept a
   * slot for edge.width, and a layout entry counts even when the shader
   * never reads it.
   *
   * @param device — the device that owns the pipelines and strip index
   * @param format — the scene colour target's format (the pick target is
   * always r32uint)
   * @param visibleLayout — the curved-edge culler's @group(1) layout
   */
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
        } ) ),
        { // the line-fill gradient record (C2), fragment-only
          binding: VERTEX_COLUMNS.length + FRAGMENT_COLUMNS.length + 3,
          visibility: SHADER_STAGE.FRAGMENT,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType }
        }
      ]
    } );

    const layout = device.createPipelineLayout( { bindGroupLayouts: [ this.bindLayout, visibleLayout ] } );

    // the layer draw's own layout: the same binding numbers minus the
    // widths column (binding 2) — the pre-derived stroke width replaces
    // it, keeping the layer vertex stage within the 8-buffer budget
    // (layouts count against the per-stage limit even for bindings a
    // shader never references)
    this.layerBindLayout = device.createBindGroupLayout( {
      label: 'cy-gpu:curved-edge-layer-bind-layout',
      entries: [
        {
          binding: 0,
          visibility: SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT,
          buffer: { type: 'uniform' }
        },
        ...VERTEX_COLUMNS.map( ( id, i ) => ( { id, binding: i + 1 } ) )
          .filter( entry => entry.id !== 'edge.width' )
          .map( entry => ( {
            binding: entry.binding,
            visibility: SHADER_STAGE.VERTEX,
            buffer: { type: 'read-only-storage' as GPUBufferBindingType }
          } ) ),
        {
          binding: VERTEX_COLUMNS.length + 1, // the curve param blob
          visibility: SHADER_STAGE.VERTEX,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType }
        },
        {
          binding: VERTEX_COLUMNS.length + FRAGMENT_COLUMNS.length + 2, // the layer record
          visibility: SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType }
        }
      ]
    } );

    const layerLayout = device.createPipelineLayout( {
      bindGroupLayouts: [ this.layerBindLayout, visibleLayout ]
    } );

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

    this.layerPipeline = device.createRenderPipeline( {
      label: 'cy-gpu:curved-edge-layer-pipeline',
      layout: layerLayout,
      vertex: { module, entryPoint: 'vsCurvedLayer' },
      fragment: { module, entryPoint: 'fsCurvedLayer', targets: [ { format, blend: PREMULTIPLIED_BLEND } ] },
      primitive: { topology: 'triangle-list' },
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: 'less' }
    } );

    this.bindGroups = new Map();
  }

  private ensureBindGroup(
    device: GPUDevice, uniform: GPUBuffer, mirror: ColumnMirror,
    layer: 'edge.overlay' | 'edge.underlay' | 'edge.casing' | 'main' = 'main'
  ): GPUBindGroup {
    let perUniform = this.bindGroups.get( uniform );

    if( perUniform == null ){
      perUniform = new Map();
      this.bindGroups.set( uniform, perUniform );
    }

    const cached = perUniform.get( layer );

    if( cached != null && cached.version === mirror.version ){
      return cached.group;
    }

    const forLayer = layer !== 'main';
    const group = device.createBindGroup( {
      label: 'cy-gpu:curved-edge-bind-group',
      layout: forLayer ? this.layerBindLayout : this.bindLayout,
      entries: [
        { binding: 0, resource: { buffer: uniform } },
        ...VERTEX_COLUMNS.map( ( id, i ) => ( { id, binding: i + 1 } ) )
          .filter( entry => !forLayer || entry.id !== 'edge.width' )
          .map( entry => ( {
            binding: entry.binding,
            resource: { buffer: mirror.buffer( entry.id ) }
          } ) ),
        { binding: VERTEX_COLUMNS.length + 1, resource: { buffer: mirror.blobBuffer() } },
        ...( forLayer ? [] : FRAGMENT_COLUMNS.map( ( id, i ) => ( {
          binding: VERTEX_COLUMNS.length + 2 + i,
          resource: { buffer: mirror.buffer( id ) }
        } ) ) ),
        ...( forLayer
          ? [ {
            binding: VERTEX_COLUMNS.length + FRAGMENT_COLUMNS.length + 2,
            resource: { buffer: mirror.buffer( layer ) }
          } ]
          : [ {
            binding: VERTEX_COLUMNS.length + FRAGMENT_COLUMNS.length + 3,
            resource: { buffer: mirror.buffer( 'edge.gradient' ) }
          } ] )
      ]
    } );

    perUniform.set( layer, { group, version: mirror.version } );

    return group;
  }

  /**
   * The curved-edge draw: one CURVE_SEGS-quad strip per visible curved
   * edge, the curve re-evaluated in the vertex shader from live endpoint
   * positions and the edge's route params, so a node drag needs no
   * geometry re-upload.  Draws off the culled stream's primary indirect
   * args (offset 0) — the arrowheads use the same stream's single-quad
   * args instead.
   *
   * @param pass — the render pass being encoded
   * @param device — the device, for lazy bind group rebuilds
   * @param uniform — the Frame uniform; the render and pick frames each
   * get their own cached bind group
   * @param mirror — the column mirror; its `version` drives the rebuild
   * @param instances — the culled curved-edge count, used only to skip an
   * empty draw; the indirect buffer carries the real count
   * @param cull — the curved-edge culled group; its compute pass must
   * already be encoded
   * @param pick — true to write edge ids to the r32uint pick target
   */
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

  /** The overlay/underlay stroke draw (round 13 A2), off the curved
   * visible list — disabled instances collapse in the VS. */
  drawLayer(
    pass: GPURenderPassEncoder, device: GPUDevice, uniform: GPUBuffer,
    mirror: ColumnMirror, instances: number, cull: CulledGroup,
    layer: 'edge.overlay' | 'edge.underlay' | 'edge.casing'
  ): void {
    if( instances === 0 ){ return; }

    pass.setPipeline( this.layerPipeline );
    pass.setBindGroup( 0, this.ensureBindGroup( device, uniform, mirror, layer ) );
    pass.setBindGroup( 1, cull.visibleBindGroup() );
    pass.setIndexBuffer( this.stripIndex, 'uint16' );
    pass.drawIndexedIndirect( cull.indirect, 0 );
  }
}
