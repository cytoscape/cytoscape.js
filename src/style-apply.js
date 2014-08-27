;(function($$){ 'use strict';

  // (potentially expensive calculation)
  // apply the style to the element based on
  // - its bypass
  // - what selectors match it
  $$.styfn.apply = function( eles ){
    var self = this;

    if( self._private.newStyle ){
      this._private.contextStyles = {};
    }

    for( var ie = 0; ie < eles.length; ie++ ){
      var ele = eles[ie];
      var cxtMeta = self.getContextMeta( ele );
      var cxtStyle = self.getContextStyle( cxtMeta );
      var app = self.applyContextStyle( cxtMeta, cxtStyle, ele );

      self.updateTransitions( ele, app.diffProps );
      self.updateStyleHints( ele );

    } // for elements

    self._private.newStyle = false;
  };

  $$.styfn.getContextMeta = function( ele ){
    var self = this;
    var cxtKey = '';
    var diffProps = [];
    var prevKey = ele._private.styleCxtKey || '';

    // apply the styles
    for( var i = 0; i < self.length; i++ ){
      var context = self[i];
      var contextSelectorMatches = context.selector && context.selector.matches( ele ); // NB: context.selector may be null for 'core'

      if( contextSelectorMatches ){
        cxtKey += 't';
      } else {
        cxtKey += 'f';
      }

      var changedCxt = cxtKey[i] !== prevKey[i] || self._private.newStyle; // new style always applied b/c old cxts may not be the same
      if( changedCxt ){
        for( var j = 0; j < context.properties.length; j++ ){
          var prop = context.properties[j];

          if( !diffProps[ prop.name ] ){
            diffProps.push( prop.name );
            diffProps[ prop.name ] = true;
          }
          
        }
      }
    } // for context

    ele._private.styleCxtKey = cxtKey;

    return {
      key: cxtKey,
      diffPropNames: diffProps
    };
  };

  // gets a computed ele style object based on matched contexts
  $$.styfn.getContextStyle = function( cxtMeta ){
    var cxtKey = cxtMeta.key;
    var self = this;
    var cxtStyles = this._private.contextStyles = this._private.contextStyles || {};

    // if already computed style, returned cached copy
    if( cxtStyles[cxtKey] ){ return cxtStyles[cxtKey]; }

    var style = {
      _private: {
        key: cxtKey
      }
    };

    for( var i = 0; i < self.length; i++ ){
      var cxt = self[i];
      var hasCxt = cxtKey[i] === 't';

      if( !hasCxt ){ continue; }

      for( var j = 0; j < cxt.properties.length; j++ ){
        var prop = cxt.properties[j];
        var styProp = style[ prop.name ] = prop;

        styProp.context = cxt;
      }
    }

    return cxtStyles[cxtKey] = style;
  };

  $$.styfn.applyContextStyle = function( cxtMeta, cxtStyle, ele ){
    var self = this;
    var cxtKey = cxtMeta.key;
    var diffProps = cxtMeta.diffPropNames;
    var retDiffProps = {};

    for( var i = 0; i < diffProps.length; i++ ){
      var diffPropName = diffProps[i];
      var cxtProp = cxtStyle[ diffPropName ];
      var eleProp = ele._private.style[ diffPropName ];

      // save cycles when the context prop doesn't need to be applied
      if( !cxtProp || eleProp === cxtProp ){ continue; }

      var cxt = cxtProp.context;

      var retDiffProp = retDiffProps[ diffPropName ] = {
        prev: eleProp
      };

      self.applyParsedProperty( ele, cxtProp );

      retDiffProp.next = ele._private.style[ diffPropName ];

      if( retDiffProp.next.bypass ){
        retDiffProp.next = retDiffProp.next.bypassed;
      }
    }

    return {
      diffProps: retDiffProps
    };
  };

  $$.styfn.updateStyleHints = function(ele){
    var _p = ele._private;
    var self = this;

    // set whether has pie or not; for greater efficiency
    var hasPie = false;
    if( _p.group === 'nodes' && self._private.hasPie ){
      for( var i = 1; i <= $$.style.pieBackgroundN; i++ ){ // 1..N
        var size = _p.style['pie-' + i + '-background-size'].value;

        if( size > 0 ){
          hasPie = true;
          break;
        }
      }
    }

    _p.hasPie = hasPie;

    var transform = _p.style['text-transform'].strValue;
    var content = _p.style['content'].strValue;
    var fStyle = _p.style['font-style'].strValue;
    var size = _p.style['font-size'].pxValue + 'px';
    var family = _p.style['font-family'].strValue;
    var variant = _p.style['font-variant'].strValue;
    var weight = _p.style['font-weight'].strValue;
    _p.labelKey = fStyle +'$'+ size +'$'+ family +'$'+ variant +'$'+ weight +'$'+ content +'$'+ transform;
    _p.fontKey = fStyle +'$'+ weight +'$'+ size +'$'+ family;

    _p.styleKey = Date.now(); // probably safe to use applied time and much faster
    // for( var i = 0; i < $$.style.properties.length; i++ ){
    //   var prop = $$.style.properties[i];
    //   var eleProp = _p.style[ prop.name ];
    //   var val = eleProp && eleProp.strValue ? eleProp.strValue : 'undefined';

    //   _p.styleKey += '$' + val;
    // }
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
  $$.styfn.applyParsedProperty = function( ele, parsedProp ){
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

      // make sure to bound percent value
      if( percent < 0 ){
        percent = 0;
      } else if( percent > 1 ){
        percent = 1;
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
          strValue: 'rgb(' + clr[0] + ', ' + clr[1] + ', ' + clr[2] + ')'
        };
      
      } else if( type.number ){
        var calcValue = prop.valueMin + (prop.valueMax - prop.valueMin) * percent;
        flatProp = this.parse( prop.name, calcValue, prop.bypass, true );
      
      } else {
        return false; // can only map to colours and numbers
      }

      if( !flatProp ){ // if we can't flatten the property, then use the origProp so we still keep the mapping itself
        flatProp = this.parse( prop.name, origProp.strValue, prop.bypass, true );
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

      flatProp = this.parse( prop.name, fieldVal, prop.bypass, true );
      if( !flatProp ){ // if we can't flatten the property, then use the origProp so we still keep the mapping itself
        flatProp = this.parse( prop.name, origProp.strValue, prop.bypass, true );
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
      if( origPropIsBypass ){ // then keep the orig prop (since it's a bypass) and link to the new prop
        origProp.bypassed = prop;
      } else { // then just replace the old prop with the new one
        style[ prop.name ] = prop; 
      }
    }

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

      this.updateStyleHints( ele );
    }
  };

  $$.styfn.updateTransitions = function( ele, diffProps, isBypass ){
    var self = this;
    var style = ele._private.style;

    var props = style['transition-property'].value;
    var duration = style['transition-duration'].msValue;
    var delay = style['transition-delay'].msValue;
    var css = {};

    if( props.length > 0 && duration > 0 ){

      // build up the style to animate towards
      var anyPrev = false;
      for( var i = 0; i < props.length; i++ ){
        var prop = props[i];
        var styProp = style[ prop ];
        var diffProp = diffProps[ prop ];

        if( !diffProp ){ continue; }

        var prevProp = diffProp.prev;
        var fromProp = prevProp;
        var toProp = diffProp.next != null ? diffProp.next : styProp;
        var diff = false;

        if( !fromProp ){ continue; } 

        // consider px values
        if( $$.is.number( fromProp.pxValue ) && $$.is.number( toProp.pxValue ) ){
          diff = fromProp.pxValue !== toProp.pxValue;

        // consider numerical values
        } else if( $$.is.number( fromProp.value ) && $$.is.number( toProp.value ) ){
          diff = fromProp.value !== toProp.value;

        // consider colour values
        } else if( $$.is.array( fromProp.value ) && $$.is.array( toProp.value ) ){
          diff = fromProp.value[0] !== toProp.value[0]
            || fromProp.value[1] !== toProp.value[1]
            || fromProp.value[2] !== toProp.value[2]
          ;
        }

        // the previous value is good for an animation only if it's different
        if( diff ){
          css[ prop ] = toProp.strValue; // to val
          this.applyBypass(ele, prop, fromProp.strValue); // from val
          anyPrev = true;
        }
        
      } // end if props allow ani

      // can't transition if there's nothing previous to transition from
      if( !anyPrev ){ return; }
      
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
          if( !isBypass ){
            self.removeBypasses( ele, props );
          }

          ele._private.transitioning = false;
        }
      });

    } else if( ele._private.transitioning ){
      ele.stop();

      this.removeBypasses( ele, props );

      ele._private.transitioning = false;
    }
  }; 

})( cytoscape );