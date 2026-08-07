import { srgbToOklab } from '../style-schemes.mjs';
import {
  NODE_EVAL_SHADER,
  EDGE_EVAL_SHADER,
  TARGET_BINDINGS,
  MAX_PROGRAMS,
} from './mapper-shaders.mjs';
import { BUFFER_USAGE, SHADER_STAGE } from './webgpu-constants.mjs';
import type { GroupName, ColumnId } from '../contract.mjs';
import type { DataStore } from '../store/data-store.mjs';
import type {
  CompiledMapper,
  Evaluated,
  Program,
  Transform,
  RGBA,
} from '../style-scales.mjs';

/*
CPU-side packing for the GPU mapper eval pass: lowers compiled paint-
channel mapper programs (style-scales.mts) into the buffers the eval
kernel consumes.  Pure functions over typed arrays — no device — so the
byte layout is Node-testable; the kernel wiring lives in the renderer.

Layout (all little-endian, WGSL-uniform compatible):

MapperProgram — 16 words / 64 B per program:
  words  0..3   meta   (u32): target channel, scale kind, flags, dataBase
  words  4..7   domain (f32): lo, hi, p0, p1 — untransformed domain
                endpoints (clamping happens pre-transform); p0 = pow
                exponent | log base, p1 = symlog constant
  words  8..11  table  (u32): outBase, count, inBase, 0 — vec4 indices
                into the stop table
  words 12..15  fallback (f32): normalized rgba (colors) or scalar in x

Stop table — array<vec4f>:
  - transformed input stops (continuous) / cut points (discrete): floats
    packed 4 per vec4 starting at inBase
  - output stops: one vec4 per stop at outBase — continuous colors as
    (L, a, b, alpha) in OKLab (or normalized sRGB under FLAG.SRGB),
    discrete colors as normalized straight sRGB (no interpolation, so
    the exact bytes ride along), scalars in x

Data regions — per distinct mapped key, one region of alignSlots(cap)
f32 values (f64 data narrowed once into a persistent shadow; dict
indices bitcast as u32) plus the same span of present bytes, mirrored
byte-identical and bound as array<u32> (4 slots per word).  dataBase is
the region's element offset; the present word/lane derive from it, so no
second base is stored.
*/

export const PROGRAM_WORDS = 16;
export const PROGRAM_BYTES = PROGRAM_WORDS * 4;

/** meta.y — the kernel's evaluation families (compile-time lowering did the rest). */
export const KIND = {
  /** the datum is the value (numeric passthrough) */
  PASSTHROUGH: 0,
  /** piecewise-linear over transformed stops; 1..4 pick the transform */
  IDENTITY: 1,
  LOG: 2,
  POW: 3,
  SYMLOG: 4,
  /** cut-point search into discrete outputs (threshold/quantize) */
  DISCRETE: 5,
  /** dict-index LUT (string ordinal; packed by the dict path) */
  ORDINAL: 6,
  /** fixed output (arrow color riding a mapped opacity) */
  CONSTANT: 7,
} as const;

/** meta.z flag bits. */
export const FLAG = {
  /** output is a color (packed to the column as rgba8); else a scalar */
  COLOR: 1,
  /** multiply the output alpha by the evaluated opacity (arrow folding) */
  MUL_ALPHA: 2,
  CLAMP: 4,
  /** the data region holds bitcast u32 dict indices, not f32 values */
  DICT: 8,
  /** color stops are normalized sRGB (interpolate: 'srgb'), not OKLab */
  SRGB: 16,
} as const;

/** meta.x — which stored channel the program writes, per group kernel. */
export const TARGETS: Record<
  GroupName,
  Record<string, { target: number; column: ColumnId }>
> = {
  nodes: {
    'background-color': { target: 0, column: 'node.fillColor' },
    'border-color': { target: 1, column: 'node.borderColor' },
    opacity: { target: 2, column: 'node.opacity' },
  },
  edges: {
    'line-color': { target: 0, column: 'edge.lineColor' },
    opacity: { target: 1, column: 'edge.opacity' },
    'source-arrow-color': { target: 2, column: 'edge.sourceArrow' },
    'target-arrow-color': { target: 3, column: 'edge.targetArrow' },
  },
};

/**
 * Edge-sheet context for the in-kernel arrow-alpha folding: the stored
 * arrow bytes carry `colorAlpha × edge opacity`, so arrow programs need
 * the opacity (evaluated when mapped, constant otherwise), and a mapped
 * opacity with *constant* arrow colors needs a synthesized constant
 * program per enabled end to re-fold on opacity writes.  (Mapped arrow
 * *shapes* demote all edge paint to the CPU — the engine's rule.)
 */
