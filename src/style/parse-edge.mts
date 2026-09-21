import { LINE_DASHED, LINE_DOTTED, LINE_SOLID } from '../contract.mjs';
import {
  CURVE_STYLE_BEZIER,
  CURVE_STYLE_HAYSTACK,
  CURVE_STYLE_ROUND_SEGMENTS,
  CURVE_STYLE_ROUND_TAXI,
  CURVE_STYLE_SEGMENTS,
  CURVE_STYLE_STRAIGHT,
  CURVE_STYLE_TAXI,
  CURVE_STYLE_TRIANGLE,
  CURVE_STYLE_UNBUNDLED,
} from '../store/curve-index.mjs';
import {
  EDGE_DIST_INTERSECTION,
  EDGE_DIST_NODE_POSITION,
  TAXI_AUTO,
  TAXI_DOWNWARD,
  TAXI_HORIZONTAL,
  TAXI_LEFTWARD,
  TAXI_RIGHTWARD,
  TAXI_UPWARD,
  TAXI_VERTICAL,
} from '../curve-geometry.mjs';
import {
  EDGE_DIST_ENDPOINTS,
  ENDPT_ANGLE,
  ENDPT_DEFAULT,
  ENDPT_INSIDE,
  ENDPT_LINE,
  ENDPT_PCT_X,
  ENDPT_PCT_Y,
  ENDPT_POINT,
} from '../curve-geometry.mjs';
import { PROP } from '../style-props.mjs';
import type { EndpointEnd, ArrowShape } from './defaults.mjs';
import { SHAPES, ARROW_ENUM, ARROW_NAMES } from './tables.mjs';
import { parseNumber } from './parse.mjs';

/** v3's size type: a non-negative number. */
export const parseNonNegative = (prop: string, value: unknown): number => {
  const num = parseNumber(prop, value);

  if (num < 0) {
    throw new Error(
      `The value '${String(value)}' for '${prop}' may not be negative`,
    );
  }

  return num;
};

/** A node shape name as its shape id. */
export const parseShape = (value: unknown): number => {
  const shape = SHAPES[String(value)];

  if (shape == null) {
    throw new Error(
      `The shape '${String(value)}' is unsupported in the GPU prototype; ` +
        `use one of: ${Object.keys(SHAPES).join(', ')}`,
    );
  }

  return shape;
};

export const LINE_STYLES: Record<string, number> = {
  solid: LINE_SOLID,
  dashed: LINE_DASHED,
  dotted: LINE_DOTTED,
};

/** Stored line-style id → resolved keyword. */
export const LINE_STYLE_NAMES: Record<number, string> = {
  [LINE_SOLID]: 'solid',
  [LINE_DASHED]: 'dashed',
  [LINE_DOTTED]: 'dotted',
};

/** The `line-style` keyword as its enum id. */
export const parseLineStyle = (value: unknown): number => {
  const style = LINE_STYLES[String(value)];

  if (style == null) {
    throw new Error(
      `The line-style '${String(value)}' is unsupported in the GPU prototype; ` +
        `use one of: ${Object.keys(LINE_STYLES).join(', ')}`,
    );
  }

  return style;
};

/*
text-rotation (round 27.7).  The stored value is the rotation in
**radians**, with `NaN` as the one sentinel, meaning `autorotate`.

That works because 'none' and a rotation of 0 radians are the same
rendering, so collapsing them costs nothing — and it leaves the whole
real line free for numeric values, where an enum id would have
collided (v3 accepts a bare number, and 1 radian is a perfectly
ordinary one).  Autorotate is the only mode that is not an angle at
all: it is resolved per frame from the edge's own slope.
*/
const AUTOROTATE = NaN;

/** A text rotation: `none`, `autorotate` (the NaN sentinel) or an angle in radians. */
export const parseTextRotation = (value: unknown): number => {
  if (value === 'none') {
    return 0;
  }
  if (value === 'autorotate') {
    return AUTOROTATE;
  }
  if (typeof value === 'number' && isFinite(value)) {
    return value;
  }

  throw new Error(
    `The text-rotation '${String(value)}' is unsupported in the GPU prototype; ` +
      `use 'none', 'autorotate', or a number of radians`,
  );
};

/** Stored rotation → the resolved value a getter reports. */
export const textRotationName = (rotation: number): string | number => {
  if (Number.isNaN(rotation)) {
    return 'autorotate';
  }

  return rotation === 0 ? 'none' : rotation;
};

