;(function($, $$){ 'use strict';
  
  if( !$ ){ return; } // no jquery => don't need this

  // allow calls on a jQuery selector by proxying calls to $.cytoscape
  // e.g. $("#foo").cytoscape(options) => $.cytoscape(options) on #foo
  $.fn.cytoscape = function(opts){
    var $this = $(this);

    // get object
    if( opts === 'get' ){
      var reg = $$.getRegistrationForInstance( $this[0] );
      return reg.cy;
    }
    
    // bind to ready
    else if( $$.is.fn(opts) ){
      //debugger;

      var ready = opts;
      var domEle = $this[0];
      var reg = $$.getRegistrationForInstance( domEle );

      if( !reg ){
        reg = $$.registerInstance( domEle );
      }
      
      if( reg && reg.cy && reg.cy.ready() ){
        // already ready so just trigger now
        reg.cy.trigger('ready', [], ready);

      } else {
        // not yet ready, so add to readies list
        
        reg.readies.push( ready );
      } 
      
    }
    
    // proxy to create instance
    else if( $$.is.plainObject(opts) ){
      return $this.each(function(){
        var options = $.extend({}, opts, {
          container: $(this)[0]
        });
      
        cytoscape(options);
      });
    }
    
    // proxy a function call
    else {
      var domEle = $this[0];
      var rets = [];
      var args = [];
      for(var i = 1; i < arguments.length; i++){
        args[i - 1] = arguments[i];
      }
      
      $this.each(function(){
        var reg = $$.getRegistrationForInstance( domEle );
        var cy = reg.cy;
        var fnName = opts;
        
        if( cy && $$.is.fn( cy[fnName] ) ){
          var ret = cy[fnName].apply(cy, args);
          rets.push(ret);
        }
      });
      
      // if only one instance, don't need to return array
      if( rets.length === 1 ){
        rets = rets[0];
      } else if( rets.length === 0 ){
        rets = $(this);
      }
      
      return rets;
    }

  };
  
  // allow access to the global cytoscape object under jquery for legacy reasons
  $.cytoscape = cytoscape;
  
  // use short alias (cy) if not already defined
  if( $.fn.cy == null && $.cy == null ){
    $.fn.cy = $.fn.cytoscape;
    $.cy = $.cytoscape;
  }
  
})(typeof jQuery !== 'undefined' ? jQuery : null , cytoscape);