export interface EdgeArrowContext {
  opacityMapped: boolean;
  constOpacity: number;
  source: { enabled: boolean; colorMapped: boolean; constColor: RGBA };
  target: { enabled: boolean; colorMapped: boolean; constColor: RGBA };
}

export interface PackInput {
  m: CompiledMapper;
  /** resolved missing-value output: spec fallback ?? channel default */
  fallback: Evaluated;
}

export interface PackedPrograms {
  group: GroupName;
  /** programCount × PROGRAM_BYTES, uniform-buffer ready */
  programData: ArrayBuffer;
  programCount: number;
  /** vec4-packed stop/LUT table (empty ⇒ bind a 1-vec4 dummy) */
  stopData: Float32Array;
  /** distinct mapped data keys, in data-region order */
  keys: string[];
  /** columns the kernel writes — the mirror's gpu-owned set */
  ownedColumns: ColumnId[];
  /** the packed props, program order (the engine's gpu-owned prop set) */
  props: string[];
  /** dict length per ordinal key at pack time (growth ⇒ the LUT must repack) */
  dictSizes: Record<string, number>;
  /** dict epoch per ordinal key at pack time (a compaction remap ⇒ repack too) */
  dictEpochs: Record<string, number>;
  /** mappers that stay CPU-evaluated (unsupported prop/kind/column) */
  skipped: CompiledMapper[];
}

const transformKind = (t: Transform): number => {
  switch (t.kind) {
    case 'identity':
      return KIND.IDENTITY;
    case 'log':
      return KIND.LOG;
    case 'pow':
      return KIND.POW;
    case 'symlog':
      return KIND.SYMLOG;
  }
};

const transformParam = (t: Transform): number => {
  switch (t.kind) {
    case 'identity':
      return 0;
    case 'log':
      return t.base;
    case 'pow':
      return t.exponent;
    case 'symlog':
      return t.constant;
  }
};

/** Whether this program can evaluate in the kernel against its current column. */
const packable = (
  group: GroupName,
  m: CompiledMapper,
  data: DataStore,
): boolean => {
  if (TARGETS[group][m.prop] == null) {
    return false;
  }

  const col = data.column(group, m.key);

  // mixed columns always stay CPU-evaluated (arbitrary JS values)
  if (col?.kind === 'mixed') {
    return false;
  }

  switch (m.program.kind) {
    case 'passthrough':
      return m.kind === 'number' && col?.kind !== 'string';
    case 'continuous':
    case 'discrete':
      return (
        (m.kind === 'number' || m.kind === 'color') && col?.kind !== 'string'
      );
    case 'ordinal':
      // dict-index LUT: needs the string column to exist (its dict is the
      // LUT's index space); number-keyed ordinals stay on the CPU
      return (
        col?.kind === 'string' && (m.kind === 'number' || m.kind === 'color')
      );
    default:
      return false;
  }
};

/** vec4-align and append floats; returns the vec4 base index. */
const appendPacked = (table: number[], floats: ArrayLike<number>): number => {
  const base = table.length / 4;

  for (let i = 0; i < floats.length; i++) {
    table.push(floats[i]);
  }

  while (table.length % 4 !== 0) {
    table.push(0);
  }

  return base;
};

/** Append one vec4 per entry; returns the vec4 base index. */
const appendVec4s = (table: number[], vec4s: number[][]): number => {
  const base = table.length / 4;

  for (const v of vec4s) {
    table.push(v[0], v[1], v[2], v[3]);
  }

  return base;
};

const colorVec4 = (rgba: RGBA, oklab: boolean): number[] => {
  const [r, g, b, a] = rgba;

  if (!oklab) {
    return [r / 255, g / 255, b / 255, a / 255];
  }

  const [L, A, B] = srgbToOklab(r, g, b);

  return [L, A, B, a / 255];
};

const fallbackVec4 = (fallback: Evaluated): number[] => {
  return typeof fallback === 'number'
    ? [fallback, 0, 0, 0]
    : [
        fallback[0] / 255,
        fallback[1] / 255,
        fallback[2] / 255,
        fallback[3] / 255,
      ];
};

/**
 * Lower the group's paint mappers into the kernel's program + stop
 * buffers.  Programs whose output feeds another program's alpha folding
 * (edge opacity) sort first so the fold reads an evaluated value.
 */
