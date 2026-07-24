import { color2tuple } from '../util/colors.mjs';
import {
  SHAPE_CIRCLE, SHAPE_ELLIPSE, SHAPE_RECTANGLE, SHAPE_ROUND_RECTANGLE
} from './contract.mjs';
import {
  compileMapper, bindEvaluator, isMapperSpec, autoExtentFor, applyAutoExtent
} from './style-scales.mjs';
import type { CompiledMapper, ChannelKind, Evaluated, ValueReader } from './style-scales.mjs';
import type { GroupName, Ref } from './contract.mjs';
import type { GraphStore } from './store/graph-store.mjs';
import type { GpuStyleProps, GpuStylesheet, GpuMapper, GpuMapperSpec } from './gpu-types.mjs';
import type { GpuCollection } from './collection.mjs';

/*
StyleEngine: the v4 stylesheet is `{ nodes, edges }` — no selectors.  Each
key holds either a props object (constants and mapper objects, applied to
the whole group) or a function `(ele) => props` for per-element styling.
Prop names are kebab-case or camelCase; values are constants or mapper
specs (style-scales.mts; `label` additionally takes the legacy
`data(key)` string, which normalizes to the `{ data: key }` passthrough).

Refresh policy: constant props and declarative mappers stay fresh
automatically — a data() write re-derives the mapped channels of exactly
the written slots, gated per group on the mapped keys, and a change in a
live auto-domain extent re-derives the whole channel.  Function styles
are opaque — they are evaluated when the sheet is set and when elements
are added, and re-run only on an explicit `cy.style(sheet)` /
`cy.style().update()` (mapper objects inside a fn return throw: the fn is
already the per-element mechanism).  A select never restyles (the
`:selected` accent ring is drawn by the shader).

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
}

interface EdgeComputed {
  lineColor: RGBA;
  width: number;
  opacity: number;
  sourceArrowShape: ArrowShape;
  sourceArrowColor: RGBA;
  targetArrowShape: ArrowShape;
  targetArrowColor: RGBA;
}

type Computed = NodeComputed & EdgeComputed;

type ArrowShape = 'none' | 'triangle';

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
  textColor: [ 0, 0, 0, 255 ]
};

/** gap between the node's bottom edge and the label's top, model px */
const LABEL_MARGIN = 4;

const DATA_MAPPER = /^\s*data\s*\(\s*([\w-]+)\s*\)\s*$/;

const EDGE_DEFAULTS: EdgeComputed = {
  lineColor: [ 153, 153, 153, 255 ], // #999
  width: 2,
  opacity: 1,
  sourceArrowShape: 'none',
  sourceArrowColor: [ 153, 153, 153, 255 ], // #999, as v3
  targetArrowShape: 'none',
  targetArrowColor: [ 153, 153, 153, 255 ]
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
  'round-rectangle': SHAPE_ROUND_RECTANGLE,
  'roundrectangle': SHAPE_ROUND_RECTANGLE
};

/** RGBA bytes packed little-endian, matching WGSL unpack4x8unorm. */
const packRgba = ( [ r, g, b, a ]: RGBA ): number => {
  return ( r | ( g << 8 ) | ( b << 16 ) | ( a << 24 ) ) >>> 0;
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
  [ SHAPE_ROUND_RECTANGLE ]: 'round-rectangle'
};

/** Readable props per group ('width' and 'opacity' exist for both). */
const NODE_READ: ReadonlySet<string> = new Set( [
  'background-color', 'border-color', 'border-width', 'width', 'height',
  'shape', 'opacity', 'label', 'font-size', 'color'
] );

