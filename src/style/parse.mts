import { color2tuple } from '../util/colors.mjs';
import { CHART_NONE, CHART_PIE, CHART_STRIPES } from '../contract.mjs';
import { SCHEMES, resolveScheme, hexToRgb } from '../style-schemes.mjs';
import type { BgLen, BgSize } from '../store/graph-store.mjs';
import type { RGBA } from './defaults.mjs';
import { parseNonNegative } from './parse-edge.mjs';

/** A colour value as an `RGBA` byte tuple; throws on an unparsable colour. */
export const parseColor = (prop: string, value: unknown): RGBA => {
  const tuple = color2tuple(value as string);

  if (tuple == null) {
    throw new Error(
      `The value '${String(value)}' is not a valid colour for '${prop}'`,
    );
  }

  const [r, g, b, a] = tuple;

  return [r, g, b, Math.round((a ?? 1) * 255)];
};

/** A finite number; throws on anything else. */
export const parseNumber = (prop: string, value: unknown): number => {
  const num = typeof value === 'number' ? value : parseFloat(String(value));

  if (!isFinite(num)) {
    throw new Error(
      `The value '${String(value)}' is not a valid number for '${prop}'`,
    );
  }

  return num;
};

/** v3's zeroOneNumber type. */
export const parseZeroOne = (prop: string, value: unknown): number => {
  const num = parseNumber(prop, value);

  if (num < 0 || num > 1) {
    throw new Error(`The ${prop} '${String(value)}' must be within [0, 1]`);
  }

  return num;
};

/** overlay/underlay shape: v3's overlayShape enum. */
export const parseLayerShape = (prop: string, value: unknown): number => {
  const token = String(value).trim();

  if (token === 'round-rectangle') {
    return 0;
  }
  if (token === 'ellipse') {
    return 1;
  }

  throw new Error(
    `The ${prop} '${String(value)}' is invalid; use round-rectangle or ellipse`,
  );
};

/** overlay/underlay corner radius: a non-negative number or 'auto'. */
export const parseLayerRadius = (prop: string, value: unknown): number => {
  if (String(value).trim() === 'auto') {
    return -1;
  }

  return parseNonNegative(prop, value);
};

export const TEXT_TRANSFORMS: Record<string, number> = {
  none: 0,
  uppercase: 1,
  lowercase: 2,
};
// the wrap family (round 16.2) — v3's keyword sets
export const TEXT_WRAPS: Record<string, number> = {
  none: 0,
  wrap: 1,
  ellipsis: 2,
};
export const TEXT_WRAP_NAMES = ['none', 'wrap', 'ellipsis'];
export const OFLOW_WRAPS: Record<string, number> = {
  whitespace: 0,
  anywhere: 1,
};
export const OFLOW_WRAP_NAMES = ['whitespace', 'anywhere'];
export const JUSTIFICATIONS: Record<string, number> = {
  auto: -1,
  left: 0,
  center: 1,
  right: 2,
};
export const JUSTIFICATION_NAMES: Record<number, string> = {
  [-1]: 'auto',
  0: 'left',
  1: 'center',
  2: 'right',
};

/** A keyword parser over an enum `table`, curried on the prop name for its error. */
export const parseKeyword =
  (prop: string, table: Record<string, number>) =>
  (value: unknown): number => {
    const id = table[String(value)];

    if (id == null) {
      throw new Error(
        `The ${prop} '${String(value)}' is unsupported; use one of: ${Object.keys(table).join(', ')}`,
      );
    }

    return id;
  };
export const TEXT_TRANSFORM_NAMES: Record<number, string> = {
  0: 'none',
  1: 'uppercase',
  2: 'lowercase',
};

/** The `text-transform` keyword as its enum id. */
export const parseTextTransform = (value: unknown): number => {
  const id = TEXT_TRANSFORMS[String(value)];

  if (id == null) {
    throw new Error(
      `The text-transform '${String(value)}' is invalid; use one of: none, uppercase, lowercase`,
    );
  }

  return id;
};

