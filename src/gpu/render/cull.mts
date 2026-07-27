import { COMMON, GLYPH_STRUCT } from './shaders.mjs';
import { BUFFER_USAGE, SHADER_STAGE } from './webgpu-constants.mjs';

/*
GPU culling: per group (nodes, edges, glyphs) a compute pre-pass compacts
the drawable slots into a `visible` list and writes drawIndexedIndirect
args, so the render pipelines draw exactly the visible instances instead
of running the vertex shader over every slot ever allocated.

Compaction is a deterministic three-dispatch stream compaction — count
survivors per 256-slot workgroup, serially prefix-scan the workgroup
counts (also producing instanceCount), then scatter with a workgroup-local
Hillis-Steele scan — rather than a single atomic-append pass, because
atomic append would randomize draw order within a group every frame and
overlapping translucent elements would shimmer.  Slot order (the
documented z-order within a group) is preserved exactly.

The predicates share the LOD WGSL (nodeLod/edgeLod/labelFade) with the
vertex shaders, so membership and alpha compensation can't drift apart.
Edges get an exact segment-vs-rect (Liang-Barsky) test here — affordable
once per instance in compute — replacing the old conservative
same-side-endpoints test that kept long near-miss edges.

The pick pass reuses the same kernels with the pick-tile Frame uniform
into separate lists, which turns viewport culling into cursor-region
culling: pick draws stay O(region).
*/

const WG_SIZE = 256;

export type CullKind = 'node' | 'edge' | 'glyph';

/** ordered storage-buffer inputs per kind (bindings 2..N-4 of the cull layout) */
const INPUT_COUNTS: Record<CullKind, number> = { node: 3, edge: 5, glyph: 3 };

const SCAFFOLD = `
struct CullInfo { count: u32 }

var<workgroup> wgLocal: atomic<u32>;
var<workgroup> scanBuf: array<u32, ${WG_SIZE}>;

@compute @workgroup_size(${WG_SIZE})
fn csCount(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32,
  @builtin(workgroup_id) wg: vec3u
) {
  if (lid == 0u) { atomicStore(&wgLocal, 0u); }
  workgroupBarrier();

  if (gid.x < info.count && isVisible(gid.x)) { atomicAdd(&wgLocal, 1u); }
  workgroupBarrier();

  if (lid == 0u) { wgCounts[wg.x] = atomicLoad(&wgLocal); }
}

@compute @workgroup_size(${WG_SIZE})
fn csScatter(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lid: u32,
  @builtin(workgroup_id) wg: vec3u
) {
  var p = 0u;

  if (gid.x < info.count && isVisible(gid.x)) { p = 1u; }

  scanBuf[lid] = p;
  workgroupBarrier();

  // workgroup-local inclusive scan (Hillis-Steele), uniform control flow
  var offset = 1u;

  while (offset < ${WG_SIZE}u) {
    var v = 0u;

    if (lid >= offset) { v = scanBuf[lid - offset]; }

    workgroupBarrier();
    scanBuf[lid] = scanBuf[lid] + v;
    workgroupBarrier();

    offset = offset << 1u;
  }

  if (p == 1u) {
    visible[wgOffsets[wg.x] + scanBuf[lid] - 1u] = gid.x;
  }
}
`;

const NODE_CULL = `
${COMMON}
@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var<uniform> info: CullInfo;
@group(0) @binding(2) var<storage, read> positions: array<vec2f>;
@group(0) @binding(3) var<storage, read> sizes: array<vec2f>;
@group(0) @binding(4) var<storage, read> nodeFlags: array<u32>;
@group(0) @binding(5) var<storage, read_write> wgCounts: array<u32>;
@group(0) @binding(6) var<storage, read_write> wgOffsets: array<u32>;
@group(0) @binding(7) var<storage, read_write> visible: array<u32>;

fn isVisible(slot: u32) -> bool {
  if ((nodeFlags[slot] & SHOWN) != SHOWN) { return false; }

  let lod = nodeLod(sizes[slot] * 0.5 * frame.zoomDpr, frame.hidePx);
  let c = modelToPx(frame, positions[slot]);
  let ext = lod.xy + vec2f(2.0); // AA + accent-ring slack, matches the VS

  return !(c.x + ext.x < 0.0 || c.x - ext.x > frame.viewportPx.x ||
           c.y + ext.y < 0.0 || c.y - ext.y > frame.viewportPx.y);
}
${SCAFFOLD}
`;

