// type testing utility functions

;(function($$, window){ 'use strict';

  $$.is = {
    string: function(obj){
      return obj != null && typeof obj == typeof '';
    },
    
    fn: function(obj){
      return obj != null && typeof obj === typeof function(){};
    },
    
    array: function(obj){
      return Array.isArray ? Array.isArray(obj) : obj != null && obj instanceof Array;
    },
    
    plainObject: function(obj){
      return obj != null && typeof obj === typeof {} && !$$.is.array(obj) && obj.constructor === Object;
    },
    
    number: function(obj){
      return obj != null && typeof obj === typeof 1 && !isNaN(obj);
    },

    integer: function( obj ){
      return $$.is.number(obj) && Math.floor(obj) === obj;
    },
    
    color: function(obj){
      return obj != null && typeof obj === typeof '' && $.Color(obj).toString() !== '';
    },
    
    bool: function(obj){
      return obj != null && typeof obj === typeof true;
    },
    
    elementOrCollection: function(obj){
      return $$.is.element(obj) || $$.is.collection(obj);
    },
    
    element: function(obj){
      return obj instanceof $$.Element && obj._private.single;
    },
    
    collection: function(obj){
      return obj instanceof $$.Collection && !obj._private.single;
    },
    
    core: function(obj){
      return obj instanceof $$.Core;
    },

    style: function(obj){
      return obj instanceof $$.Style;
    },

    stylesheet: function(obj){
      return obj instanceof $$.Stylesheet;
    },

    event: function(obj){
      return obj instanceof $$.Event;
    },

    emptyString: function(obj){
      if( !obj ){ // null is empty
        return true; 
      } else if( $$.is.string(obj) ){
        if( obj === '' || obj.match(/^\s+$/) ){
          return true; // empty string is empty
        }
      }
      
      return false; // otherwise, we don't know what we've got
    },
    
    nonemptyString: function(obj){
      if( obj && $$.is.string(obj) && obj !== '' && !obj.match(/^\s+$/) ){
        return true;
      }

      return false;
    },

    domElement: function(obj){
      if( typeof HTMLElement === 'undefined' ){
        return false; // we're not in a browser so it doesn't matter
      } else {
        return obj instanceof HTMLElement;
      }
    },

    touch: function(){
      return window && ( ('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch );
    },

    boundingBox: function(obj){
      return $$.is.plainObject(obj) && 
        $$.is.number(obj.x1) && $$.is.number(obj.x2) &&
        $$.is.number(obj.y1) && $$.is.number(obj.y2)
      ;
    }
  };  
  
})( cytoscape, typeof window === 'undefined' ? null : window );
