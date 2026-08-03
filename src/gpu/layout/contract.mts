/*
The layout extension contract (round 17.5): direct objects, no
registry.

v4 has no `cytoscape.use` and no string registration — an extension
layout is an import the app passes straight in:

    import { Fcose } from 'fcose-gpu';
    cy.layout( { impl: Fcose, animate: true, ... } ).run();

`impl` is a class (constructed with no arguments) or a plain object
implementing `{ run( ctx ), stop?() }`.  `run` may return a promise —
the lifecycle waits for it (the shape a GPU-resident layout needs).
Layout instances stay non-emitters (the round-10 rule): the lifecycle
events — `layoutstart`, `layoutready`, `layoutstop`, with the wrapper
as `event.layout` — fire on the core exactly once per run, whether the
impl uses the discrete finisher or the direct bulk path.

The **LayoutContext** is columnar-first: slot-indexed reads (the live
position column, CSR degrees, edge endpoints, the scope's slots
pre-filtered to unlocked leaves — parents derive from their placed
children, the round-14 rule) and one bulk write, `setPositions`, on
the round-5 slot path (one dirty span, no per-element handles).
Handles stay reachable (`ctx.eles`, `ctx.nodes`) at handle cost — the
contract makes the columnar path the obvious one.  For discrete
layouts, `ctx.layoutPositions( fn )` is the full v3 finisher
(spacingFactor / transform / animate / fit and the lifecycle).
*/

import { FLAG_LOCKED, FLAG_PARENT } from '../contract.mjs';
import type { GpuCore } from '../core.mjs';
import type { GpuCollection } from '../collection.mjs';
import type { GpuCustomLayoutOptions, Position } from '../gpu-types.mjs';

export interface GpuLayoutImpl {
  run( ctx: GpuLayoutContext ): void | Promise<void>;
  stop?(): void;
}

export class GpuLayoutContext {
  /** the core being laid out */
  readonly cy: GpuCore;
  /** the resolved layout options (custom knobs included) */
  readonly options: GpuCustomLayoutOptions;
  /** the layout scope (handles tier); whole graph unless eles.layout */
  readonly eles: GpuCollection;
  /** the scope's node handles */
  readonly nodes: GpuCollection;

  /** the discrete finisher ran: its lifecycle covers the run */
  _finisherUsed = false;

  private layout: object;
  private slots: number[] | null = null;

  /**
   * Built by the wrapper, once per run — a layout impl receives one of
   * these and never constructs it.
   *
   * @param cy — the core being laid out
   * @param layout — the wrapper, passed through as `event.layout` on the
   *   lifecycle events
   * @param options — the resolved layout options; `eles` narrows the
   *   scope (from `eles.layout()`), defaulting to the whole graph
   */
  constructor( cy: GpuCore, layout: object, options: GpuCustomLayoutOptions ){
    this.cy = cy;
    this.layout = layout;
    this.options = options;
    this.eles = ( options.eles as GpuCollection | undefined ) ?? cy.elements();
    this.nodes = this.eles.nodes();
  }

  /**
   * The slots to lay out: the scope's nodes, pre-filtered to unlocked
   * leaves (locked nodes hold their place; parents derive from their
   * placed children — round 14.11).  Scope order.
   */
  nodeSlots(): number[] {
    if( this.slots != null ){ return this.slots; }

    const store = this.cy._store;
    const out: number[] = [];

    for( let i = 0; i < this.nodes.length; i++ ){
      const ref = this.nodes[ i ]._eventRef();

      if( ref == null || !this.nodes[ i ].inside() ){ continue; }

      if( store.hasFlag( 'nodes', ref.slot, FLAG_PARENT )
        || store.hasFlag( 'nodes', ref.slot, FLAG_LOCKED ) ){ continue; }

      out.push( ref.slot );
    }

    this.slots = out;

    return out;
  }

  /** the scope's edge slots */
  edgeSlots(): number[] {
    const out: number[] = [];

    for( const ref of this.eles._liveRefs() ){
      if( ref.group === 'edges' ){ out.push( ref.slot ); }
    }

    return out;
  }

  /** the live position column (x,y interleaved by slot) — read it,
   * write through setPositions */
  positions(): Float32Array {
    return this.cy._store.column( 'node.position' ) as Float32Array;
  }

  /** the live edge endpoint column (source,target node slots) */
  endpoints(): Uint32Array {
    return this.cy._store.column( 'edge.endpoints' ) as Uint32Array;
  }

  /**
   * O(1) degree off the CSR adjacency.
   *
   * @param slot — a node slot, as handed out by `nodeSlots()`
   * @returns its whole-graph degree, loops counted as v3 counts them
   */
  degreeOf( slot: number ): number {
    const adj = this.cy._store.adj;

    return adj.outDegree( slot ) + adj.inDegree( slot );
  }