const EDGE_CULL = `
${COMMON}
@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var<uniform> info: CullInfo;
@group(0) @binding(2) var<storage, read> endpoints: array<vec2u>;
@group(0) @binding(3) var<storage, read> widths: array<f32>;
@group(0) @binding(4) var<storage, read> edgeFlags: array<u32>;
@group(0) @binding(5) var<storage, read> nodePositions: array<vec2f>;
@group(0) @binding(6) var<storage, read> nodeFlags: array<u32>;
@group(0) @binding(7) var<storage, read_write> wgCounts: array<u32>;
@group(0) @binding(8) var<storage, read_write> wgOffsets: array<u32>;
@group(0) @binding(9) var<storage, read_write> visible: array<u32>;

// exact segment-vs-rect (Liang-Barsky) against the viewport grown by m
fn segmentHitsViewport(a: vec2f, b: vec2f, m: f32) -> bool {
  let lo = vec2f(-m, -m);
  let hi = frame.viewportPx + vec2f(m, m);
  let d = b - a;
  var t0 = 0.0;
  var t1 = 1.0;

  for (var axis = 0u; axis < 2u; axis = axis + 1u) {
    let da = select(d.y, d.x, axis == 0u);
    let aa = select(a.y, a.x, axis == 0u);
    let loA = select(lo.y, lo.x, axis == 0u);
    let hiA = select(hi.y, hi.x, axis == 0u);

    if (abs(da) < 1e-6) {
      if (aa < loA || aa > hiA) { return false; }
    } else {
      var tNear = (loA - aa) / da;
      var tFar = (hiA - aa) / da;

      if (tNear > tFar) { let t = tNear; tNear = tFar; tFar = t; }

      t0 = max(t0, tNear);
      t1 = min(t1, tFar);

      if (t0 > t1) { return false; }
    }
  }

  return true;
}

fn isVisible(slot: u32) -> bool {
  if ((edgeFlags[slot] & SHOWN) != SHOWN) { return false; }

  let ends = endpoints[slot];

  if ((nodeFlags[ends.x] & SHOWN) != SHOWN || (nodeFlags[ends.y] & SHOWN) != SHOWN) { return false; }

  let widthPx = widths[slot] * frame.zoomDpr;
  let lod = edgeLod(slot, widthPx, frame.edgeWidthFloor);

  if (lod.x == 0.0) { return false; } // decimated hairline

  let a = modelToPx(frame, nodePositions[ends.x]);
  let b = modelToPx(frame, nodePositions[ends.y]);

  if (length(b - a) < 1e-4) { return false; } // degenerate (loop at one point)

  let m = max(widthPx, frame.edgeWidthFloor) * 0.5 + 1.0; // half width + AA
  return segmentHitsViewport(a, b, m);
}
${SCAFFOLD}
`;

const GLYPH_CULL = `
${COMMON}
${GLYPH_STRUCT}
@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var<uniform> info: CullInfo;
@group(0) @binding(2) var<storage, read> glyphs: array<Glyph>;
@group(0) @binding(3) var<storage, read> nodePositions: array<vec2f>;
@group(0) @binding(4) var<storage, read> nodeFlags: array<u32>;
@group(0) @binding(5) var<storage, read_write> wgCounts: array<u32>;
@group(0) @binding(6) var<storage, read_write> wgOffsets: array<u32>;
@group(0) @binding(7) var<storage, read_write> visible: array<u32>;

fn isVisible(slot: u32) -> bool {
  let g = glyphs[slot];

  if (g.nodeSlot == DEAD_GLYPH) { return false; }
  if ((nodeFlags[g.nodeSlot] & SHOWN) != SHOWN) { return false; }

  let heightPx = glyphLodHeight(g) * frame.zoomDpr;

  // hard minimum: below this the text is too small to read, don't draw it
  if (heightPx < frame.labelMinPx) { return false; }

  if (labelFade(heightPx, frame.labelFadePx) <= 0.001) { return false; }

  let originPx = modelToPx(frame, nodePositions[g.nodeSlot]) + g.offset * frame.zoomDpr;
  let sizePx = g.size * frame.zoomDpr;

  return !(originPx.x + sizePx.x < 0.0 || originPx.x > frame.viewportPx.x ||
           originPx.y + sizePx.y < 0.0 || originPx.y > frame.viewportPx.y);
}
${SCAFFOLD}
`;

