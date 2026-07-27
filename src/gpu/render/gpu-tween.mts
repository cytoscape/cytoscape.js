import type { ChannelWrite, WriteKind } from '../animation.mjs';
import type { ColumnId } from '../contract.mjs';
import { OKLAB_TO_SRGB_WGSL } from './mapper-shaders.mjs';
import { BUFFER_USAGE, SHADER_STAGE } from './webgpu-constants.mjs';

/*
GPU tween runtime: evaluates animations on-device so a running animation
costs ~zero per-frame CPU.  Each registered animation uploads its per-slot
from/to data once; every frame a compute pass reads the shared `now` and
writes `column[slot] = mix(from, to, ease(t))` for the animation's slots —
no CPU tween loop, no per-frame column upload.

Because a tween is a pure function of time, the CPU stays the reference:
the AnimationManager owns the queue/timing/completion and, on
settle/stop, re-derives the exact current value on the CPU (no readback).
This runtime is a pure executor — register / unregister / encode — driven
by the renderer's frame clock; the animation's columns are marked GPU-owned
in the mirror while it runs so CPU writes don't clobber them.

Scope: node position (the layout-transition / large-move case) and the
paint channels (opacity, fill/border/line colour, and the arrow colours
that carry edge opacity's pre-folded alpha).  Colours interpolate in OKLab,
pre-converted on the CPU, so the kernel only needs the OKLab→sRGB
direction and both executors mix the identical numbers.  Size and the other
geometry channels stay on the CPU path — they are read by culling, CPU
picking and the columnar scans.

Position and paint dispatch at different points in the frame (see
`encode`): position before the cull pass, whose kernels must see the
tweened coordinates, and paint after the mapper eval pass, so an active
tween wins over a mapper writing the same channel.
*/

const WG_SIZE = 256;
export const TWEEN_PARAMS_BYTES = 16;

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

/*
The params uniform holds only per-batch state, because a batch's channels
share one buffer and `queue.writeBuffer` is ordered against submitted
command buffers, not against dispatches inside one — a per-channel value
written here would collapse to whichever write came last.  The per-channel
count instead comes from `arrayLength(&slots)`.
*/
const TWEEN_COMMON = `
struct TweenParams {
  start: f32,
  duration: f32,
  now: f32,
  easingId: u32,
}

@group(0) @binding(0) var<uniform> params: TweenParams;
@group(0) @binding(1) var<storage, read> slots: array<u32>;

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

/** eased progress, shared by every kind */
fn progress() -> f32 {
  let raw = select((params.now - params.start) / params.duration, 1.0, params.duration <= 0.0);

  return ease(params.easingId, clamp(raw, 0.0, 1.0));
}
`;

const POSITION_SHADER = TWEEN_COMMON + `
@group(0) @binding(2) var<storage, read> fromTo: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> dst: array<vec2f>;

@compute @workgroup_size(${WG_SIZE})
fn csTween(@builtin(global_invocation_id) gid: vec3u) {
  if (gid.x >= arrayLength(&slots)) { return; }

  let ft = fromTo[gid.x];

  dst[slots[gid.x]] = mix(ft.xy, ft.zw, progress());
}
`;

const SCALAR_SHADER = TWEEN_COMMON + `
@group(0) @binding(2) var<storage, read> fromTo: array<vec2f>;
@group(0) @binding(3) var<storage, read_write> dst: array<f32>;

@compute @workgroup_size(${WG_SIZE})
fn csTween(@builtin(global_invocation_id) gid: vec3u) {
  if (gid.x >= arrayLength(&slots)) { return; }

  let ft = fromTo[gid.x];

  dst[slots[gid.x]] = mix(ft.x, ft.y, progress());
}
`;