/** curve-style keywords (12a: bezier; 12b: the unbundled families). */
export const CURVE_STYLES: Record<string, number> = {
  straight: CURVE_STYLE_STRAIGHT,
  bezier: CURVE_STYLE_BEZIER,
  'unbundled-bezier': CURVE_STYLE_UNBUNDLED,
  segments: CURVE_STYLE_SEGMENTS,
  'round-segments': CURVE_STYLE_ROUND_SEGMENTS,
  taxi: CURVE_STYLE_TAXI,
  'round-taxi': CURVE_STYLE_ROUND_TAXI,
  haystack: CURVE_STYLE_HAYSTACK,
  'straight-triangle': CURVE_STYLE_TRIANGLE,
};

export const CURVE_STYLE_NAMES: Record<number, string> = {
  [CURVE_STYLE_STRAIGHT]: 'straight',
  [CURVE_STYLE_BEZIER]: 'bezier',
  [CURVE_STYLE_UNBUNDLED]: 'unbundled-bezier',
  [CURVE_STYLE_SEGMENTS]: 'segments',
  [CURVE_STYLE_ROUND_SEGMENTS]: 'round-segments',
  [CURVE_STYLE_TAXI]: 'taxi',
  [CURVE_STYLE_ROUND_TAXI]: 'round-taxi',
  [CURVE_STYLE_HAYSTACK]: 'haystack',
  [CURVE_STYLE_TRIANGLE]: 'straight-triangle',
};

/** The `curve-style` keyword as its curve kind. */
export const parseCurveStyle = (value: unknown): number => {
  const style = CURVE_STYLES[String(value)];

  if (style == null) {
    throw new Error(
      `The curve-style '${String(value)}' is unsupported in the GPU prototype; ` +
        `use one of: ${Object.keys(CURVE_STYLES).join(', ')}`,
    );
  }

  return style;
};

/** v3's `numbers` type: a number, an array of numbers, or a
 * whitespace-separated string (as in string sheets). */
export const parseNumberList = (prop: string, value: unknown): number[] => {
  if (typeof value === 'number') {
    return [parseNumber(prop, value)];
  }

  const parts = Array.isArray(value)
    ? value
    : String(value).trim() === ''
      ? []
      : String(value).trim().split(/\s+/);

  return parts.map((part) => parseNumber(prop, part));
};

/**
 * shape-polygon-points (C3): flat unit pairs in [-1, 1], v3's
 * evenMultiple rule plus a >= 3 point floor (the SDF needs a real
 * polygon); capped at 32 points, a recorded cap.
 */
export const parsePolygonPoints = (prop: string, value: unknown): number[] => {
  const list = parseNumberList(prop, value);

  if (list.length % 2 !== 0 || list.length < 6) {
    throw new Error(
      `The ${prop} list must hold an even number of values (at least 3 x/y pairs)`,
    );
  }

  for (const v of list) {
    if (v < -1 || v > 1) {
      throw new Error(`The ${prop} value ${v} is outside [-1, 1]`);
    }
  }

  return list.length > 64 ? list.slice(0, 64) : list;
};

const RADIUS_TYPES: Record<string, number> = {
  'arc-radius': 1,
  'influence-radius': 0,
};

export const RADIUS_TYPE_NAMES: Record<number, string> = {
  1: 'arc-radius',
  0: 'influence-radius',
};

/** radius-type: one keyword or a per-point list (v3's multiple enum). */
export const parseRadiusTypes = (prop: string, value: unknown): number[] => {
  const parts = Array.isArray(value)
    ? value
    : String(value).trim().split(/\s+/);

  return parts.map((part) => {
    const id = RADIUS_TYPES[String(part)];

    if (id == null) {
      throw new Error(
        `The ${prop} '${String(part)}' is invalid; use one of: ` +
          Object.keys(RADIUS_TYPES).join(', '),
      );
    }

    return id;
  });
};

export const EDGE_DISTANCES: Record<string, number> = {
  intersection: EDGE_DIST_INTERSECTION,
  'node-position': EDGE_DIST_NODE_POSITION,
  endpoints: EDGE_DIST_ENDPOINTS,
};

export const EDGE_DISTANCE_NAMES: Record<number, string> = {
  [EDGE_DIST_INTERSECTION]: 'intersection',
  [EDGE_DIST_NODE_POSITION]: 'node-position',
  [EDGE_DIST_ENDPOINTS]: 'endpoints',
};

