import { BUFFER_USAGE, SHADER_STAGE } from './webgpu-constants.mjs';

/*
GPU tween runtime: evaluates position animations on-device so a running
animation costs ~zero per-frame CPU.  Each registered batch uploads its
per-slot from/to positions once; every frame a compute pass reads the
shared `now` and writes node.position = mix(from, to, ease(t)) for the
batch's slots — no CPU tween loop, no per-frame column upload.

Because a tween is a pure function of time, the CPU stays the reference:
the AnimationManager owns the queue/timing/completion and, on
settle/stop, re-derives the exact current value on the CPU (no readback).
This runtime is a pure executor — register / unregister / encode — driven
by the renderer's frame clock; node.position is marked GPU-owned in the
mirror while any batch is active so CPU writes don't clobber it.

Scope: node position (the layout-transition / large-move case).  Paint
and size tweens stay on the CPU path for now.
*/

const WG_SIZE = 256;
export const TWEEN_PARAMS_BYTES = 32;

/** Narrow device surface (mock-testable, matching MapperRuntime). */
export interface TweenDevice {
  createBuffer( d: { size: number; usage: number; label?: string } ): GPUBuffer;
  createBindGroupLayout( d: GPUBindGroupLayoutDescriptor ): GPUBindGroupLayout;
  createPipelineLayout( d: GPUPipelineLayoutDescriptor ): GPUPipelineLayout;
  createShaderModule( d: GPUShaderModuleDescriptor ): GPUShaderModule;
  createComputePipeline( d: GPUComputePipelineDescriptor ): GPUComputePipeline;
  createBindGroup( d: GPUBindGroupDescriptor ): GPUBindGroup;
  queue: { writeBuffer( b: GPUBuffer, off: number, data: ArrayBufferLike | ArrayBufferView, dOff?: number, size?: number ): void };
}

export const TWEEN_SHADER = `
struct TweenParams {
  start: f32,
  duration: f32,
  now: f32,
  count: u32,
  easingId: u32,
  pad0: u32, pad1: u32, pad2: u32,
}

@group(0) @binding(0) var<uniform> params: TweenParams;
@group(0) @binding(1) var<storage, read> slots: array<u32>;
@group(0) @binding(2) var<storage, read> fromTo: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> positions: array<vec2f>;

// ids match EASING_IDS in animation.mts
fn ease(id: u32, t: f32) -> f32 {
  switch id {
    case 0u: { return t; }                                  // linear
    case 2u: { return t * t * t; }                          // ease-in (cubic)
    case 3u: { return 1.0 - pow(1.0 - t, 3.0); }            // ease-out
    case 4u: { if (t < 0.5) { return 4.0*t*t*t; } return 1.0 - pow(-2.0*t + 2.0, 3.0)/2.0; }
    case 5u: { return 1.0 - cos((t * 3.14159265) / 2.0); }  // ease-in-sine
    case 6u: { return sin((t * 3.14159265) / 2.0); }        // ease-out-sine
    case 7u: { return -(cos(3.14159265 * t) - 1.0) / 2.0; } // ease-in-out-sine
    default: { return t * t * (3.0 - 2.0 * t); }            // ease (smoothstep)
  }
}

@compute @workgroup_size(${WG_SIZE})
fn csTween(@builtin(global_invocation_id) gid: vec3u) {
  if (gid.x >= params.count) { return; }

  let slot = slots[gid.x];
  let ft = fromTo[gid.x];
  let raw = select((params.now - params.start) / params.duration, 1.0, params.duration <= 0.0);
  let e = ease(params.easingId, clamp(raw, 0.0, 1.0));

  positions[slot] = mix(ft.xy, ft.zw, e);
}
`;

interface Batch {
  count: number;
  slotBuffer: GPUBuffer;
  fromToBuffer: GPUBuffer;
  paramsBuffer: GPUBuffer;
  bindGroup: GPUBindGroup | null;
  /** mirror version the bind group was built against (position buffer realloc) */
  bindVersion: number;
  start: number;
  duration: number;
  easingId: number;
}

export class GpuTweenRuntime {
  private device: TweenDevice;
  private positionBuffer: () => GPUBuffer;
  private mirrorVersion: () => number;
  private layout: GPUBindGroupLayout;
  private pipeline: GPUComputePipeline;
  private batches = new Map<number, Batch>();
  private destroyed = false;

