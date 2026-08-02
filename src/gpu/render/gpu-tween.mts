import type { ChannelWrite, WriteKind } from '../animation.mjs';
import type { ColumnId } from '../contract.mjs';
import { EASING_KIND } from '../easing.mjs';
import type { EasingProgram } from '../easing.mjs';
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
export const TWEEN_PARAMS_BYTES = 48;

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
  kind: u32,      // EASING_KIND in easing.mts
  bez: vec4f,     // cubic-bezier control points x1, y1, x2, y2
  pointCount: u32,
}

@group(0) @binding(0) var<uniform> params: TweenParams;
@group(0) @binding(1) var<storage, read> slots: array<u32>;
// (x, y) progression pairs for the points kind; a 1-pair dummy otherwise
@group(0) @binding(4) var<storage, read> easingPoints: array<vec2f>;

/*
The easing evaluators mirror easing.mts step for step: the cubic-bezier
solve is the same 11-sample bracket plus Newton refinement (falling back to
binary subdivision on a near-flat bracket), and the points lookup is the
same binary search and lerp.  They agree to float precision rather than
bit-exactly, which is invisible mid-flight and moot at the ends: t=0 and
t=1 are exact on both sides, and a settle re-derives on the CPU.

Springs are not a case here — they compile to a progression array on the
CPU, so the device only ever sees points.
*/
const SPLINE_SIZE = 11u;
const SPLINE_STEP = 0.1;         // 1 / (SPLINE_SIZE - 1)
const NEWTON_MIN_SLOPE = 0.001;
const SUBDIVISION_PRECISION = 0.0000001;

fn bezA(a1: f32, a2: f32) -> f32 { return 1.0 - 3.0 * a2 + 3.0 * a1; }
fn bezB(a1: f32, a2: f32) -> f32 { return 3.0 * a2 - 6.0 * a1; }
fn bezC(a1: f32) -> f32 { return 3.0 * a1; }

fn calcBezier(t: f32, a1: f32, a2: f32) -> f32 {
  return ((bezA(a1, a2) * t + bezB(a1, a2)) * t + bezC(a1)) * t;
}

fn bezSlope(t: f32, a1: f32, a2: f32) -> f32 {
  return 3.0 * bezA(a1, a2) * t * t + 2.0 * bezB(a1, a2) * t + bezC(a1);
}

fn newtonRefine(x: f32, guess: f32, x1: f32, x2: f32) -> f32 {
  var t = guess;

  for (var i = 0u; i < 4u; i = i + 1u) {
    let slope = bezSlope(t, x1, x2);

    if (slope == 0.0) { return t; }

    t = t - (calcBezier(t, x1, x2) - x) / slope;
  }

  return t;
}

fn subdivide(x: f32, lo: f32, hi: f32, x1: f32, x2: f32) -> f32 {
  var a = lo;
  var b = hi;
  var t = lo;

  for (var i = 0u; i < 10u; i = i + 1u) {
    t = a + (b - a) / 2.0;

    let err = calcBezier(t, x1, x2) - x;

    if (err > 0.0) { b = t; } else { a = t; }

    if (abs(err) <= SUBDIVISION_PRECISION) { break; }
  }

  return t;
}

fn bezierAt(x: f32) -> f32 {
  let x1 = params.bez.x;
  let x2 = params.bez.z;

  var table: array<f32, 11>;

  for (var i = 0u; i < SPLINE_SIZE; i = i + 1u) {
    table[i] = calcBezier(f32(i) * SPLINE_STEP, x1, x2);
  }

  var start = 0.0;
  var i = 1u;

  loop {
    if (i == SPLINE_SIZE - 1u || table[i] > x) { break; }
    start = start + SPLINE_STEP;
    i = i + 1u;
  }

  i = i - 1u;

  let dist = (x - table[i]) / (table[i + 1u] - table[i]);
  let guess = start + dist * SPLINE_STEP;
  let slope = bezSlope(guess, x1, x2);
  var t: f32;

  if (slope >= NEWTON_MIN_SLOPE) {
    t = newtonRefine(x, guess, x1, x2);
  } else if (slope == 0.0) {
    t = guess;
  } else {
    t = subdivide(x, start, start + SPLINE_STEP, x1, x2);
  }

  return calcBezier(t, params.bez.y, params.bez.w);
}

fn pointsAt(x: f32) -> f32 {
  let last = params.pointCount - 1u;

  if (x <= easingPoints[0u].x) { return easingPoints[0u].y; }
  if (x >= easingPoints[last].x) { return easingPoints[last].y; }

  var lo = 0u;
  var hi = last;

  loop {
    if (hi - lo <= 1u) { break; }

    let mid = (lo + hi) / 2u;

    if (easingPoints[mid].x <= x) { lo = mid; } else { hi = mid; }
  }

  let a = easingPoints[lo];
  let b = easingPoints[hi];

  if (b.x == a.x) { return b.y; }

  return a.y + (b.y - a.y) * ((x - a.x) / (b.x - a.x));
}

fn ease(t: f32) -> f32 {
  switch params.kind {
    case ${EASING_KIND.linear}u: { return t; }
    case ${EASING_KIND.points}u: { return pointsAt(t); }   // linear() / spring()
    default: { return bezierAt(t); }                       // the enum + cubic-bezier()
  }
}

