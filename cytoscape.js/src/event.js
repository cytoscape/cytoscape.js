'use strict';

/*!
Event object based on jQuery events, MIT license

https://jquery.org/license/
https://tldrlegal.com/license/mit-license
https://github.com/jquery/jquery/blob/master/src/event.js
*/

var Event = function( src, props ){
  // Allow instantiation without the 'new' keyword
  if( !(this instanceof Event) ){
    return new Event( src, props );
  }

  // Event object
  if( src && src.type ){
    this.originalEvent = src;
    this.type = src.type;

    // Events bubbling up the document may have been marked as prevented
    // by a handler lower down the tree; reflect the correct value.
    this.isDefaultPrevented = ( src.defaultPrevented ) ? returnTrue : returnFalse;

  // Event type
  } else {
    this.type = src;
  }

  // Put explicitly provided properties onto the event object
  if( props ){
    // util.extend( this, props );

    // more efficient to manually copy fields we use
    this.type = props.type !== undefined ? props.type : this.type;
    this.cy = props.cy;
    this.cyTarget = props.cyTarget;
    this.cyPosition = props.cyPosition;
    this.cyRenderedPosition = props.cyRenderedPosition;
    this.namespace = props.namespace;
    this.layout = props.layout;
    this.data = props.data;
    this.message = props.message;
  }

  // Create a timestamp if incoming event doesn't have one
  this.timeStamp = src && src.timeStamp || Date.now();
};

function returnFalse(){
  return false;
}

function returnTrue(){
  return true;
}

// http://www.w3.org/TR/2003/WD-DOM-Level-3-Events-20030331/ecma-script-binding.html
Event.prototype = {
  instanceString: function(){
    return 'event';
  },

  preventDefault: function(){
    this.isDefaultPrevented = returnTrue;

    var e = this.originalEvent;
    if( !e ){
      return;
    }

    // if preventDefault exists run it on the original event
    if( e.preventDefault ){
      e.preventDefault();
    }
  },

  stopPropagation: function(){
    this.isPropagationStopped = returnTrue;

    var e = this.originalEvent;
    if( !e ){
      return;
    }

    // if stopPropagation exists run it on the original event
    if( e.stopPropagation ){
      e.stopPropagation();
    }
  },

  stopImmediatePropagation: function(){
    this.isImmediatePropagationStopped = returnTrue;
    this.stopPropagation();
  },

  isDefaultPrevented: returnFalse,
  isPropagationStopped: returnFalse,
  isImmediatePropagationStopped: returnFalse
};

module.exports = Event;
