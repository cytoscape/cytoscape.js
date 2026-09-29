// Chart capacity measurement (PLAN.md item 73, prepared 2026-09-29 for the
// chart-kinds sitting).  A prototype, deliberately outside `src/`: it prices
// the per-fragment cost of the chart kinds as the values per node grow, which
// the shipped renderer cannot do because `CHART_MAX_SLICES` truncates at 16
// and the `offset | count << 24` ref stops at 255.
//
//   node --import tsx benchmark/chart-capacity.mjs            # full sweep
//   node --import tsx benchmark/chart-capacity.mjs --quick    # 16 and 64 only
//   node --import tsx benchmark/chart-capacity.mjs --variant pie-bsearch
//   node --import tsx benchmark/chart-capacity.mjs --json out.json
//
// What runs: the shipped chart shader (`src/render/shaders/chart.mts`,
// imported, not copied) and variants derived from it by exact text
// substitution — each substitution asserts it matched once, so a drifted
// shader fails the run rather than silently pricing the original:
//
//   pie-packed   the shipped shader verbatim (ref = offset | n << 24): the
//                control; only where the record fits the 24-bit offset
//   pie-walk     the shipped O(n) cumulative walk, the ref carrying the
//                offset only and n read from the record header (the
//                "count in the header" packing alternative)
//   stripes-walk the same walk, stripes geometry
//   pie-bsearch  the pie over cumulative stops, bisected: O(log n)
//   heat-index   round 80's planned heat kinds: region floor(t·n), O(1)
//   bar-index    round 80.2's bar: region index + one value read + height
//   scatter-walk a point series drawn in the chart FS: nearest of n points,
//                O(n) per fragment (the naive "one more record kind")
//   line-walk    a polyline in the chart FS: nearest of n-1 segments, O(n)
//   scatter-inst a point series as its own draw: one instanced quad per
//                point, O(1) per fragment, n instances per node
//
// Two scenes on a 2560x1600 target (1280x800 at dpr 2, the render bench's
// size): `fit-25k` — 25,000 charted nodes at 12 device px, the whole graph
// on screen just above the 8 px chart floor; `close-1k` — the 1,000 nodes a
// zoomed-in view of the same graph shows, at 60 px.  Both cover about the
// same number of fragments; they differ in instances.
//
// Metric: GPU time of the one render pass via timestamp-query, median of the
// timed passes.  Each row also reads the target back once and reports the
// covered-pixel fraction, so a row that drew nothing cannot pass for a fast
// one (docs/agents/benchmarking.md: a row asserts the property it is named
// for).  Refuses a software adapter.

import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { CHART_SHADER } from '../src/render/shaders/chart.mjs';
import { COMMON } from '../src/render/shaders/common.mjs';
import {
  CHART_HEADER,
  SHAPE_ELLIPSE,
  SHAPE_SHIFT,
  CHART_PIE,
  CHART_STRIPES,
} from '../src/contract.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, '..');
const args = process.argv.slice(2);
const quick = args.includes('--quick');
const jsonAt = args.indexOf('--json');
const jsonOut = jsonAt >= 0 ? args[jsonAt + 1] : null;
const onlyAt = args.indexOf('--variant');
const only = onlyAt >= 0 ? args[onlyAt + 1] : null;

/** Replace exactly one occurrence, or fail the run. */
const swap = (src, from, to, what) => {
  const n = src.split(from).length - 1;

  if (n !== 1) {
    throw new Error(`variant ${what}: expected one match, found ${n}`);
  }

  return src.replace(from, to);
};

const REF_PACKED = 'let n = cref >> 24u;\n  let off = cref & 0xffffffu;';
// the header's float 6 already holds n (CHART_HEADER's layout); the ref
// carries offset + 1 so that 0 still means "no chart"
const REF_HEADER = 'let off = cref - 1u;\n  let n = u32(chartBlob[off + 6u]);';

const LOOP =
  '  for (var i = 0u; i < n; i = i + 1u) {\n' +
  '    let v = chartBlob[off + CHART_HEADER + i * 3u];\n' +
  '    let next = acc + v;\n\n' +
  '    if (t < next && k == n) {\n' +
  '      k = i;\n' +
  '      lower = acc;\n' +
  '      upper = next;\n' +
  '    }\n\n' +
  '    acc = next;\n' +
  '  }\n';

