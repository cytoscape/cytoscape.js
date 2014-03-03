;(function($$){ 'use strict';

  // (potentially expensive calculation)
  // apply the style to the element based on
  // - its bypass
  // - what selectors match it
  $$.styfn.apply = function( eles ){
    var self = this;

    for( var ie = 0; ie < eles.length; ie++ ){
      var ele = eles[ie];
      var changedCxts = false;

      if( self._private.newStyle ){
        ele._private.styleCxts = [];
        ele._private.style = {};
      }

      // console.log('APPLYING STYLESHEET\n--\n');

      // apply the styles
      for( var i = 0; i < this.length; i++ ){
        var context = this[i];
        var contextSelectorMatches = context.selector && context.selector.filter( ele ).length > 0; // NB: context.selector may be null for 'core'
        var props = context.properties;
        var newCxt = !ele._private.styleCxts[i];

        // console.log(i + ' : looking at selector: ' + context.selector);

        if( contextSelectorMatches ){ // then apply its properties

          // apply the properties in the context
          
          for( var j = 0; j < props.length; j++ ){ // for each prop
            var prop = props[j];
            var currentEleProp = ele._private.style[prop.name];
            var propIsFirstInEle = currentEleProp && currentEleProp.context === context;
            var needToUpdateCxtMapping = prop.mapped && propIsFirstInEle;

            //if(prop.mapped) debugger;

            if( newCxt || needToUpdateCxtMapping ){
              // console.log(i + ' + MATCH: applying property: ' + prop.name);
              this.applyParsedProperty( ele, prop, context );
            }
          }

          // keep a note that this context matches
          ele._private.styleCxts[i] = context;

          if( self._private.newStyle === false && newCxt ){
            changedCxts = true;
          }
          
        } else {

          // roll back style cxts that don't match now
          if( ele._private.styleCxts[i] ){
            // console.log(i + ' x MISS: rolling back context');
            this.rollBackContext( ele, context );
            changedCxts = true;
          }

          delete ele._private.styleCxts[i];
        }
      } // for context

      if( changedCxts ){
        this.updateTransitions( ele );
      }

    } // for elements

    self._private.newStyle = false;
  };

  // when a context's selector no longer matches the ele, roll back the context on the ele
  // (cheaper than having to recalc from the beginning)
  $$.styfn.rollBackContext = function( ele, context ){
    for( var j = 0; j < context.properties.length; j++ ){ // for each prop
      var prop = context.properties[j];
      var eleProp = ele._private.style[ prop.name ];

      // because bypasses do not store prevs, look at the bypassed property
      if( eleProp.bypassed ){
        eleProp = eleProp.bypassed;
      }

      var first = true;
      var lastEleProp;
      var l = 0;
      while( eleProp.prev ){
        var prev = eleProp.prev;

        if( eleProp.context === context ){

          if( first ){
            ele._private.style[ prop.name ] = prev;
          } else if( lastEleProp ){
            lastEleProp.prev = prev;
          }
          
        }

        lastEleProp = eleProp;
        eleProp = prev;
        first = false;
        l++;

        // in case we have a problematic prev list
        // if( l >= 100 ){
        //   debugger;
        // }
      }
    }
  };

  // apply a property to the style (for internal use)
  // returns whether application was successful
  //
  // now, this function flattens the property, and here's how:
  //
  // for parsedProp:{ bypass: true, deleteBypass: true }
  // no property is generated, instead the bypass property in the
  // element's style is replaced by what's pointed to by the `bypassed`
  // field in the bypass property (i.e. restoring the property the
  // bypass was overriding)
  //
  // for parsedProp:{ mapped: truthy }
  // the generated flattenedProp:{ mapping: prop }
  // 
  // for parsedProp:{ bypass: true }
  // the generated flattenedProp:{ bypassed: parsedProp } 
  $$.styfn.applyParsedProperty = function( ele, parsedProp, context ){
    parsedProp = $$.util.clone( parsedProp ); // copy b/c the same parsedProp may be applied to many elements, BUT
    // the instances put in each element should be unique to avoid overwriting other the lists of other elements

    var prop = parsedProp;
    var style = ele._private.style;
    var fieldVal, flatProp;
    var type = $$.style.properties[ prop.name ].type;
    var propIsBypass = prop.bypass;
    var origProp = style[ prop.name ];
    var origPropIsBypass = origProp && origProp.bypass;

    // can't apply auto to width or height unless it's a parent node
    if( (parsedProp.name === 'height' || parsedProp.name === 'width') && parsedProp.value === 'auto' && ele.isNode() && !ele.isParent() ){
      return false;
    }

    // check if we need to delete the current bypass
    if( propIsBypass && prop.deleteBypass ){ // then this property is just here to indicate we need to delete
      var currentProp = style[ prop.name ];

      // can only delete if the current prop is a bypass and it points to the property it was overriding
      if( !currentProp ){
        return true; // property is already not defined
      } else if( currentProp.bypass && currentProp.bypassed ){ // then replace the bypass property with the original
        
        // because the bypassed property was already applied (and therefore parsed), we can just replace it (no reapplying necessary)
        style[ prop.name ] = currentProp.bypassed;
        return true;
      
      } else {
        return false; // we're unsuccessful deleting the bypass
      }
    }

    // put the property in the style objects
    switch( prop.mapped ){ // flatten the property if mapped
    case $$.style.types.mapData:
    case $$.style.types.mapLayoutData:
      
      var isLayout = prop.mapped === $$.style.types.mapLayoutData;

      // flatten the field (e.g. data.foo.bar)
      var fields = prop.field.split(".");
      var fieldVal = isLayout ? ele._private.layoutData : ele._private.data;
      for( var i = 0; i < fields.length && fieldVal; i++ ){
        var field = fields[i];
        fieldVal = fieldVal[ field ];
      }

      var percent;
      if( !$$.is.number(fieldVal) ){ // then keep the mapping but assume 0% for now
        percent = 0;
      } else {
        percent = (fieldVal - prop.fieldMin) / (prop.fieldMax - prop.fieldMin);
      }

      if( type.color ){
        var r1 = prop.valueMin[0];
        var r2 = prop.valueMax[0];
        var g1 = prop.valueMin[1];
        var g2 = prop.valueMax[1];
        var b1 = prop.valueMin[2];
        var b2 = prop.valueMax[2];
        var a1 = prop.valueMin[3] == null ? 1 : prop.valueMin[3];
        var a2 = prop.valueMax[3] == null ? 1 : prop.valueMax[3];

        var clr = [
          Math.round( r1 + (r2 - r1)*percent ),
          Math.round( g1 + (g2 - g1)*percent ),
          Math.round( b1 + (b2 - b1)*percent ),
          Math.round( a1 + (a2 - a1)*percent )
        ];

        flatProp = { // colours are simple, so just create the flat property instead of expensive string parsing
          bypass: prop.bypass, // we're a bypass if the mapping property is a bypass
          name: prop.name,
          value: clr,
          strValue: [ "rgba(", clr[0], ", ", clr[1], ", ", clr[2], ", ", clr[3] , ")" ].join('') // fake it til you make it
        };
      
      } else if( type.number ){
        var calcValue = prop.valueMin + (prop.valueMax - prop.valueMin) * percent;
        flatProp = this.parse( prop.name, calcValue, prop.bypass );
      
      } else {
        return false; // can only map to colours and numbers
      }

      if( !flatProp ){ // if we can't flatten the property, then use the origProp so we still keep the mapping itself
        flatProp = this.parse( prop.name, origProp.strValue, prop.bypass);
      } 

      flatProp.mapping = prop; // keep a reference to the mapping
      prop = flatProp; // the flattened (mapped) property is the one we want

      break;

    // direct mapping  
    case $$.style.types.data: 
    case $$.style.types.layoutData: 

      var isLayout = prop.mapped === $$.style.types.layoutData;

      // flatten the field (e.g. data.foo.bar)
      var fields = prop.field.split(".");
      var fieldVal = isLayout ? ele._private.layoutData : ele._private.data;
      for( var i = 0; i < fields.length && fieldVal; i++ ){
        var field = fields[i];
        fieldVal = fieldVal[ field ];
      }

      flatProp = this.parse( prop.name, fieldVal, prop.bypass );
      if( !flatProp ){ // if we can't flatten the property, then use the origProp so we still keep the mapping itself
        flatProp = this.parse( prop.name, origProp.strValue, prop.bypass);
      } 

      flatProp.mapping = prop; // keep a reference to the mapping
      prop = flatProp; // the flattened (mapped) property is the one we want
      break;

    case undefined:
      break; // just set the property

    default: 
      return false; // not a valid mapping
    }

    // if the property is a bypass property, then link the resultant property to the original one
    if( propIsBypass ){
      if( origPropIsBypass ){ // then this bypass overrides the existing one
        prop.bypassed = origProp.bypassed; // steal bypassed prop from old bypass
      } else { // then link the orig prop to the new bypass
        prop.bypassed = origProp;
      }

      style[ prop.name ] = prop; // and set
    
    } else { // prop is not bypass
      var prevProp;

      if( origPropIsBypass ){ // then keep the orig prop (since it's a bypass) and link to the new prop
        prevProp = origProp.bypassed;
        
        origProp.bypassed = prop;
      } else { // then just replace the old prop with the new one
        prevProp = style[ prop.name ];

        style[ prop.name ] = prop; 
      }

      if( prevProp && prevProp.mapping && prop.mapping && prevProp.context === context ){
        prevProp = prevProp.prev;
      }

      if( prevProp && prevProp !== prop ){
        prop.prev = prevProp;
      }
    }

    prop.context = context;

    return true;
  };

  // updates the visual style for all elements (useful for manual style modification after init)
  $$.styfn.update = function(){
    var cy = this._private.cy;
    var eles = cy.elements();

    eles.updateStyle();
  };

  // just update the functional properties (i.e. mappings) in the elements'
  // styles (less expensive than recalculation)
  $$.styfn.updateMappers = function( eles ){
    for( var i = 0; i < eles.length; i++ ){ // for each ele
      var ele = eles[i];
      var style = ele._private.style;

      for( var j = 0; j < $$.style.properties.length; j++ ){ // for each prop
        var prop = $$.style.properties[j];
        var propInStyle = style[ prop.name ];

        if( propInStyle && propInStyle.mapping ){
          var mapping = propInStyle.mapping;
          this.applyParsedProperty( ele, mapping ); // reapply the mapping property
        }
      }
    }
  };

  $$.styfn.updateTransitions = function( ele ){
    var self = this;
    var style = ele._private.style;

    var props = style['transition-property'].value;
    var duration = style['transition-duration'].value * 1000;
    var delay = style['transition-delay'].value * 1000;
    var css = {};

    if( props.length > 0 && duration > 0 ){

      // if already transitioning, then this is a duplicate
      if( ele._private.transitioning ){ return; }

      // build up the style to animate towards
      var anyPrev = false;
      for( var i = 0; i < props.length; i++ ){
        var prop = props[i];
        var styProp = style[ prop ];

        // if a previous value is defined, then we can animate from that value to the specified value
        if( styProp.prev ){
          css[ prop ] = style[ prop ].strValue; // to val
          this.applyBypass(ele, prop, styProp.prev.strValue); // from val
          anyPrev = true;
        }
      }

      // can't transition if there's nothing previous to transition from
      if( !anyPrev ){ return; }

console.log('transition ', ele.id());
      
      ele._private.transitioning = true;

      ele.stop();

      if( delay > 0 ){
        ele.delay( delay );
      }

      ele.animate({
        css: css
      }, {
        duration: duration,
        queue: false,
        complete: function(){
          self.removeAllBypasses( ele );

          ele._private.transitioning = false;
        }
      });

    } else if( ele._private.transitioning ){
console.log('cancel', ele.id())
      ele.stop();

      this.removeAllBypasses( ele );

      ele._private.transitioning = false;
    }
  }; 

})( cytoscape );