export const packPrograms = (
  group: GroupName,
  inputs: PackInput[],
  data: DataStore,
  cap: number,
  ctx: EdgeArrowContext | null = null,
): PackedPrograms => {
  const eligible: PackInput[] = [];
  const skipped: CompiledMapper[] = [];

  for (const input of inputs) {
    if (packable(group, input.m, data)) {
      eligible.push(input);
    } else {
      skipped.push(input.m);
    }
  }

  // opacity first: arrow programs multiply by its result in-kernel
  eligible.sort(
    (a, b) =>
      (a.m.prop === 'opacity' ? 0 : 1) - (b.m.prop === 'opacity' ? 0 : 1),
  );

  // a mapped edge opacity with constant arrow colors: synthesize one
  // constant program per enabled end so the fold tracks opacity writes
  const synthesized: {
    prop: string;
    target: number;
    column: ColumnId;
    color: RGBA;
  }[] = [];

  if (group === 'edges' && ctx != null && ctx.opacityMapped) {
    for (const end of ['source', 'target'] as const) {
      const arrow = ctx[end];

      if (arrow.enabled && !arrow.colorMapped) {
        const prop = `${end}-arrow-color`;

        synthesized.push({
          prop,
          ...TARGETS.edges[prop],
          color: arrow.constColor,
        });
      }
    }
  }

  while (eligible.length + synthesized.length > MAX_PROGRAMS) {
    skipped.push((eligible.pop() as PackInput).m); // backstop; never hit by real sheets
  }

  const keys: string[] = [];
  const keyIndex = (key: string): number => {
    let at = keys.indexOf(key);

    if (at < 0) {
      at = keys.length;
      keys.push(key);
    }

    return at;
  };

  const table: number[] = [];
  const programCount = eligible.length + synthesized.length;
  const programData = new ArrayBuffer(
    Math.max(programCount, 1) * PROGRAM_BYTES,
  );
  const u32 = new Uint32Array(programData);
  const f32 = new Float32Array(programData);
  const ownedColumns: ColumnId[] = [];
  const props: string[] = [];
  const dictSizes: Record<string, number> = {};
  const dictEpochs: Record<string, number> = {};
  const capAligned = alignSlots(cap);
  const isArrowProp = (prop: string): boolean => prop.endsWith('-arrow-color');

  for (let p = 0; p < eligible.length; p++) {
    const { m, fallback } = eligible[p];
    const { target, column } = TARGETS[group][m.prop];
    const program = m.program;
    const at = p * PROGRAM_WORDS;
    const isColor = m.kind === 'color';
    const dataBase = keyIndex(m.key) * capAligned;

    ownedColumns.push(column);
    props.push(m.prop);

    let kind: number;
    let flags = isColor ? FLAG.COLOR : 0;
    let lo = 0;
    let hi = 0;
    let p0 = 0;
    // domain.w: the constant alpha multiplier for color programs (arrow
    // programs fold the constant edge opacity here; FLAG.MUL_ALPHA
    // switches to the evaluated opacity instead)
    let alphaMul = isColor ? 1 : 0;
    let outBase = 0;
    let count = 0;
    let inBase = 0;

    if (group === 'edges' && isArrowProp(m.prop) && ctx != null) {
      if (ctx.opacityMapped) {
        flags |= FLAG.MUL_ALPHA;
      } else {
        alphaMul = ctx.constOpacity;
      }
    }

    if (program.kind === 'passthrough') {
      kind = KIND.PASSTHROUGH;
    } else if (program.kind === 'ordinal') {
      // dict-index LUT: entry i answers dict index i+1; unlisted
      // categories resolve to the program fallback like absent data
      const col = data.column(group, m.key);
      const dict = col?.kind === 'string' ? col.dict : [];
      const map = (program as Extract<Program, { kind: 'ordinal' }>).map;

      kind = KIND.ORDINAL;
      flags |= FLAG.DICT;

      if (isColor) {
        flags |= FLAG.SRGB;
      } // LUT colors are exact normalized sRGB

      count = dict.length;
      outBase = appendVec4s(
        table,
        dict.map((entry) => {
          const out = map.get(entry) ?? fallback;

          return typeof out === 'number'
            ? [out, 0, 0, 0]
            : colorVec4(out as RGBA, false);
        }),
      );
      dictSizes[m.key] = dict.length;
      dictEpochs[m.key] = col?.kind === 'string' ? col.epoch : 0;
    } else if (program.kind === 'continuous') {
      kind = transformKind(program.transform);
      lo = program.lo;
      hi = program.hi;
      p0 = transformParam(program.transform);

      if (program.clamp) {
        flags |= FLAG.CLAMP;
      }

      const out = program.outStops;

      count = program.inStops.length;
      inBase = appendPacked(table, program.inStops);

      if (out.kind === 'number') {
        outBase = appendVec4s(
          table,
          [...out.values].map((v) => [v, 0, 0, 0]),
        );
      } else {
        if (out.space === 'srgb') {
          flags |= FLAG.SRGB;
        }

        const vec4s: number[][] = [];

        for (let i = 0; i < count; i++) {
          const a = out.alpha[i] / 255;

          vec4s.push(
            out.space === 'srgb'
              ? [
                  out.triples[i * 3] / 255,
                  out.triples[i * 3 + 1] / 255,
                  out.triples[i * 3 + 2] / 255,
                  a,
                ]
              : [
                  out.triples[i * 3],
                  out.triples[i * 3 + 1],
                  out.triples[i * 3 + 2],
                  a,
                ],
          );
        }

        outBase = appendVec4s(table, vec4s);
      }
    } else {
      // discrete (threshold/quantize; ordinal never packs here)
      const discrete = program as Extract<Program, { kind: 'discrete' }>;

      kind = KIND.DISCRETE;
      count = discrete.outputs.length;
      inBase = appendPacked(table, discrete.cuts);
      outBase = appendVec4s(
        table,
        discrete.outputs.map((out) =>
          typeof out === 'number' ? [out, 0, 0, 0] : colorVec4(out, false),
        ),
      );

      // discrete color outputs are exact normalized sRGB, never OKLab
      if (isColor) {
        flags |= FLAG.SRGB;
      }
    }

    u32[at] = target;
    u32[at + 1] = kind;
    u32[at + 2] = flags;
    u32[at + 3] = dataBase;
    f32[at + 4] = lo;
    f32[at + 5] = hi;
    f32[at + 6] = p0;
    f32[at + 7] = alphaMul;
    u32[at + 8] = outBase;
    u32[at + 9] = count;
    u32[at + 10] = inBase;
    u32[at + 11] = 0;

    // the fallback rides in the same space the program's outputs use, so
    // resolveColor applies one conversion path per program
    const oklabFallback = isColor && (flags & FLAG.SRGB) === 0;
    const fb = oklabFallback
      ? (() => {
          const [r, g, b, a] = fallback as RGBA;
          const [L, A, B] = srgbToOklab(r, g, b);

          return [L, A, B, a / 255];
        })()
      : fallbackVec4(fallback);

    f32[at + 12] = fb[0];
    f32[at + 13] = fb[1];
    f32[at + 14] = fb[2];
    f32[at + 15] = fb[3];
  }

  for (let s = 0; s < synthesized.length; s++) {
    const synth = synthesized[s];
    const at = (eligible.length + s) * PROGRAM_WORDS;

    ownedColumns.push(synth.column);
    props.push(synth.prop);

    u32[at] = synth.target;
    u32[at + 1] = KIND.CONSTANT;
    u32[at + 2] = FLAG.COLOR | FLAG.SRGB | FLAG.MUL_ALPHA;
    f32[at + 7] = 1;

    const fb = fallbackVec4(synth.color);

    f32[at + 12] = fb[0];
    f32[at + 13] = fb[1];
    f32[at + 14] = fb[2];
    f32[at + 15] = fb[3];
  }

  return {
    group,
    programData,
    programCount,
    stopData: Float32Array.from(table.length > 0 ? table : [0, 0, 0, 0]),
    keys,
    ownedColumns,
    props,
    dictSizes,
    dictEpochs,
    skipped,
  };
};