const EDGE_READ: ReadonlySet<string> = new Set( [
  'line-color', 'width', 'opacity',
  'source-arrow-shape', 'source-arrow-color', 'target-arrow-shape', 'target-arrow-color'
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

const parseArrowShape = ( prop: string, value: unknown ): ArrowShape => {
  const shape = String( value );

  if( shape !== 'none' && shape !== 'triangle' ){
    throw new Error(
      `The ${prop} '${shape}' is unsupported in the GPU prototype; ` +
      `only 'triangle' and 'none' are allowed`
    );
  }

  return shape;
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
    case 'border-width':
      computed.borderWidth = parseNumber( prop, value );
      break;
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
    case 'color':
      computed.textColor = parseColor( prop, value );
      break;

    // edge properties
    case 'line-color':
      computed.lineColor = parseColor( prop, value );
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

    default:
      throw new Error( `The style property '${prop}' is unsupported in the GPU prototype` );
  }
};

const ARROW_ENUM: Record<string, number> = { 'none': 0, 'triangle': 1 };

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
    kind: 'number', groups: [ 'nodes' ],
    set: ( c, v ) => { c.fontSize = v as number; },
    default: () => NODE_DEFAULTS.fontSize
  },
  'color': {
    kind: 'color', groups: [ 'nodes' ],
    set: ( c, v ) => { c.textColor = v as RGBA; },
    default: () => NODE_DEFAULTS.textColor
  },
  'line-color': {
    kind: 'color', groups: [ 'edges' ],
    set: ( c, v ) => { c.lineColor = v as RGBA; },
    default: () => EDGE_DEFAULTS.lineColor
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
  'source-arrow-shape': {
    kind: 'enum', groups: [ 'edges' ],
    parseEnum: v => ARROW_ENUM[ String( v ) ] ?? null,
    set: ( c, v ) => { c.sourceArrowShape = v === 1 ? 'triangle' : 'none'; },
    default: () => 0
  },
  'target-arrow-shape': {
    kind: 'enum', groups: [ 'edges' ],
    parseEnum: v => ARROW_ENUM[ String( v ) ] ?? null,
    set: ( c, v ) => { c.targetArrowShape = v === 1 ? 'triangle' : 'none'; },
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

/** A per-group stylesheet entry as stored: constants resolved, or the fn. */
type GroupDef =
  | {
    fn: null;
    computed: Computed;
    mappers: BoundMapper[];
    /** data key → what depends on it (null when nothing does) */
    deps: Map<string, { label: boolean; mappers: boolean }> | null;
  }
  | {
    fn: ( ele: GpuCollection ) => GpuStyleProps | null | undefined;
    computed: null;
    mappers: BoundMapper[]; // always empty: fn styles are opaque
    deps: null;
  };

const SHEET_KEYS: ReadonlySet<string> = new Set( [ 'nodes', 'edges' ] );

export class StyleEngine {
  private store: GraphStore;
  /** interned handle provider (injected by the core; used to evaluate fn styles) */
  private eleFor: ( group: GroupName, slot: number ) => GpuCollection;
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

  constructor( store: GraphStore, eleFor: ( group: GroupName, slot: number ) => GpuCollection ){
    this.store = store;
    this.eleFor = eleFor;
    this.sheet = {};
    this.defs = {
      nodes: { fn: null, computed: this.resolveConst( 'nodes', {} ), mappers: [], deps: null },
      edges: { fn: null, computed: this.resolveConst( 'edges', {} ), mappers: [], deps: null }
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
   * explicit refresh for fn styles too.  `apply: false` compiles and
   * validates without applying (the core defers the apply while batching).
   */
  setSheet( sheet: GpuStylesheet, apply: boolean = true ): void {
    for( const key of Object.keys( sheet ) ){
      if( !SHEET_KEYS.has( key ) ){
        throw new Error( `Unknown stylesheet key '${key}'; supported keys: nodes, edges` );
      }
    }

    const compile = ( group: GroupName, def: GpuStylesheet['nodes'] ): GroupDef => {
      if( typeof def === 'function' ){
        return { fn: def, computed: null, mappers: [], deps: null };
      }

      const mappers: BoundMapper[] = [];
      const computed = this.resolveConst( group, def ?? {}, mappers );

      // which mutable data() keys the group's style derives from — the
      // data-write refresh gate (id is immutable and never registers; fn
      // styles are opaque, so by policy they refresh on style set only)
      let deps: Extract<GroupDef, { fn: null }>['deps'] = null;
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

      return { fn: null, computed, mappers, deps };
    };

    const defs = {
      nodes: compile( 'nodes', sheet.nodes ),
      edges: compile( 'edges', sheet.edges )
    };

    // which arrow ends can any edge have at all — the renderer skips whole
    // arrow draw calls per end when nothing enables it; a fn edge style is
    // opaque, so both ends stay enabled (per-element arrows still collapse
    // in the shader via zero alpha), and a mapped arrow shape enables its
    // end the same conservative way
    const mapsProp = ( def: GroupDef, prop: string ): boolean =>
      def.mappers.some( bm => bm.m.prop === prop );

    this.arrows = defs.edges.fn != null
      ? { source: true, target: true }
      : {
        source: defs.edges.computed.sourceArrowShape === 'triangle' || mapsProp( defs.edges, 'source-arrow-shape' ),
        target: defs.edges.computed.targetArrowShape === 'triangle' || mapsProp( defs.edges, 'target-arrow-shape' )
      };

    this.sheet = sheet;
    this.defs = defs;

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

  /** Re-apply the current sheet — the explicit re-run hook for fn styles. */
  update(): void {
    this.applyAll();
  }

  applyAll(): void {
    this.applyBulk( 'nodes', this.store.slotsOrdered( 'nodes' ) );
    this.applyBulk( 'edges', this.store.slotsOrdered( 'edges' ) );
  }

  /**
   * Bulk apply over *live* slots of one group.  Constant sheets resolve
   * once per group (the per-element cost is only the column writes); a fn
   * sheet evaluates per element against the interned handle.
   */
  applyBulk( group: GroupName, slots: ArrayLike<number> ): void {
    if( slots.length === 0 ){ return; }

    const def = this.defs[ group ];

    if( def.fn == null ){
      if( def.mappers.length > 0 ){
        this.applyMapped( group, def, slots );

        return;
      }

      const computed = def.computed;

      for( let i = 0; i < slots.length; i++ ){
        this.write( group, slots[ i ], computed );
      }

      return;
    }

    for( let i = 0; i < slots.length; i++ ){
      const slot = slots[ i ];
      const props = def.fn( this.eleFor( group, slot ) );

      this.write( group, slot, this.resolveConst( group, props ?? {} ) );
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
    group: GroupName, def: Extract<GroupDef, { fn: null }>, slots: ArrayLike<number>,
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
  private checkAutoExtents( group: GroupName, def: Extract<GroupDef, { fn: null }> ): boolean {
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
   * slots, gated per group on the written keys (fn sheets never
   * auto-refresh by policy).  A label-only dependency pays just the label
   * text recompute (setLabel no-ops when the entry is unchanged); mapped
   * channels re-evaluate through the whole-element scratch pass, which
   * also escalates to the full group when a live auto-domain extent
   * moved.
   */
  refreshMapped( group: GroupName, slots: ArrayLike<number>, keys: string[] ): void {
    const def = this.defs[ group ];

    if( slots.length === 0 || def.fn != null || def.deps == null ){ return; }

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
            this.writeLabel( slots[ i ], def.computed );
          }
        }
      }
    } else if( label ){
      for( let i = 0; i < slots.length; i++ ){
        this.writeLabel( slots[ i ], def.computed );
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

    switch( prop ){
      // node channels
      case 'background-color': return color( 'node.fillColor' );
      case 'border-color': return color( 'node.borderColor' );
      case 'border-width': return scalar( 'node.borderWidth' );
      case 'height': return pair( 'node.size', 1 );
      case 'shape': return SHAPE_NAMES[ scalar( 'node.shape' ) ];
      case 'label': return store.labelAt( slot )?.text ?? '';
      case 'font-size': return this.labelChannels( ref ).fontSize;
      case 'color': return this.labelChannels( ref ).color;

      // shared names, resolved per group
      case 'width': return ref.group === 'nodes' ? pair( 'node.size', 0 ) : scalar( 'edge.width' );
      case 'opacity': return scalar( ref.group === 'nodes' ? 'node.opacity' : 'edge.opacity' );

      // edge channels
      case 'line-color': return color( 'edge.lineColor' );
      case 'source-arrow-shape': return alphaOf( 'edge.sourceArrow' ) > 0 ? 'triangle' : 'none';
      case 'target-arrow-shape': return alphaOf( 'edge.targetArrow' ) > 0 ? 'triangle' : 'none';
      case 'source-arrow-color': return color( 'edge.sourceArrow' );
      case 'target-arrow-color': return color( 'edge.targetArrow' );
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
   * The stored-arrow-bytes truth when the kernel owns edge paint: color
   * (mapped or constant) with alpha folded by the (mapped or constant)
   * opacity; a 'none' shape stays fully transparent.  Shapes are never
   * kernel-owned (mapped shapes demote edge paint to the CPU), so the
   * computed constants decide the gate.
   */
  private foldedArrow( ref: Ref, colorProp: string ): RGBA {
    const def = this.defs.edges;
    const computed = def.computed as Computed;
    const source = colorProp.startsWith( 'source' );
    const shape = source ? computed.sourceArrowShape : computed.targetArrowShape;

    if( shape !== 'triangle' ){ return NO_ARROW; }

    const evalProp = ( prop: string, constant: number | RGBA ): number | RGBA => {
      const bm = def.mappers.find( bm => bm.m.prop === prop );

      return bm == null
        ? constant
        : bindEvaluator( bm.m, this.store.data, 'edges', bm.channel.default( 'edges' ), this.readValue )( ref.slot );
    };

    const opacity = evalProp( 'opacity', computed.opacity ) as number;
    const [ r, g, b, a ] = evalProp(
      colorProp, source ? computed.sourceArrowColor : computed.targetArrowColor ) as RGBA;

    return [ r, g, b, Math.round( a * opacity ) ];
  }

  /** Resolved label channels: the sidecar when labelled, else the sheet. */
  private labelChannels( ref: Ref ): { fontSize: number; color: string } {
    const entry = this.store.labelAt( ref.slot );

    if( entry != null ){
      const packed = entry.color;

      return {
        fontSize: entry.fontSize,
        color: formatRgba( packed & 0xff, ( packed >>> 8 ) & 0xff, ( packed >>> 16 ) & 0xff, ( packed >>> 24 ) & 0xff )
      };
    }

    const def = this.defs.nodes;
    let computed: Computed;

    if( def.fn != null ){
      computed = this.resolveConst( 'nodes', def.fn( this.eleFor( 'nodes', ref.slot ) ) ?? {} );
    } else if( def.mappers.length > 0 ){
      // an unlabelled node still reads mapped font-size/color truthfully
      const scratch: Computed = { ...def.computed };

      for( const bm of def.mappers ){
        bm.channel.set( scratch, bindEvaluator( bm.m, this.store.data, 'nodes', bm.channel.default( 'nodes' ), this.readValue )( ref.slot ) );
      }

      computed = scratch;
    } else {
      computed = def.computed;
    }

    return { fontSize: computed.fontSize, color: formatRgba( ...computed.textColor ) };
  }

  /**
   * Defaults + props for one group ('width' is shared; the group's own
   * default wins).  Mapper specs compile into `mappersOut` (setSheet
   * path); without it — a fn style's return — they throw: the fn is
   * already the per-element mechanism, and a mapper inside it would hide
   * data dependencies inside an opaque closure.
   */
  private resolveConst( group: GroupName, props: GpuStyleProps, mappersOut?: BoundMapper[] ): Computed {
    const computed: Computed = {
      ...NODE_DEFAULTS,
      ...EDGE_DEFAULTS,
      width: group === 'nodes' ? NODE_DEFAULTS.width : EDGE_DEFAULTS.width
    };

    for( const prop of Object.keys( props ) ){
      const norm = normalizeProp( prop );
      const value = props[ prop ];

      if( isMapperSpec( value ) ){
        if( mappersOut == null ){
          throw new Error(
            `Mapper objects are not allowed in function style returns; ` +
            `the function is already evaluated per element`
          );
        }

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

      this.writeLabel( slot, computed );
    } else {
      store.setColor( 'edge.lineColor', slot, ...computed.lineColor );
      store.setScalar( 'edge.width', slot, computed.width );
      store.setScalar( 'edge.opacity', slot, computed.opacity );
      // edge opacity folds into the stored alpha (the arrow shader has no
      // spare storage-buffer binding for the opacity column)
      const arrow = ( shape: ArrowShape, color: RGBA ): RGBA => shape !== 'triangle' ? NO_ARROW
        : [ color[ 0 ], color[ 1 ], color[ 2 ], Math.round( color[ 3 ] * computed.opacity ) ];

      store.setColor( 'edge.sourceArrow', slot, ...arrow( computed.sourceArrowShape, computed.sourceArrowColor ) );
      store.setColor( 'edge.targetArrow', slot, ...arrow( computed.targetArrowShape, computed.targetArrowColor ) );
    }
  }

  /** Resolve a node's label text from its computed channels and store it. */
  private writeLabel( slot: number, computed: NodeComputed ): void {
    const store = this.store;
    const key = computed.labelKey;
    const text = key == null
      ? computed.label
      : key === 'id'
        ? ( store.idAt( 'nodes', slot ) ?? '' )
        : stringify( store.data.get( 'nodes', slot, key ) );

    store.setLabel( slot, text === '' ? null : {
      text,
      fontSize: computed.fontSize,
      color: packRgba( computed.textColor ),
      anchorY: computed.height / 2 + LABEL_MARGIN
    } );
  }
}
