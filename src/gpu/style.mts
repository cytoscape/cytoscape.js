import { color2tuple } from '../util/colors.mjs';
import {
  FLAG_SELECTED, SHAPE_CIRCLE, SHAPE_ELLIPSE, SHAPE_RECTANGLE, SHAPE_ROUND_RECTANGLE
} from './contract.mjs';
import type { GroupName, Ref } from './contract.mjs';
import { matchesRef, parseSelector } from './selector.mjs';
import type { CompiledSelector } from './selector.mjs';
import type { GraphStore } from './store/graph-store.mjs';
import type { GpuStyleBlock } from './gpu-types.mjs';

/*
StyleEngine: constrained compiled-style blocks (constants only, no mappers)
compiled into channel columns.  `cy.style([{ selector, style }])` blocks are
applied on setBlocks (all alive elements), on element add, and on
select/unselect.  Defaults ≈ v3: gray 30×30 ellipse nodes, 2px gray lines.
The `:selected` accent ring is drawn by the shader (constant #0169d9), so no
selected block exists in the defaults; user `:selected` blocks still work.
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

type Setter = ( computed: NodeComputed & EdgeComputed ) => void;

interface CompiledBlock {
  selector: CompiledSelector;
  setters: Setter[];
}

/** RGBA bytes packed little-endian, matching WGSL unpack4x8unorm. */
const packRgba = ( [ r, g, b, a ]: RGBA ): number => {
  return ( r | ( g << 8 ) | ( b << 16 ) | ( a << 24 ) ) >>> 0;
};

const parseColor = ( prop: string, value: string | number ): RGBA => {
  const tuple = color2tuple( value as string );

  if( tuple == null ){
    throw new Error( `The value '${value}' is not a valid colour for '${prop}'` );
  }

  const [ r, g, b, a ] = tuple;

  return [ r, g, b, Math.round( ( a ?? 1 ) * 255 ) ];
};

const parseNumber = ( prop: string, value: string | number ): number => {
  const num = typeof value === 'number' ? value : parseFloat( value );

  if( !isFinite( num ) ){
    throw new Error( `The value '${value}' is not a valid number for '${prop}'` );
  }

  return num;
};

const parseShape = ( value: string | number ): number => {
  const shape = SHAPES[ String( value ) ];

  if( shape == null ){
    throw new Error(
      `The shape '${value}' is unsupported in the GPU prototype; ` +
      `use one of: ${Object.keys( SHAPES ).join( ', ' )}`
    );
  }

  return shape;
};

const parseArrowShape = ( prop: string, value: string | number ): ArrowShape => {
  const shape = String( value );

  if( shape !== 'none' && shape !== 'triangle' ){
    throw new Error(
      `The ${prop} '${shape}' is unsupported in the GPU prototype; ` +
      `only 'triangle' and 'none' are allowed`
    );
  }

  return shape;
};