const SCAN = `
struct CullInfo { count: u32 }

@group(0) @binding(0) var<uniform> info: CullInfo;
@group(0) @binding(1) var<storage, read> wgCounts: array<u32>;
@group(0) @binding(2) var<storage, read_write> wgOffsets: array<u32>;
@group(0) @binding(3) var<storage, read_write> drawArgs: array<u32, 5>;

// serial exclusive scan over the per-workgroup counts; numWg is a few
// thousand at most (capacity / ${WG_SIZE}), microseconds on any GPU
@compute @workgroup_size(1)
fn csScan() {
  let numWg = (info.count + ${WG_SIZE - 1}u) / ${WG_SIZE}u;
  var sum = 0u;

  for (var i = 0u; i < numWg; i = i + 1u) {
    wgOffsets[i] = sum;
    sum = sum + wgCounts[i];
  }

  drawArgs[0] = 6u;  // indexCount: the shared instance quad
  drawArgs[1] = sum; // instanceCount: visible survivors
  drawArgs[2] = 0u;
  drawArgs[3] = 0u;
  drawArgs[4] = 0u;
}
`;

const CULL_SHADERS: Record<CullKind, string> = {
  node: NODE_CULL,
  edge: EDGE_CULL,
  glyph: GLYPH_CULL
};

/** Compiled cull pipelines + the group(1) visible-list layout shared with
 * the render pipelines.  One instance per device. */
export class CullKernels {
  device: GPUDevice;
  /** bind group layout for the render pipelines' @group(1) visible list */
  visibleLayout: GPUBindGroupLayout;
  cullLayouts: Record<CullKind, GPUBindGroupLayout>;
  countPipelines: Record<CullKind, GPUComputePipeline>;
  scatterPipelines: Record<CullKind, GPUComputePipeline>;
  scanLayout: GPUBindGroupLayout;
  scanPipeline: GPUComputePipeline;