/** The `edge-distances` keyword as its enum id. */
export const parseEdgeDistances = (value: unknown): number => {
  const id = EDGE_DISTANCES[String(value)];

  if (id == null) {
    throw new Error(
      `The edge-distances '${String(value)}' is unsupported in the GPU prototype; ` +
        `use one of: ${Object.keys(EDGE_DISTANCES).join(', ')}`,
    );
  }

  return id;
};

const ENDPT_KEYWORDS: Record<string, number> = {
  'outside-to-node': ENDPT_DEFAULT,
  'inside-to-node': ENDPT_INSIDE,
  'outside-to-line': ENDPT_LINE,
};

const ENDPT_COMPONENT = /^(-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)(%|px)?$/;

/**
 * v3's edgeEndpoint forms: a keyword, a 2-component point ('%' or px
 * per component), or a single angle ('deg'/'rad' strings, or a plain
 * number in radians — v4's angle convention).  The '-or-label'
 * keywords need the label bounding box v4 doesn't have and throw (a
 * recorded deviation, deferred to the label-bb round).
 */
export const parseEndpoint = (prop: string, value: unknown): EndpointEnd => {
  if (typeof value === 'number' && isFinite(value)) {
    return { mode: ENDPT_ANGLE, a: value - Math.PI / 2, b: 0, pct: 0 };
  }

  const parts = Array.isArray(value)
    ? value
    : String(value).trim().split(/\s+/);

  if (parts.length === 1 && typeof parts[0] === 'string') {
    const token = parts[0].trim();
    const keyword = ENDPT_KEYWORDS[token];

    if (keyword != null) {
      return { mode: keyword, a: 0, b: 0, pct: 0 };
    }

    if (
      token === 'outside-to-node-or-label' ||
      token === 'outside-to-line-or-label'
    ) {
      throw new Error(
        `The ${prop} '${token}' is unsupported in the GPU prototype ` +
          `(label bounding boxes are not computed; use the non-label form)`,
      );
    }

    const angle = ANGLE_VALUE.exec(token);

    if (angle != null && angle[2] != null) {
      const num = parseFloat(angle[1]);
      const rad = angle[2] === 'deg' ? (num * Math.PI) / 180 : num;

      return { mode: ENDPT_ANGLE, a: rad - Math.PI / 2, b: 0, pct: 0 };
    }
  }

  if (
    parts.length === 1 &&
    typeof parts[0] === 'number' &&
    isFinite(parts[0])
  ) {
    return { mode: ENDPT_ANGLE, a: parts[0] - Math.PI / 2, b: 0, pct: 0 };
  }

  if (parts.length === 2) {
    let pct = 0;
    const comp = (raw: unknown, bit: number): number => {
      if (typeof raw === 'number' && isFinite(raw)) {
        return raw;
      }

      const m = ENDPT_COMPONENT.exec(String(raw).trim());

      if (m == null) {
        throw new Error(
          `The value '${String(raw)}' is not a valid ${prop} component`,
        );
      }

      const num = parseFloat(m[1]);

      if (m[2] === '%') {
        pct |= bit;

        return num / 100;
      }

      return num;
    };

    const a = comp(parts[0], ENDPT_PCT_X);
    const b = comp(parts[1], ENDPT_PCT_Y);

    return { mode: ENDPT_POINT, a, b, pct };
  }

  throw new Error(
    `The value '${String(value)}' is not a valid ${prop} ` +
      `(use a keyword, an 'x y' point with optional %/px units, or an angle)`,
  );
};

/** endpoint readback: the canonical string form (keywords, 'x y' with
 * % suffixes on pct components, or '<rad>rad' for angles). */
export const endpointString = (e: EndpointEnd): string => {
  switch (e.mode) {
    case ENDPT_INSIDE:
      return 'inside-to-node';
    case ENDPT_LINE:
      return 'outside-to-line';
    case ENDPT_POINT: {
      const x = e.pct % 2 === 1 ? `${e.a * 100}%` : `${e.a}`;
      const y = e.pct >= ENDPT_PCT_Y ? `${e.b * 100}%` : `${e.b}`;

      return `${x} ${y}`;
    }
    case ENDPT_ANGLE:
      return `${e.a + Math.PI / 2}rad`;
    default:
      return 'outside-to-node';
  }
};

