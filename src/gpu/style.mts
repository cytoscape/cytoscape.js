import { color2tuple } from '../util/colors.mjs';
import {
  ARROW_CHEVRON, ARROW_CIRCLE, ARROW_DIAMOND, ARROW_NONE, ARROW_SQUARE,
  ARROW_TEE, ARROW_TRIANGLE, ARROW_VEE,
  LINE_DASHED, LINE_DOTTED, LINE_SOLID,
  SHAPE_CIRCLE, SHAPE_DIAMOND, SHAPE_ELLIPSE, SHAPE_HEPTAGON, SHAPE_HEXAGON,
  SHAPE_OCTAGON, SHAPE_PENTAGON, SHAPE_RECTANGLE, SHAPE_RHOMBOID,
  SHAPE_ROUND_RECTANGLE, SHAPE_STAR, SHAPE_TAG, SHAPE_TRIANGLE, SHAPE_VEE
} from './contract.mjs';
import {
  compileMapper, bindEvaluator, isMapperSpec, autoExtentFor, applyAutoExtent
} from './style-scales.mjs';
import {
  CURVE_DEFAULTS, CURVE_EXTRA_DEFAULTS, CURVE_STYLE_BEZIER, CURVE_STYLE_HAYSTACK,
  CURVE_STYLE_ROUND_SEGMENTS, CURVE_STYLE_ROUND_TAXI, CURVE_STYLE_SEGMENTS,
  CURVE_STYLE_STRAIGHT, CURVE_STYLE_TAXI, CURVE_STYLE_TRIANGLE, CURVE_STYLE_UNBUNDLED,
  isBlobStyle
} from './store/curve-index.mjs';
import type { CurveStyleExtras, EndpointSpec } from './store/curve-index.mjs';
import {
  EDGE_DIST_INTERSECTION, EDGE_DIST_NODE_POSITION,
  TAXI_AUTO, TAXI_DOWNWARD, TAXI_HORIZONTAL, TAXI_LEFTWARD, TAXI_RIGHTWARD, TAXI_UPWARD,
  TAXI_VERTICAL
} from './curve-geometry.mjs';
import {
  EDGE_DIST_ENDPOINTS, ENDPT_ANGLE, ENDPT_DEFAULT, ENDPT_INSIDE, ENDPT_LINE, ENDPT_PCT_X,
  ENDPT_PCT_Y, ENDPT_POINT
} from './curve-geometry.mjs';

/** One styled end of source/target-endpoint (12c): the parsed form of
 * v3's edgeEndpoint type.  Angles store the *effective* radians (the
 * 12-o'clock start already applied); point pct components store the
 * fraction (v3's pfValue). */
interface EndpointEnd {
  mode: number;
  a: number;
  b: number;
  pct: number;
}

const ENDPT_END_DEFAULT: EndpointEnd = { mode: ENDPT_DEFAULT, a: 0, b: 0, pct: 0 };

import type { CompiledMapper, ChannelKind, Evaluated, ValueReader } from './style-scales.mjs';
import type { GroupName, Ref } from './contract.mjs';
import type { GraphStore } from './store/graph-store.mjs';
import type { GpuStyleProps, GpuStylesheet, GpuMapper, GpuMapperSpec } from './gpu-types.mjs';

/*
StyleEngine: the v4 stylesheet is `{ nodes, edges }` — no selectors, no
style functions.  Each key is a props object whose values are constants
or mapper objects; all per-element variation is declarative (style-
scales.mts: `data(key)` scales and `case` conditionals), so every value
is analyzable, serializable, and GPU-evaluable.  Prop names are kebab-
case or camelCase; `label` additionally takes the legacy `data(key)`
string, which normalizes to the `{ data: key }` passthrough.

Every mapper is cheaply CPU-evaluable — that invariant keeps `ele.style()`
synchronous, keeps headless mode and Node tests working (the same IR runs
on CPU, GPU, and in tests), and keeps determinism.  GPU evaluation is an
optimization layered over the CPU-evaluable IR, never a source of values
the CPU can't reproduce.

Refresh: constant props and declarative mappers stay fresh automatically —
a data() write re-derives the mapped channels of exactly the written
slots, gated per group on the mapped keys, and a change in a live
auto-domain extent re-derives the whole channel.  A select never restyles
(the `:selected` accent ring is drawn by the shader).

Defaults ≈ v3: gray 30×30 ellipse nodes, 2px gray lines.
*/

type RGBA = [ number, number, number, number ];

/** Resolved channel values for one element, before writing to columns. */
interface NodeComputed {
  fillColor: RGBA;
  borderColor: RGBA;
  width: number;
  height: number;
  shape: number;
  opacity: number;
  borderWidth: number;
  /** literal label text ('' for none) when labelKey is null */
  label: string;
  /** `data(key)` mapper key ('id' reads the first-class id) */
  labelKey: string | null;
  fontSize: number;
  textColor: RGBA;
  /** effectively global: one font per glyph atlas (keyed by character) */
  fontFamily: string;
  textOutlineWidth: number;
  textOutlineColor: RGBA;
  textOutlineOpacity: number;
  textBgColor: RGBA;
  textBgOpacity: number;
  textBgPadding: number;
  textMarginX: number;
  textMarginY: number;
  // ghost props (round 13 A1): the body duplicated at the offset
  ghost: boolean;
  ghostOffsetX: number;
  ghostOffsetY: number;
  ghostOpacity: number;
}

interface EdgeComputed {
  lineColor: RGBA;
  width: number;
  opacity: number;
  /** 0 solid, 1 dashed, 2 dotted (contract LINE_* ids) */
  lineStyle: number;
  sourceArrowShape: ArrowShape;
  sourceArrowColor: RGBA;
  targetArrowShape: ArrowShape;
  targetArrowColor: RGBA;
  // edge labels (round 10): anchored at the edge midpoint on-GPU
  label: string;
  labelKey: string | null;
  fontSize: number;
  textColor: RGBA;
  textOutlineWidth: number;
  textOutlineColor: RGBA;
  textOutlineOpacity: number;
  textBgColor: RGBA;
  textBgOpacity: number;
  textBgPadding: number;
  textMarginX: number;
  textMarginY: number;
  /** 0 none (horizontal), 1 autorotate (TEXT_ROTATIONS ids; edges only) */
  textRotation: number;
  // curved edges (round 12a): the styled record the CurveIndex derives
  // edge.curveParams from (CURVE_STYLE_* ids; angles in radians)
  curveStyle: number;
  controlPointStepSize: number;
  controlPointWeight: number;
  loopDirection: number;
  loopSweep: number;
  // the 12b families (lists are parse-owned copies, treated read-only)
  controlPointDistances: number[] | null;
  controlPointWeights: number[];
  segmentDistances: number[];
  segmentWeights: number[];
  segmentRadii: number[];
  /** radius-type per point: 1 = arc-radius, 0 = influence-radius */
  radiusTypes: number[];
  /** EDGE_DIST_* id */
  edgeDistances: number;
  taxiDirection: number;
  // 12c curve props
  haystackRadius: number;
  sourceEndpoint: EndpointEnd;
  targetEndpoint: EndpointEnd;
  sourceDistanceFromNode: number;
  targetDistanceFromNode: number;
  /** percent turns store the fraction (v3 pfValue); px turns the px */
  taxiTurn: number;
  taxiTurnPercent: boolean;
  taxiTurnMinDistance: number;
  taxiRadius: number;
}

type Computed = NodeComputed & EdgeComputed;

type ArrowShape = 'none' | 'triangle' | 'vee' | 'chevron' | 'circle' | 'square' | 'diamond' | 'tee';

const NODE_DEFAULTS: NodeComputed = {
  fillColor: [ 153, 153, 153, 255 ], // #999
  borderColor: [ 0, 0, 0, 255 ],
  width: 30,
  height: 30,
  shape: SHAPE_ELLIPSE,
  opacity: 1,
  borderWidth: 0,
  label: '', // no label
  labelKey: null,
  fontSize: 16,
  textColor: [ 0, 0, 0, 255 ],
  fontFamily: 'sans-serif',
  textOutlineWidth: 0,
  textOutlineColor: [ 0, 0, 0, 255 ],
  textOutlineOpacity: 1,
  textBgColor: [ 0, 0, 0, 255 ],
  textBgOpacity: 0, // background off by default, as v3
  textBgPadding: 0,
  textMarginX: 0,
  textMarginY: 0,
  ghost: false,
  ghostOffsetX: 0,
  ghostOffsetY: 0,
  ghostOpacity: 0 // v3's default: a ghost is invisible until given opacity
};

/** gap between the node's bottom edge and the label's top, model px */
const LABEL_MARGIN = 4;

const DATA_MAPPER = /^\s*data\s*\(\s*([\w-]+)\s*\)\s*$/;

const EDGE_DEFAULTS: EdgeComputed = {
  lineColor: [ 153, 153, 153, 255 ], // #999
  width: 2,
  opacity: 1,
  lineStyle: LINE_SOLID,
  sourceArrowShape: 'none',
  sourceArrowColor: [ 153, 153, 153, 255 ], // #999, as v3
  targetArrowShape: 'none',
  targetArrowColor: [ 153, 153, 153, 255 ],
  label: '',
  labelKey: null,
  fontSize: 16,
  textColor: [ 0, 0, 0, 255 ],
  textOutlineWidth: 0,
  textOutlineColor: [ 0, 0, 0, 255 ],
  textOutlineOpacity: 1,
  textBgColor: [ 0, 0, 0, 255 ],
  textBgOpacity: 0,
  textBgPadding: 0,
  textMarginX: 0,
  textMarginY: 0,
  textRotation: 0, // none: horizontal, as v3's default
  curveStyle: CURVE_DEFAULTS.style, // straight — the signed-off v4 default (v3 defaults to bezier)
  controlPointStepSize: CURVE_DEFAULTS.stepSize,
  controlPointWeight: CURVE_DEFAULTS.weight,
  loopDirection: CURVE_DEFAULTS.loopDirection, // -45deg, as v3
  loopSweep: CURVE_DEFAULTS.loopSweep, // -90deg, as v3
  // 12b family defaults (v3's); parse always replaces the arrays, so
  // sharing the default references across computed records is safe
  controlPointDistances: CURVE_EXTRA_DEFAULTS.ctrlDists,
  controlPointWeights: CURVE_EXTRA_DEFAULTS.ctrlWeights,
  segmentDistances: CURVE_EXTRA_DEFAULTS.segDists,
  segmentWeights: CURVE_EXTRA_DEFAULTS.segWeights,
  segmentRadii: CURVE_EXTRA_DEFAULTS.segRadii,
  radiusTypes: CURVE_EXTRA_DEFAULTS.radiusTypes,
  edgeDistances: CURVE_EXTRA_DEFAULTS.edgeDistances,
  taxiDirection: CURVE_EXTRA_DEFAULTS.taxiDir,
  haystackRadius: 0, // v3's default: haystack endpoints at the centers
  sourceEndpoint: ENDPT_END_DEFAULT,
  targetEndpoint: ENDPT_END_DEFAULT,
  sourceDistanceFromNode: 0,
  targetDistanceFromNode: 0,
  taxiTurn: CURVE_EXTRA_DEFAULTS.taxiTurn,
  taxiTurnPercent: CURVE_EXTRA_DEFAULTS.taxiTurnPercent,
  taxiTurnMinDistance: CURVE_EXTRA_DEFAULTS.taxiTurnMinDist,
  taxiRadius: CURVE_EXTRA_DEFAULTS.taxiRadius
};

