/*
WGSL for the mapper eval pass: one uber-kernel per group interprets the
packed program array (mapper-runtime.mts) over a slot range and writes
the evaluated values into the *existing* style-channel storage buffers —
the render pipelines never know mappers exist.  Scale math mirrors
style-scales.mts step for step (transform → clamp → stop search → lerp),
so CPU getter evaluation and rendered bytes agree.

Bindings (@group(0)):
  0 info      uniform  EvalInfo { start, count, programCount }
  1 programs  uniform  array<MapperProgram, MAX_PROGRAMS>
  2 values    storage  packed per-key data regions (f32; dict u32 bitcast)
  3 present   storage  per-key present bytes, read as u32 words
  4 stops     storage  vec4f stop/LUT table
  5.. write targets, per group (colors as array<u32>, scalars f32)
*/

/** uniform-buffer program capacity (1 KB at 64 B each; plenty per group) */
export const MAX_PROGRAMS = 16;

const EVAL_COMMON = `
struct MapperProgram {
  head: vec4u,     // target, kind, flags, dataBase
  domain: vec4f,   // lo, hi, p0 (exponent | log base | symlog C), pad
  table: vec4u,    // outBase, count, inBase, pad
  fallback: vec4f, // normalized rgba, or scalar in x
}

struct EvalInfo {
  start: u32,
  count: u32,
  programCount: u32,
  pad: u32,
}

const KIND_PASSTHROUGH = 0u;
const KIND_LOG = 2u;
const KIND_POW = 3u;
const KIND_SYMLOG = 4u;
const KIND_DISCRETE = 5u;
const KIND_ORDINAL = 6u;
const KIND_CONSTANT = 7u;

const FLAG_COLOR = 1u;
const FLAG_MUL_ALPHA = 2u;
const FLAG_CLAMP = 4u;
const FLAG_DICT = 8u;
const FLAG_SRGB = 16u;

@group(0) @binding(0) var<uniform> info: EvalInfo;
@group(0) @binding(1) var<uniform> programs: array<MapperProgram, ${MAX_PROGRAMS}>;
@group(0) @binding(2) var<storage, read> dataValues: array<f32>;
@group(0) @binding(3) var<storage, read> present: array<u32>;
@group(0) @binding(4) var<storage, read> stops: array<vec4f>;

fn isPresent(at: u32) -> bool {
  return ((present[at >> 2u] >> ((at & 3u) * 8u)) & 0xffu) != 0u;
}

// packed floats, 4 per vec4 (input stops / cut points)
fn packedF32(base: u32, i: u32) -> f32 {
  return stops[base + (i >> 2u)][i & 3u];
}

fn transformVal(kind: u32, x: f32, p0: f32) -> f32 {
  switch kind {
    case KIND_LOG: { // signed, so all-negative domains stay ascending
      let l = log(abs(x)) / log(p0);
      return select(-l, l, x > 0.0);
    }
    case KIND_POW: { return sign(x) * pow(abs(x), p0); }
    case KIND_SYMLOG: { return sign(x) * log(1.0 + abs(x) / p0); }
    default: { return x; }
  }
}

// segment index + fraction, mirroring style-scales' segmentAt (end
// segments clamp the index, so unclamped inputs extrapolate linearly)
fn segmentAt(inBase: u32, n: u32, tx: f32) -> vec2f {
  var i = 0u;

  loop {
    if (i >= n - 2u) { break; }
    if (tx > packedF32(inBase, i + 1u)) { i = i + 1u; } else { break; }
  }

  let a = packedF32(inBase, i);
  let b = packedF32(inBase, i + 1u);
  let u = select(0.0, (tx - a) / (b - a), b != a);

  return vec2f(f32(i), u);
}

// evaluate one program's output vec4 for a slot (scalar programs use x)
fn evalProgram(p: MapperProgram, slot: u32) -> vec4f {
  let kind = p.head.y;

  if (kind == KIND_CONSTANT) { return p.fallback; }

  let at = p.head.w + slot;

  if (!isPresent(at)) { return p.fallback; }

  var x = dataValues[at];

  if (kind == KIND_PASSTHROUGH) { return vec4f(x, 0.0, 0.0, 0.0); }

  if (kind == KIND_ORDINAL) {
    // dict-index LUT; the index rides the data region as a bitcast u32
    let idx = bitcast<u32>(x);
    if (idx == 0u || idx > p.table.y) { return p.fallback; }
    return stops[p.table.x + idx - 1u];
  }

  if (kind == KIND_DISCRETE) {
    let n = p.table.y;
    var i = 0u;
    loop {
      if (i >= n - 1u) { break; }
      if (x >= packedF32(p.table.z, i)) { i = i + 1u; } else { break; }
    }
    return stops[p.table.x + i];
  }

  // continuous: clamp in untransformed space, then piecewise over stops
  let lo = p.domain.x;
  let hi = p.domain.y;
  let clampOn = (p.head.z & FLAG_CLAMP) != 0u;

  if (kind == KIND_LOG && (x == 0.0 || (x > 0.0) != (lo > 0.0))) {
    if (!clampOn) { return p.fallback; } // sign mismatch is unmappable
    x = select(hi, lo, lo > 0.0);
  }

  if (clampOn) { x = clamp(x, lo, hi); }

  let n = p.table.y;
  let first = packedF32(p.table.z, 0u);
  let last = packedF32(p.table.z, n - 1u);
  var iu: vec2f;

  if (first == last) {
    // degenerate domain: the center of the range
    let mid = f32(n - 1u) * 0.5;
    let i = min(f32(n - 2u), floor(mid));
    iu = vec2f(i, mid - i);
  } else {
    iu = segmentAt(p.table.z, n, transformVal(kind, x, p.domain.z));
  }

  let i = u32(iu.x);
  let a = stops[p.table.x + i];
  let b = stops[p.table.x + i + 1u];

  return a + (b - a) * iu.y;
}
`;

