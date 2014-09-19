;(function($$, window){ 'use strict';
  
  $$.fn.core({
    
    // pull in animation functions
    animated: $$.define.animated(),
    clearQueue: $$.define.clearQueue(),
    delay: $$.define.delay(),
    animate: $$.define.animate(),
    stop: $$.define.stop(),

    addToAnimationPool: function( eles ){
      var cy = this;

      if( !cy.styleEnabled() ){ return; } // save cycles when no style used
      
      cy._private.aniEles.merge( eles );
    },

    startAnimationLoop: function(){
      var cy = this;

      if( !cy.styleEnabled() ){ return; } // save cycles when no style used

      // don't execute the animation loop in headless environments
      if( !window ){
        return;
      }
      
      function globalAnimationStep(){
        $$.util.requestAnimationFrame(function(now){
          handleElements(now);
          globalAnimationStep();
        });
      }
      
      globalAnimationStep(); // first call
      
      function handleElements(now){
        now = +new Date();

        var eles = cy._private.aniEles;
        var doneEles = [];

        function handleElement( ele, isCore ){
          var current = ele._private.animation.current;
          var queue = ele._private.animation.queue;
          var ranAnis = false;
          
          // if nothing currently animating, get something from the queue
          if( current.length === 0 ){
            var next = queue.length > 0 ? queue.shift() : null;
            
            if( next ){
              next.callTime = now; // was queued, so update call time
              current.push( next );
            }
          }
          
          // step and remove if done
          var completes = [];
          for(var i = current.length - 1; i >= 0; i--){
            var ani = current[i];

            // start if need be
            if( !ani.started ){ startAnimation( ele, ani ); }
            
            step( ele, ani, now, isCore );

            if( ani.done ){
              completes.push( ani );
              
              // remove current[i]
              current.splice(i, 1);
            }

            ranAnis = true;
          }
          
          // call complete callbacks
          for( var i = 0; i < completes.length; i++ ){
            var ani = completes[i];
            var complete = ani.params.complete;

            if( $$.is.fn(complete) ){
              complete.apply( ele, [ now ] );
            }
          }

          if( !isCore && current.length === 0 && queue.length === 0 ){
            doneEles.push( ele );
          }

          return ranAnis;
        } // handleElements

        // handle all eles
        for( var e = 0; e < eles.length; e++ ){
          var ele = eles[e];
          
          handleElement( ele );
        } // each element

        var ranCoreAni = handleElement( cy, true );
        
        // notify renderer
        if( eles.length > 0 || ranCoreAni ){
          var toNotify;

          if( eles.length > 0 ){
            var updatedEles = eles.updateCompoundBounds();
            toNotify = updatedEles.length > 0 ? eles.add( updatedEles ) : eles;
          }

          cy.notify({
            type: 'draw',
            collection: toNotify
          });
        }

        // remove elements from list of currently animating if its queues are empty
        eles.unmerge( doneEles );

      } // handleElements
      
      function startAnimation( self, ani ){
        var isCore = $$.is.core( self );
        var isEles = !isCore;
        var ele = self;
        var style = cy._private.style;

        if( isEles ){
          var pos = ele._private.position;
          var startPosition = {
            x: pos.x,
            y: pos.y
          };
          var startStyle = style.getValueStyle( ele );
        }

        if( isCore ){
          var pan = cy._private.pan;
          var startPan = {
            x: pan.x,
            y: pan.y
          };

          var startZoom = cy._private.zoom;
        }

        ani.started = true;
        ani.startTime = Date.now();
        ani.startPosition = startPosition;
        ani.startStyle = startStyle;
        ani.startPan = startPan;
        ani.startZoom = startZoom;
      }

      function step( self, animation, now, isCore ){
        var style = cy._private.style;
        var properties = animation.properties;
        var params = animation.params;
        var startTime = animation.startTime;
        var percent;
        var isEles = !isCore;
        
        if( animation.duration === 0 ){
          percent = 1;
        } else {
          percent = Math.min(1, (now - startTime)/animation.duration);
        }

        if( percent < 0 ){
          percent = 0;
        } else if( percent > 1 ){
          percent = 1;
        }
        
        if( properties.delay == null ){ // then update

          var startPos = animation.startPosition;
          var endPos = properties.position;
          var pos = self._private.position;
          if( endPos && isEles ){
            if( valid( startPos.x, endPos.x ) ){
              pos.x = ease( startPos.x, endPos.x, percent );
            }

            if( valid( startPos.y, endPos.y ) ){
              pos.y = ease( startPos.y, endPos.y, percent );
            }
          }

          var startPan = animation.startPan;
          var endPan = properties.pan;
          var pan = self._private.pan;
          var animatingPan = endPan != null && isCore;
          if( animatingPan ){
            if( valid( startPan.x, endPan.x ) ){
              pan.x = ease( startPan.x, endPan.x, percent );
            }

            if( valid( startPan.y, endPan.y ) ){
              pan.y = ease( startPan.y, endPan.y, percent );
            }

            self.trigger('pan');
          }

          var startZoom = animation.startZoom;
          var endZoom = properties.zoom;
          var animatingZoom = endZoom != null && isCore;
          if( animatingZoom ){
            if( valid( startZoom, endZoom ) ){
              self._private.zoom = ease( startZoom, endZoom, percent );
            }

            self.trigger('zoom');
          }

          if( animatingPan || animatingZoom ){
            self.trigger('viewport');
          }

          if( properties.css && isEles ){
            var props = properties.css;

            for( var i = 0; i < props.length; i++ ){
              var name = props[i].name;
              var prop = props[i];
              var end = prop;

              var start = animation.startStyle[ name ];
              var easedVal = ease( start, end, percent );
              
              style.overrideBypass( self, name, easedVal );
            } // for props
          } // if 

        }
        
        if( $$.is.fn(params.step) ){
          params.step.apply( self, [ now ] );
        }
        
        if( percent >= 1 ){
          animation.done = true;
        }
        
        return percent;
      }
      
      function valid(start, end){
        if( start == null || end == null ){
          return false;
        }
        
        if( $$.is.number(start) && $$.is.number(end) ){
          return true;
        } else if( (start) && (end) ){
          return true;
        }
        
        return false;
      }
      
      function ease(startProp, endProp, percent){
        if( percent < 0 ){
          percent = 0;
        } else if( percent > 1 ){
          percent = 1;
        }

        var start, end;

        if( startProp.pxValue != null || startProp.value != null ){
          start = startProp.pxValue != null ? startProp.pxValue : startProp.value;
        } else {
          start = startProp;
        }

        if( endProp.pxValue != null || endProp.value != null ){
          end = endProp.pxValue != null ? endProp.pxValue : endProp.value;
        } else {
          end = endProp;
        }

        if( $$.is.number(start) && $$.is.number(end) ){
          return start + (end - start) * percent;

        } else if( $$.is.number(start[0]) && $$.is.number(end[0]) ){ // then assume a colour
          var c1 = start;
          var c2 = end;

          var ch = function(ch1, ch2){
            var diff = ch2 - ch1;
            var min = ch1;
            return Math.round( percent * diff + min );
          };
          
          var r = ch( c1[0], c2[0] );
          var g = ch( c1[1], c2[1] );
          var b = ch( c1[2], c2[2] );
          
          return [r, g, b];
        }
        
        return undefined;
      }
      
    }
    
  });
  
})( cytoscape, typeof window === 'undefined' ? null : window );


  
    