// -- data regions --

/** Data regions are 4-slot aligned so present bytes pack whole u32 words. */
export const alignSlots = (cap: number): number => (cap + 3) & ~3;

export interface DataRegions {
  /** keys.length × capAligned f32 values (dict indices bitcast as u32) */
  values: Float32Array;
  /** keys.length × capAligned present bytes (bound as array<u32>) */
  present: Uint8Array;
  keys: string[];
  capAligned: number;
}

/**
 * Build the packed per-key data shadow for a group: one aligned region
 * per key, f64 values narrowed to f32 with their present mask.
 */
export const buildDataRegions = (
  group: GroupName,
  keys: string[],
  data: DataStore,
  cap: number,
): DataRegions => {
  const capAligned = alignSlots(cap);
  const regions: DataRegions = {
    values: new Float32Array(Math.max(keys.length * capAligned, 4)),
    present: new Uint8Array(Math.max(keys.length * capAligned, 4)),
    keys,
    capAligned,
  };

  for (let i = 0; i < keys.length; i++) {
    updateDataRegion(regions, group, i, data, 0, cap);
  }

  return regions;
};

/**
 * Refresh one key's region over [start, end) from the data column.
 * Returns the touched byte range within `values` (the present range is
 * the same offsets at 1 byte per slot, 4-byte aligned by construction).
 */