const INDEX =
  '  {\n' +
  '    let nf = f32(n);\n' +
  '    let kf = min(floor(t * nf), nf - 1.0);\n\n' +
  '    k = u32(kf);\n' +
  '    lower = kf / nf;\n' +
  '    upper = (kf + 1.0) / nf;\n' +
  '    acc = 1.0;\n' +
  '  }\n';

// the O(log n) alternative for the ordered kinds: the record stores the
// cumulative stops (readback would difference them) and the FS bisects
const BSEARCH =
  '  {\n' +
  '    var lo = 0u;\n' +
  '    var hi = n;\n\n' +
  '    loop {\n' +
  '      if (lo >= hi) { break; }\n' +
  '      let mid = (lo + hi) / 2u;\n\n' +
  '      if (t < chartBlob[off + CHART_HEADER + mid * 3u]) { hi = mid; } else { lo = mid + 1u; }\n' +
  '    }\n\n' +
  '    k = lo;\n' +
  '    acc = chartBlob[off + CHART_HEADER + (n - 1u) * 3u];\n\n' +
  '    if (k < n) {\n' +
  '      upper = chartBlob[off + CHART_HEADER + k * 3u];\n' +
  '      lower = select(0.0, chartBlob[off + CHART_HEADER + (k - 1u) * 3u], k > 0u);\n' +
  '    }\n' +
  '  }\n';

const BAR =
  INDEX +
  '  {\n' +
  '    let hBox = max(2.0 * half.y * size, 1e-4);\n' +
  '    let barV = chartBlob[off + CHART_HEADER + k * 3u];\n' +
  '    let yf = 0.5 - p.y / hBox;\n\n' +
  '    mask = mask * (1.0 - smoothstep(barV - aaY / hBox, barV, yf));\n' +
  '  }\n';

// the point-series tails replace everything from the region search to the
// end of fsChart: their record is (x, y, rgba8 bit-cast) per point
const TAIL_FROM = '  // find the region at t:';
const TAIL_TO = '  return color * alpha;\n}';

const pointTail = (segments) =>
  '  let ext = half * size;\n' +
  '  let rad = max(ext.x, ext.y) * 0.05 + 0.75 / frame.zoomDpr;\n' +
  '  var best = 1e9;\n' +
  '  var bi = 0u;\n' +
  (segments
    ? '  var q0 = (vec2f(chartBlob[off + CHART_HEADER], chartBlob[off + CHART_HEADER + 1u]) * 2.0 - 1.0) * ext;\n' +
      '  for (var i = 1u; i < n; i = i + 1u) {\n' +
      '    let b = off + CHART_HEADER + i * 3u;\n' +
      '    let q1 = (vec2f(chartBlob[b], chartBlob[b + 1u]) * 2.0 - 1.0) * ext;\n' +
      '    let e = q1 - q0;\n' +
      '    let h = clamp(dot(p - q0, e) / max(dot(e, e), 1e-8), 0.0, 1.0);\n' +
      '    let d = length(p - q0 - e * h);\n\n' +
      '    if (d < best) { best = d; bi = i; }\n' +
      '    q0 = q1;\n' +
      '  }\n'
    : '  for (var i = 0u; i < n; i = i + 1u) {\n' +
      '    let b = off + CHART_HEADER + i * 3u;\n' +
      '    let q = (vec2f(chartBlob[b], chartBlob[b + 1u]) * 2.0 - 1.0) * ext;\n' +
      '    let d = length(p - q);\n\n' +
      '    if (d < best) { best = d; bi = i; }\n' +
      '  }\n') +
  '  let cover = 1.0 - smoothstep(rad - aaX, rad, best);\n' +
  '  let c = unpack4x8unorm(bitcast<u32>(chartBlob[off + CHART_HEADER + bi * 3u + 2u]));\n' +
  '  let alpha = clipA * mask * cover * opacities[slot] * c.a;\n\n' +
  '  if (alpha <= 0.004) { discard; }\n\n' +
  '  return vec4f(c.rgb * alpha, alpha);\n' +
  '}';

const tail = (src, body, what) => {
  const a = src.indexOf(TAIL_FROM);
  const b = src.indexOf(TAIL_TO);

  if (a < 0 || b < a || src.indexOf(TAIL_TO, b + 1) >= 0) {
    throw new Error(`variant ${what}: tail markers not found exactly once`);
  }

  return src.slice(0, a) + body + src.slice(b + TAIL_TO.length);
};