// two vec4f per slot: (L, a, b, alpha) OKLab endpoints, alpha normalized
const COLOR_SHADER = TWEEN_COMMON + OKLAB_TO_SRGB_WGSL + `
@group(0) @binding(2) var<storage, read> fromTo: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> dst: array<u32>;

@compute @workgroup_size(${WG_SIZE})
fn csTween(@builtin(global_invocation_id) gid: vec3u) {
  if (gid.x >= arrayLength(&slots)) { return; }

  let v = mix(fromTo[gid.x * 2u], fromTo[gid.x * 2u + 1u], progress());

  dst[slots[gid.x]] = pack4x8unorm(vec4f(oklabToSrgbNorm(v.xyz), v.w));
}
`;

export const TWEEN_SHADERS: Record<WriteKind, string> = {
  position: POSITION_SHADER,
  scalar: SCALAR_SHADER,
  color: COLOR_SHADER
};

const KINDS = Object.keys( TWEEN_SHADERS ) as WriteKind[];

/** One column's dispatch within a registered animation. */
interface Channel {
  column: ColumnId;
  kind: WriteKind;
  count: number;
  slotBuffer: GPUBuffer;
  dataBuffer: GPUBuffer;
  bindGroup: GPUBindGroup | null;
  /** mirror version the bind group was built against (column buffer realloc) */
  bindVersion: number;
}

interface Batch {
  channels: Channel[];
  paramsBuffer: GPUBuffer;
  start: number;
  duration: number;
  easingId: number;
}

export class GpuTweenRuntime {
  private device: TweenDevice;
  private columnBuffer: ( id: ColumnId ) => GPUBuffer;
  private mirrorVersion: () => number;
  private layout: GPUBindGroupLayout;
  private pipelines: Record<WriteKind, GPUComputePipeline>;
  private batches = new Map<number, Batch>();
  private destroyed = false;

  constructor( device: TweenDevice, columnBuffer: ( id: ColumnId ) => GPUBuffer, mirrorVersion: () => number ){
    this.device = device;
    this.columnBuffer = columnBuffer;
    this.mirrorVersion = mirrorVersion;

    // one layout for all three kinds: only the WGSL types of bindings 2/3
    // differ, not their binding kinds
    this.layout = device.createBindGroupLayout( {
      label: 'cy-gpu:tween-layout',
      entries: [
        { binding: 0, visibility: SHADER_STAGE.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: SHADER_STAGE.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: SHADER_STAGE.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: SHADER_STAGE.COMPUTE, buffer: { type: 'storage' } }
      ]
    } );

    const pipelineLayout = device.createPipelineLayout( { bindGroupLayouts: [ this.layout ] } );

    this.pipelines = Object.fromEntries( KINDS.map( kind => [ kind, device.createComputePipeline( {
      label: `cy-gpu:tween-${kind}`,
      layout: pipelineLayout,
      compute: {
        module: device.createShaderModule( {
          label: `cy-gpu:tween-${kind}-shader`, code: TWEEN_SHADERS[ kind ] } ),
        entryPoint: 'csTween'
      }
    } ) ] ) ) as Record<WriteKind, GPUComputePipeline>;
  }

  active(): boolean { return this.batches.size > 0; }

  /** True when some batch tweens node position (needs the pre-cull pass). */
  hasPositions(): boolean {
    for( const b of this.batches.values() ){
      if( b.channels.some( c => c.kind === 'position' ) ){ return true; }
    }

    return false;
  }

  /**
   * Columns the runtime owns while its animations run: the mirror skips
   * their span uploads so CPU-side writes never clobber tweened bytes.
   */
  ownedColumns(): ColumnId[] {
    const owned = new Set<ColumnId>();

    for( const b of this.batches.values() ){
      for( const c of b.channels ){ owned.add( c.column ); }
    }

    return [ ...owned ];
  }