/** eased progress, shared by every kind */
fn progress() -> f32 {
  let raw = select((params.now - params.start) / params.duration, 1.0, params.duration <= 0.0);

  return ease(clamp(raw, 0.0, 1.0));
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

/*
Opacity is the only scalar channel that offloads (the rest are geometry, so
they stay on the CPU path), hence the fixed [0, 1] clamp — a bouncy easing
overshoots its endpoints and the renderer should never see an opacity of
1.04.  A wider scalar tier (size, with the R8.5 geometry seam) has to carry
per-channel bounds in the per-slot data, *not* in the shared params buffer,
for the same reason the dispatch count doesn't live there.
*/
const SCALAR_SHADER = TWEEN_COMMON + `
@group(0) @binding(2) var<storage, read> fromTo: array<vec2f>;
@group(0) @binding(3) var<storage, read_write> dst: array<f32>;

@compute @workgroup_size(${WG_SIZE})
fn csTween(@builtin(global_invocation_id) gid: vec3u) {
  if (gid.x >= arrayLength(&slots)) { return; }

  let ft = fromTo[gid.x];

  dst[slots[gid.x]] = clamp(mix(ft.x, ft.y, progress()), 0.0, 1.0);
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

/** The kinds the kernels evaluate.  The round-25 geometry kinds
 * (`lane`, `padding`, `fontSize`) never reach the device
 * (`gpuEligible` is false for any animation carrying one), so they
 * have no shaders. */
export type GpuWriteKind = Exclude<WriteKind, 'lane' | 'padding' | 'fontSize'>;

export const TWEEN_SHADERS: Record<GpuWriteKind, string> = {
  position: POSITION_SHADER,
  scalar: SCALAR_SHADER,
  color: COLOR_SHADER
};

const KINDS = Object.keys( TWEEN_SHADERS ) as GpuWriteKind[];

/** One column's dispatch within a registered animation. */
interface Channel {
  column: ColumnId;
  kind: GpuWriteKind;
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
  /** the easing's progression array, or the shared dummy for other kinds */
  pointsBuffer: GPUBuffer;
  /** true when pointsBuffer is this batch's own (the dummy is shared) */
  ownsPoints: boolean;
  start: number;
  duration: number;
  easing: EasingProgram;
}

export class GpuTweenRuntime {
  private device: TweenDevice;
  private columnBuffer: ( id: ColumnId ) => GPUBuffer;
  private mirrorVersion: () => number;
  private layout: GPUBindGroupLayout;
  private pipelines: Record<GpuWriteKind, GPUComputePipeline>;
  private batches = new Map<number, Batch>();
  /** stands in at binding 4 for easings that need no progression array */
  private dummyPoints: GPUBuffer;
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
        { binding: 3, visibility: SHADER_STAGE.COMPUTE, buffer: { type: 'storage' } },
        { binding: 4, visibility: SHADER_STAGE.COMPUTE, buffer: { type: 'read-only-storage' } }
      ]
    } );

    this.dummyPoints = device.createBuffer( {
      label: 'cy-gpu:tween-points-none', size: 8,
      usage: BUFFER_USAGE.STORAGE | BUFFER_USAGE.COPY_DST
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
    } ) ] ) ) as Record<GpuWriteKind, GPUComputePipeline>;
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
  register(
    id: number, writes: readonly ChannelWrite[],
    start: number, duration: number, easing: EasingProgram
  ): void {
    if( this.destroyed ){ return; }

    this.unregister( id );

    const dev = this.device;
    const channels: Channel[] = [];

    for( const w of writes ){
      if( w.slots.length === 0 ){ continue; }

      if( w.kind === 'lane' || w.kind === 'padding' || w.kind === 'fontSize' ){
        // unreachable by the eligibility rule (a geometry write bars the
        // whole animation from the device); guard the invariant anyway
        throw new Error( `${w.kind} writes never register on the GPU (column ${w.column})` );
      }

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
        column: w.column as ColumnId, kind: w.kind, count: w.slots.length,
        slotBuffer, dataBuffer, bindGroup: null, bindVersion: -1
      } );
    }

    if( channels.length === 0 ){ return; }

    const points = easing.points;
    let pointsBuffer = this.dummyPoints;

    if( points != null ){
      pointsBuffer = dev.createBuffer( {
        label: `cy-gpu:tween-points:${id}`, size: points.byteLength,
        usage: BUFFER_USAGE.STORAGE | BUFFER_USAGE.COPY_DST
      } );

      dev.queue.writeBuffer( pointsBuffer, 0, points.buffer, points.byteOffset, points.byteLength );
    }

    this.batches.set( id, {
      channels,
      paramsBuffer: dev.createBuffer( {
        label: `cy-gpu:tween-params:${id}`, size: TWEEN_PARAMS_BYTES,
        usage: BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST
      } ),
      pointsBuffer, ownsPoints: points != null,
      start, duration, easing
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

    if( b.ownsPoints ){ b.pointsBuffer.destroy(); }

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

      // the whole curve plus the clock (see TweenParams) — per batch, so one
      // write covers every channel dispatched below
      const bez = b.easing.bezier;

      f32[ 0 ] = b.start;
      f32[ 1 ] = b.duration;
      f32[ 2 ] = now;
      params[ 3 ] = b.easing.kind;
      f32[ 4 ] = bez == null ? 0 : bez[ 0 ];   // bez is vec4f, so 16-byte aligned
      f32[ 5 ] = bez == null ? 0 : bez[ 1 ];
      f32[ 6 ] = bez == null ? 0 : bez[ 2 ];
      f32[ 7 ] = bez == null ? 0 : bez[ 3 ];
      params[ 8 ] = b.easing.points == null ? 0 : b.easing.points.length / 2;
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
              { binding: 3, resource: { buffer: this.columnBuffer( c.column ) } },
              { binding: 4, resource: { buffer: b.pointsBuffer } }
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

    this.dummyPoints.destroy();
  }
}
