import { color2tuple } from '../util/colors.mjs';
import {
  SHAPE_CIRCLE, SHAPE_ELLIPSE, SHAPE_RECTANGLE, SHAPE_ROUND_RECTANGLE
} from './contract.mjs';
import type { GroupName, Ref } from './contract.mjs';
import type { GraphStore } from './store/graph-store.mjs';
import type { GpuStyleProps, GpuStylesheet } from './gpu-types.mjs';
import type { GpuCollection } from './collection.mjs';

/*
StyleEngine: the v4 stylesheet is `{ node, edge }` — no selectors.  Each
key holds either a props object (constants, applied to the whole group)
or a function `(ele) => props` for per-element styling.  Prop names are
kebab-case or camelCase; values are constants, except `label`, which also
takes the `data(key)` mapper (the first of the planned string-mapper DSL).

Refresh policy: constant props and declarative mappers stay fresh
automatically (mapped labels recompute on data() writes, gated on the
mapped keys).  Function styles are opaque — they are evaluated when the
sheet is set and when elements are added, and re-run only on an explicit
`cy.style(sheet)` / `cy.style().update()`.  In particular a select or a
data write never re-runs them (the `:selected` accent ring is drawn by
the shader, so selection needs no restyle).

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
const normalizeProp = ( prop: string ): string => {
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

/** A per-group stylesheet entry as stored: constants resolved, or the fn. */
type GroupDef =
  | { fn: null; computed: Computed }
  | { fn: ( ele: GpuCollection ) => GpuStyleProps | null | undefined; computed: null };

const SHEET_KEYS: ReadonlySet<string> = new Set( [ 'node', 'edge' ] );

export class StyleEngine {
  private store: GraphStore;
  /** interned handle provider (injected by the core; used to evaluate fn styles) */
  private eleFor: ( group: GroupName, slot: number ) => GpuCollection;
  private sheet: GpuStylesheet;
  private defs: { nodes: GroupDef; edges: GroupDef };

  /** mutable data() keys constant node labels map (fn styles are opaque and excluded by policy) */
  private labelKeys = new Set<string>();
  private dataMappers = false;
  private arrows = { source: false, target: false };

  constructor( store: GraphStore, eleFor: ( group: GroupName, slot: number ) => GpuCollection ){
    this.store = store;
    this.eleFor = eleFor;
    this.sheet = {};
    this.defs = {
      nodes: { fn: null, computed: this.resolveConst( 'nodes', {} ) },
      edges: { fn: null, computed: this.resolveConst( 'edges', {} ) }
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
        throw new Error( `Unknown stylesheet key '${key}'; supported keys: node, edge` );
      }
    }

    const compile = ( group: GroupName, def: GpuStylesheet['node'] ): GroupDef => {
      if( typeof def === 'function' ){
        return { fn: def, computed: null };
      }

      return { fn: null, computed: this.resolveConst( group, def ?? {} ) };
    };

    const defs = {
      nodes: compile( 'nodes', sheet.node ),
      edges: compile( 'edges', sheet.edge )
    };

    // which mutable data() keys do constant labels map? (id is immutable,
    // so data(id) labels never need a refresh on data writes; fn styles
    // are opaque, so by policy they refresh on style set, not data writes)
    const labelKey = defs.nodes.computed?.labelKey ?? null;

    this.labelKeys = new Set( labelKey != null && labelKey !== 'id' ? [ labelKey ] : [] );
    this.dataMappers = this.labelKeys.size > 0;

    // which arrow ends can any edge have at all — the renderer skips whole
    // arrow draw calls per end when nothing enables it; a fn edge style is
    // opaque, so both ends stay enabled (per-element arrows still collapse
    // in the shader via zero alpha)
    this.arrows = defs.edges.fn != null
      ? { source: true, target: true }
      : {
        source: defs.edges.computed.sourceArrowShape === 'triangle',
        target: defs.edges.computed.targetArrowShape === 'triangle'
      };

    this.sheet = sheet;
    this.defs = defs;

    if( apply ){ this.applyAll(); }
  }

  /** True when writing any of these data() keys can change a computed label. */
  labelDependsOn( keys: string[] ): boolean {
    if( !this.dataMappers ){ return false; }

    return keys.some( key => this.labelKeys.has( key ) );
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

  /** Resolve and write one element's channels (no-op for stale refs). */
  apply( ref: Ref ): void {
    if( !this.store.isCurrent( ref ) ){ return; }

    this.applyBulk( ref.group, [ ref.slot ] );
  }

  /**
   * Refresh data-mapped node labels only — the data-write path.  Only a
   * constant sheet with a `data(key)` label can be affected (a data write
   * can't change any other channel, and fn styles don't re-run on data
   * writes by policy), so each slot pays only the label text recompute;
   * setLabel no-ops when the entry is unchanged.
   */
  refreshLabels( slots: ArrayLike<number> ): void {
    if( slots.length === 0 || !this.dataMappers ){ return; }

    const computed = this.defs.nodes.computed;

    if( computed == null ){ return; } // fn sheet: policy says no auto-refresh

    for( let i = 0; i < slots.length; i++ ){
      this.writeLabel( slots[ i ], computed );
    }
  }

  /** Defaults + props for one group ('width' is shared; the group's own default wins). */
  private resolveConst( group: GroupName, props: GpuStyleProps ): Computed {
    const computed: Computed = {
      ...NODE_DEFAULTS,
      ...EDGE_DEFAULTS,
      width: group === 'nodes' ? NODE_DEFAULTS.width : EDGE_DEFAULTS.width
    };

    for( const prop of Object.keys( props ) ){
      applyProp( computed, normalizeProp( prop ), props[ prop ] );
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