const NODE_TARGETS = `
@group(0) @binding(5) var<storage, read_write> fillColor: array<u32>;
@group(0) @binding(6) var<storage, read_write> borderColor: array<u32>;
@group(0) @binding(7) var<storage, read_write> opacity: array<f32>;
`;

const EDGE_TARGETS = `
@group(0) @binding(5) var<storage, read_write> lineColor: array<u32>;
@group(0) @binding(6) var<storage, read_write> opacity: array<f32>;
@group(0) @binding(7) var<storage, read_write> sourceArrow: array<u32>;
@group(0) @binding(8) var<storage, read_write> targetArrow: array<u32>;
`;

/** target ids match TARGETS in mapper-runtime.mts */
const NODE_WRITE = `
fn writeTarget(tgt: u32, slot: u32, v: vec4f, opacityNow: f32) {
  switch tgt {
    case 2u: { opacity[slot] = v.x; }
    default: {}
  }
}
`;

const EDGE_WRITE = `
fn writeTarget(tgt: u32, slot: u32, v: vec4f, opacityNow: f32) {
  switch tgt {
    case 1u: { opacity[slot] = v.x; }
    default: {}
  }
}
`;

const MAIN = `
@compute @workgroup_size(256)
fn csEval(@builtin(global_invocation_id) gid: vec3u) {
  if (gid.x >= info.count) { return; }

  let slot = info.start + gid.x;
  var opacityNow = -1.0; // sentinel: opacity programs are packed first

  for (var p = 0u; p < info.programCount; p = p + 1u) {
    let prog = programs[p];
    let v = evalProgram(prog, slot);

    writeTarget(prog.head.x, slot, v, opacityNow);

    // remember the evaluated opacity for downstream alpha folding
    if ((prog.head.z & FLAG_COLOR) == 0u) { opacityNow = v.x; }
  }
}
`;

export const NODE_EVAL_SHADER = EVAL_COMMON + NODE_TARGETS + NODE_WRITE + MAIN;
export const EDGE_EVAL_SHADER = EVAL_COMMON + EDGE_TARGETS + EDGE_WRITE + MAIN;

/** write-target storage bindings per group, after the 5 shared ones */
export const TARGET_BINDINGS: Record<'nodes' | 'edges', readonly string[]> = {
  nodes: [ 'node.fillColor', 'node.borderColor', 'node.opacity' ],
  edges: [ 'edge.lineColor', 'edge.opacity', 'edge.sourceArrow', 'edge.targetArrow' ]
};