  constructor( device: GPUDevice ){
    this.device = device;

    this.visibleLayout = device.createBindGroupLayout( {
      label: 'cy-gpu:visible-layout',
      entries: [ {
        binding: 0,
        visibility: SHADER_STAGE.VERTEX,
        buffer: { type: 'read-only-storage' }
      } ]
    } );

    const storage = ( binding: number, type: GPUBufferBindingType ): GPUBindGroupLayoutEntry => ( {
      binding,
      visibility: SHADER_STAGE.COMPUTE,
      buffer: { type }
    } );

    this.cullLayouts = {} as Record<CullKind, GPUBindGroupLayout>;
    this.countPipelines = {} as Record<CullKind, GPUComputePipeline>;
    this.scatterPipelines = {} as Record<CullKind, GPUComputePipeline>;

    for( const kind of [ 'node', 'edge', 'glyph' ] as CullKind[] ){
      const inputs = INPUT_COUNTS[ kind ];
      const layout = device.createBindGroupLayout( {
        label: `cy-gpu:${kind}-cull-layout`,
        entries: [
          { binding: 0, visibility: SHADER_STAGE.COMPUTE, buffer: { type: 'uniform' } },
          { binding: 1, visibility: SHADER_STAGE.COMPUTE, buffer: { type: 'uniform' } },
          ...Array.from( { length: inputs }, ( _, i ) => storage( 2 + i, 'read-only-storage' ) ),
          storage( 2 + inputs, 'storage' ),     // wgCounts
          storage( 3 + inputs, 'storage' ),     // wgOffsets
          storage( 4 + inputs, 'storage' )      // visible
        ]
      } );
      const module = device.createShaderModule( {
        label: `cy-gpu:${kind}-cull-shader`,
        code: CULL_SHADERS[ kind ]
      } );
      const pipelineLayout = device.createPipelineLayout( { bindGroupLayouts: [ layout ] } );

      this.cullLayouts[ kind ] = layout;
      this.countPipelines[ kind ] = device.createComputePipeline( {
        label: `cy-gpu:${kind}-cull-count`,
        layout: pipelineLayout,
        compute: { module, entryPoint: 'csCount' }
      } );
      this.scatterPipelines[ kind ] = device.createComputePipeline( {
        label: `cy-gpu:${kind}-cull-scatter`,
        layout: pipelineLayout,
        compute: { module, entryPoint: 'csScatter' }
      } );
    }

    this.scanLayout = device.createBindGroupLayout( {
      label: 'cy-gpu:cull-scan-layout',
      entries: [
        { binding: 0, visibility: SHADER_STAGE.COMPUTE, buffer: { type: 'uniform' } },
        storage( 1, 'read-only-storage' ),
        storage( 2, 'storage' ),
        storage( 3, 'storage' )
      ]
    } );
    this.scanPipeline = device.createComputePipeline( {
      label: 'cy-gpu:cull-scan',
      layout: device.createPipelineLayout( { bindGroupLayouts: [ this.scanLayout ] } ),
      compute: { module: device.createShaderModule( { label: 'cy-gpu:cull-scan-shader', code: SCAN } ), entryPoint: 'csScan' }
    } );
  }
}

/**
 * One culled instance stream: the visible list + indirect args for a
 * (group kind, Frame uniform) pair.  The scene and the pick pass each own
 * their instances (different uniforms, different lists).
 */
export class CulledGroup {
  /** drawIndexedIndirect args, written by the scan dispatch */
  indirect: GPUBuffer;

  private kernels: CullKernels;
  private kind: CullKind;
  private label: string;
  private meta: GPUBuffer;
  private lastCount: number;
  private capacity: number;
  private visible: GPUBuffer | null;
  private wgCounts: GPUBuffer | null;
  private wgOffsets: GPUBuffer | null;
  private cullBind: GPUBindGroup | null;
  private scanBind: GPUBindGroup | null;
  private visibleBind: GPUBindGroup | null;
  private bindKey: string;
  private destroyed: boolean;

  constructor( kernels: CullKernels, kind: CullKind, label: string ){
    this.kernels = kernels;
    this.kind = kind;
    this.label = label;
    this.lastCount = -1;
    this.capacity = 0;
    this.visible = null;
    this.wgCounts = null;
    this.wgOffsets = null;
    this.cullBind = null;
    this.scanBind = null;
    this.visibleBind = null;
    this.bindKey = '';
    this.destroyed = false;

    const device = kernels.device;

    this.meta = device.createBuffer( {
      label: `cy-gpu:${label}-cull-meta`,
      size: 4,
      usage: BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST
    } );
    this.indirect = device.createBuffer( {
      label: `cy-gpu:${label}-indirect`,
      size: 20,
      usage: BUFFER_USAGE.STORAGE | BUFFER_USAGE.INDIRECT
    } );
  }

  /** The render pipelines' @group(1) bind group (the visible list). */
  visibleBindGroup(): GPUBindGroup {
    return this.visibleBind as GPUBindGroup;
  }