  /**
   * Register an animation: each write's `slots[i]` tweens across its
   * `data` endpoints over [start, start + duration].
   */
  register( id: number, writes: readonly ChannelWrite[], start: number, duration: number, easingId: number ): void {
    if( this.destroyed ){ return; }

    this.unregister( id );

    const dev = this.device;
    const channels: Channel[] = [];

    for( const w of writes ){
      if( w.slots.length === 0 ){ continue; }

      const slotBuffer = dev.createBuffer( {
        label: `cy-gpu:tween-slots:${id}:${w.column}`, size: Math.max( 4, w.slots.byteLength ),
        usage: BUFFER_USAGE.STORAGE | BUFFER_USAGE.COPY_DST
      } );
      const dataBuffer = dev.createBuffer( {
        label: `cy-gpu:tween-data:${id}:${w.column}`, size: Math.max( 16, w.data.byteLength ),
        usage: BUFFER_USAGE.STORAGE | BUFFER_USAGE.COPY_DST
      } );

      dev.queue.writeBuffer( slotBuffer, 0, w.slots.buffer, w.slots.byteOffset, w.slots.byteLength );
      dev.queue.writeBuffer( dataBuffer, 0, w.data.buffer, w.data.byteOffset, w.data.byteLength );

      channels.push( {
        column: w.column, kind: w.kind, count: w.slots.length,
        slotBuffer, dataBuffer, bindGroup: null, bindVersion: -1
      } );
    }

    if( channels.length === 0 ){ return; }

    this.batches.set( id, {
      channels,
      paramsBuffer: dev.createBuffer( {
        label: `cy-gpu:tween-params:${id}`, size: TWEEN_PARAMS_BYTES,
        usage: BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST
      } ),
      start, duration, easingId
    } );
  }

  unregister( id: number ): void {
    const b = this.batches.get( id );

    if( b == null ){ return; }

    for( const c of b.channels ){
      c.slotBuffer.destroy();
      c.dataBuffer.destroy();
    }

    b.paramsBuffer.destroy();
    this.batches.delete( id );
  }

  /**
   * Encode every active batch's dispatches for frame time `now` (ms),
   * restricted to one tier: `'position'` in the pre-cull pass (the cull
   * kernels and edge shaders must read the tweened coordinates) and
   * `'paint'` in the cull pass after the mapper eval, so a tween outranks a
   * mapper writing the same channel.
   */
  encode( pass: GPUComputePassEncoder, now: number, tier: 'position' | 'paint' ): void {
    if( this.destroyed ){ return; }

    const version = this.mirrorVersion();
    const params = new Uint32Array( TWEEN_PARAMS_BYTES / 4 );
    const f32 = new Float32Array( params.buffer );

    for( const b of this.batches.values() ){
      const channels = b.channels.filter( c => ( c.kind === 'position' ) === ( tier === 'position' ) );

      if( channels.length === 0 ){ continue; }

      // start/duration/now, easingId (see TweenParams) — per batch, so one
      // write covers every channel dispatched below
      f32[ 0 ] = b.start;
      f32[ 1 ] = b.duration;
      f32[ 2 ] = now;
      params[ 3 ] = b.easingId;
      this.device.queue.writeBuffer( b.paramsBuffer, 0, params );

      for( const c of channels ){
        if( c.bindGroup == null || c.bindVersion !== version ){
          c.bindGroup = this.device.createBindGroup( {
            label: `cy-gpu:tween-bind:${c.column}`,
            layout: this.layout,
            entries: [
              { binding: 0, resource: { buffer: b.paramsBuffer } },
              { binding: 1, resource: { buffer: c.slotBuffer } },
              { binding: 2, resource: { buffer: c.dataBuffer } },
              { binding: 3, resource: { buffer: this.columnBuffer( c.column ) } }
            ]
          } );
          c.bindVersion = version;
        }

        pass.setPipeline( this.pipelines[ c.kind ] );
        pass.setBindGroup( 0, c.bindGroup );
        pass.dispatchWorkgroups( Math.ceil( c.count / WG_SIZE ) );
      }
    }
  }

  destroy(): void {
    this.destroyed = true;

    for( const id of [ ...this.batches.keys() ] ){ this.unregister( id ); }
  }
}
