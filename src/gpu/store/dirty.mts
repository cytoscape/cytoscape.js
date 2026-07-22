import type { ColumnId, DirtySpan, GroupName, StoreDelta } from '../contract.mjs';

interface Span {
  start: number;
  end: number;
}

/**
 * Tracks one coalesced `[min, end)` dirty span per column per frame, plus a
 * per-group `resized` flag (capacity growth ⇒ the renderer reallocates the
 * group's buffers and re-uploads in full).  `take()` returns-and-clears.
 * Invalidation callbacks fire at most once per microtask so a burst of
 * mutations schedules a single frame.
 */
export class DirtyTracker {
  private spans: Map<ColumnId, Span>;
  private resized: { nodes: boolean; edges: boolean };
  private cbs: ( () => void )[];
  private scheduled: boolean;

  constructor(){
    this.spans = new Map();
    this.resized = { nodes: false, edges: false };
    this.cbs = [];
    this.scheduled = false;
  }

  mark( column: ColumnId, start: number, end: number = start + 1 ): void {
    const span = this.spans.get( column );

    if( span == null ){
      this.spans.set( column, { start, end } );
    } else {
      span.start = Math.min( span.start, start );
      span.end = Math.max( span.end, end );
    }

    this.schedule();
  }

  markResized( group: GroupName ): void {
    this.resized[ group ] = true;
    this.schedule();
  }

  hasDirty(): boolean {
    return this.spans.size > 0 || this.resized.nodes || this.resized.edges;
  }

  take( nodeHighWater: number, edgeHighWater: number ): StoreDelta {
    const spans: DirtySpan[] = [];

    for( const [ column, span ] of this.spans ){
      spans.push( { column, start: span.start, end: span.end } );
    }

    const delta: StoreDelta = {
      resized: this.resized,
      spans,
      nodeHighWater,
      edgeHighWater
    };

    this.spans = new Map();
    this.resized = { nodes: false, edges: false };

    return delta;
  }

  onInvalidate( cb: () => void ): () => void {
    this.cbs.push( cb );

    return () => {
      const i = this.cbs.indexOf( cb );

      if( i >= 0 ){ this.cbs.splice( i, 1 ); }
    };
  }

  private schedule(): void {
    if( this.scheduled ){ return; }

    this.scheduled = true;

    queueMicrotask( () => {
      this.scheduled = false;

      if( !this.hasDirty() ){ return; } // e.g. taken synchronously before the microtask ran

      for( const cb of this.cbs.slice() ){
        cb();
      }
    } );
  }
}