export const TEXT_BG_SHAPES: Record<string, number> = {
  rectangle: 0,
  'round-rectangle': 1,
};
export const TEXT_BG_SHAPE_NAMES: Record<number, string> = {
  0: 'rectangle',
  1: 'round-rectangle',
};

/** The `text-background-shape` keyword as its enum id. */
export const parseTextBgShape = (value: unknown): number => {
  const id = TEXT_BG_SHAPES[String(value)];

  if (id == null) {
    throw new Error(
      `The text-background-shape '${String(value)}' is invalid; use rectangle or round-rectangle`,
    );
  }

  return id;
};

export const ARROW_FILLS: Record<string, number> = { filled: 0, hollow: 1 };
export const ARROW_FILL_NAMES: Record<number, string> = {
  0: 'filled',
  1: 'hollow',
};

/** The arrow-fill keyword as its enum id. */
export const parseArrowFill = (value: unknown): number => {
  const id = ARROW_FILLS[String(value)];

  if (id == null) {
    throw new Error(
      `The arrow-fill '${String(value)}' is unsupported in the GPU prototype; use filled or hollow`,
    );
  }

  return id;
};

const ARROW_WIDTH_PERCENT = /^(-?(?:\d+\.?\d*|\.\d+))%$/;

/** v3's arrowWidth: a px number, 'match-line', or a percent of the
 * edge width — resolved against the width at style-write. */
export const parseArrowWidth = (
  prop: string,
  value: unknown,
): number | 'match-line' | { percent: number } => {
  if (String(value).trim() === 'match-line') {
    return 'match-line';
  }

  const pct = ARROW_WIDTH_PERCENT.exec(String(value).trim());

  if (pct != null) {
    return { percent: parseFloat(pct[1]) / 100 };
  }

  return parseNonNegative(prop, value);
};

export const LINE_CAPS: Record<string, number> = {
  butt: 0,
  round: 1,
  square: 2,
};
export const LINE_CAP_NAMES: Record<number, string> = {
  0: 'butt',
  1: 'round',
  2: 'square',
};

/** The `line-cap` keyword as its enum id. */
export const parseLineCap = (value: unknown): number => {
  const id = LINE_CAPS[String(value)];

  if (id == null) {
    throw new Error(
      `The line-cap '${String(value)}' is invalid; use one of: butt, round, square`,
    );
  }

  return id;
};

/**
 * Normalize a dash pattern to two on/off pairs (B3): odd patterns
 * double (canvas semantics), a single pair repeats, and longer
 * patterns truncate to the first two pairs — a recorded cap.
 */
export const normalizeDashPattern = (
  list: number[],
  empty: number[] = [6, 3, 6, 3],
): number[] => {
  if (list.length === 0) {
    return empty;
  }

  for (const v of list) {
    if (v < 0) {
      throw new Error('dash-pattern entries may not be negative');
    }
  }

  const doubled = list.length % 2 === 1 ? [...list, ...list] : list;
  const pairs =
    doubled.length >= 4
      ? doubled.slice(0, 4)
      : [...doubled, ...doubled].slice(0, 4);

  return pairs;
};

export const FILL_KINDS: Record<string, number> = {
  solid: 0,
  'linear-gradient': 1,
  'radial-gradient': 2,
};
export const FILL_KIND_NAMES: Record<number, string> = {
  0: 'solid',
  1: 'linear-gradient',
  2: 'radial-gradient',
};

/** The `background-fill` keyword as its enum id. */
export const parseFill = (prop: string, value: unknown): number => {
  const id = FILL_KINDS[String(value)];

  if (id == null) {
    throw new Error(
      `The ${prop} '${String(value)}' is invalid; use solid, linear-gradient or radial-gradient`,
    );
  }

  return id;
};

