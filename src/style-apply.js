;(function($$){ 'use strict';

  // (potentially expensive calculation)
  // apply the style to the element based on
  // - its bypass
  // - what selectors match it
  $$.styfn.apply = function( eles ){
    var self = this;

    if( self._private.newStyle ){ // clear style caches
      this._private.contextStyles = {};
      this._private.propDiffs = {};
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

  $$.styfn.getPropertiesDiff = function( oldCxtKey, newCxtKey ){
    var self = this;
    var cache = self._private.propDiffs = self._private.propDiffs || {};
    var dualCxtKey = oldCxtKey + '-' + newCxtKey;
    var cachedVal = cache[dualCxtKey];

    if( cachedVal ){
      return cachedVal;
    }

    var diffProps = [];
    var addedProp = {};

    for( var i = 0; i < self.length; i++ ){
      var cxt = self[i];
      var oldHasCxt = oldCxtKey[i] === 't';
      var newHasCxt = newCxtKey[i] === 't';
      var cxtHasDiffed = oldHasCxt !== newHasCxt;
      var cxtHasMappedProps = cxt.mappedProperties.length > 0;

      if( cxtHasDiffed || cxtHasMappedProps ){
        var props;

        if( cxtHasDiffed && cxtHasMappedProps ){
          props = cxt.properties; // suffices b/c mappedProperties is a subset of properties
        } else if( cxtHasDiffed ){
          props = cxt.properties; // need to check them all
        } else if( cxtHasMappedProps ){
          props = cxt.mappedProperties; // only need to check mapped
        }

        for( var j = 0; j < props.length; j++ ){
          var prop = props[j];
          var name = prop.name;

          // if a later context overrides this property, then the fact that this context has switched/diffed doesn't matter
          // (semi expensive check since it makes this function O(n^2) on context length, but worth it since overall result
          // is cached)
          var laterCxtOverrides = false;
          for( var k = i + 1; k < self.length; k++ ){
            var laterCxt = self[k];
            var hasLaterCxt = newCxtKey[k] === 't';

            if( !hasLaterCxt ){ continue; } // can't override unless the context is active

            laterCxtOverrides = laterCxt.properties[ prop.name ] != null;

            if( laterCxtOverrides ){ break; } // exit early as long as one later context overrides
          }

          if( !addedProp[name] && !laterCxtOverrides ){
            addedProp[name] = true;
            diffProps.push( name );
          }
        } // for props
      } // if

    } // for contexts

    cache[ dualCxtKey ] = diffProps;
    return diffProps;
  };

  $$.styfn.getContextMeta = function( ele ){
    var self = this;
    var cxtKey = '';
    var diffProps;
    var prevKey = ele._private.styleCxtKey || '';

    if( self._private.newStyle ){
      prevKey = ''; // since we need to apply all style if a fresh stylesheet
    }

    // get the cxt key
    for( var i = 0; i < self.length; i++ ){
      var context = self[i];
      var contextSelectorMatches = context.selector && context.selector.matches( ele ); // NB: context.selector may be null for 'core'

      if( contextSelectorMatches ){
        cxtKey += 't';
      } else {
        cxtKey += 'f';
      }
    } // for context

    diffProps = self.getPropertiesDiff( prevKey, cxtKey );

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

    cxtStyles[cxtKey] = style;
    return style;
  };

  $$.styfn.applyContextStyle = function( cxtMeta, cxtStyle, ele ){
    var self = this;
    var diffProps = cxtMeta.diffPropNames;
    var retDiffProps = {};

    for( var i = 0; i < diffProps.length; i++ ){
      var diffPropName = diffProps[i];
      var cxtProp = cxtStyle[ diffPropName ];
      var eleProp = ele._private.style[ diffPropName ];

      // save cycles when the context prop doesn't need to be applied
      if( !cxtProp || eleProp === cxtProp ){ continue; }

      var retDiffProp = retDiffProps[ diffPropName ] = {
        prev: eleProp
      };

      self.applyParsedProperty( ele, cxtProp );

      retDiffProp.next = ele._private.style[ diffPropName ];

      if( retDiffProp.next && retDiffProp.next.bypass ){
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
    var style = _p.style;

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

    var transform = style['text-transform'].strValue;
    var content = style['content'].strValue;
    var fStyle = style['font-style'].strValue;
    var size = style['font-size'].pxValue + 'px';
    var family = style['font-family'].strValue;
    // var variant = style['font-variant'].strValue;
    var weight = style['font-weight'].strValue;
    var valign = style['text-valign'].strValue;
    var halign = style['text-valign'].strValue;
    var oWidth = style['text-outline-width'].pxValue;
    var wrap = style['text-wrap'].strValue;
    var wrapW = style['text-max-width'].pxValue;
    _p.labelKey = fStyle +'$'+ size +'$'+ family +'$'+ weight +'$'+ content +'$'+ transform +'$'+ valign +'$'+ halign +'$'+ oWidth + '$' + wrap + '$' + wrapW;
    _p.fontKey = fStyle +'$'+ weight +'$'+ size +'$'+ family;

    var width = style['width'].pxValue;
    var height = style['height'].pxValue;
    var borderW = style['border-width'].pxValue;
    _p.boundingBoxKey = width +'$'+ height +'$'+ borderW;

    if( ele._private.group === 'edges' ){
      var cpss = style['control-point-step-size'].pxValue;
      var cpd = style['control-point-distance'] ? style['control-point-distance'].pxValue : undefined;
      var cpw = style['control-point-weight'].value;
      var curve = style['curve-style'].strValue;

      _p.boundingBoxKey += '$'+ cpss +'$'+ cpd +'$'+ cpw +'$'+ curve;
    }

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
    var types = $$.style.types;
    var type = $$.style.properties[ prop.name ].type;
    var propIsBypass = prop.bypass;
    var origProp = style[ prop.name ];
    var origPropIsBypass = origProp && origProp.bypass;
    var _p = ele._private;

    // can't apply auto to width or height unless it's a parent node
    if( (parsedProp.name === 'height' || parsedProp.name === 'width') && ele.isNode() ){
      if( parsedProp.value === 'auto' && !ele.isParent() ){
        return false;
      } else if( parsedProp.value !== 'auto' && ele.isParent() ){
        prop = parsedProp = this.parse( parsedProp.name, 'auto', propIsBypass );
      }
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

    var printMappingErr = function(){
      $$.util.error('Do not assign mappings to elements without corresponding data (e.g. ele `'+ ele.id() +'` for property `'+ prop.name +'` with data field `'+ prop.field +'`); try a `['+ prop.field +']` selector to limit scope to elements with `'+ prop.field +'` defined');
    };

    // put the property in the style objects
    switch( prop.mapped ){ // flatten the property if mapped
    case types.mapData:
    case types.mapLayoutData:
    case types.mapScratch:

      var isLayout = prop.mapped === types.mapLayoutData;
      var isScratch = prop.mapped === types.mapScratch;

      // flatten the field (e.g. data.foo.bar)
      var fields = prop.field.split(".");
      var fieldVal;

      if( isScratch || isLayout ){
        fieldVal = _p.scratch;
      } else {
        fieldVal = _p.data;
      }

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

      if( !flatProp ){ printMappingErr(); }
      flatProp.mapping = prop; // keep a reference to the mapping
      prop = flatProp; // the flattened (mapped) property is the one we want

      break;

    // direct mapping
    case types.data:
    case types.layoutData:
    case types.scratch:
      var isLayout = prop.mapped === types.layoutData;
      var isScratch = prop.mapped === types.scratch;

      // flatten the field (e.g. data.foo.bar)
      var fields = prop.field.split(".");
      var fieldVal;

      if( isScratch || isLayout ){
        fieldVal = _p.scratch;
      } else {
        fieldVal = _p.data;
      }

      if( fieldVal ){ for( var i = 0; i < fields.length; i++ ){
        var field = fields[i];
        fieldVal = fieldVal[ field ];
      } }

      flatProp = this.parse( prop.name, fieldVal, prop.bypass, true );

      if( !flatProp ){ // if we can't flatten the property, then use the origProp so we still keep the mapping itself
        var flatPropVal = origProp ? origProp.strValue : '';

        flatProp = this.parse( prop.name, flatPropVal, prop.bypass, true );
      }

      if( !flatProp ){ printMappingErr(); }
      flatProp.mapping = prop; // keep a reference to the mapping
      prop = flatProp; // the flattened (mapped) property is the one we want

      break;

    case types.fn:
      var fn = prop.value;
      var fnRetVal = fn( ele );

      flatProp = this.parse( prop.name, fnRetVal, prop.bypass, true );
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

  // diffProps : { name => { prev, next } }
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
        var initVal;
        var initDt = 0.000001; // delta time % value for initVal (allows animating out of init zero opacity)

        if( !fromProp ){ continue; }

        // consider px values
        if( $$.is.number( fromProp.pxValue ) && $$.is.number( toProp.pxValue ) ){
          diff = toProp.pxValue - fromProp.pxValue; // nonzero is truthy
          initVal = fromProp.pxValue + initDt * diff;

        // consider numerical values
        } else if( $$.is.number( fromProp.value ) && $$.is.number( toProp.value ) ){
          diff = toProp.value - fromProp.value; // nonzero is truthy
          initVal = fromProp.value + initDt * diff;

        // consider colour values
        } else if( $$.is.array( fromProp.value ) && $$.is.array( toProp.value ) ){
          diff = fromProp.value[0] !== toProp.value[0]
            || fromProp.value[1] !== toProp.value[1]
            || fromProp.value[2] !== toProp.value[2]
          ;

          initVal = fromProp.strValue;
        }

        // the previous value is good for an animation only if it's different
        if( diff ){
          css[ prop ] = toProp.strValue; // to val
          this.applyBypass( ele, prop, initVal ); // from val
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