const NO_ARROW: RGBA = [ 0, 0, 0, 0 ]; // a=0 collapses the arrow in the shader

/** data() value → label text ('' for absent) */
const stringify = ( value: unknown ): string => {
  return value == null ? '' : String( value );
};

const SHAPES: Record<string, number> = {
  'ellipse': SHAPE_ELLIPSE,
  'circle': SHAPE_CIRCLE,
  'rectangle': SHAPE_RECTANGLE,
  'square': SHAPE_RECTANGLE,
  'round-rectangle': SHAPE_ROUND_RECTANGLE,
  'roundrectangle': SHAPE_ROUND_RECTANGLE,
  'triangle': SHAPE_TRIANGLE,
  'pentagon': SHAPE_PENTAGON,
  'hexagon': SHAPE_HEXAGON,
  'heptagon': SHAPE_HEPTAGON,
  'octagon': SHAPE_OCTAGON,
  'diamond': SHAPE_DIAMOND,
  'rhomboid': SHAPE_RHOMBOID,
  'vee': SHAPE_VEE,
  'star': SHAPE_STAR,
  'tag': SHAPE_TAG
};

/** RGBA bytes packed little-endian, matching WGSL unpack4x8unorm. */
const packRgba = ( [ r, g, b, a ]: RGBA ): number => {
  return ( r | ( g << 8 ) | ( b << 16 ) | ( a << 24 ) ) >>> 0;
};

/** The slot's 12b curve extras, defaulted for non-blob styles. */
const curveExtrasFor = ( store: GraphStore, slot: number ): CurveStyleExtras => {
  return store.curveStyleAt( slot ).extras ?? CURVE_EXTRA_DEFAULTS;
};