export const GRADIENT_DIRECTIONS: Record<string, number> = {
  'to-bottom': 0,
  'to-top': 1,
  'to-left': 2,
  'to-right': 3,
  'to-bottom-right': 4,
  'to-bottom-left': 5,
  'to-top-right': 6,
  'to-top-left': 7,
};
export const GRADIENT_DIRECTION_NAMES: Record<number, string> = {
  0: 'to-bottom',
  1: 'to-top',
  2: 'to-left',
  3: 'to-right',
  4: 'to-bottom-right',
  5: 'to-bottom-left',
  6: 'to-top-right',
  7: 'to-top-left',
};

/** The gradient-direction keyword as its enum id. */
export const parseGradientDirection = (value: unknown): number => {
  const id = GRADIENT_DIRECTIONS[String(value)];

  if (id == null) {
    throw new Error(
      `The background-gradient-direction '${String(value)}' is invalid; ` +
        `use one of: ${Object.keys(GRADIENT_DIRECTIONS).join(', ')}`,
    );
  }

  return id;
};

/** gradient stop colors: an array or whitespace-separated string (C2). */
export const parseColorList = (prop: string, value: unknown): RGBA[] => {
  const parts = Array.isArray(value)
    ? value
    : String(value).trim().split(/\s+/);

  return parts.map((part) => parseColor(prop, part));
};

/** gradient stop positions: percents (numbers or 'N%' strings) → fractions. */
export const parsePercentList = (prop: string, value: unknown): number[] => {
  const parts = Array.isArray(value)
    ? value
    : String(value).trim().split(/\s+/);

  return parts.map((part) => {
    const num = typeof part === 'number' ? part : parseFloat(String(part));

    if (!isFinite(num)) {
      throw new Error(
        `The value '${String(part)}' is not a valid percent for '${prop}'`,
      );
    }

    return Math.max(0, Math.min(1, num / 100));
  });
};

/** text-halign/-valign (round 13 D3): v3's 3x3 node-label grid. */
// background images (round 15.2) — v3's keyword sets verbatim
export const BG_FITS: Record<string, number> = {
  none: 0,
  contain: 1,
  cover: 2,
};
export const BG_FIT_NAMES = ['none', 'contain', 'cover'];
export const BG_REPEATS: Record<string, number> = {
  'no-repeat': 0,
  'repeat-x': 1,
  'repeat-y': 2,
  repeat: 3,
};
export const BG_REPEAT_NAMES = ['no-repeat', 'repeat-x', 'repeat-y', 'repeat'];
export const BG_CLIPS: Record<string, number> = { none: 0, node: 1 };
export const BG_CLIP_NAMES = ['none', 'node'];
export const BG_CONTAINMENTS: Record<string, number> = { inside: 0, over: 1 };
export const BG_CONTAINMENT_NAMES = ['inside', 'over'];
export const IMAGE_TYPES: Record<string, number> = { auto: 0, 'sdf-icon': 1 };
export const IMAGE_TYPE_NAMES = ['auto', 'sdf-icon'];
export const BG_CROSSORIGINS = new Set([
  'anonymous',
  'use-credentials',
  'null',
]);

const BG_PCT = /^\s*(-?(?:\d+\.?\d*|\.\d+))\s*%\s*$/;
const BG_PX = /^\s*(-?(?:\d+\.?\d*|\.\d+))\s*px\s*$/;

/** Parse one prop value as a per-image list: arrays distribute per
 * image (index i reads entry min(i, len-1)); scalars apply to all. */
export const parseImageList = <T,>(
  prop: string,
  value: unknown,
  one: (v: unknown) => T,
): T[] => {
  const list = Array.isArray(value) ? value : [value];

  if (list.length === 0) {
    throw new Error(`The ${prop} list must not be empty`);
  }

  return list.map(one);
};

/** An image-prop keyword parser over an enum `table`, curried on the prop name. */
export const parseImageEnum =
  (prop: string, table: Record<string, number>) =>
  (v: unknown): number => {
    const id = table[String(v)];

    if (id == null) {
      throw new Error(
        `The ${prop} '${String(v)}' is unsupported; use one of: ${Object.keys(table).join(', ')}`,
      );
    }

    return id;
  };