  /**
   * The scope's current bounding box, labels included.
   *
   * @returns `{ x1, y1, x2, y2, w, h }` in model coordinates
   */
  boundingBox(): ReturnType<GpuCollection['boundingBox']> {
    return this.eles.boundingBox();
  }

  /**
   * The viewport width in CSS px — what a layout sizing itself to the
   * screen should use.  Headless instances report the configured
   * headless width, so a layout still works without a DOM.
   *
   * @returns the viewport width
   */
  width(): number {
    return this.cy.width() as number;
  }

  /**
   * The viewport height in CSS px.
   *
   * @returns the viewport height
   */
  height(): number {
    return this.cy.height() as number;
  }

  /**
   * The bulk write: xy[i*2], xy[i*2+1] land on slots[i] — one dirty
   * span, no handles (the round-5 slot path; under compounds it takes
   * the per-slot sequential path so auto-bounds stay exact).
   *
   * @param slots — the node slots to move
   * @param xy — the packed positions: `xy[i*2]`, `xy[i*2+1]` land on
   *   `slots[i]`
   */
  setPositions( slots: number[], xy: number[] | Float32Array ): void {
    this.cy._store.setPositions( slots, xy );
  }

  /**
   * The discrete finisher: v3's layoutPositions plumbing over the
   * scope — spacingFactor, transform, animate (with the
   * fit-at-final-positions viewport animation), fit/zoom/pan, and the
   * layoutready/layoutstop events.  The wrapper's layoutstart covers
   * the start (no double emit).
   *
   * @param fn — called per scoped node with the node and its index,
   *   returning the model position to place it at
   */
  layoutPositions( fn: ( node: GpuCollection, i: number ) => Position ): void {
    this._finisherUsed = true;
    this.eles.layoutPositions( this.layout, {
      ...this.options,
      eles: this.eles,
      _startEmitted: true
    } as GpuCustomLayoutOptions, fn );
  }
}

/** The wrapper cy.layout({ impl }) returns: the builtins' shape plus
 * promise() (resolves at this run's layoutstop). */
export class CustomLayout {
  /** the resolved options this run was created with */
  options: GpuCustomLayoutOptions;

  private cy: GpuCore;
  private impl: GpuLayoutImpl;
  private donePromise: Promise<void> = Promise.resolve();

  /**
   * Wrap a layout impl.  Reached through `cy.layout( { impl } )` /
   * `eles.layout( { impl } )` rather than constructed directly.
   *
   * @param cy — the core to lay out
   * @param options — must carry `impl`, a class constructed with no
   *   arguments or a plain object, implementing `{ run( ctx ), stop?() }`
   * @throws if `impl` is missing, or does not implement `run( ctx )`
   */
  constructor( cy: GpuCore, options: GpuCustomLayoutOptions ){
    const provided = options.impl;
    let impl: GpuLayoutImpl;

    if( typeof provided === 'function' ){
      impl = new ( provided as new () => GpuLayoutImpl )();
    } else if( provided != null && typeof provided === 'object' ){
      impl = provided as GpuLayoutImpl;
    } else {
      throw new Error( `A custom layout needs an impl class or object` );
    }

    if( typeof impl.run !== 'function' ){
      throw new Error( `A layout impl must implement run( ctx )` );
    }

    this.cy = cy;
    this.impl = impl;
    this.options = options;
  }

  /**
   * Start the layout.  Emits `layoutstart` on the core, calls
   * `impl.run( ctx )` and awaits it if it returns a promise (the shape a
   * GPU-resident layout needs).
   *
   * The lifecycle fires exactly once per run either way: an impl that
   * finishes through `ctx.layoutPositions()` lets the finisher emit
   * `layoutready`/`layoutstop`, and one that writes positions directly
   * has them emitted here instead.
   *
   * @returns this layout, for chaining; await `promise()` for
   *   completion
   */
  run(): this {
    const cy = this.cy;
    let resolve!: () => void;

    this.donePromise = new Promise<void>( r => { resolve = r; } );

    const ctx = new GpuLayoutContext( cy, this, {
      ...this.options,
      // the finisher resolves the run promise at its stop callback
      stop: () => {
        this.options.stop?.();
        resolve();
      }
    } );

    cy.emit( { type: 'layoutstart', layout: this } );

    Promise.resolve( this.impl.run( ctx ) ).then( () => {
      if( ctx._finisherUsed ){ return; } // its lifecycle covers the run

      this.options.ready?.();
      cy.emit( { type: 'layoutready', layout: this } );
      this.options.stop?.();
      cy.emit( { type: 'layoutstop', layout: this } );
      resolve();
    } );

    return this;
  }

  /** Resolves at this run's layoutstop (immediately when never run). */
  promise(): Promise<void> {
    return this.donePromise;
  }

  /**
   * Ask the layout to stop early, by calling the impl's optional
   * `stop()`.  An impl without one simply runs to completion.
   *
   * @returns this layout, for chaining
   */
  stop(): this {
    this.impl.stop?.();

    return this;
  }
}