export const updateDataRegion = (
  regions: DataRegions,
  group: GroupName,
  keyIndex: number,
  data: DataStore,
  start: number,
  end: number,
): { valueByteStart: number; valueByteEnd: number } => {
  const base = keyIndex * regions.capAligned;
  const col = data.column(group, regions.keys[keyIndex]);
  const to = Math.min(end, regions.capAligned);

  if (col?.kind === 'number') {
    const { values, present } = col;

    for (let slot = start; slot < to; slot++) {
      const ok = slot < values.length && present[slot] === 1;

      regions.values[base + slot] = ok ? Math.fround(values[slot]) : 0;
      regions.present[base + slot] = ok ? 1 : 0;
    }
  } else if (col?.kind === 'string') {
    const u32 = new Uint32Array(regions.values.buffer);
    const indices = col.indices;

    for (let slot = start; slot < to; slot++) {
      const at = slot < indices.length ? indices[slot] : 0;

      u32[base + slot] = at;
      regions.present[base + slot] = at > 0 ? 1 : 0;
    }
  } else {
    for (let slot = start; slot < to; slot++) {
      regions.values[base + slot] = 0;
      regions.present[base + slot] = 0;
    }
  }

  return {
    valueByteStart: (base + start) * 4,
    valueByteEnd: (base + to) * 4,
  };
};

// -- the device-side runtime --

/** The StyleEngine surface the runtime pulls from (structural; no render→style import cycle). */
export interface PaintSource {
  /** bumps on setSheet and when a GPU-owned auto-domain extent moves */
  paintVersion: number;
  paintInputs(group: GroupName): PackInput[];
  /** edge-sheet constants for the in-kernel arrow-alpha folding */
  paintContext(group: GroupName): EdgeArrowContext | null;
  /** told which props the kernel owns, so CPU refresh skips them and getters evaluate lazily */
  setGpuOwned(group: GroupName, props: Iterable<string>): void;
}

/** The GraphStore surface the runtime needs. */
export interface EvalStore {
  data: DataStore;
  capacity(group: GroupName): number;
  takeMapperSpans(): {
    group: GroupName;
    key: string;
    start: number;
    end: number;
  }[];
}

/** The ColumnMirror surface the runtime needs. */
export interface EvalMirror {
  version: number;
  buffer(id: ColumnId): GPUBuffer;
  setGpuOwned(ids: Iterable<ColumnId>): void;
}

/** Narrow device surface (mock-testable, like MirrorDevice). */
export interface EvalDevice {
  createBuffer(descriptor: {
    size: number;
    usage: number;
    label?: string;
  }): GPUBuffer;
  createBindGroupLayout(
    descriptor: GPUBindGroupLayoutDescriptor,
  ): GPUBindGroupLayout;
  createPipelineLayout(
    descriptor: GPUPipelineLayoutDescriptor,
  ): GPUPipelineLayout;
  createShaderModule(descriptor: GPUShaderModuleDescriptor): GPUShaderModule;
  createComputePipeline(
    descriptor: GPUComputePipelineDescriptor,
  ): GPUComputePipeline;
  createBindGroup(descriptor: GPUBindGroupDescriptor): GPUBindGroup;
  queue: {
    writeBuffer(
      buffer: GPUBuffer,
      bufferOffset: number,
      data: ArrayBufferLike | ArrayBufferView,
      dataOffset?: number,
      size?: number,
    ): void;
  };
}

interface GroupState {
  packed: PackedPrograms | null;
  regions: DataRegions | null;
  programBuffer: GPUBuffer;
  infoBuffer: GPUBuffer;
  stopBuffer: GPUBuffer | null;
  valuesBuffer: GPUBuffer | null;
  presentBuffer: GPUBuffer | null;
  bindGroup: GPUBindGroup | null;
  bindKey: string;
  /** local buffer generation (bumped when values/present/stop buffers are recreated) */
  gen: number;
  /** coalesced slot range awaiting a kernel dispatch; start > end means none */
  pendingStart: number;
  pendingEnd: number;
}

const WG_SIZE = 256;
const GROUPS: readonly GroupName[] = ['nodes', 'edges'];

/**
 * The GPU-resident restyle: owns the packed program/stop/data buffers and
 * the per-group eval pipelines, pulls reconfiguration from the
 * StyleEngine by version, converts data-write spans and owned-column CPU
 * spans into coalesced eval dispatches, and encodes them at the top of
 * the scene compute pass.  A bulk data write therefore costs only the
 * data-byte upload plus one dispatch — zero per-element CPU restyle.
 */