/** RGBA bytes → the v3-style resolved color string. */
const formatRgba = ( r: number, g: number, b: number, a: number ): string => {
  return a === 255 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${Math.round( a / 255 * 1000 ) / 1000})`;
};

/** Stored shape id → resolved keyword (the exact-circle compile collapses back to 'ellipse'). */
const SHAPE_NAMES: Record<number, string> = {
  [ SHAPE_CIRCLE ]: 'ellipse',
  [ SHAPE_ELLIPSE ]: 'ellipse',
  [ SHAPE_RECTANGLE ]: 'rectangle',
  [ SHAPE_ROUND_RECTANGLE ]: 'round-rectangle',
  [ SHAPE_TRIANGLE ]: 'triangle',
  [ SHAPE_PENTAGON ]: 'pentagon',
  [ SHAPE_HEXAGON ]: 'hexagon',
  [ SHAPE_HEPTAGON ]: 'heptagon',
  [ SHAPE_OCTAGON ]: 'octagon',
  [ SHAPE_DIAMOND ]: 'diamond',
  [ SHAPE_RHOMBOID ]: 'rhomboid',
  [ SHAPE_VEE ]: 'vee',
  [ SHAPE_STAR ]: 'star',
  [ SHAPE_TAG ]: 'tag'
};

/** Readable props per group ('width' and 'opacity' exist for both). */
const NODE_READ: ReadonlySet<string> = new Set( [
  'background-color', 'border-color', 'border-width', 'width', 'height',
  'shape', 'opacity', 'label', 'font-size', 'font-family', 'color',
  'ghost', 'ghost-offset-x', 'ghost-offset-y', 'ghost-opacity',
  'text-outline-width', 'text-outline-color', 'text-outline-opacity',
  'text-background-color', 'text-background-opacity', 'text-background-padding',
  'text-margin-x', 'text-margin-y'
] );

const EDGE_READ: ReadonlySet<string> = new Set( [
  'line-color', 'line-style', 'width', 'opacity',
  'source-arrow-shape', 'source-arrow-color', 'target-arrow-shape', 'target-arrow-color',
  'label', 'font-size', 'color',
  'text-outline-width', 'text-outline-color', 'text-outline-opacity',
  'text-background-color', 'text-background-opacity', 'text-background-padding',
  'text-margin-x', 'text-margin-y', 'text-rotation',
  'curve-style', 'control-point-step-size', 'control-point-weight', 'loop-direction', 'loop-sweep',
  'control-point-distances', 'control-point-weights',
  'segment-distances', 'segment-weights', 'segment-radii', 'radius-type',
  'edge-distances', 'taxi-direction', 'taxi-turn', 'taxi-turn-min-distance', 'taxi-radius',
  'haystack-radius', 'source-endpoint', 'target-endpoint',
  'source-distance-from-node', 'target-distance-from-node'
] );

/** curve props are edge-only (constants and mappers alike). */
const CURVE_PROPS: ReadonlySet<string> = new Set( [
  'curve-style', 'control-point-step-size', 'control-point-weight', 'loop-direction', 'loop-sweep',
  'control-point-distances', 'control-point-weights',
  'segment-distances', 'segment-weights', 'segment-radii', 'radius-type',
  'edge-distances', 'taxi-direction', 'taxi-turn', 'taxi-turn-min-distance', 'taxi-radius',
  'haystack-radius', 'source-endpoint', 'target-endpoint',
  'source-distance-from-node', 'target-distance-from-node'
] );

/** ghost props are node-only (round 13 A1). */
const GHOST_PROPS: ReadonlySet<string> = new Set( [
  'ghost', 'ghost-offset-x', 'ghost-offset-y', 'ghost-opacity'
] );

const parseColor = ( prop: string, value: unknown ): RGBA => {
  const tuple = color2tuple( value as string );

  if( tuple == null ){
    throw new Error( `The value '${String( value )}' is not a valid colour for '${prop}'` );
  }

  const [ r, g, b, a ] = tuple;

  return [ r, g, b, Math.round( ( a ?? 1 ) * 255 ) ];
};

const parseNumber = ( prop: string, value: unknown ): number => {
  const num = typeof value === 'number' ? value : parseFloat( String( value ) );

  if( !isFinite( num ) ){
    throw new Error( `The value '${String( value )}' is not a valid number for '${prop}'` );
  }

  return num;
};

/** v3's bool type: 'yes'/'no' keywords (booleans accepted too). */
const parseYesNo = ( prop: string, value: unknown ): boolean => {
  if( typeof value === 'boolean' ){ return value; }

  const token = String( value ).trim();

  if( token === 'yes' ){ return true; }
  if( token === 'no' ){ return false; }

  throw new Error( `The value '${String( value )}' is not a valid ${prop} (use 'yes' or 'no')` );
};

/** v3's size type: a non-negative number. */
const parseNonNegative = ( prop: string, value: unknown ): number => {
  const num = parseNumber( prop, value );

  if( num < 0 ){
    throw new Error( `The value '${String( value )}' for '${prop}' may not be negative` );
  }

  return num;
};

const parseShape = ( value: unknown ): number => {
  const shape = SHAPES[ String( value ) ];

  if( shape == null ){
    throw new Error(
      `The shape '${String( value )}' is unsupported in the GPU prototype; ` +
      `use one of: ${Object.keys( SHAPES ).join( ', ' )}`
    );
  }

  return shape;
};

const LINE_STYLES: Record<string, number> = {
  'solid': LINE_SOLID,
  'dashed': LINE_DASHED,
  'dotted': LINE_DOTTED
};

/** Stored line-style id → resolved keyword. */
const LINE_STYLE_NAMES: Record<number, string> = {
  [ LINE_SOLID ]: 'solid',
  [ LINE_DASHED ]: 'dashed',
  [ LINE_DOTTED ]: 'dotted'
};

const parseLineStyle = ( value: unknown ): number => {
  const style = LINE_STYLES[ String( value ) ];

  if( style == null ){
    throw new Error(
      `The line-style '${String( value )}' is unsupported in the GPU prototype; ` +
      `use one of: ${Object.keys( LINE_STYLES ).join( ', ' )}`
    );
  }

  return style;
};

/** text-rotation keywords (edge labels): 0 none, 1 autorotate. */
const TEXT_ROTATIONS: Record<string, number> = {
  'none': 0,
  'autorotate': 1
};

const TEXT_ROTATION_NAMES: Record<number, string> = {
  0: 'none',
  1: 'autorotate'
};

const parseTextRotation = ( value: unknown ): number => {
  const rotation = TEXT_ROTATIONS[ String( value ) ];

  if( rotation == null ){
    throw new Error(
      `The text-rotation '${String( value )}' is unsupported in the GPU prototype; ` +
      `use one of: ${Object.keys( TEXT_ROTATIONS ).join( ', ' )} ` +
      `(numeric rotations are not supported)`
    );
  }

  return rotation;
};

/** curve-style keywords (12a: bezier; 12b: the unbundled families). */
const CURVE_STYLES: Record<string, number> = {
  'straight': CURVE_STYLE_STRAIGHT,
  'bezier': CURVE_STYLE_BEZIER,
  'unbundled-bezier': CURVE_STYLE_UNBUNDLED,
  'segments': CURVE_STYLE_SEGMENTS,
  'round-segments': CURVE_STYLE_ROUND_SEGMENTS,
  'taxi': CURVE_STYLE_TAXI,
  'round-taxi': CURVE_STYLE_ROUND_TAXI,
  'haystack': CURVE_STYLE_HAYSTACK,
  'straight-triangle': CURVE_STYLE_TRIANGLE
};

const CURVE_STYLE_NAMES: Record<number, string> = {
  [ CURVE_STYLE_STRAIGHT ]: 'straight',
  [ CURVE_STYLE_BEZIER ]: 'bezier',
  [ CURVE_STYLE_UNBUNDLED ]: 'unbundled-bezier',
  [ CURVE_STYLE_SEGMENTS ]: 'segments',
  [ CURVE_STYLE_ROUND_SEGMENTS ]: 'round-segments',
  [ CURVE_STYLE_TAXI ]: 'taxi',
  [ CURVE_STYLE_ROUND_TAXI ]: 'round-taxi',
  [ CURVE_STYLE_HAYSTACK ]: 'haystack',
  [ CURVE_STYLE_TRIANGLE ]: 'straight-triangle'
};

const parseCurveStyle = ( value: unknown ): number => {
  const style = CURVE_STYLES[ String( value ) ];

  if( style == null ){
    throw new Error(
      `The curve-style '${String( value )}' is unsupported in the GPU prototype; ` +
      `use one of: ${Object.keys( CURVE_STYLES ).join( ', ' )}`
    );
  }

  return style;
};

/** v3's `numbers` type: a number, an array of numbers, or a
 * whitespace-separated string (as in string sheets). */
const parseNumberList = ( prop: string, value: unknown ): number[] => {
  if( typeof value === 'number' ){ return [ parseNumber( prop, value ) ]; }

  const parts = Array.isArray( value )
    ? value
    : String( value ).trim() === '' ? [] : String( value ).trim().split( /\s+/ );

  return parts.map( part => parseNumber( prop, part ) );
};

const RADIUS_TYPES: Record<string, number> = {
  'arc-radius': 1,
  'influence-radius': 0
};

const RADIUS_TYPE_NAMES: Record<number, string> = {
  1: 'arc-radius',
  0: 'influence-radius'
};

/** radius-type: one keyword or a per-point list (v3's multiple enum). */
const parseRadiusTypes = ( prop: string, value: unknown ): number[] => {
  const parts = Array.isArray( value ) ? value : String( value ).trim().split( /\s+/ );

  return parts.map( part => {
    const id = RADIUS_TYPES[ String( part ) ];

    if( id == null ){
      throw new Error(
        `The ${prop} '${String( part )}' is invalid; use one of: ` +
        Object.keys( RADIUS_TYPES ).join( ', ' )
      );
    }

    return id;
  } );
};

const EDGE_DISTANCES: Record<string, number> = {
  'intersection': EDGE_DIST_INTERSECTION,
  'node-position': EDGE_DIST_NODE_POSITION,
  'endpoints': EDGE_DIST_ENDPOINTS
};

const EDGE_DISTANCE_NAMES: Record<number, string> = {
  [ EDGE_DIST_INTERSECTION ]: 'intersection',
  [ EDGE_DIST_NODE_POSITION ]: 'node-position',
  [ EDGE_DIST_ENDPOINTS ]: 'endpoints'
};

const parseEdgeDistances = ( value: unknown ): number => {
  const id = EDGE_DISTANCES[ String( value ) ];

  if( id == null ){
    throw new Error(
      `The edge-distances '${String( value )}' is unsupported in the GPU prototype; ` +
      `use one of: ${Object.keys( EDGE_DISTANCES ).join( ', ' )}`
    );
  }

  return id;
};

const ENDPT_KEYWORDS: Record<string, number> = {
  'outside-to-node': ENDPT_DEFAULT,
  'inside-to-node': ENDPT_INSIDE,
  'outside-to-line': ENDPT_LINE
};

const ENDPT_COMPONENT = /^(-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)(%|px)?$/;

/**
 * v3's edgeEndpoint forms: a keyword, a 2-component point ('%' or px
 * per component), or a single angle ('deg'/'rad' strings, or a plain
 * number in radians — v4's angle convention).  The '-or-label'
 * keywords need the label bounding box v4 doesn't have and throw (a
 * recorded deviation, deferred to the label-bb round).
 */
const parseEndpoint = ( prop: string, value: unknown ): EndpointEnd => {
  if( typeof value === 'number' && isFinite( value ) ){
    return { mode: ENDPT_ANGLE, a: value - Math.PI / 2, b: 0, pct: 0 };
  }

  const parts = Array.isArray( value )
    ? value
    : String( value ).trim().split( /\s+/ );

  if( parts.length === 1 && typeof parts[ 0 ] === 'string' ){
    const token = parts[ 0 ].trim();
    const keyword = ENDPT_KEYWORDS[ token ];

    if( keyword != null ){ return { mode: keyword, a: 0, b: 0, pct: 0 }; }

    if( token === 'outside-to-node-or-label' || token === 'outside-to-line-or-label' ){
      throw new Error(
        `The ${prop} '${token}' is unsupported in the GPU prototype ` +
        `(label bounding boxes are not computed; use the non-label form)`
      );
    }

    const angle = ANGLE_VALUE.exec( token );

    if( angle != null && angle[ 2 ] != null ){
      const num = parseFloat( angle[ 1 ] );
      const rad = angle[ 2 ] === 'deg' ? num * Math.PI / 180 : num;

      return { mode: ENDPT_ANGLE, a: rad - Math.PI / 2, b: 0, pct: 0 };
    }
  }

  if( parts.length === 1 && typeof parts[ 0 ] === 'number' && isFinite( parts[ 0 ] ) ){
    return { mode: ENDPT_ANGLE, a: parts[ 0 ] - Math.PI / 2, b: 0, pct: 0 };
  }

  if( parts.length === 2 ){
    let pct = 0;
    const comp = ( raw: unknown, bit: number ): number => {
      if( typeof raw === 'number' && isFinite( raw ) ){ return raw; }

      const m = ENDPT_COMPONENT.exec( String( raw ).trim() );

      if( m == null ){
        throw new Error( `The value '${String( raw )}' is not a valid ${prop} component` );
      }

      const num = parseFloat( m[ 1 ] );

      if( m[ 2 ] === '%' ){
        pct |= bit;

        return num / 100;
      }

      return num;
    };

    const a = comp( parts[ 0 ], ENDPT_PCT_X );
    const b = comp( parts[ 1 ], ENDPT_PCT_Y );

    return { mode: ENDPT_POINT, a, b, pct };
  }

  throw new Error(
    `The value '${String( value )}' is not a valid ${prop} ` +
    `(use a keyword, an 'x y' point with optional %/px units, or an angle)`
  );
};

/** endpoint readback: the canonical string form (keywords, 'x y' with
 * % suffixes on pct components, or '<rad>rad' for angles). */
const endpointString = ( e: EndpointEnd ): string => {
  switch( e.mode ){
    case ENDPT_INSIDE: return 'inside-to-node';
    case ENDPT_LINE: return 'outside-to-line';
    case ENDPT_POINT: {
      const x = e.pct % 2 === 1 ? `${e.a * 100}%` : `${e.a}`;
      const y = e.pct >= ENDPT_PCT_Y ? `${e.b * 100}%` : `${e.b}`;

      return `${x} ${y}`;
    }
    case ENDPT_ANGLE: return `${e.a + Math.PI / 2}rad`;
    default: return 'outside-to-node';
  }
};

const TAXI_DIRECTIONS: Record<string, number> = {
  'auto': TAXI_AUTO,
  'vertical': TAXI_VERTICAL,
  'horizontal': TAXI_HORIZONTAL,
  'upward': TAXI_UPWARD,
  'downward': TAXI_DOWNWARD,
  'leftward': TAXI_LEFTWARD,
  'rightward': TAXI_RIGHTWARD
};

const TAXI_DIRECTION_NAMES: Record<number, string> = {
  [ TAXI_AUTO ]: 'auto',
  [ TAXI_VERTICAL ]: 'vertical',
  [ TAXI_HORIZONTAL ]: 'horizontal',
  [ TAXI_UPWARD ]: 'upward',
  [ TAXI_DOWNWARD ]: 'downward',
  [ TAXI_LEFTWARD ]: 'leftward',
  [ TAXI_RIGHTWARD ]: 'rightward'
};

const parseTaxiDirection = ( value: unknown ): number => {
  const id = TAXI_DIRECTIONS[ String( value ) ];

  if( id == null ){
    throw new Error(
      `The taxi-direction '${String( value )}' is invalid; use one of: ` +
      Object.keys( TAXI_DIRECTIONS ).join( ', ' )
    );
  }

  return id;
};

const TAXI_TURN_PERCENT = /^(-?(?:\d+\.?\d*|\.\d+))%$/;

/** taxi-turn: a px number (may be negative = from the target side) or a
 * percent string ('50%' stores the fraction, v3's pfValue). */
const parseTaxiTurn = ( value: unknown ): { value: number; percent: boolean } => {
  if( typeof value === 'number' ){ return { value: parseNumber( 'taxi-turn', value ), percent: false }; }

  const match = TAXI_TURN_PERCENT.exec( String( value ).trim() );

  if( match != null ){
    return { value: parseFloat( match[ 1 ] ) / 100, percent: true };
  }

  return { value: parseNumber( 'taxi-turn', value ), percent: false };
};

const ANGLE_VALUE = /^(-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)(deg|rad)?$/;

/** v3's angle type: plain numbers are radians; strings take deg/rad units. */
const parseAngle = ( prop: string, value: unknown ): number => {
  if( typeof value === 'number' && isFinite( value ) ){ return value; }

  const m = ANGLE_VALUE.exec( String( value ).trim() );

  if( m == null ){
    throw new Error(
      `The value '${String( value )}' is not a valid angle for '${prop}' ` +
      `(use a number in radians, or a 'deg'/'rad' suffixed string)`
    );
  }

  const num = parseFloat( m[ 1 ] );

  return m[ 2 ] === 'deg' ? num * Math.PI / 180 : num;
};

const parseArrowShape = ( prop: string, value: unknown ): ArrowShape => {
  const id = ARROW_ENUM[ String( value ) ];

  if( id == null ){
    throw new Error(
      `The ${prop} '${String( value )}' is unsupported in the GPU prototype; ` +
      `use one of: ${Object.keys( ARROW_ENUM ).join( ', ' )}`
    );
  }

  return ARROW_NAMES[ id ];
};

/** camelCase → kebab-case ('backgroundColor' → 'background-color'). */
export const normalizeProp = ( prop: string ): string => {
  return prop.replace( /([A-Z])/g, '-$1' ).toLowerCase();
};

/** Apply one (normalized-name) prop onto a computed record. */
const applyProp = ( computed: Computed, prop: string, value: unknown ): void => {
  switch( prop ){
    // node properties
    case 'background-color':
      computed.fillColor = parseColor( prop, value );
      break;
    case 'border-color':
      computed.borderColor = parseColor( prop, value );
      break;
    case 'width': // node width or edge line width, resolved per group at apply time
      computed.width = parseNumber( prop, value );
      break;
    case 'height':
      computed.height = parseNumber( prop, value );
      break;
    case 'shape':
      computed.shape = parseShape( value );
      break;
    case 'text-outline-width':
      computed.textOutlineWidth = parseNumber( prop, value );
      break;
    case 'text-outline-color':
      computed.textOutlineColor = parseColor( prop, value );
      break;
    case 'text-outline-opacity':
      computed.textOutlineOpacity = parseNumber( prop, value );
      break;
    case 'text-background-color':
      computed.textBgColor = parseColor( prop, value );
      break;
    case 'text-background-opacity':
      computed.textBgOpacity = parseNumber( prop, value );
      break;
    case 'text-background-padding':
      computed.textBgPadding = parseNumber( prop, value );
      break;
    case 'text-margin-x':
      computed.textMarginX = parseNumber( prop, value );
      break;
    case 'text-margin-y':
      computed.textMarginY = parseNumber( prop, value );
      break;
    case 'text-rotation':
      computed.textRotation = parseTextRotation( value );
      break;
    case 'border-width':
      computed.borderWidth = parseNumber( prop, value );
      break;
    case 'ghost':
      computed.ghost = parseYesNo( prop, value );
      break;
    case 'ghost-offset-x':
      computed.ghostOffsetX = parseNumber( prop, value );
      break;
    case 'ghost-offset-y':
      computed.ghostOffsetY = parseNumber( prop, value );
      break;
    case 'ghost-opacity': {
      const op = parseNumber( prop, value );

      if( op < 0 || op > 1 ){
        throw new Error( `The ghost-opacity '${String( value )}' must be within [0, 1]` );
      }

      computed.ghostOpacity = op;
      break;
    }
    case 'opacity':
      computed.opacity = parseNumber( prop, value );
      break;
    case 'label': {
      // constant strings, or the data(key) mapper reading the sidecar
      // ('id' reads the first-class id); mapData stays unsupported
      const text = String( value );
      const mapped = DATA_MAPPER.exec( text );

      if( mapped != null ){
        computed.label = '';
        computed.labelKey = mapped[ 1 ];
        break;
      }

      if( /^\s*(data|mapData)\s*\(/.test( text ) ){
        throw new Error(
          `The label value '${text}' is unsupported in the GPU prototype; ` +
          `only constant strings and 'data(key)' are allowed`
        );
      }

      computed.label = text;
      computed.labelKey = null;
      break;
    }
    case 'font-size':
      computed.fontSize = parseNumber( prop, value );
      break;
    case 'font-family': {
      const family = String( value ).trim();

      if( family === '' ){
        throw new Error( `The value '${String( value )}' is not a valid font-family` );
      }

      computed.fontFamily = family;
      break;
    }
    case 'color':
      computed.textColor = parseColor( prop, value );
      break;

    // edge properties
    case 'line-color':
      computed.lineColor = parseColor( prop, value );
      break;
    case 'line-style':
      computed.lineStyle = parseLineStyle( value );
      break;
    case 'source-arrow-shape':
      computed.sourceArrowShape = parseArrowShape( prop, value );
      break;
    case 'target-arrow-shape':
      computed.targetArrowShape = parseArrowShape( prop, value );
      break;
    case 'source-arrow-color':
      computed.sourceArrowColor = parseColor( prop, value );
      break;
    case 'target-arrow-color':
      computed.targetArrowColor = parseColor( prop, value );
      break;
    case 'curve-style':
      computed.curveStyle = parseCurveStyle( value );
      break;
    case 'control-point-step-size':
      computed.controlPointStepSize = parseNumber( prop, value );
      break;
    case 'control-point-weight':
      computed.controlPointWeight = parseNumber( prop, value );
      break;
    case 'loop-direction':
      computed.loopDirection = parseAngle( prop, value );
      break;
    case 'loop-sweep':
      computed.loopSweep = parseAngle( prop, value );
      break;
    case 'control-point-distances':
      computed.controlPointDistances = parseNumberList( prop, value );
      break;
    case 'control-point-weights':
      computed.controlPointWeights = parseNumberList( prop, value );
      break;
    case 'segment-distances':
      computed.segmentDistances = parseNumberList( prop, value );
      break;
    case 'segment-weights':
      computed.segmentWeights = parseNumberList( prop, value );
      break;
    case 'segment-radii':
      computed.segmentRadii = parseNumberList( prop, value );
      break;
    case 'radius-type':
      computed.radiusTypes = parseRadiusTypes( prop, value );
      break;
    case 'edge-distances':
      computed.edgeDistances = parseEdgeDistances( value );
      break;
    case 'taxi-direction':
      computed.taxiDirection = parseTaxiDirection( value );
      break;
    case 'taxi-turn': {
      const turn = parseTaxiTurn( value );

      computed.taxiTurn = turn.value;
      computed.taxiTurnPercent = turn.percent;
      break;
    }
    case 'taxi-turn-min-distance':
      computed.taxiTurnMinDistance = parseNumber( prop, value );
      break;
    case 'taxi-radius':
      computed.taxiRadius = parseNumber( prop, value );
      break;
    case 'haystack-radius': {
      const radius = parseNumber( prop, value );

      if( radius < 0 || radius > 1 ){
        throw new Error( `The haystack-radius '${String( value )}' must be within [0, 1]` );
      }

      computed.haystackRadius = radius;
      break;
    }
    case 'source-endpoint':
      computed.sourceEndpoint = parseEndpoint( prop, value );
      break;
    case 'target-endpoint':
      computed.targetEndpoint = parseEndpoint( prop, value );
      break;
    case 'source-distance-from-node':
      computed.sourceDistanceFromNode = parseNonNegative( prop, value );
      break;
    case 'target-distance-from-node':
      computed.targetDistanceFromNode = parseNonNegative( prop, value );
      break;

    default:
      throw new Error( `The style property '${prop}' is unsupported in the GPU prototype` );
  }
};

const ARROW_ENUM: Record<string, number> = {
  'none': ARROW_NONE,
  'triangle': ARROW_TRIANGLE,
  'arrow': ARROW_TRIANGLE, // v3 alias
  'vee': ARROW_VEE,
  'chevron': ARROW_CHEVRON,
  'circle': ARROW_CIRCLE,
  'square': ARROW_SQUARE,
  'diamond': ARROW_DIAMOND,
  'tee': ARROW_TEE
};

/** enum id → shape keyword (for enum-mapper writes and readback) */
const ARROW_NAMES: Record<number, ArrowShape> = {
  [ ARROW_NONE ]: 'none',
  [ ARROW_TRIANGLE ]: 'triangle',
  [ ARROW_VEE ]: 'vee',
  [ ARROW_CHEVRON ]: 'chevron',
  [ ARROW_CIRCLE ]: 'circle',
  [ ARROW_SQUARE ]: 'square',
  [ ARROW_DIAMOND ]: 'diamond',
  [ ARROW_TEE ]: 'tee'
};

/** How a mapped prop lands on the computed record. */
interface MappableChannel {
  kind: ChannelKind;
  groups: readonly GroupName[];
  parseEnum?: ( value: unknown ) => number | null;
  set: ( computed: Computed, value: Evaluated ) => void;
  default: ( group: GroupName ) => Evaluated;
}

/** Mapper-capable props ('label' rides the labelKey channel instead). */
const MAPPABLE: Record<string, MappableChannel> = {
  'background-color': {
    kind: 'color', groups: [ 'nodes' ],
    set: ( c, v ) => { c.fillColor = v as RGBA; },
    default: () => NODE_DEFAULTS.fillColor
  },
  'border-color': {
    kind: 'color', groups: [ 'nodes' ],
    set: ( c, v ) => { c.borderColor = v as RGBA; },
    default: () => NODE_DEFAULTS.borderColor
  },
  'width': {
    kind: 'number', groups: [ 'nodes', 'edges' ],
    set: ( c, v ) => { c.width = v as number; },
    default: group => group === 'nodes' ? NODE_DEFAULTS.width : EDGE_DEFAULTS.width
  },
  'height': {
    kind: 'number', groups: [ 'nodes' ],
    set: ( c, v ) => { c.height = v as number; },
    default: () => NODE_DEFAULTS.height
  },
  'border-width': {
    kind: 'number', groups: [ 'nodes' ],
    set: ( c, v ) => { c.borderWidth = v as number; },
    default: () => NODE_DEFAULTS.borderWidth
  },
  'opacity': {
    kind: 'number', groups: [ 'nodes', 'edges' ],
    set: ( c, v ) => { c.opacity = v as number; },
    default: () => NODE_DEFAULTS.opacity
  },
  'shape': {
    kind: 'enum', groups: [ 'nodes' ],
    parseEnum: v => SHAPES[ String( v ) ] ?? null,
    set: ( c, v ) => { c.shape = v as number; },
    default: () => NODE_DEFAULTS.shape
  },
  'font-size': {
    kind: 'number', groups: [ 'nodes', 'edges' ],
    set: ( c, v ) => { c.fontSize = v as number; },
    default: () => NODE_DEFAULTS.fontSize
  },
  'color': {
    kind: 'color', groups: [ 'nodes', 'edges' ],
    set: ( c, v ) => { c.textColor = v as RGBA; },
    default: () => NODE_DEFAULTS.textColor
  },
  'text-outline-width': {
    kind: 'number', groups: [ 'nodes', 'edges' ],
    set: ( c, v ) => { c.textOutlineWidth = v as number; },
    default: () => NODE_DEFAULTS.textOutlineWidth
  },
  'text-outline-color': {
    kind: 'color', groups: [ 'nodes', 'edges' ],
    set: ( c, v ) => { c.textOutlineColor = v as RGBA; },
    default: () => NODE_DEFAULTS.textOutlineColor
  },
  'text-outline-opacity': {
    kind: 'number', groups: [ 'nodes', 'edges' ],
    set: ( c, v ) => { c.textOutlineOpacity = v as number; },
    default: () => NODE_DEFAULTS.textOutlineOpacity
  },
  'text-background-color': {
    kind: 'color', groups: [ 'nodes', 'edges' ],
    set: ( c, v ) => { c.textBgColor = v as RGBA; },
    default: () => NODE_DEFAULTS.textBgColor
  },
  'text-background-opacity': {
    kind: 'number', groups: [ 'nodes', 'edges' ],
    set: ( c, v ) => { c.textBgOpacity = v as number; },
    default: () => NODE_DEFAULTS.textBgOpacity
  },
  'text-background-padding': {
    kind: 'number', groups: [ 'nodes', 'edges' ],
    set: ( c, v ) => { c.textBgPadding = v as number; },
    default: () => NODE_DEFAULTS.textBgPadding
  },
  'text-margin-x': {
    kind: 'number', groups: [ 'nodes', 'edges' ],
    set: ( c, v ) => { c.textMarginX = v as number; },
    default: () => NODE_DEFAULTS.textMarginX
  },
  'text-margin-y': {
    kind: 'number', groups: [ 'nodes', 'edges' ],
    set: ( c, v ) => { c.textMarginY = v as number; },
    default: () => NODE_DEFAULTS.textMarginY
  },
  'text-rotation': {
    kind: 'enum', groups: [ 'edges' ],
    parseEnum: v => TEXT_ROTATIONS[ String( v ) ] ?? null,
    set: ( c, v ) => { c.textRotation = v as number; },
    default: () => EDGE_DEFAULTS.textRotation
  },
  'line-color': {
    kind: 'color', groups: [ 'edges' ],
    set: ( c, v ) => { c.lineColor = v as RGBA; },
    default: () => EDGE_DEFAULTS.lineColor
  },
  'line-style': {
    kind: 'enum', groups: [ 'edges' ],
    parseEnum: v => LINE_STYLES[ String( v ) ] ?? null,
    set: ( c, v ) => { c.lineStyle = v as number; },
    default: () => EDGE_DEFAULTS.lineStyle
  },
  'source-arrow-color': {
    kind: 'color', groups: [ 'edges' ],
    set: ( c, v ) => { c.sourceArrowColor = v as RGBA; },
    default: () => EDGE_DEFAULTS.sourceArrowColor
  },
  'target-arrow-color': {
    kind: 'color', groups: [ 'edges' ],
    set: ( c, v ) => { c.targetArrowColor = v as RGBA; },
    default: () => EDGE_DEFAULTS.targetArrowColor
  },
  'curve-style': {
    kind: 'enum', groups: [ 'edges' ],
    parseEnum: v => CURVE_STYLES[ String( v ) ] ?? null,
    set: ( c, v ) => { c.curveStyle = v as number; },
    default: () => EDGE_DEFAULTS.curveStyle
  },
  'control-point-step-size': {
    kind: 'number', groups: [ 'edges' ],
    set: ( c, v ) => { c.controlPointStepSize = v as number; },
    default: () => EDGE_DEFAULTS.controlPointStepSize
  },
  'control-point-weight': {
    kind: 'number', groups: [ 'edges' ],
    set: ( c, v ) => { c.controlPointWeight = v as number; },
    default: () => EDGE_DEFAULTS.controlPointWeight
  },
  'loop-direction': {
    kind: 'number', groups: [ 'edges' ], // mapped values are radians
    set: ( c, v ) => { c.loopDirection = v as number; },
    default: () => EDGE_DEFAULTS.loopDirection
  },
  'loop-sweep': {
    kind: 'number', groups: [ 'edges' ],
    set: ( c, v ) => { c.loopSweep = v as number; },
    default: () => EDGE_DEFAULTS.loopSweep
  },
  // 12b scalar/enum curve props are mapper-capable like 12a's; the list
  // props (control-point-distances/-weights, segment-*, radius-type)
  // take constants only — a mapper value is one number/keyword, not a
  // list (a recorded 12b scope note)
  'edge-distances': {
    kind: 'enum', groups: [ 'edges' ],
    parseEnum: v => EDGE_DISTANCES[ String( v ) ] ?? null,
    set: ( c, v ) => { c.edgeDistances = v as number; },
    default: () => EDGE_DEFAULTS.edgeDistances
  },
  'taxi-direction': {
    kind: 'enum', groups: [ 'edges' ],
    parseEnum: v => TAXI_DIRECTIONS[ String( v ) ] ?? null,
    set: ( c, v ) => { c.taxiDirection = v as number; },
    default: () => EDGE_DEFAULTS.taxiDirection
  },
  'taxi-turn': {
    // mapped turns are px (a percent turn is constant-only); a missing
    // value falls back to the default fraction as px — set an explicit
    // mapper fallback to control this
    kind: 'number', groups: [ 'edges' ],
    set: ( c, v ) => { c.taxiTurn = v as number; c.taxiTurnPercent = false; },
    default: () => EDGE_DEFAULTS.taxiTurn
  },
  'taxi-turn-min-distance': {
    kind: 'number', groups: [ 'edges' ],
    set: ( c, v ) => { c.taxiTurnMinDistance = v as number; },
    default: () => EDGE_DEFAULTS.taxiTurnMinDistance
  },
  'taxi-radius': {
    kind: 'number', groups: [ 'edges' ],
    set: ( c, v ) => { c.taxiRadius = v as number; },
    default: () => EDGE_DEFAULTS.taxiRadius
  },
  // ghost props (round 13 A1; node-only)
  'ghost': {
    kind: 'enum', groups: [ 'nodes' ],
    parseEnum: v => v === 'yes' || v === true ? 1 : v === 'no' || v === false ? 0 : null,
    set: ( c, v ) => { c.ghost = ( v as number ) === 1; },
    default: () => NODE_DEFAULTS.ghost ? 1 : 0
  },
  'ghost-offset-x': {
    kind: 'number', groups: [ 'nodes' ],
    set: ( c, v ) => { c.ghostOffsetX = v as number; },
    default: () => NODE_DEFAULTS.ghostOffsetX
  },
  'ghost-offset-y': {
    kind: 'number', groups: [ 'nodes' ],
    set: ( c, v ) => { c.ghostOffsetY = v as number; },
    default: () => NODE_DEFAULTS.ghostOffsetY
  },
  'ghost-opacity': {
    kind: 'number', groups: [ 'nodes' ],
    set: ( c, v ) => { c.ghostOpacity = Math.max( 0, Math.min( 1, v as number ) ); },
    default: () => NODE_DEFAULTS.ghostOpacity
  },
  // 12c scalar curve props (source/target-endpoint stays constants-only:
  // its point form is a list, per the 12b list-prop scope rule)
  'haystack-radius': {
    kind: 'number', groups: [ 'edges' ],
    set: ( c, v ) => { c.haystackRadius = Math.max( 0, Math.min( 1, v as number ) ); },
    default: () => EDGE_DEFAULTS.haystackRadius
  },
  'source-distance-from-node': {
    kind: 'number', groups: [ 'edges' ],
    set: ( c, v ) => { c.sourceDistanceFromNode = Math.max( 0, v as number ); },
    default: () => EDGE_DEFAULTS.sourceDistanceFromNode
  },
  'target-distance-from-node': {
    kind: 'number', groups: [ 'edges' ],
    set: ( c, v ) => { c.targetDistanceFromNode = Math.max( 0, v as number ); },
    default: () => EDGE_DEFAULTS.targetDistanceFromNode
  },
  'source-arrow-shape': {
    kind: 'enum', groups: [ 'edges' ],
    parseEnum: v => ARROW_ENUM[ String( v ) ] ?? null,
    set: ( c, v ) => { c.sourceArrowShape = ARROW_NAMES[ v as number ] ?? 'none'; },
    default: () => 0
  },
  'target-arrow-shape': {
    kind: 'enum', groups: [ 'edges' ],
    parseEnum: v => ARROW_ENUM[ String( v ) ] ?? null,
    set: ( c, v ) => { c.targetArrowShape = ARROW_NAMES[ v as number ] ?? 'none'; },
    default: () => 0
  }
};

/** A compiled mapper bound to its target channel. */
interface BoundMapper {
  m: CompiledMapper;
  channel: MappableChannel;
}

/**
 * Paint channels: props whose stored bytes no CPU path reads back except
 * the style getters — the GPU-eligible half of the mapper split.  (The
 * geometry channels — size, border-width, shape, edge width — feed
 * culling, CPU picking and columnar scans, so they stay CPU-evaluated.)
 */
const PAINT_PROPS: Record<GroupName, ReadonlySet<string>> = {
  nodes: new Set( [ 'background-color', 'border-color', 'opacity' ] ),
  edges: new Set( [
    'line-color', 'opacity',
    'source-arrow-color', 'target-arrow-color', 'source-arrow-shape', 'target-arrow-shape'
  ] )
};

const compileChannel = ( group: GroupName, prop: string, spec: GpuMapperSpec ): BoundMapper => {
  const channel = MAPPABLE[ prop ];

  if( channel == null || !channel.groups.includes( group ) ){
    throw new Error( `The style property '${prop}' does not support mappers` +
      ( channel == null ? '' : ` on ${group}` ) );
  }

  return {
    m: compileMapper( spec, { kind: channel.kind, prop, parseEnum: channel.parseEnum } ),
    channel
  };
};

/** A per-group stylesheet entry as stored: the resolved base + compiled mappers. */
interface GroupDef {
  computed: Computed;
  mappers: BoundMapper[];
  /** data key → what depends on it (null when nothing does) */
  deps: Map<string, { label: boolean; mappers: boolean }> | null;
}

const SHEET_KEYS: ReadonlySet<string> = new Set( [ 'nodes', 'edges' ] );

export class StyleEngine {
  private store: GraphStore;
  private sheet: GpuStylesheet;
  private defs: { nodes: GroupDef; edges: GroupDef };

  private arrows = { source: false, target: false };

  /**
   * Bumps when the paint-mapper state changes (sheet set, or a GPU-owned
   * live auto-domain extent moved) — the renderer's mapper runtime pulls
   * on this to repack its program buffers.
   */
  paintVersion = 0;

  /** props per group the GPU eval kernel currently owns (set by the runtime). */
  private gpuOwnedProps: Record<GroupName, ReadonlySet<string>> = {
    nodes: new Set(), edges: new Set()
  };

  /** a mapped key's column promoted to mixed while kernel-owned: re-derive on CPU */
  private demoted: Record<GroupName, boolean> = { nodes: false, edges: false };

  /** value reader for mapper/condition keys ('id' is first-class, not in the sidecar) */
  private readValue: ValueReader = ( group, slot, key ) =>
    key === 'id' ? this.store.idAt( group, slot ) : this.store.data.get( group, slot, key );

  constructor( store: GraphStore ){
    this.store = store;
    this.sheet = {};
    this.defs = {
      nodes: { computed: this.resolveConst( 'nodes', {}, [] ), mappers: [], deps: null },
      edges: { computed: this.resolveConst( 'edges', {}, [] ), mappers: [], deps: null }
    };

    // a mixed column can't evaluate in the kernel: demote its group's
    // mapped channels back to eager CPU (the runtime repacks on the
    // version bump; the next mapped pass re-derives every slot)
    store.data.onPromote = ( group, key ) => {
      if( this.defs[ group ].deps?.has( key ) && this.gpuOwnedProps[ group ].size > 0 ){
        this.demoted[ group ] = true;
        this.paintVersion++;
      }
    };
  }

  /**
   * Replace the stylesheet and (re-)apply to all alive elements — the
   * mapped channels too.  `apply: false` compiles and validates without
   * applying (the core defers the apply while batching).
   */
  setSheet( sheet: GpuStylesheet, apply: boolean = true ): void {
    for( const key of Object.keys( sheet ) ){
      if( !SHEET_KEYS.has( key ) ){
        throw new Error( `Unknown stylesheet key '${key}'; supported keys: nodes, edges` );
      }
    }

    const compile = ( group: GroupName, def: GpuStylesheet['nodes'] ): GroupDef => {
      const mappers: BoundMapper[] = [];
      const computed = this.resolveConst( group, def ?? {}, mappers );

      // which mutable data() keys the group's style derives from — the
      // data-write refresh gate (id is immutable and never registers)
      let deps: GroupDef['deps'] = null;
      const dep = ( key: string, what: 'label' | 'mappers' ): void => {
        if( key === 'id' ){ return; }

        deps ??= new Map();

        const entry = deps.get( key ) ?? { label: false, mappers: false };

        entry[ what ] = true;
        deps.set( key, entry );
      };

      if( computed.labelKey != null ){ dep( computed.labelKey, 'label' ); }

      for( const bm of mappers ){
        for( const key of bm.m.keys ){ dep( key, 'mappers' ); }
      }

      return { computed, mappers, deps };
    };

    const defs = {
      nodes: compile( 'nodes', sheet.nodes ),
      edges: compile( 'edges', sheet.edges )
    };

    // which arrow ends can any edge have at all — the renderer skips whole
    // arrow draw calls per end when nothing enables it; a mapped arrow
    // shape conservatively enables its end (per-element arrows still
    // collapse in the shader via zero alpha)
    const mapsProp = ( def: GroupDef, prop: string ): boolean =>
      def.mappers.some( bm => bm.m.prop === prop );

    this.arrows = {
      source: defs.edges.computed.sourceArrowShape === 'triangle' || mapsProp( defs.edges, 'source-arrow-shape' ),
      target: defs.edges.computed.targetArrowShape === 'triangle' || mapsProp( defs.edges, 'target-arrow-shape' )
    };

    this.sheet = sheet;
    this.defs = defs;

    // global: routes to the atlas and marks every labelled node
    // label-dirty (metrics change), applied even while batching — the
    // deferred flush re-lays-out against current entries anyway
    this.store.setLabelFont( defs.nodes.computed.fontFamily );

    // the store coalesces write spans for paint-mapped keys so the GPU
    // eval pass knows what to re-evaluate without a CPU restyle; owned
    // props reset until the runtime re-configures against the new sheet.
    // Only single-key scale mappers can be GPU-evaluated — conditionals
    // (case, '' key / multi-key) stay CPU-evaluated, so they aren't watched.
    for( const group of [ 'nodes', 'edges' ] as const ){
      this.store.watchDataKeys( group, defs[ group ].mappers
        .filter( bm => PAINT_PROPS[ group ].has( bm.m.prop ) && bm.m.program.kind !== 'case' )
        .map( bm => bm.m.key ) );
      this.gpuOwnedProps[ group ] = new Set();
    }

    this.paintVersion++;

    if( apply ){ this.applyAll(); }
  }

  /**
   * Paint-channel mappers with resolved fallbacks (the runtime's pack
   * input).  A mapped arrow *shape* demotes all edge paint to the CPU:
   * the shape gates the stored arrow alpha, and splitting that fold
   * between CPU and kernel would race.
   */
  paintInputs( group: GroupName ): { m: CompiledMapper; fallback: Evaluated }[] {
    const def = this.defs[ group ];

    if( group === 'edges' && def.mappers.some( bm => bm.m.prop.endsWith( '-arrow-shape' ) ) ){
      return [];
    }

    return def.mappers
      .filter( bm => PAINT_PROPS[ group ].has( bm.m.prop ) )
      .map( bm => ( { m: bm.m, fallback: bm.m.fallback ?? bm.channel.default( group ) } ) );
  }

  /** Edge-sheet constants for the kernel's arrow-alpha folding. */
  paintContext( group: GroupName ): {
    opacityMapped: boolean;
    constOpacity: number;
    source: { enabled: boolean; colorMapped: boolean; constColor: RGBA };
    target: { enabled: boolean; colorMapped: boolean; constColor: RGBA };
  } | null {
    const def = this.defs.edges;

    if( group !== 'edges' || def.computed == null ){ return null; }

    const computed = def.computed;
    const mapped = ( prop: string ): boolean => def.mappers.some( bm => bm.m.prop === prop );

    return {
      opacityMapped: mapped( 'opacity' ),
      constOpacity: computed.opacity,
      source: {
        enabled: computed.sourceArrowShape === 'triangle',
        colorMapped: mapped( 'source-arrow-color' ),
        constColor: computed.sourceArrowColor
      },
      target: {
        enabled: computed.targetArrowShape === 'triangle',
        colorMapped: mapped( 'target-arrow-color' ),
        constColor: computed.targetArrowColor
      }
    };
  }

  /**
   * The runtime reports which props its kernel evaluates: the data-write
   * refresh skips their CPU evaluation (the whole point of GPU eval) and
   * the read-back getters evaluate the shared IR lazily instead of
   * trusting the stale stored bytes.
   */
  setGpuOwned( group: GroupName, props: Iterable<string> ): void {
    this.gpuOwnedProps[ group ] = new Set( props );
  }

  /** True when writing any of these data() keys can change the group's computed style. */
  stylesDependOnData( group: GroupName, keys: string[] ): boolean {
    const deps = this.defs[ group ].deps;

    if( deps == null ){ return false; }

    return keys.some( key => deps.has( key ) );
  }

  /** Which arrow ends the current stylesheet can enable. */
  get arrowEnds(): { source: boolean; target: boolean } {
    return this.arrows;
  }

  json(): GpuStylesheet {
    return this.sheet;
  }

  /** Re-apply the current sheet (e.g. to re-snapshot live auto-domain extents). */
  update(): void {
    this.applyAll();
  }

  applyAll(): void {
    this.applyBulk( 'nodes', this.store.slotsOrdered( 'nodes' ) );
    this.applyBulk( 'edges', this.store.slotsOrdered( 'edges' ) );
  }

  /**
   * Bulk apply over *live* slots of one group.  The group resolves once
   * (the per-element cost is only the column writes); mapped channels
   * evaluate per element in applyMapped.
   */
  applyBulk( group: GroupName, slots: ArrayLike<number> ): void {
    if( slots.length === 0 ){ return; }

    const def = this.defs[ group ];

    if( def.mappers.length > 0 ){
      this.applyMapped( group, def, slots );

      return;
    }

    const computed = def.computed;

    for( let i = 0; i < slots.length; i++ ){
      this.write( group, slots[ i ], computed );
    }
  }

  /**
   * Scratch-evaluate every mapped channel and write whole elements — the
   * per-channel write would break the cross-channel couplings that live
   * in write() (circle collapse, arrow-alpha folding, the label anchor).
   * Live auto-domain extents re-check here; a changed extent escalates
   * the pass to the whole group (every slot's mapping moved).
   */
  private applyMapped(
    group: GroupName, def: GroupDef, slots: ArrayLike<number>,
    skipOwned: boolean = false
  ): void {
    const store = this.store;

    if( this.demoted[ group ] ){
      // formerly kernel-owned bytes are stale everywhere: one full CPU
      // pass re-derives them; ownership stays clear until the runtime
      // re-configures against the mixed column
      this.demoted[ group ] = false;
      this.gpuOwnedProps[ group ] = new Set();
      slots = store.slotsOrdered( group );
      skipOwned = false;
    }

    const target = this.checkAutoExtents( group, def ) ? store.slotsOrdered( group ) : slots;

    // one scratch record: every evaluated channel is reassigned per slot
    // and the rest keep the constant base.  GPU-owned channels skip CPU
    // evaluation on data-write refreshes (the kernel re-derives them);
    // their stored bytes go stale, which the getters compensate for.
    const owned = this.gpuOwnedProps[ group ];
    const active = skipOwned
      ? def.mappers.filter( bm => !owned.has( bm.m.prop ) )
      : def.mappers;
    const scratch: Computed = { ...def.computed };
    const evals = active.map( bm => ( {
      set: bm.channel.set,
      ev: bindEvaluator( bm.m, store.data, group, bm.channel.default( group ), this.readValue )
    } ) );

    for( let i = 0; i < target.length; i++ ){
      const slot = target[ i ];

      for( let j = 0; j < evals.length; j++ ){
        evals[ j ].set( scratch, evals[ j ].ev( slot ) );
      }

      this.write( group, slot, scratch );
    }
  }

  /**
   * Re-check live auto-domain extents against the data; returns true when
   * any moved (the caller escalates to the whole group).  A moved extent
   * on a GPU-owned program also bumps paintVersion so the runtime repacks
   * its program uniform and re-evaluates in full.
   */
  private checkAutoExtents( group: GroupName, def: GroupDef ): boolean {
    let moved = false;

    for( const bm of def.mappers ){
      const program = bm.m.program;

      if( ( program.kind === 'continuous' || program.kind === 'discrete' ) && program.autoDomain ){
        if( applyAutoExtent( program, ...autoExtentFor( bm.m, this.store.data, group ) ) ){
          moved = true;

          if( this.gpuOwnedProps[ group ].has( bm.m.prop ) ){ this.paintVersion++; }
        }
      }
    }

    return moved;
  }

  /** Resolve and write one element's channels (no-op for stale refs). */
  apply( ref: Ref ): void {
    if( !this.store.isCurrent( ref ) ){ return; }

    this.applyBulk( ref.group, [ ref.slot ] );
  }

  /**
   * The data-write refresh: re-derive the mapped channels of the written
   * slots, gated per group on the written keys.  A label-only dependency
   * pays just the label text recompute (setLabel no-ops when the entry is
   * unchanged); mapped channels re-evaluate through the whole-element
   * scratch pass, which also escalates to the full group when a live
   * auto-domain extent moved.
   */
  refreshMapped( group: GroupName, slots: ArrayLike<number>, keys: string[] ): void {
    const def = this.defs[ group ];

    if( slots.length === 0 || def.deps == null ){ return; }

    let label = false;
    let mapped = false;

    for( const key of keys ){
      const entry = def.deps.get( key );

      if( entry == null ){ continue; }

      label = label || entry.label;
      mapped = mapped || entry.mappers;
    }

    if( mapped ){
      const owned = this.gpuOwnedProps[ group ];

      if( this.demoted[ group ] || def.mappers.some( bm => !owned.has( bm.m.prop ) ) ){
        this.applyMapped( group, def, slots, true );
      } else {
        // every mapped channel is GPU-owned: no CPU restyle at all — the
        // data-write spans drive the kernel; only the extents need a look
        this.checkAutoExtents( group, def );

        if( label ){
          for( let i = 0; i < slots.length; i++ ){
            this.writeLabel( slots[ i ], def.computed, group );
          }
        }
      }
    } else if( label ){
      for( let i = 0; i < slots.length; i++ ){
        this.writeLabel( slots[ i ], def.computed, group );
      }
    }
  }

  // -- read-back (the collection's read-only style getters) --

  /*
  Style reads report the *stored* channels — the resolved values the
  renderer draws from — not the sheet's declarations.  Consequences: an
  equal-radii 'circle'/'ellipse' reads back as 'ellipse'; arrow getters
  derive from the stored arrow color (whose alpha folds in edge opacity),
  so a fully transparent arrow reads as shape 'none' and color
  rgba(...,0); label channels ('font-size', 'color') come from the label
  sidecar when the node is labelled, else they resolve through the sheet
  (evaluating a fn sheet for that element).
  */

  /** One resolved prop for a live element (undefined when the prop belongs to the other group). */
  readProp( ref: Ref, propRaw: string ): string | number | undefined {
    const prop = normalizeProp( propRaw );

    if( !NODE_READ.has( prop ) && !EDGE_READ.has( prop ) ){
      throw new Error( `The style property '${prop}' is unsupported in the GPU prototype` );
    }

    const forGroup = ref.group === 'nodes' ? NODE_READ : EDGE_READ;

    if( !forGroup.has( prop ) ){ return undefined; }

    // GPU-owned channels: the stored bytes go stale after data writes, so
    // evaluate the shared IR lazily (same math the kernel runs, ±1/byte).
    // Arrow getters need the fold: stored alpha = colorAlpha × opacity,
    // either of which may be kernel-owned.
    const owned = this.gpuOwnedProps[ ref.group ];

    if( ref.group === 'edges' && /-arrow-(color|shape)$/.test( prop ) ){
      const colorProp = prop.replace( '-shape', '-color' );

      if( owned.has( colorProp ) || owned.has( 'opacity' ) ){
        const [ r, g, b, a ] = this.foldedArrow( ref, colorProp );

        return prop.endsWith( '-shape' )
          ? ( a > 0 ? 'triangle' : 'none' )
          : formatRgba( r, g, b, a );
      }
    } else if( owned.has( prop ) ){
      const bm = this.defs[ ref.group ].mappers.find( bm => bm.m.prop === prop );

      if( bm != null ){
        const value = bindEvaluator( bm.m, this.store.data, ref.group, bm.channel.default( ref.group ), this.readValue )( ref.slot );

        return typeof value === 'number' ? value : formatRgba( value[ 0 ], value[ 1 ], value[ 2 ], value[ 3 ] );
      }
    }

    const store = this.store;
    const slot = ref.slot;
    const scalar = ( id: Parameters<GraphStore['column']>[0] ): number =>
      ( store.column( id ) as Float32Array | Uint32Array )[ slot ];
    const pair = ( id: Parameters<GraphStore['column']>[0], i: 0 | 1 ): number =>
      ( store.column( id ) as Float32Array )[ slot * 2 + i ];
    const color = ( id: Parameters<GraphStore['column']>[0] ): string => {
      const bytes = store.column( id ) as Uint8Array;

      return formatRgba( bytes[ slot * 4 ], bytes[ slot * 4 + 1 ], bytes[ slot * 4 + 2 ], bytes[ slot * 4 + 3 ] );
    };
    const alphaOf = ( id: Parameters<GraphStore['column']>[0] ): number =>
      ( store.column( id ) as Uint8Array )[ slot * 4 + 3 ];
    const packedColor = ( packed: number ): string =>
      formatRgba( packed & 0xff, ( packed >>> 8 ) & 0xff, ( packed >>> 16 ) & 0xff, ( packed >>> 24 ) & 0xff );

    switch( prop ){
      // node channels
      case 'background-color': return color( 'node.fillColor' );
      case 'border-color': return color( 'node.borderColor' );
      case 'border-width': return scalar( 'node.borderWidth' );
      case 'ghost':
        return ( store.column( 'node.ghost' ) as Float32Array )[ slot * 4 + 3 ] !== 0 ? 'yes' : 'no';
      case 'ghost-offset-x': return ( store.column( 'node.ghost' ) as Float32Array )[ slot * 4 ];
      case 'ghost-offset-y': return ( store.column( 'node.ghost' ) as Float32Array )[ slot * 4 + 1 ];
      case 'ghost-opacity': return ( store.column( 'node.ghost' ) as Float32Array )[ slot * 4 + 2 ];
      case 'height': return pair( 'node.size', 1 );
      case 'shape': return SHAPE_NAMES[ scalar( 'node.shape' ) ];
      case 'label': return store.labelAt( slot, ref.group )?.text ?? '';
      case 'font-size': return this.labelChannels( ref ).fontSize;
      case 'font-family': return store.labelFont;
      case 'color': return this.labelChannels( ref ).color;

      // label visual props (constants; sidecar when labelled, else the sheet
      // constants — opacities read back folded into the stored alpha, like
      // arrow colors)
      case 'text-outline-width':
        return store.labelAt( slot, ref.group )?.outlineWidth ?? this.defs[ ref.group ].computed.textOutlineWidth;
      case 'text-outline-color': {
        const entry = store.labelAt( slot, ref.group );

        return entry != null ? packedColor( entry.outlineColor ) : formatRgba( ...this.defs[ ref.group ].computed.textOutlineColor );
      }
      case 'text-outline-opacity': {
        const entry = store.labelAt( slot, ref.group );

        return entry != null
          ? Math.round( ( ( entry.outlineColor >>> 24 ) & 0xff ) / 255 * 1000 ) / 1000
          : this.defs[ ref.group ].computed.textOutlineOpacity;
      }
      case 'text-background-color': {
        const entry = store.labelAt( slot, ref.group );

        return entry != null ? packedColor( entry.bgColor ) : formatRgba( ...this.defs[ ref.group ].computed.textBgColor );
      }
      case 'text-background-opacity': {
        const entry = store.labelAt( slot, ref.group );

        return entry != null
          ? Math.round( ( ( entry.bgColor >>> 24 ) & 0xff ) / 255 * 1000 ) / 1000
          : this.defs[ ref.group ].computed.textBgOpacity;
      }
      case 'text-background-padding':
        return store.labelAt( slot, ref.group )?.bgPadding ?? this.defs[ ref.group ].computed.textBgPadding;
      case 'text-margin-x':
        return store.labelAt( slot, ref.group )?.marginX ?? this.defs[ ref.group ].computed.textMarginX;
      case 'text-margin-y':
        return store.labelAt( slot, ref.group )?.marginY ?? this.defs[ ref.group ].computed.textMarginY;
      case 'text-rotation': {
        const entry = store.labelAt( slot, ref.group );

        return entry != null
          ? ( entry.rotate ? 'autorotate' : 'none' )
          : TEXT_ROTATION_NAMES[ this.defs[ ref.group ].computed.textRotation ];
      }

      // shared names, resolved per group
      case 'width': return ref.group === 'nodes' ? pair( 'node.size', 0 ) : scalar( 'edge.width' );
      case 'opacity': return scalar( ref.group === 'nodes' ? 'node.opacity' : 'edge.opacity' );

      // edge channels
      case 'line-color': return color( 'edge.lineColor' );
      case 'line-style': return LINE_STYLE_NAMES[ scalar( 'edge.lineStyle' ) ];
      case 'source-arrow-shape':
        return alphaOf( 'edge.sourceArrow' ) > 0
          ? ARROW_NAMES[ scalar( 'edge.arrowShapes' ) & 0xff ]
          : 'none';
      case 'target-arrow-shape':
        return alphaOf( 'edge.targetArrow' ) > 0
          ? ARROW_NAMES[ ( scalar( 'edge.arrowShapes' ) >>> 8 ) & 0xff ]
          : 'none';
      case 'source-arrow-color': return color( 'edge.sourceArrow' );
      case 'target-arrow-color': return color( 'edge.targetArrow' );

      // curve props read the styled record (stored truth: a lone
      // 'bezier' edge reads back 'bezier' even though it renders
      // straight — v3 semantics); angles read back in radians.  Lists
      // read back as space-separated strings (v3's strValue form);
      // percent taxi turns read back as the percent string.
      case 'curve-style': return CURVE_STYLE_NAMES[ store.curveStyleAt( slot ).style ];
      case 'control-point-step-size': return store.curveStyleAt( slot ).stepSize;
      case 'control-point-weight': return store.curveStyleAt( slot ).weight;
      case 'loop-direction': return store.curveStyleAt( slot ).loopDirection;
      case 'loop-sweep': return store.curveStyleAt( slot ).loopSweep;
      case 'control-point-distances': {
        const dists = curveExtrasFor( store, slot ).ctrlDists;

        return dists == null ? undefined : dists.join( ' ' );
      }
      case 'control-point-weights': return curveExtrasFor( store, slot ).ctrlWeights.join( ' ' );
      case 'segment-distances': return curveExtrasFor( store, slot ).segDists.join( ' ' );
      case 'segment-weights': return curveExtrasFor( store, slot ).segWeights.join( ' ' );
      case 'segment-radii': return curveExtrasFor( store, slot ).segRadii.join( ' ' );
      case 'radius-type':
        return curveExtrasFor( store, slot ).radiusTypes
          .map( id => RADIUS_TYPE_NAMES[ id ] ).join( ' ' );
      case 'edge-distances': return EDGE_DISTANCE_NAMES[ curveExtrasFor( store, slot ).edgeDistances ];
      case 'taxi-direction': return TAXI_DIRECTION_NAMES[ curveExtrasFor( store, slot ).taxiDir ];
      case 'taxi-turn': {
        const ex = curveExtrasFor( store, slot );

        return ex.taxiTurnPercent ? `${ex.taxiTurn * 100}%` : ex.taxiTurn;
      }
      case 'taxi-turn-min-distance': return curveExtrasFor( store, slot ).taxiTurnMinDist;
      case 'taxi-radius': return curveExtrasFor( store, slot ).taxiRadius;
      case 'haystack-radius': return store.curveStyleAt( slot ).haystackRadius;
      case 'source-endpoint':
      case 'target-endpoint': {
        const e = store.curveStyleAt( slot ).endpoints;
        const src = prop === 'source-endpoint';

        if( e == null ){ return 'outside-to-node'; }

        return endpointString( src
          ? { mode: e.srcMode, a: e.srcA, b: e.srcB, pct: e.srcPct }
          : { mode: e.tgtMode, a: e.tgtA, b: e.tgtB, pct: e.tgtPct } );
      }
      case 'source-distance-from-node':
        return store.curveStyleAt( slot ).endpoints?.srcDist ?? 0;
      case 'target-distance-from-node':
        return store.curveStyleAt( slot ).endpoints?.tgtDist ?? 0;
    }

    return undefined;
  }

  /** All resolved props of a live element's group. */
  readProps( ref: Ref ): Record<string, string | number> {
    const props = ref.group === 'nodes' ? NODE_READ : EDGE_READ;
    const out: Record<string, string | number> = {};

    for( const prop of props ){
      out[ prop ] = this.readProp( ref, prop ) as string | number;
    }

    return out;
  }

  /**
   * An arrow's colour *before* the edge-opacity fold — the base the stored
   * bytes are derived from (`stored.a = base.a × opacity`).  A 'none' shape
   * is fully transparent.  Animating edge opacity needs this: the stored
   * alpha alone can't recover the base when the opacity it was folded with
   * was 0.
   */
  arrowBase( ref: Ref, colorProp: string ): RGBA {
    const def = this.defs.edges;
    const computed = def.computed as Computed;
    const source = colorProp.startsWith( 'source' );
    const shape = source ? computed.sourceArrowShape : computed.targetArrowShape;

    if( shape !== 'triangle' ){ return NO_ARROW; }

    return this.evalEdgeProp(
      ref, colorProp, source ? computed.sourceArrowColor : computed.targetArrowColor ) as RGBA;
  }

  /**
   * The stored-arrow-bytes truth when the kernel owns edge paint: the base
   * colour with alpha folded by the (mapped or constant) opacity.  Shapes
   * are never kernel-owned (mapped shapes demote edge paint to the CPU), so
   * the computed constants decide the gate.
   */
  private foldedArrow( ref: Ref, colorProp: string ): RGBA {
    const [ r, g, b, a ] = this.arrowBase( ref, colorProp );
    const computed = this.defs.edges.computed as Computed;
    const opacity = this.evalEdgeProp( ref, 'opacity', computed.opacity ) as number;

    return [ r, g, b, Math.round( a * opacity ) ];
  }

  /** One edge prop for a slot: the mapper's value when mapped, else the constant. */
  private evalEdgeProp( ref: Ref, prop: string, constant: number | RGBA ): number | RGBA {
    const bm = this.defs.edges.mappers.find( bm => bm.m.prop === prop );

    return bm == null
      ? constant
      : bindEvaluator( bm.m, this.store.data, 'edges', bm.channel.default( 'edges' ), this.readValue )( ref.slot );
  }

  /** Resolved label channels: the sidecar when labelled, else the sheet. */
  private labelChannels( ref: Ref ): { fontSize: number; color: string } {
    const entry = this.store.labelAt( ref.slot, ref.group );

    if( entry != null ){
      const packed = entry.color;

      return {
        fontSize: entry.fontSize,
        color: formatRgba( packed & 0xff, ( packed >>> 8 ) & 0xff, ( packed >>> 16 ) & 0xff, ( packed >>> 24 ) & 0xff )
      };
    }

    const def = this.defs[ ref.group ];
    let computed: Computed;

    if( def.mappers.length > 0 ){
      // an unlabelled element still reads mapped font-size/color truthfully
      const scratch: Computed = { ...def.computed };

      for( const bm of def.mappers ){
        bm.channel.set( scratch, bindEvaluator( bm.m, this.store.data, ref.group, bm.channel.default( ref.group ), this.readValue )( ref.slot ) );
      }

      computed = scratch;
    } else {
      computed = def.computed;
    }

    return { fontSize: computed.fontSize, color: formatRgba( ...computed.textColor ) };
  }

  /**
   * Defaults + props for one group ('width' is shared; the group's own
   * default wins).  Mapper specs compile into `mappersOut`; the label
   * passthrough rides the labelKey channel instead.
   */
  private resolveConst( group: GroupName, props: GpuStyleProps, mappersOut: BoundMapper[] ): Computed {
    const computed: Computed = {
      ...NODE_DEFAULTS,
      ...EDGE_DEFAULTS,
      width: group === 'nodes' ? NODE_DEFAULTS.width : EDGE_DEFAULTS.width
    };

    for( const prop of Object.keys( props ) ){
      const norm = normalizeProp( prop );
      const value = props[ prop ];

      if( norm === 'text-rotation' && group === 'nodes' ){
        // autorotate is an edge concept (rotate to the edge's angle);
        // per-element numeric rotation is a logged parity gap, not built
        throw new Error( `'text-rotation' is an edge style property in the GPU prototype` );
      }

      if( CURVE_PROPS.has( norm ) && group === 'nodes' ){
        throw new Error( `'${norm}' is an edge style property` );
      }

      if( GHOST_PROPS.has( norm ) && group === 'edges' ){
        throw new Error( `'${norm}' is a node style property` );
      }

      if( norm === 'font-family' ){
        // one glyph atlas keyed by character ⇒ one font, globally
        if( group === 'edges' ){
          throw new Error( `'font-family' is a node style property (labels are node-only)` );
        }

        if( isMapperSpec( value ) ){
          throw new Error(
            `'font-family' takes a constant only — per-element fonts are unsupported ` +
            `(the glyph atlas holds one font)`
          );
        }
      }

      if( isMapperSpec( value ) ){
        if( norm === 'label' ){
          // the label passthrough rides the existing labelKey channel
          const asScale = value as GpuMapper;
          const passthrough = !( 'case' in value ) && typeof asScale.data === 'string'
            && asScale.scale == null && asScale.domain == null && asScale.range == null;

          if( !passthrough ){
            throw new Error( `Only the passthrough mapper ({ data: key }) is supported for 'label'` );
          }

          computed.label = '';
          computed.labelKey = asScale.data;
          continue;
        }

        mappersOut.push( compileChannel( group, norm, value ) );
        continue;
      }

      applyProp( computed, norm, value );
    }

    return computed;
  }

  private write( group: GroupName, slot: number, computed: Computed ): void {
    const store = this.store;

    if( group === 'nodes' ){
      // equal-radii ellipses render via the cheaper exact circle SDF
      const shape = computed.shape === SHAPE_ELLIPSE && computed.width === computed.height
        ? SHAPE_CIRCLE
        : computed.shape;

      store.setPair( 'node.size', slot, computed.width, computed.height );
      store.setColor( 'node.fillColor', slot, ...computed.fillColor );
      store.setColor( 'node.borderColor', slot, ...computed.borderColor );
      store.setScalar( 'node.borderWidth', slot, computed.borderWidth );
      store.setScalar( 'node.opacity', slot, computed.opacity );
      store.setScalar( 'node.shape', slot, shape );
      store.setGhost(
        slot, computed.ghostOffsetX, computed.ghostOffsetY,
        computed.ghostOpacity, computed.ghost );

      this.writeLabel( slot, computed );
    } else {
      store.setColor( 'edge.lineColor', slot, ...computed.lineColor );
      store.setScalar( 'edge.width', slot, computed.width );
      store.setScalar( 'edge.opacity', slot, computed.opacity );
      store.setScalar( 'edge.lineStyle', slot, computed.lineStyle );
      // edge opacity folds into the stored alpha (the arrow shader has no
      // spare storage-buffer binding for the opacity column).  Haystack
      // edges draw no arrows (v3 skips them), so their stored arrow
      // alpha is 0 — arrow getters read 'none' (a recorded deviation:
      // v3's pstyle still reports the declared shape)
      const noArrows = computed.curveStyle === CURVE_STYLE_HAYSTACK;
      const arrow = ( shape: ArrowShape, color: RGBA ): RGBA => shape === 'none' || noArrows
        ? NO_ARROW
        : [ color[ 0 ], color[ 1 ], color[ 2 ], Math.round( color[ 3 ] * computed.opacity ) ];

      store.setColor( 'edge.sourceArrow', slot, ...arrow( computed.sourceArrowShape, computed.sourceArrowColor ) );
      store.setColor( 'edge.targetArrow', slot, ...arrow( computed.targetArrowShape, computed.targetArrowColor ) );
      store.setScalar( 'edge.arrowShapes', slot,
        ARROW_ENUM[ computed.sourceArrowShape ] | ( ARROW_ENUM[ computed.targetArrowShape ] << 8 ) );
      // blob-family styles carry the 12b record; straight/bezier store none
      const extras: CurveStyleExtras | null = isBlobStyle( computed.curveStyle )
        ? {
          ctrlDists: computed.controlPointDistances,
          ctrlWeights: computed.controlPointWeights,
          segDists: computed.segmentDistances,
          segWeights: computed.segmentWeights,
          segRadii: computed.segmentRadii,
          radiusTypes: computed.radiusTypes,
          edgeDistances: computed.edgeDistances,
          taxiDir: computed.taxiDirection,
          taxiTurn: computed.taxiTurn,
          taxiTurnPercent: computed.taxiTurnPercent,
          taxiTurnMinDist: computed.taxiTurnMinDistance,
          taxiRadius: computed.taxiRadius
        }
        : null;

      // the styled endpoint spec (null when all-default — the common case)
      const se = computed.sourceEndpoint;
      const te = computed.targetEndpoint;
      const endpoints: EndpointSpec | null =
        se.mode === ENDPT_DEFAULT && te.mode === ENDPT_DEFAULT &&
        computed.sourceDistanceFromNode === 0 && computed.targetDistanceFromNode === 0
          ? null
          : {
            srcMode: se.mode, srcA: se.a, srcB: se.b, srcPct: se.pct,
            srcDist: computed.sourceDistanceFromNode,
            tgtMode: te.mode, tgtA: te.a, tgtB: te.b, tgtPct: te.pct,
            tgtDist: computed.targetDistanceFromNode
          };

      store.setCurveStyle(
        slot, computed.curveStyle, computed.controlPointStepSize, computed.controlPointWeight,
        computed.loopDirection, computed.loopSweep, extras,
        computed.haystackRadius, endpoints
      );

      this.writeLabel( slot, computed, 'edges' );
    }
  }

  /** Resolve an element's label text from its computed channels and store it. */
  private writeLabel( slot: number, computed: NodeComputed | Computed, group: GroupName = 'nodes' ): void {
    const store = this.store;
    const key = computed.labelKey;
    const text = key == null
      ? computed.label
      : key === 'id'
        ? ( store.idAt( group, slot ) ?? '' )
        : stringify( store.data.get( group, slot, key ) );

    const fold = ( [ r, g, b, a ]: RGBA, opacity: number ): number =>
      packRgba( [ r, g, b, Math.round( a * Math.max( 0, Math.min( 1, opacity ) ) ) ] );

    // nodes: text-block top sits below the node; edges: the text centers
    // (approximately, by font size) on the midpoint the shader computes
    const anchorY = group === 'nodes'
      ? ( computed as NodeComputed ).height / 2 + LABEL_MARGIN + computed.textMarginY
      : -computed.fontSize / 2 + computed.textMarginY;

    store.setLabel( slot, text === '' ? null : {
      text,
      fontSize: computed.fontSize,
      color: packRgba( computed.textColor ),
      anchorY,
      marginX: computed.textMarginX,
      marginY: computed.textMarginY,
      outlineWidth: computed.textOutlineWidth,
      outlineColor: fold( computed.textOutlineColor, computed.textOutlineOpacity ),
      bgColor: fold( computed.textBgColor, computed.textBgOpacity ),
      bgPadding: computed.textBgPadding,
      rotate: group === 'edges' && ( computed as Computed ).textRotation === 1
    }, group );
  }
}
