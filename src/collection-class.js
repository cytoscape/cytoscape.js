;(function( $$ ){ 'use strict';
  
  $$.fn.eles({
    classes: function(opts){
      var triggerEles = [];
      var eles = this;
      var changed = [];
      var fn;

      if( $$.is.fn(opts) ){
        fn = opts;

      } else if( !$$.is.plainObject(opts) ){
        return this; // needs opts or fn
      } 

      for(var i = 0; i < eles.length; i++){
        var ele = eles[i];
        var eleChanged = false;

        opts = fn ? fn.apply(ele, [i, ele]) : opts;

        // add classes
        if( opts.add ){ for( var j = 0; j < opts.add.length; j++ ){
          var cls = opts.add[j];
          var hasClass = ele._private.classes[cls];

          ele._private.classes[cls] = true;

          if( !hasClass && !eleChanged ){
            changed.push( ele );
            eleChanged = true;
          }
        } }

        // remove classes
        if( opts.remove ){ for( var j = 0; j < opts.remove.length; j++ ){
          var cls = opts.remove[j];
          var hasClass = ele._private.classes[cls];

          ele._private.classes[cls] = false;

          if( hasClass && !eleChanged ){
            changed.push( ele );
            eleChanged = true;
          }
        } }

        // toggle classes
        if( opts.toggle ){ for( var j = 0; j < opts.toggle.length; j++ ){
          var cls = opts.toggle[j];
          var hasClass = ele._private.classes[cls];

          ele._private.classes[cls] = !hasClass;

          if( !eleChanged ){
            changed.push( ele );
            eleChanged = true;
          }
        } }
      }

      if( changed.length > 0 ){
        new $$.Collection( this.cy(), changed )
          .updateStyle()
          .trigger('class')
      }

      return this;
    },

    addClass: function(classes){
      classes = classes.split(/\s+/);
      var self = this;
      var changed = [];
      
      for( var i = 0; i < classes.length; i++ ){
        var cls = classes[i];
        if( $$.is.emptyString(cls) ){ continue; }
        
        for( var j = 0; j < self.length; j++ ){
          var ele = self[j];
          var hasClass = ele._private.classes[cls];
          ele._private.classes[cls] = true;

          if( !hasClass ){ // if didn't already have, add to list of changed
            changed.push( ele );
          }
        }
      }
      
      // trigger update style on those eles that had class changes
      if( changed.length > 0 ){
        new $$.Collection(this._private.cy, changed)
          .updateStyle()
          .trigger('class')
        ;
      }

      return self;
    },

    hasClass: function(className){
      var ele = this[0];
      return ( ele != null && ele._private.classes[className] ) ? true : false;
    },

    toggleClass: function(classesStr, toggle){
      var classes = classesStr.split(/\s+/);
      var self = this;
      var changed = []; // eles who had classes changed
      
      for( var i = 0, il = self.length; i < il; i++ ){
        var ele = self[i];

        for( var j = 0; j < classes.length; j++ ){
          var cls = classes[j];

          if( $$.is.emptyString(cls) ){ continue; }
          
          var hasClass = ele._private.classes[cls];
          var shouldAdd = toggle || (toggle === undefined && !hasClass);

          if( shouldAdd ){
            ele._private.classes[cls] = true;

            if( !hasClass ){ changed.push(ele); }
          } else { // then remove
            ele._private.classes[cls] = false;

            if( hasClass ){ changed.push(ele); }
          }

        } // for j classes
      } // for i eles
      
      // trigger update style on those eles that had class changes
      if( changed.length > 0 ){
        new $$.Collection(this._private.cy, changed)
          .updateStyle()
          .trigger('class')
        ;
      }

      return self;
    },

    removeClass: function(classes){
      classes = classes.split(/\s+/);
      var self = this;
      var changed = [];

      for( var i = 0; i < self.length; i++ ){
        var ele = self[i];

        for( var j = 0; j < classes.length; j++ ){
          var cls = classes[j];
          if( !cls || cls === '' ){ continue; }

          var hasClass = ele._private.classes[cls];
          delete ele._private.classes[cls];

          if( hasClass ){ // then we changed its set of classes
            changed.push( ele );
          }
        }
      }
      
      // trigger update style on those eles that had class changes
      if( changed.length > 0 ){
        new $$.Collection(self._private.cy, changed).updateStyle();
      }

      self.trigger('class');
      return self;
    },

    flashClass: function(classes, duration){
      var self = this;

      if( duration == null ){
        duration = 250;
      } else if( duration === 0 ){
        return self; // nothing to do really
      }

      self.addClass( classes );
      setTimeout(function(){
        self.removeClass( classes );
      }, duration);

      return self;
    }
  });
  
})( cytoscape );