const header = (s) => swap(s, REF_PACKED, REF_HEADER, 'ref');

// the instanced point draw: its own small shader over the same record
const SCATTER_INST = `
${COMMON}

@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var<storage, read> positions: array<vec2f>;
@group(0) @binding(2) var<storage, read> sizes: array<vec2f>;
@group(0) @binding(3) var<storage, read> chartRefs: array<u32>;
@group(0) @binding(4) var<storage, read> chartBlob: array<f32>;
@group(1) @binding(0) var<storage, read> visible: array<u32>;

override PER_NODE: u32 = 16u;
const CHART_HEADER: u32 = ${CHART_HEADER}u;

struct PtOut {
  @builtin(position) position: vec4f,
  @location(0) local: vec2f,
  @location(1) @interpolate(flat) color: vec4f,
  @location(2) @interpolate(flat) rad: f32,
}

@vertex
fn vsPoint(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> PtOut {
  var out: PtOut;
  let slot = visible[ii / PER_NODE];
  let i = ii % PER_NODE;
  let off = chartRefs[slot] - 1u;
  let n = u32(chartBlob[off + 6u]);
  let size = chartBlob[off + 1u];
  let ext = sizes[slot] * 0.5 * size;
  let rad = max(ext.x, ext.y) * 0.05 + 0.75 / frame.zoomDpr;

  if (i >= n) {
    out.position = vec4f(2.0, 2.0, 0.0, 1.0);
    return out;
  }

  let b = off + CHART_HEADER + i * 3u;
  let q = (vec2f(chartBlob[b], chartBlob[b + 1u]) * 2.0 - 1.0) * ext;
  let corner = quadCorner(vi) * (rad + 1.0 / frame.zoomDpr);
  let px = modelToPx(frame, positions[slot] + q + corner);

  out.position = vec4f(pxToClip(frame, px), 0.0, 1.0);
  out.local = corner;
  out.color = unpack4x8unorm(bitcast<u32>(chartBlob[b + 2u]));
  out.rad = rad;

  return out;
}

@fragment
fn fsPoint(in: PtOut) -> @location(0) vec4f {
  let d = length(in.local);
  let aa = max(fwidth(d), 1e-4);
  let a = (1.0 - smoothstep(in.rad - aa, in.rad, d)) * in.color.a;

  if (a <= 0.004) { discard; }

  return vec4f(in.color.rgb * a, a);
}
`;

const VARIANTS = {
  'pie-packed': { wgsl: CHART_SHADER, kind: CHART_PIE, ref: 'packed' },
  'pie-walk': { wgsl: header(CHART_SHADER), kind: CHART_PIE },
  'stripes-walk': { wgsl: header(CHART_SHADER), kind: CHART_STRIPES },
  'pie-bsearch': {
    wgsl: swap(header(CHART_SHADER), LOOP, BSEARCH, 'pie-bsearch'),
    kind: CHART_PIE,
    cumulative: true,
  },
  'heat-index': {
    wgsl: swap(header(CHART_SHADER), LOOP, INDEX, 'heat-index'),
    kind: CHART_PIE,
  },
  'bar-index': {
    wgsl: swap(header(CHART_SHADER), LOOP, BAR, 'bar-index'),
    kind: CHART_STRIPES,
    horizontal: true,
  },
  'scatter-walk': {
    wgsl: tail(header(CHART_SHADER), pointTail(false), 'scatter-walk'),
    kind: CHART_STRIPES,
    points: true,
  },
  'line-walk': {
    wgsl: tail(header(CHART_SHADER), pointTail(true), 'line-walk'),
    kind: CHART_STRIPES,
    points: true,
  },
  'scatter-inst': { wgsl: SCATTER_INST, instanced: true, points: true },
};

const SCENES = [
  { key: 'fit-25k', nodes: 25000, px: 12 },
  { key: 'close-1k', nodes: 1000, px: 60 },
];

const COUNTS = quick ? [16, 64] : [1, 16, 64, 255, 1024, 4096];

// the shipped ref's bound: a 24-bit float offset into the pool
const POOL_FLOATS_MAX = 2 ** 24;