  constructor( device: TweenDevice, positionBuffer: () => GPUBuffer, mirrorVersion: () => number ){
    this.device = device;
    this.positionBuffer = positionBuffer;
    this.mirrorVersion = mirrorVersion;

    this.layout = device.createBindGroupLayout( {
      label: 'cy-gpu:tween-layout',
      entries: [
        { binding: 0, visibility: SHADER_STAGE.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: SHADER_STAGE.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: SHADER_STAGE.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: SHADER_STAGE.COMPUTE, buffer: { type: 'storage' } }
      ]
    } );
    this.pipeline = device.createComputePipeline( {
      label: 'cy-gpu:tween',
      layout: device.createPipelineLayout( { bindGroupLayouts: [ this.layout ] } ),
      compute: {
        module: device.createShaderModule( { label: 'cy-gpu:tween-shader', code: TWEEN_SHADER } ),
        entryPoint: 'csTween'
      }
    } );
  }

  active(): boolean { return this.batches.size > 0; }

  /** node.position is GPU-owned while any batch runs (mirror skips its uploads). */
  ownedColumns(): readonly ( 'node.position' )[] {
    return this.batches.size > 0 ? [ 'node.position' ] : [];
  }

  /**
   * Register a position batch: `slots[i]`'s position tweens across
   * `fromTo[i*4..+4]` = (fromX, fromY, toX, toY) over [start, start+duration].
   */
  register( id: number, slots: Uint32Array, fromTo: Float32Array, start: number, duration: number, easingId: number ): void {
    if( this.destroyed || slots.length === 0 ){ return; }

    this.unregister( id );

    const dev = this.device;
    const slotBuffer = dev.createBuffer( {
      label: `cy-gpu:tween-slots:${id}`, size: Math.max( 4, slots.byteLength ),
      usage: BUFFER_USAGE.STORAGE | BUFFER_USAGE.COPY_DST
    } );
    const fromToBuffer = dev.createBuffer( {
      label: `cy-gpu:tween-fromto:${id}`, size: Math.max( 16, fromTo.byteLength ),
      usage: BUFFER_USAGE.STORAGE | BUFFER_USAGE.COPY_DST
    } );
    const paramsBuffer = dev.createBuffer( {
      label: `cy-gpu:tween-params:${id}`, size: TWEEN_PARAMS_BYTES,
      usage: BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST
    } );

    dev.queue.writeBuffer( slotBuffer, 0, slots.buffer, slots.byteOffset, slots.byteLength );
    dev.queue.writeBuffer( fromToBuffer, 0, fromTo.buffer, fromTo.byteOffset, fromTo.byteLength );

    this.batches.set( id, {
      count: slots.length, slotBuffer, fromToBuffer, paramsBuffer,
      bindGroup: null, bindVersion: -1, start, duration, easingId
    } );
  }

  unregister( id: number ): void {
    const b = this.batches.get( id );

    if( b == null ){ return; }

    b.slotBuffer.destroy();
    b.fromToBuffer.destroy();
    b.paramsBuffer.destroy();
    this.batches.delete( id );
  }

  /** Encode every active batch's dispatch for frame time `now` (ms). */
  encode( pass: GPUComputePassEncoder, now: number ): void {
    if( this.destroyed ){ return; }

    const version = this.mirrorVersion();

    for( const b of this.batches.values() ){
      // start/duration/now/count, easingId (see TweenParams)
      const u32 = new Uint32Array( TWEEN_PARAMS_BYTES / 4 );
      const f32 = new Float32Array( u32.buffer );

      f32[ 0 ] = b.start;
      f32[ 1 ] = b.duration;
      f32[ 2 ] = now;
      u32[ 3 ] = b.count;
      u32[ 4 ] = b.easingId;
      this.device.queue.writeBuffer( b.paramsBuffer, 0, u32 );

      if( b.bindGroup == null || b.bindVersion !== version ){
        b.bindGroup = this.device.createBindGroup( {
          label: 'cy-gpu:tween-bind',
          layout: this.layout,
          entries: [
            { binding: 0, resource: { buffer: b.paramsBuffer } },
            { binding: 1, resource: { buffer: b.slotBuffer } },
            { binding: 2, resource: { buffer: b.fromToBuffer } },
            { binding: 3, resource: { buffer: this.positionBuffer() } }
          ]
        } );
        b.bindVersion = version;
      }

      pass.setPipeline( this.pipeline );
      pass.setBindGroup( 0, b.bindGroup );
      pass.dispatchWorkgroups( Math.ceil( b.count / WG_SIZE ) );
    }
  }

  destroy(): void {
    this.destroyed = true;

    for( const id of [ ...this.batches.keys() ] ){ this.unregister( id ); }
  }
}