export class MapperRuntime {
  /** stats: data bytes uploaded for mapper evaluation */
  uploadedBytes = 0;
  /** stats: eval dispatches encoded */
  dispatches = 0;

  private device: EvalDevice;
  private store: EvalStore;
  private engine: PaintSource;
  private mirror: EvalMirror;
  private layouts: Record<GroupName, GPUBindGroupLayout>;
  private pipelines: Record<GroupName, GPUComputePipeline>;
  private states: Record<GroupName, GroupState>;
  private lastVersion = -1;
  private destroyed = false;

  /**
   * Builds the per-group eval layouts, pipelines and fixed-size program
   * and info buffers.  No mapper is configured yet: the runtime is
   * inert (active() false, encode() a no-op) until the first update()
   * observes a new `engine.paintVersion` and packs the programs, so
   * constructing it on a graph with no data mappers costs two pipelines
   * and nothing more.  All four collaborators are held by reference.
   *
   * @param device — the device (or narrow mock) that owns the pipelines
   * and every per-group buffer
   * @param store — supplies group capacities and the data values the
   * kernel evaluates against
   * @param engine — the paint source polled by `paintVersion` for
   * reconfiguration
   * @param mirror — the column mirror whose buffers the kernel writes;
   * the caller must register the evaluated columns as GPU-owned, or CPU
   * span uploads would clobber them
   */
  constructor(
    device: EvalDevice,
    store: EvalStore,
    engine: PaintSource,
    mirror: EvalMirror,
  ) {
    this.device = device;
    this.store = store;
    this.engine = engine;
    this.mirror = mirror;

    const layoutFor = (group: GroupName): GPUBindGroupLayout =>
      device.createBindGroupLayout({
        label: `cy-gpu:${group}-mapper-eval-layout`,
        entries: [
          {
            binding: 0,
            visibility: SHADER_STAGE.COMPUTE,
            buffer: { type: 'uniform' },
          },
          {
            binding: 1,
            visibility: SHADER_STAGE.COMPUTE,
            buffer: { type: 'uniform' },
          },
          {
            binding: 2,
            visibility: SHADER_STAGE.COMPUTE,
            buffer: { type: 'read-only-storage' },
          },
          {
            binding: 3,
            visibility: SHADER_STAGE.COMPUTE,
            buffer: { type: 'read-only-storage' },
          },
          {
            binding: 4,
            visibility: SHADER_STAGE.COMPUTE,
            buffer: { type: 'read-only-storage' },
          },
          ...TARGET_BINDINGS[group].map((_, i) => ({
            binding: 5 + i,
            visibility: SHADER_STAGE.COMPUTE,
            buffer: { type: 'storage' as GPUBufferBindingType },
          })),
        ],
      });

    this.layouts = { nodes: layoutFor('nodes'), edges: layoutFor('edges') };
    this.pipelines = {} as Record<GroupName, GPUComputePipeline>;

    for (const group of GROUPS) {
      this.pipelines[group] = device.createComputePipeline({
        label: `cy-gpu:${group}-mapper-eval`,
        layout: device.createPipelineLayout({
          bindGroupLayouts: [this.layouts[group]],
        }),
        compute: {
          module: device.createShaderModule({
            label: `cy-gpu:${group}-mapper-eval-shader`,
            code: group === 'nodes' ? NODE_EVAL_SHADER : EDGE_EVAL_SHADER,
          }),
          entryPoint: 'csEval',
        },
      });
    }

    const stateFor = (group: GroupName): GroupState => ({
      packed: null,
      regions: null,
      programBuffer: device.createBuffer({
        label: `cy-gpu:${group}-mapper-programs`,
        size: MAX_PROGRAMS * PROGRAM_BYTES,
        usage: BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST,
      }),
      infoBuffer: device.createBuffer({
        label: `cy-gpu:${group}-mapper-info`,
        size: 16,
        usage: BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST,
      }),
      stopBuffer: null,
      valuesBuffer: null,
      presentBuffer: null,
      bindGroup: null,
      bindKey: '',
      gen: 0,
      pendingStart: 1,
      pendingEnd: 0,
    });

    this.states = { nodes: stateFor('nodes'), edges: stateFor('edges') };
  }

  /** True when any group currently evaluates on the GPU. */
  active(): boolean {
    return this.states.nodes.packed != null || this.states.edges.packed != null;
  }

