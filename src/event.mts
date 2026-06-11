/*!
Event object based on jQuery events, MIT license

https://jquery.org/license/
https://tldrlegal.com/license/mit-license
https://github.com/jquery/jquery/blob/master/src/event.js
*/

import type { Position, CoreShim } from './types.mjs';

type NativeEvent = globalThis.Event;

export interface EventProps {
  originalEvent?: NativeEvent;
  type?: string;
  cy?: CoreShim;
  target?: unknown;
  position?: Position;
  renderedPosition?: Position;
  namespace?: string | null;
  layout?: unknown;
  timeStamp?: number;
}

export type EventSrc = string | NativeEvent | EventProps | null | undefined;

function returnFalse(): boolean {
  return false;
}

function returnTrue(): boolean {
  return true;
}

// http://www.w3.org/TR/2003/WD-DOM-Level-3-Events-20030331/ecma-script-binding.html
class Event {
  type!: string;
  originalEvent?: NativeEvent;
  cy?: CoreShim;
  target?: unknown;
  position?: Position;
  renderedPosition?: Position;
  namespace?: string | null;
  layout?: unknown;
  timeStamp!: number;

  isDefaultPrevented: () => boolean = returnFalse;
  isPropagationStopped: () => boolean = returnFalse;
  isImmediatePropagationStopped: () => boolean = returnFalse;

  constructor( src: EventSrc, props?: EventProps ){
    this.recycle( src, props );
  }

  instanceString(): string {
    return 'event';
  }

  recycle( src: EventSrc, props?: EventProps ): void {
    this.isImmediatePropagationStopped = this.isPropagationStopped = this.isDefaultPrevented = returnFalse;

    if( src != null && typeof src !== 'string' && 'preventDefault' in src && typeof src.preventDefault === 'function' ){ // Browser Event object
      this.type = src.type;

      // Events bubbling up the document may have been marked as prevented
      // by a handler lower down the tree; reflect the correct value.
      this.isDefaultPrevented = ( src.defaultPrevented ) ? returnTrue : returnFalse;

    } else if( src != null && typeof src !== 'string' && src.type ){ // Plain object containing all event details
      props = src as EventProps;

    } else { // Event string
      this.type = src as string;
    }

    // Put explicitly provided properties onto the event object
    if( props != null ){
      // more efficient to manually copy fields we use
      this.originalEvent = props.originalEvent;
      this.type = props.type != null ? props.type : this.type;
      this.cy = props.cy;
      this.target = props.target;
      this.position = props.position;
      this.renderedPosition = props.renderedPosition;
      this.namespace = props.namespace;
      this.layout = props.layout;
    }

    if( this.cy != null && this.position != null && this.renderedPosition == null ){
      // create a rendered position based on the passed position
      let pos = this.position;
      let zoom = this.cy.zoom();
      let pan = this.cy.pan();

      this.renderedPosition = {
        x: pos.x * zoom + pan.x,
        y: pos.y * zoom + pan.y
      };
    }

    // Create a timestamp if incoming event doesn't have one
    this.timeStamp = ( src && typeof src !== 'string' && src.timeStamp ) || Date.now();
  }

  preventDefault(): void {
    this.isDefaultPrevented = returnTrue;

    let e = this.originalEvent;
    if( !e ){
      return;
    }

    // if preventDefault exists run it on the original event
    if( e.preventDefault ){
      e.preventDefault();
    }
  }

  stopPropagation(): void {
    this.isPropagationStopped = returnTrue;

    let e = this.originalEvent;
    if( !e ){
      return;
    }

    // if stopPropagation exists run it on the original event
    if( e.stopPropagation ){
      e.stopPropagation();
    }
  }

  stopImmediatePropagation(): void {
    this.isImmediatePropagationStopped = returnTrue;
    this.stopPropagation();
  }
}

export default Event;