  /**
   * (Re)build buffers and bind groups as capacity grows or input buffers
   * are reallocated.  `inputs` must match the kind's binding order;
   * `inputsKey` must change whenever any input buffer identity changes
   * (mirror/glyph version).
   */
  ensure( uniform: GPUBuffer, capacity: number, inputs: GPUBuffer[], inputsKey: string ): void {
    const device = this.kernels.device;

    if( capacity > this.capacity ){
      const old = [ this.visible, this.wgCounts, this.wgOffsets ];
      const numWg = Math.ceil( capacity / WG_SIZE );

      this.capacity = capacity;
      this.visible = device.createBuffer( {
        label: `cy-gpu:${this.label}-visible`,
        size: capacity * 4,
        usage: BUFFER_USAGE.STORAGE
      } );
      this.wgCounts = device.createBuffer( {
        label: `cy-gpu:${this.label}-wg-counts`,
        size: numWg * 4,
        usage: BUFFER_USAGE.STORAGE
      } );
      this.wgOffsets = device.createBuffer( {
        label: `cy-gpu:${this.label}-wg-offsets`,
        size: numWg * 4,
        usage: BUFFER_USAGE.STORAGE
      } );

      // the old buffers may still be referenced by in-flight work
      void device.queue.onSubmittedWorkDone().then( () => {
        for( const buffer of old ){ buffer?.destroy(); }
      } );
    }

    const key = `${inputsKey}|${this.capacity}`;

    if( key === this.bindKey && this.cullBind != null ){ return; }

    this.bindKey = key;

    const wgCounts = this.wgCounts as GPUBuffer;
    const visible = this.visible as GPUBuffer;
    const inputCount = INPUT_COUNTS[ this.kind ];

    this.cullBind = device.createBindGroup( {
      label: `cy-gpu:${this.label}-cull-bind`,
      layout: this.kernels.cullLayouts[ this.kind ],
      entries: [
        { binding: 0, resource: { buffer: uniform } },
        { binding: 1, resource: { buffer: this.meta } },
        ...inputs.map( ( buffer, i ) => ( { binding: 2 + i, resource: { buffer } } ) ),
        { binding: 2 + inputCount, resource: { buffer: wgCounts } },
        { binding: 3 + inputCount, resource: { buffer: this.wgOffsets as GPUBuffer } },
        { binding: 4 + inputCount, resource: { buffer: visible } }
      ]
    } );
    this.scanBind = device.createBindGroup( {
      label: `cy-gpu:${this.label}-scan-bind`,
      layout: this.kernels.scanLayout,
      entries: [
        { binding: 0, resource: { buffer: this.meta } },
        { binding: 1, resource: { buffer: wgCounts } },
        { binding: 2, resource: { buffer: this.wgOffsets as GPUBuffer } },
        { binding: 3, resource: { buffer: this.indirect } }
      ]
    } );
    this.visibleBind = device.createBindGroup( {
      label: `cy-gpu:${this.label}-visible-bind`,
      layout: this.kernels.visibleLayout,
      entries: [ { binding: 0, resource: { buffer: visible } } ]
    } );
  }

  /** Encode the three compaction dispatches.  No-op when highWater is 0
   * (the caller skips the draw as well). */
  encode( pass: GPUComputePassEncoder, highWater: number ): void {
    if( highWater === 0 || this.cullBind == null ){ return; }

    if( this.lastCount !== highWater ){
      this.lastCount = highWater;
      this.kernels.device.queue.writeBuffer( this.meta, 0, Uint32Array.of( highWater ) );
    }

    const numWg = Math.ceil( highWater / WG_SIZE );
    const kind = this.kind;

    pass.setPipeline( this.kernels.countPipelines[ kind ] );
    pass.setBindGroup( 0, this.cullBind );
    pass.dispatchWorkgroups( numWg );

    pass.setPipeline( this.kernels.scanPipeline );
    pass.setBindGroup( 0, this.scanBind );
    pass.dispatchWorkgroups( 1 );

    pass.setPipeline( this.kernels.scatterPipelines[ kind ] );
    pass.setBindGroup( 0, this.cullBind );
    pass.dispatchWorkgroups( numWg );
  }

  destroy(): void {
    if( this.destroyed ){ return; }

    this.destroyed = true;
    this.meta.destroy();
    this.indirect.destroy();
    this.visible?.destroy();
    this.wgCounts?.destroy();
    this.wgOffsets?.destroy();
  }
}