export const TAXI_DIRECTIONS: Record<string, number> = {
  auto: TAXI_AUTO,
  vertical: TAXI_VERTICAL,
  horizontal: TAXI_HORIZONTAL,
  upward: TAXI_UPWARD,
  downward: TAXI_DOWNWARD,
  leftward: TAXI_LEFTWARD,
  rightward: TAXI_RIGHTWARD,
};

export const TAXI_DIRECTION_NAMES: Record<number, string> = {
  [TAXI_AUTO]: 'auto',
  [TAXI_VERTICAL]: 'vertical',
  [TAXI_HORIZONTAL]: 'horizontal',
  [TAXI_UPWARD]: 'upward',
  [TAXI_DOWNWARD]: 'downward',
  [TAXI_LEFTWARD]: 'leftward',
  [TAXI_RIGHTWARD]: 'rightward',
};

/** The `taxi-direction` keyword as its enum id. */
export const parseTaxiDirection = (value: unknown): number => {
  const id = TAXI_DIRECTIONS[String(value)];

  if (id == null) {
    throw new Error(
      `The taxi-direction '${String(value)}' is invalid; use one of: ` +
        Object.keys(TAXI_DIRECTIONS).join(', '),
    );
  }

  return id;
};

const TAXI_TURN_PERCENT = /^(-?(?:\d+\.?\d*|\.\d+))%$/;

/**
 * The number a `taxi-turn` mapper's `fallback: 'auto'` compiles to
 * (round 124): mapper outputs are numbers, so the keyword rides a
 * sentinel no px turn could mean, and the channel's setter reads it
 * back as the auto flag.
 */
export const TAXI_TURN_AUTO_SENTINEL = -1073741824; // -2^30

/** taxi-turn: a px number (may be negative = from the target side), a
 * percent string ('50%' stores the fraction, v3's pfValue), or `auto`
 * (round 124: the track pass assigns the turn; stored as the 50 %
 * default with the auto flag, so the readback and the fallback agree). */
export const parseTaxiTurn = (
  value: unknown,
): { value: number; percent: boolean; auto: boolean } => {
  if (typeof value === 'number') {
    return {
      value: parseNumber(PROP.TAXI_TURN, value),
      percent: false,
      auto: false,
    };
  }

  const text = String(value).trim();

  if (text === 'auto') {
    return { value: 0.5, percent: true, auto: true };
  }

  const match = TAXI_TURN_PERCENT.exec(text);

  if (match != null) {
    return { value: parseFloat(match[1]) / 100, percent: true, auto: false };
  }

  return {
    value: parseNumber(PROP.TAXI_TURN, value),
    percent: false,
    auto: false,
  };
};

export const TAXI_TRACKS: Record<string, number> = {
  source: 0,
  target: 1,
  family: 2,
};

export const TAXI_TRACK_NAMES: Record<number, string> = {
  0: 'source',
  1: 'target',
  2: 'family',
};

/** The `taxi-track` keyword as its enum id. */
export const parseTaxiTrack = (value: unknown): number => {
  const id = TAXI_TRACKS[String(value)];

  if (id == null) {
    throw new Error(
      `The taxi-track '${String(value)}' is invalid; use one of: ` +
        Object.keys(TAXI_TRACKS).join(', '),
    );
  }

  return id;
};

const ANGLE_VALUE = /^(-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)(deg|rad)?$/;

/** v3's angle type: plain numbers are radians; strings take deg/rad units. */
export const parseAngle = (prop: string, value: unknown): number => {
  if (typeof value === 'number' && isFinite(value)) {
    return value;
  }

  const m = ANGLE_VALUE.exec(String(value).trim());

  if (m == null) {
    throw new Error(
      `The value '${String(value)}' is not a valid angle for '${prop}' ` +
        `(use a number in radians, or a 'deg'/'rad' suffixed string)`,
    );
  }

  const num = parseFloat(m[1]);

  return m[2] === 'deg' ? (num * Math.PI) / 180 : num;
};

/** An arrow shape name as its `ArrowShape` id. */
export const parseArrowShape = (prop: string, value: unknown): ArrowShape => {
  const id = ARROW_ENUM[String(value)];

  if (id == null) {
    throw new Error(
      `The ${prop} '${String(value)}' is unsupported in the GPU prototype; ` +
        `use one of: ${Object.keys(ARROW_ENUM).join(', ')}`,
    );
  }

  return ARROW_NAMES[id];
};
