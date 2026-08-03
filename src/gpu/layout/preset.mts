import { FLAG_PARENT } from '../contract.mjs';
import { hasListeners } from '../events.mjs';
import type { Position } from '../../types.mjs';
import type { GpuPresetLayoutOptions } from '../gpu-types.mjs';
import type { GpuCollection } from '../collection.mjs';
import type { GpuCore } from '../core.mjs';

/*
Preset layout: applies `options.positions` (id-keyed map or per-node
function) and the viewport options, as v3's preset layout does.  The map
form resolves ids straight to slots and bulk-writes — O(map), no element
handles; only the function form (which takes handles by contract) walks
nodes.  With no `positions` at all, node positions are already in the
model (set at add time), so only the viewport options apply.  Animation
is out of scope, as everywhere in the prototype.
*/

const defaults: Omit<GpuPresetLayoutOptions, 'name'> = {
  positions: undefined, // map of (node id) => position, or function(node) => position
  zoom: undefined, // the zoom level to set (prob want fit = false if set)
  pan: undefined, // the pan level to set (prob want fit = false if set)
  fit: true, // whether to fit to viewport
  padding: 30 // padding on fit
};

/**
 * Place nodes at explicitly supplied positions.
 *
 * `positions` is a map from element id to `{ x, y }`, or a function of the node; nodes without a position keep the one they have.
 */
export class PresetLayout {
  /** the resolved options this layout was created with */
  options: GpuPresetLayoutOptions;

  private cy: GpuCore;

  /**
   * Reached through `cy.layout( { name: 'preset' } )` /
   * `eles.layout( … )` rather than constructed directly.
   *
   * @param cy — the core to lay out
   * @param options — this layout's options merged over its defaults,
   *   plus the shared plumbing (`fit`, `padding`, `spacingFactor`,
   *   `transform`, `animate`, the lifecycle callbacks)
   */
  constructor( cy: GpuCore, options: GpuPresetLayoutOptions ){
    this.cy = cy;
    this.options = { ...defaults, ...options };
  }

  /**
   * Run the layout: emits `layoutstart`, writes the positions, then
   * emits `layoutready`/`layoutstop`.  Under `animate: true` the nodes
   * tween to their targets and a `fit` animates the viewport to the box
   * at the *final* positions, concurrently.
   *
   * @returns this layout, for chaining
   */
  run(): this {
    const cy = this.cy;
    const options = this.options;
    const positions = options.positions;

    cy.emit( { type: 'layoutstart', layout: this } );

    const scope = ( options.eles as GpuCollection | undefined ) ?? cy;

    if( typeof positions === 'function' ){
      // function form takes handles by contract
      scope.nodes().positions( ( ele: GpuCollection ) => {
        if( ele.isParent() ){ return false; } // parents derive (14.11)

        return ( positions as ( node: GpuCollection ) => Position | null | undefined )( ele ) ?? false;
      } );
    } else if( positions != null ){
      // map form: resolve ids to slots directly; absent ids keep their position
      const store = cy._store;
      const slots: number[] = [];
      const xy: number[] = [];

      for( const id of Object.keys( positions ) ){
        const entry = store.lookup( id );
        const pos = positions[ id ];

        if( entry == null || entry.group !== 'nodes' || pos == null ){ continue; }
        if( store.hasFlag( 'nodes', entry.slot, FLAG_PARENT ) ){ continue; } // parents derive (14.11)

        slots.push( entry.slot );
        xy.push( pos.x, pos.y );
      }

      store.setPositions( slots, xy );

      if( hasListeners( cy._emitter, 'position' ) ){
        for( const slot of slots ){
          cy._emitOnEle( 'position', cy._ele( 'nodes', slot ) );
        }
      }
    }

    if( options.fit !== false ){
      cy.fit( options.eles as GpuCollection | undefined, options.padding ?? 30 );
    } else {
      if( options.zoom != null ){ cy.zoom( options.zoom ); }
      if( options.pan != null ){ cy.pan( options.pan ); }
    }

    cy.emit( { type: 'layoutready', layout: this } );
    cy.emit( { type: 'layoutstop', layout: this } );

    return this;
  }
}