  /**
   * Pull-based per-frame update (after mirror.sync): reconfigure when the
   * engine's paint state changed, rebuild data regions on capacity
   * growth, ingest data-write spans (upload only the touched bytes) and
   * turn owned-column CPU spans (element adds, sheet applies) into eval
   * requests.
   */
  update(delta: {
    resized: Record<GroupName, boolean>;
    spans: { column: ColumnId; start: number; end: number }[];
  }): void {
    if (this.destroyed) {
      return;
    }

    if (this.engine.paintVersion !== this.lastVersion) {
      this.lastVersion = this.engine.paintVersion;
      this.configure();
    }

    for (const group of GROUPS) {
      const state = this.states[group];

      if (state.packed == null) {
        continue;
      }

      if (delta.resized[group]) {
        this.rebuildData(group);
        this.queue(group, 0, this.store.capacity(group));
      }
    }

    for (const span of delta.spans) {
      for (const group of GROUPS) {
        const state = this.states[group];

        if (
          state.packed != null &&
          state.packed.ownedColumns.includes(span.column)
        ) {
          this.queue(group, span.start, span.end);
          break;
        }
      }
    }

    for (const span of this.store.takeMapperSpans()) {
      const state = this.states[span.group];
      const regions = state.regions;

      if (state.packed == null || regions == null) {
        continue;
      }

      const keyIndex = regions.keys.indexOf(span.key);

      if (keyIndex < 0) {
        // a watched key that wasn't packable at configure time (e.g. its
        // column didn't exist yet): reconfigure on the next frame
        this.lastVersion = -1;
        continue;
      }

      // ordinal LUTs index by dict entry: a grown dict (new category) or
      // a compaction remap (bumped epoch) needs a repacked LUT, so re-run
      // configure against the new dict (rare — once per new category or
      // reclaim); it rebuilds the data regions and queues a full eval,
      // which covers this span too
      const packedDict = state.packed.dictSizes[span.key];

      if (packedDict != null) {
        const col = this.store.data.column(span.group, span.key);

        if (
          col?.kind === 'string' &&
          (col.dict.length !== packedDict ||
            col.epoch !== state.packed.dictEpochs[span.key])
        ) {
          this.configure();
          continue;
        }
      }

      const range = updateDataRegion(
        regions,
        span.group,
        keyIndex,
        this.store.data,
        span.start,
        span.end,
      );
      const byteLength = range.valueByteEnd - range.valueByteStart;

      if (byteLength <= 0) {
        continue;
      }

      this.device.queue.writeBuffer(
        state.valuesBuffer as GPUBuffer,
        range.valueByteStart,
        regions.values.buffer,
        range.valueByteStart,
        byteLength,
      );

      // present bytes: 1 per slot at the same slot offsets, word-aligned
      const pStart = (keyIndex * regions.capAligned + span.start) & ~3;
      const pEnd = Math.min(
        (keyIndex * regions.capAligned + span.end + 3) & ~3,
        regions.present.length,
      );

      this.device.queue.writeBuffer(
        state.presentBuffer as GPUBuffer,
        pStart,
        regions.present.buffer,
        pStart,
        pEnd - pStart,
      );

      this.uploadedBytes += byteLength + (pEnd - pStart);
      this.queue(span.group, span.start, span.end);
    }
  }

  /** Encode pending eval dispatches (the top of the scene compute pass). */
  encode(pass: GPUComputePassEncoder): void {
    if (this.destroyed) {
      return;
    }

    for (const group of GROUPS) {
      const state = this.states[group];
      const packed = state.packed;

      if (packed == null || state.pendingStart > state.pendingEnd) {
        continue;
      }

      const start = Math.max(0, state.pendingStart);
      const end = Math.min(state.pendingEnd, this.store.capacity(group));
      const count = end - start;

      state.pendingStart = 1;
      state.pendingEnd = 0;

      if (count <= 0) {
        continue;
      }

      this.device.queue.writeBuffer(
        state.infoBuffer,
        0,
        new Uint32Array([start, count, packed.programCount, 0]),
      );

      this.ensureBindGroup(group);

      pass.setPipeline(this.pipelines[group]);
      pass.setBindGroup(0, state.bindGroup as GPUBindGroup);
      pass.dispatchWorkgroups(Math.ceil(count / WG_SIZE));
      this.dispatches++;
    }
  }

  /**
   * Destroys every per-group buffer and latches update() and encode()
   * off.  The mirror's column buffers are written by the kernel but not
   * owned here, so they survive with their last evaluated bytes; the
   * caller should drop the evaluated columns from the mirror's GPU-owned
   * set afterwards, or those columns would never receive CPU uploads
   * again.
   */
  destroy(): void {
    this.destroyed = true;

    for (const group of GROUPS) {
      const state = this.states[group];

      state.programBuffer.destroy();
      state.infoBuffer.destroy();
      state.stopBuffer?.destroy();
      state.valuesBuffer?.destroy();
      state.presentBuffer?.destroy();
    }
  }

