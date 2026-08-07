/*
Named color schemes and the OKLab color math for the mapper DSL.

Schemes are compact hex stop tables, not 256-entry LUTs: the sequential
families (viridis etc.) are perceptually near-uniform by construction, so
piecewise-linear interpolation in OKLab between the canonical samples is
visually indistinguishable from the full tables, endpoints are exact, and
the same stop tables serialize to the GPU as-is.  Continuous ranges
interpolate in OKLab by default (perceptually uniform; no hue drift
through gray like per-channel sRGB); `interpolate: 'srgb'` opts out.

The OKLab conversions are Björn Ottosson's reference matrices.  The
eval-direction (`oklabToSrgb`) rounds through Math.fround at each stage so
the CPU evaluator tracks the WGSL kernel's f32 arithmetic; the agreed
tolerance between CPU-read props and rendered pixels is ±1 per RGBA byte
(library pow/cbrt may differ by a couple of f32 ulps).  Keep the WGSL copy
of this math (render/mapper-shaders.mts) in sync with these constants.
*/

/** [L, a, b] in OKLab; L in [0, 1] for in-gamut sRGB. */
export type Oklab = [number, number, number];

export interface SchemeDef {
  kind: 'sequential' | 'diverging' | 'categorical';
  /** ordered hex stops; sequential/diverging interpolate, categorical index */
  stops: readonly string[];
}

/*
Sequential tables are the canonical 10-point samples of the matplotlib
maps; ColorBrewer ramps use their native class counts (9 sequential,
11 diverging).  Categorical palettes are indexed, never interpolated.
*/
export const SCHEMES: Record<string, SchemeDef> = {
  viridis: {
    kind: 'sequential',
    stops: [
      '#440154',
      '#482878',
      '#3e4a89',
      '#31688e',
      '#26828e',
      '#21918c',
      '#35b779',
      '#6ece58',
      '#b5de2b',
      '#fde725',
    ],
  },
  plasma: {
    kind: 'sequential',
    stops: [
      '#0d0887',
      '#47039f',
      '#7301a8',
      '#9c179e',
      '#bd3786',
      '#d8576b',
      '#ed7953',
      '#fa9e3b',
      '#fdc926',
      '#f0f921',
    ],
  },
  magma: {
    kind: 'sequential',
    stops: [
      '#000004',
      '#180f3e',
      '#451077',
      '#721f81',
      '#9f2f7f',
      '#cd4071',
      '#f1605d',
      '#fd9567',
      '#feca8d',
      '#fcfdbf',
    ],
  },
  inferno: {
    kind: 'sequential',
    stops: [
      '#000004',
      '#1b0c42',
      '#4b0c6b',
      '#781c6d',
      '#a52c60',
      '#cf4446',
      '#ed6925',
      '#fb9a06',
      '#f7d03c',
      '#fcffa4',
    ],
  },
  blues: {
    kind: 'sequential',
    stops: [
      '#f7fbff',
      '#deebf7',
      '#c6dbef',
      '#9ecae1',
      '#6baed6',
      '#4292c6',
      '#2171b5',
      '#08519c',
      '#08306b',
    ],
  },
  greens: {
    kind: 'sequential',
    stops: [
      '#f7fcf5',
      '#e5f5e0',
      '#c7e9c0',
      '#a1d99b',
      '#74c476',
      '#41ab5d',
      '#238b45',
      '#006d2c',
      '#00441b',
    ],
  },
  oranges: {
    kind: 'sequential',
    stops: [
      '#fff5eb',
      '#fee6ce',
      '#fdd0a2',
      '#fdae6b',
      '#fd8d3c',
      '#f16913',
      '#d94801',
      '#a63603',
      '#7f2704',
    ],
  },
  purples: {
    kind: 'sequential',
    stops: [
      '#fcfbfd',
      '#efedf5',
      '#dadaeb',
      '#bcbddc',
      '#9e9ac8',
      '#807dba',
      '#6a51a3',
      '#54278f',
      '#3f007d',
    ],
  },
  rdbu: {
    kind: 'diverging',
    stops: [
      '#67001f',
      '#b2182b',
      '#d6604d',
      '#f4a582',
      '#fddbc7',
      '#f7f7f7',
      '#d1e5f0',
      '#92c5de',
      '#4393c3',
      '#2166ac',
      '#053061',
    ],
  },
  brbg: {
    kind: 'diverging',
    stops: [
      '#543005',
      '#8c510a',
      '#bf812d',
      '#dfc27d',
      '#f6e8c3',
      '#f5f5f5',
      '#c7eae5',
      '#80cdc1',
      '#35978f',
      '#01665e',
      '#003c30',
    ],
  },
  rdylgn: {
    kind: 'diverging',
    stops: [
      '#a50026',
      '#d73027',
      '#f46d43',
      '#fdae61',
      '#fee08b',
      '#ffffbf',
      '#d9ef8b',
      '#a6d96a',
      '#66bd63',
      '#1a9850',
      '#006837',
    ],
  },
  category10: {
    kind: 'categorical',
    stops: [
      '#1f77b4',
      '#ff7f0e',
      '#2ca02c',
      '#d62728',
      '#9467bd',
      '#8c564b',
      '#e377c2',
      '#7f7f7f',
      '#bcbd22',
      '#17becf',
    ],
  },
  dark2: {
    kind: 'categorical',
    stops: [
      '#1b9e77',
      '#d95f02',
      '#7570b3',
      '#e7298a',
      '#66a61e',
      '#e6ab02',
      '#a6761d',
      '#666666',
    ],
  },
};

/** Scheme by (case-insensitive) name; throws listing the known names. */
export const resolveScheme = (name: string): SchemeDef => {
  const scheme = SCHEMES[name.toLowerCase()];

  if (scheme == null) {
    throw new Error(
      `Unknown color scheme '${name}'; ` +
        `supported schemes: ${Object.keys(SCHEMES).join(', ')}`,
    );
  }

  return scheme;
};

/** '#rrggbb' → [r, g, b] bytes (scheme tables only; user colors go through the style parser). */
export const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);

  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
};

const fr = Math.fround;

/** sRGB transfer: byte channel → linear-light. */
const srgbToLinear = (byte: number): number => {
  const c = byte / 255;

  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

/** Linear-light → sRGB byte, clamped (the cheap gamut clip). */
const linearToByte = (c: number): number => {
  const nonlin =
    c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

  return Math.round(Math.min(1, Math.max(0, nonlin)) * 255);
};

/** sRGB bytes → OKLab (compile-time direction; double precision is fine). */
export const srgbToOklab = (r: number, g: number, b: number): Oklab => {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const l = Math.cbrt(
    0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb,
  );
  const m = Math.cbrt(
    0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb,
  );
  const s = Math.cbrt(
    0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb,
  );

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};

/**
 * OKLab → sRGB bytes (the eval direction — fround-staged for WGSL parity;
 * out-of-gamut results clamp per linear channel).
 */
export const oklabToSrgb = (
  L: number,
  a: number,
  b: number,
): [number, number, number] => {
  const l_ = fr(L + 0.3963377774 * a + 0.2158037573 * b);
  const m_ = fr(L - 0.1055613458 * a - 0.0638541728 * b);
  const s_ = fr(L - 0.0894841775 * a - 1.291485548 * b);

  const l = fr(l_ * l_ * l_);
  const m = fr(m_ * m_ * m_);
  const s = fr(s_ * s_ * s_);

  return [
    linearToByte(fr(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    linearToByte(fr(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    linearToByte(fr(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
  ];
};