const compileProp = ( prop: string, value: string | number ): Setter => {
  switch( prop ){
    // node properties
    case 'background-color': {
      const color = parseColor( prop, value );

      return computed => { computed.fillColor = color; };
    }
    case 'border-color': {
      const color = parseColor( prop, value );

      return computed => { computed.borderColor = color; };
    }
    case 'width': { // node width or edge line width, resolved per group at apply time
      const num = parseNumber( prop, value );

      return computed => { computed.width = num; };
    }
    case 'height': {
      const num = parseNumber( prop, value );

      return computed => { computed.height = num; };
    }
    case 'shape': {
      const shape = parseShape( value );

      return computed => { computed.shape = shape; };
    }
    case 'border-width': {
      const num = parseNumber( prop, value );

      return computed => { computed.borderWidth = num; };
    }
    case 'opacity': {
      const num = parseNumber( prop, value );

      return computed => { computed.opacity = num; };
    }
    case 'label': {
      // constant strings, or the data(key) mapper reading the sidecar
      // ('id' reads the first-class id); mapData stays unsupported
      const text = String( value );
      const mapped = DATA_MAPPER.exec( text );

      if( mapped != null ){
        const key = mapped[ 1 ];

        return computed => { computed.label = ''; computed.labelKey = key; };
      }

      if( /^\s*(data|mapData)\s*\(/.test( text ) ){
        throw new Error(
          `The label value '${text}' is unsupported in the GPU prototype; ` +
          `only constant strings and 'data(key)' are allowed`
        );
      }

      return computed => { computed.label = text; computed.labelKey = null; };
    }
    case 'font-size': {
      const num = parseNumber( prop, value );

      return computed => { computed.fontSize = num; };
    }
    case 'color': {
      const color = parseColor( prop, value );

      return computed => { computed.textColor = color; };
    }

    // edge properties
    case 'line-color': {
      const color = parseColor( prop, value );

      return computed => { computed.lineColor = color; };
    }
    case 'source-arrow-shape':
    case 'target-arrow-shape': {
      const shape = parseArrowShape( prop, value );

      return prop === 'source-arrow-shape'
        ? computed => { computed.sourceArrowShape = shape; }
        : computed => { computed.targetArrowShape = shape; };
    }
    case 'source-arrow-color': {
      const color = parseColor( prop, value );

      return computed => { computed.sourceArrowColor = color; };
    }
    case 'target-arrow-color': {
      const color = parseColor( prop, value );

      return computed => { computed.targetArrowColor = color; };
    }

    default:
      throw new Error( `The style property '${prop}' is unsupported in the GPU prototype` );
  }
};

export class StyleEngine {
  private store: GraphStore;
  private blocks: GpuStyleBlock[];
  private compiled: CompiledBlock[];

  private dataMappers = false;
  private labelKeys = new Set<string>();
  private selectionDependent = false;
  private arrows = { source: false, target: false };

  constructor( store: GraphStore ){
    this.store = store;
    this.blocks = [];
    this.compiled = [];
  }

  /** Replace the stylesheet and re-apply to all alive elements. */
  setBlocks( blocks: GpuStyleBlock[] ): void {
    this.compiled = blocks.map( block => ( {
      selector: parseSelector( block.selector ),
      setters: Object.entries( block.style ).map( ( [ prop, value ] ) => compileProp( prop, value ) )
    } ) );

    // which mutable data() keys do labels map? (id is immutable, so
    // data(id) labels never need a refresh on data writes)
    this.labelKeys = new Set(
      blocks
        .map( block => {
          const label = block.style?.[ 'label' ];

          return label != null ? DATA_MAPPER.exec( String( label ) ) : null;
        } )
        .filter( mapped => mapped != null && mapped[ 1 ] !== 'id' )
        .map( mapped => mapped![ 1 ] )
    );
    this.dataMappers = this.labelKeys.size > 0;

    // does any block match on :selected/:unselected?  If not, a selection
    // change can never alter computed style, so select/unselect skips the
    // restyle pass entirely (the accent ring is drawn by the shader)
    this.selectionDependent = this.compiled.some(
      block => block.selector.terms.some( term => term.selected != null )
    );

    // which arrow ends can any edge have at all — the renderer skips
    // whole arrow draw calls per end when no block enables it
    this.arrows = {
      source: blocks.some( block => block.style?.[ 'source-arrow-shape' ] === 'triangle' ),
      target: blocks.some( block => block.style?.[ 'target-arrow-shape' ] === 'triangle' )
    };

    this.blocks = blocks;
    this.applyAll();
  }

  /** True when writing any of these data() keys can change a computed label. */
  labelDependsOn( keys: string[] ): boolean {
    if( !this.dataMappers ){ return false; }

    return keys.some( key => this.labelKeys.has( key ) );
  }

  /** True when a select/unselect can change computed style. */
  get dependsOnSelection(): boolean {
    return this.selectionDependent;
  }

  /** Which arrow ends the current stylesheet can enable. */
  get arrowEnds(): { source: boolean; target: boolean } {
    return this.arrows;
  }

  json(): GpuStyleBlock[] {
    return this.blocks;
  }

  /** v3-compat no-op-ish hook: re-apply the current blocks. */
  update(): void {
    this.applyAll();
  }

  applyAll(): void {
    this.applyBulk( 'nodes', this.store.slotsOrdered( 'nodes' ) );
    this.applyBulk( 'edges', this.store.slotsOrdered( 'edges' ) );
  }

  /**
   * Bulk apply over *live* slots of one group.  With the mini selector
   * language a match depends only on (group, selected) unless a block
   * selects by #id — so the stylesheet resolves once per selectedness
   * instead of once per element (the per-element cost drops to the column
   * writes).  Falls back to per-element apply when any #id block exists.
   */
  applyBulk( group: GroupName, slots: ArrayLike<number> ): void {
    if( slots.length === 0 ){ return; }

    if( this.hasIdBlock() ){
      for( let i = 0; i < slots.length; i++ ){
        this.apply( this.store.ref( group, slots[ i ] ) );
      }

      return;
    }

    const byState: [ ( NodeComputed & EdgeComputed ) | null, ( NodeComputed & EdgeComputed ) | null ] = [ null, null ];

    for( let i = 0; i < slots.length; i++ ){
      const slot = slots[ i ];
      const selected = this.store.hasFlag( group, slot, FLAG_SELECTED ) ? 1 : 0;
      let computed = byState[ selected ];

      if( computed == null ){
        computed = this.resolveState( group, selected === 1 );
        byState[ selected ] = computed;
      }

      this.write( group, slot, computed );
    }
  }

  /**
   * Refresh data-mapped node labels only — the data-write path.  A data
   * write can't change any other channel (blocks are constants), so this
   * skips the full per-element apply: the stylesheet resolves once per
   * selectedness (as in applyBulk) and each slot pays only the label text
   * recompute; setLabel no-ops when the entry is unchanged.
   */
  refreshLabels( slots: ArrayLike<number> ): void {
    if( slots.length === 0 || !this.dataMappers ){ return; }

    if( this.hasIdBlock() ){
      for( let i = 0; i < slots.length; i++ ){
        this.apply( this.store.ref( 'nodes', slots[ i ] ) );
      }

      return;
    }

    const byState: [ NodeComputed | null, NodeComputed | null ] = [ null, null ];

    for( let i = 0; i < slots.length; i++ ){
      const slot = slots[ i ];
      const selected = this.store.hasFlag( 'nodes', slot, FLAG_SELECTED ) ? 1 : 0;
      let computed = byState[ selected ];

      if( computed == null ){
        computed = this.resolveState( 'nodes', selected === 1 );
        byState[ selected ] = computed;
      }

      this.writeLabel( slot, computed );
    }
  }

  private hasIdBlock(): boolean {
    return this.compiled.some(
      block => block.selector.terms.some( term => term.id != null )
    );
  }

  /** Resolve defaults + blocks for one (group, selected) state — valid only without #id blocks. */
  private resolveState( group: GroupName, selected: boolean ): NodeComputed & EdgeComputed {
    const computed: NodeComputed & EdgeComputed = {
      ...NODE_DEFAULTS,
      ...EDGE_DEFAULTS,
      width: group === 'nodes' ? NODE_DEFAULTS.width : EDGE_DEFAULTS.width
    };

    for( const block of this.compiled ){
      const matches = block.selector.terms.some( term =>
        ( term.group == null || term.group === group ) &&
        ( term.selected == null || term.selected === selected )
      );

      if( matches ){
        for( const setter of block.setters ){
          setter( computed );
        }
      }
    }

    return computed;
  }

  /** Resolve defaults + matching blocks (in order) and write the element's channels. */
  apply( ref: Ref ): void {
    if( !this.store.isCurrent( ref ) ){ return; }

    // 'width' is shared by both groups; the group's own default wins
    const computed: NodeComputed & EdgeComputed = {
      ...NODE_DEFAULTS,
      ...EDGE_DEFAULTS,
      width: ref.group === 'nodes' ? NODE_DEFAULTS.width : EDGE_DEFAULTS.width
    };

    for( const block of this.compiled ){
      if( matchesRef( this.store, ref, block.selector ) ){
        for( const setter of block.setters ){
          setter( computed );
        }
      }
    }

    this.write( ref.group, ref.slot, computed );
  }

  private write( group: GroupName, slot: number, computed: NodeComputed & EdgeComputed ): void {
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