/** %/px length ('N%' | 'Npx' | number) → { v, pct } */
export const parseBgLen =
  (prop: string) =>
  (v: unknown): BgLen => {
    if (typeof v === 'number' && Number.isFinite(v)) {
      return { v, pct: false };
    }

    const s = String(v);
    const pct = BG_PCT.exec(s);

    if (pct != null) {
      return { v: Number(pct[1]), pct: true };
    }

    const px = BG_PX.exec(s);

    if (px != null) {
      return { v: Number(px[1]), pct: false };
    }

    throw new Error(
      `The ${prop} '${s}' must be a number of px or an 'N%' string`,
    );
  };

/** 'auto' | %/px length → { mode: 0 auto | 1 px | 2 pct, v } */
export const parseBgSize =
  (prop: string) =>
  (v: unknown): BgSize => {
    if (v === 'auto') {
      return { mode: 0, v: 0 };
    }

    const len = parseBgLen(prop)(v);

    if (len.v < 0) {
      throw new Error(`The ${prop} '${String(v)}' must be non-negative`);
    }

    return { mode: len.pct ? 2 : 1, v: len.v };
  };

/** url list: 'none' → [], strings strip an optional url(...) wrapper */
export const parseUrls = (prop: string, value: unknown): string[] => {
  if (value === 'none' || value == null) {
    return [];
  }

  const list = Array.isArray(value) ? value : [value];
  const urls: string[] = [];

  for (const v of list) {
    const s = String(v).trim();

    if (s === 'none' || s === '') {
      continue;
    }

    const wrapped = /^url\s*\(\s*['"]?(.*?)['"]?\s*\)$/.exec(s);

    urls.push(wrapped != null ? wrapped[1] : s);
  }

  return urls;
};

export const HALIGNS: Record<string, number> = { left: 0, center: 1, right: 2 };
export const VALIGNS: Record<string, number> = { top: 0, center: 1, bottom: 2 };
export const HALIGN_NAMES = ['left', 'center', 'right'];
export const VALIGN_NAMES = ['top', 'center', 'bottom'];

/** A text-alignment keyword as its enum id, against the given axis `table`. */
export const parseAlign = (
  prop: string,
  value: unknown,
  table: Record<string, number>,
): number => {
  const id = table[String(value)];

  if (id == null) {
    throw new Error(
      `The ${prop} '${String(value)}' is invalid; use one of: ${Object.keys(table).join(', ')}`,
    );
  }

  return id;
};

export const BORDER_POSITIONS: Record<string, number> = {
  center: 0,
  inside: 1,
  outside: 2,
};
export const BORDER_POSITION_NAMES: Record<number, string> = {
  0: 'center',
  1: 'inside',
  2: 'outside',
};

/** The `border-position` keyword as its enum id. */
export const parseBorderPosition = (value: unknown): number => {
  const id = BORDER_POSITIONS[String(value)];

  if (id == null) {
    throw new Error(
      `The border-position '${String(value)}' is invalid; use one of: center, inside, outside`,
    );
  }

  return id;
};

// -- border-style / outline-style (round 38) --

export const STROKE_STYLES: Record<string, number> = {
  solid: 0,
  dashed: 1,
  dotted: 2,
  double: 3,
};
export const STROKE_STYLE_NAMES: Record<number, string> = {
  0: 'solid',
  1: 'dashed',
  2: 'dotted',
  3: 'double',
};

/** A border/outline stroke-style keyword as its enum id. */
export const parseStrokeStyle = (prop: string, value: unknown): number => {
  const id = STROKE_STYLES[String(value)];

  if (id == null) {
    throw new Error(
      `The ${prop} '${String(value)}' is invalid; ` +
        `use one of: ${Object.keys(STROKE_STYLES).join(', ')}`,
    );
  }

  return id;
};

/** Resolve gradient stops (C2): even spread when positions are unset,
 * clamped monotone otherwise; the channel opacity folds into each
 * stop's alpha; capped at 5 stops (a recorded cap). */
export const gradientStops = (
  colors: RGBA[],
  positions: number[] | null,
  opacity: number,
): { rgba: number; pos: number }[] => {
  const n = Math.min(colors.length, 5);
  const out: { rgba: number; pos: number }[] = [];
  let last = 0;

  for (let i = 0; i < n; i++) {
    const [r, g, b, a] = colors[i];
    let pos =
      positions != null && positions[i] != null
        ? positions[i]
        : n === 1
          ? 0
          : i / (n - 1);

    if (pos < last) {
      pos = last;
    } // canvas: stops never decrease

    last = pos;
    out.push({
      rgba: ((Math.round(a * opacity) << 24) | (b << 16) | (g << 8) | r) >>> 0,
      pos,
    });
  }

  return out;
};

/** v3's bool type: 'yes'/'no' keywords (booleans accepted too). */
export const parseChartKind = (prop: string, value: unknown): number => {
  if (value === 'none') {
    return CHART_NONE;
  }
  if (value === 'pie') {
    return CHART_PIE;
  }
  if (value === 'stripes') {
    return CHART_STRIPES;
  }

  throw new Error(
    `The chart kind '${String(value)}' must be 'none', 'pie' or 'stripes'`,
  );
};

/** A number list (array or space-separated string) of finite fractions >= 0. */
export const parseChartValues = (prop: string, value: unknown): number[] => {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.trim().split(/\s+/)
      : null;

  if (raw == null || raw.length === 0) {
    throw new Error(`The ${prop} '${String(value)}' must be a number list`);
  }

  return raw.map((v) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v));

    if (!isFinite(n) || n < 0) {
      throw new Error(
        `The ${prop} entry '${String(v)}' must be a non-negative number`,
      );
    }

    return n;
  });
};