const MIME = { '.html': 'text/html', '.js': 'text/javascript' };
const server = createServer((req, res) => {
  const path = resolve(ROOT, '.' + new URL(req.url, 'http://x').pathname);

  try {
    const body = readFileSync(path);

    res.writeHead(200, {
      'content-type': MIME[extname(path)] ?? 'application/octet-stream',
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));

const browser = await chromium.launch({
  channel: 'chromium',
  headless: true,
  args: [
    '--enable-unsafe-webgpu',
    ...(process.platform === 'linux'
      ? ['--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan']
      : []),
  ],
});
const page = await browser.newPage();

page.on('pageerror', (e) => console.error('[page]', e.message));
await page.goto(
  `http://127.0.0.1:${server.address().port}/benchmark/chart-capacity.html`,
);

const adapter = await page.evaluate(() => window.capacity.init());

console.log(
  `adapter: ${adapter.vendor} ${adapter.architecture} ${adapter.description}` +
    ` · timestamp-query ${adapter.timestamps ? 'yes' : 'NO (wall time)'}` +
    ` · maxStorageBufferBindingSize ${adapter.maxBinding}`,
);

if (/swiftshader|llvmpipe|lavapipe/i.test(JSON.stringify(adapter))) {
  console.error('refusing a software adapter: run `npm run gpu`');
  process.exit(1);
}

const rows = [];
const shapeBits = (SHAPE_ELLIPSE << SHAPE_SHIFT) >>> 0;

console.log(
  '\nscene      variant        n      gpu ms (median)  covered  blob MiB',
);

for (const scene of SCENES) {
  for (const [name, v] of Object.entries(VARIANTS)) {
    if (only != null && name !== only) {
      continue;
    }

    for (const n of COUNTS) {
      const floats = scene.nodes * (CHART_HEADER + 3 * n);

      // a polyline needs two points
      if (name === 'line-walk' && n < 2) {
        continue;
      }

      // the shipped packing cannot express these: say so and skip
      if (v.ref === 'packed' && (n > 255 || floats > POOL_FLOATS_MAX)) {
        rows.push({ scene: scene.key, variant: name, n, skipped: 'packing' });
        console.log(
          `${scene.key.padEnd(10)} ${name.padEnd(14)} ${String(n).padStart(4)}` +
            `   (does not fit offset | n << 24: ${(floats / 1e6).toFixed(1)}M floats)`,
        );
        continue;
      }

      const r = await page.evaluate((a) => window.capacity.run(a), {
        wgsl: v.wgsl,
        instanced: v.instanced === true,
        points: v.points === true,
        kind: v.kind ?? 0,
        horizontal: v.horizontal === true,
        packed: v.ref === 'packed',
        cumulative: v.cumulative === true,
        n,
        nodes: scene.nodes,
        px: scene.px,
        shapeBits,
        header: CHART_HEADER,
      });

      if (r.error != null) {
        rows.push({ scene: scene.key, variant: name, n, error: r.error });
        console.log(
          `${scene.key.padEnd(10)} ${name.padEnd(14)} ${String(n).padStart(4)}   error: ${r.error}`,
        );
        continue;
      }

      // a single point covers little by design; a chart covers most of its box
      if (r.covered < (v.points ? 0.001 : 0.01)) {
        throw new Error(
          `${scene.key} ${name} n=${n}: covered ${r.covered} — the row drew nothing`,
        );
      }

      // an alternative search must draw exactly what the shipped walk
      // draws (the pixel hash; its broken-on-purpose control — k off by
      // one — was run once and fails here)
      const walk = rows.find(
        (w) => w.scene === scene.key && w.variant === 'pie-walk' && w.n === n,
      );

      if (name === 'pie-bsearch' && walk != null) {
        r.sameAsWalk = r.ink === walk.ink;

        if (!r.sameAsWalk) {
          throw new Error(
            `${scene.key} pie-bsearch n=${n}: draws different pixels from pie-walk`,
          );
        }
      }

      rows.push({ scene: scene.key, variant: name, n, ...r });
      console.log(
        `${scene.key.padEnd(10)} ${name.padEnd(14)} ${String(n).padStart(4)}` +
          `   ${r.ms.toFixed(3).padStart(10)}       ${(r.covered * 100).toFixed(0).padStart(3)}%` +
          `   ${(r.blobBytes / 2 ** 20).toFixed(1).padStart(7)}`,
      );
    }
  }
}

await browser.close();
server.close();

if (jsonOut != null) {
  writeFileSync(
    jsonOut,
    JSON.stringify({ adapter, date: new Date().toISOString(), rows }, null, 2),
  );
}