  // -- internals --

  private queue(group: GroupName, start: number, end: number): void {
    const state = this.states[group];

    if (state.pendingStart > state.pendingEnd) {
      state.pendingStart = start;
      state.pendingEnd = end;
    } else {
      state.pendingStart = Math.min(state.pendingStart, start);
      state.pendingEnd = Math.max(state.pendingEnd, end);
    }
  }

  private configure(): void {
    const owned: ColumnId[] = [];

    for (const group of GROUPS) {
      const state = this.states[group];
      const inputs = this.engine.paintInputs(group);
      const packed = packPrograms(
        group,
        inputs,
        this.store.data,
        this.store.capacity(group),
        this.engine.paintContext(group),
      );

      if (packed.programCount === 0) {
        state.packed = null;
        state.regions = null;
        state.bindGroup = null;
        this.engine.setGpuOwned(group, []);
        continue;
      }

      state.packed = packed;
      this.engine.setGpuOwned(group, packed.props);
      owned.push(...packed.ownedColumns);

      this.device.queue.writeBuffer(state.programBuffer, 0, packed.programData);
      this.uploadedBytes += packed.programData.byteLength;

      state.stopBuffer?.destroy();
      state.stopBuffer = this.device.createBuffer({
        label: `cy-gpu:${group}-mapper-stops`,
        size: packed.stopData.byteLength,
        usage: BUFFER_USAGE.STORAGE | BUFFER_USAGE.COPY_DST,
      });
      this.device.queue.writeBuffer(
        state.stopBuffer,
        0,
        packed.stopData.buffer,
        packed.stopData.byteOffset,
        packed.stopData.byteLength,
      );
      this.uploadedBytes += packed.stopData.byteLength;

      this.rebuildData(group);
      this.queue(group, 0, this.store.capacity(group));
    }

    this.mirror.setGpuOwned(owned);
  }

  private rebuildData(group: GroupName): void {
    const state = this.states[group];
    const packed = state.packed as PackedPrograms;
    const regions = buildDataRegions(
      group,
      packed.keys,
      this.store.data,
      this.store.capacity(group),
    );

    state.regions = regions;
    state.valuesBuffer?.destroy();
    state.presentBuffer?.destroy();
    state.valuesBuffer = this.device.createBuffer({
      label: `cy-gpu:${group}-mapper-values`,
      size: regions.values.byteLength,
      usage: BUFFER_USAGE.STORAGE | BUFFER_USAGE.COPY_DST,
    });
    state.presentBuffer = this.device.createBuffer({
      label: `cy-gpu:${group}-mapper-present`,
      size: Math.max(4, (regions.present.length + 3) & ~3),
      usage: BUFFER_USAGE.STORAGE | BUFFER_USAGE.COPY_DST,
    });

    // present length is a whole number of words (capAligned is 4-aligned)
    this.device.queue.writeBuffer(
      state.valuesBuffer,
      0,
      regions.values.buffer,
      0,
      regions.values.byteLength,
    );
    this.device.queue.writeBuffer(
      state.presentBuffer,
      0,
      regions.present.buffer,
      0,
      regions.present.length,
    );
    this.uploadedBytes += regions.values.byteLength + regions.present.length;
    state.gen++;
    state.bindGroup = null;
  }

  private ensureBindGroup(group: GroupName): void {
    const state = this.states[group];
    const key = `${this.mirror.version}:${state.gen}`;

    if (state.bindGroup != null && state.bindKey === key) {
      return;
    }

    state.bindGroup = this.device.createBindGroup({
      label: `cy-gpu:${group}-mapper-eval-bind`,
      layout: this.layouts[group],
      entries: [
        { binding: 0, resource: { buffer: state.infoBuffer } },
        { binding: 1, resource: { buffer: state.programBuffer } },
        { binding: 2, resource: { buffer: state.valuesBuffer as GPUBuffer } },
        { binding: 3, resource: { buffer: state.presentBuffer as GPUBuffer } },
        { binding: 4, resource: { buffer: state.stopBuffer as GPUBuffer } },
        ...TARGET_BINDINGS[group].map((id, i) => ({
          binding: 5 + i,
          resource: { buffer: this.mirror.buffer(id as ColumnId) },
        })),
      ],
    });
    state.bindKey = key;
  }
}