/** A palette: a named scheme, or a color list (array or space-separated). */
export const parseChartColors = (prop: string, value: unknown): RGBA[] => {
  if (
    typeof value === 'string' &&
    SCHEMES[value.trim().toLowerCase()] != null
  ) {
    // a named scheme (scheme names never collide with CSS color names)
    return resolveScheme(value).stops.map(
      (hex) => [...hexToRgb(hex), 255] as RGBA,
    );
  }

  if (
    typeof value === 'string' &&
    !/\s/.test(value.trim()) &&
    !value.startsWith('#') &&
    !value.startsWith('rgb')
  ) {
    // a bare single word that is neither a scheme nor obviously a color:
    // let resolveScheme throw its scheme-list error unless the color
    // parser accepts it (e.g. 'red')
    try {
      return [parseColor(prop, value)];
    } catch {
      return resolveScheme(value).stops.map(
        (hex) => [...hexToRgb(hex), 255] as RGBA,
      );
    }
  }

  const list = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.trim().split(/\s+/)
      : null;

  if (list == null || list.length === 0) {
    throw new Error(
      `The ${prop} '${String(value)}' must be a color list or scheme name`,
    );
  }

  return list.map((v) => parseColor(prop, v));
};

/** A fraction in [0, 1], as a number or an 'N%' string. */
export const parseChartFraction = (prop: string, value: unknown): number => {
  const n =
    typeof value === 'string' && value.trim().endsWith('%')
      ? parseFloat(value) / 100
      : typeof value === 'number'
        ? value
        : NaN;

  if (!isFinite(n) || n < 0 || n > 1) {
    throw new Error(
      `The ${prop} '${String(value)}' must be a fraction in [0, 1] (or 'N%')`,
    );
  }

  return n;
};

/** A `yes`/`no` (or boolean) value as a boolean. */
export const parseYesNo = (prop: string, value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  const token = String(value).trim();

  if (token === 'yes') {
    return true;
  }
  if (token === 'no') {
    return false;
  }

  throw new Error(
    `The value '${String(value)}' is not a valid ${prop} (use 'yes' or 'no')`,
  );
};
