import { color2tuple } from '../util/colors.mjs';
import {
  SHAPE_CIRCLE, SHAPE_ELLIPSE, SHAPE_RECTANGLE, SHAPE_ROUND_RECTANGLE
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
}

interface EdgeComputed {
  lineColor: RGBA;
  width: number;
  opacity: number;
}

const NODE_DEFAULTS: NodeComputed = {
  fillColor: [ 153, 153, 153, 255 ], // #999
  borderColor: [ 0, 0, 0, 255 ],
  width: 30,
  height: 30,
  shape: SHAPE_ELLIPSE,
  opacity: 1,
  borderWidth: 0
};

const EDGE_DEFAULTS: EdgeComputed = {
  lineColor: [ 153, 153, 153, 255 ], // #999
  width: 2,
  opacity: 1
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

    // edge properties
    case 'line-color': {
      const color = parseColor( prop, value );

      return computed => { computed.lineColor = color; };
    }

    default:
      throw new Error( `The style property '${prop}' is unsupported in the GPU prototype` );
  }
};

export class StyleEngine {
  private store: GraphStore;
  private blocks: GpuStyleBlock[];
  private compiled: CompiledBlock[];

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

    this.blocks = blocks;
    this.applyAll();
  }

  json(): GpuStyleBlock[] {
    return this.blocks;
  }

  /** v3-compat no-op-ish hook: re-apply the current blocks. */
  update(): void {
    this.applyAll();
  }

  applyAll(): void {
    this.store.forEachAlive( 'nodes', slot => this.apply( this.store.ref( 'nodes', slot ) ) );
    this.store.forEachAlive( 'edges', slot => this.apply( this.store.ref( 'edges', slot ) ) );
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
    } else {
      store.setColor( 'edge.lineColor', slot, ...computed.lineColor );
      store.setScalar( 'edge.width', slot, computed.width );
      store.setScalar( 'edge.opacity', slot, computed.opacity );
    }
  }
}
