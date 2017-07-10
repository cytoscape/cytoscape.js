let util = require('../util');
let is = require('../is');
let Promise = require('../promise');

let styfn = {};

// (potentially expensive calculation)
// apply the style to the element based on
// - its bypass
// - what selectors match it
styfn.apply = function( eles ){
  let self = this;
  let _p = self._private;
  let cy = _p.cy;
  let updatedEles = cy.collection();

  if( _p.newStyle ){ // clear style caches
    _p.contextStyles = {};
    _p.propDiffs = {};

    self.cleanElements( eles, true );
  }

  for( let ie = 0; ie < eles.length; ie++ ){
    let ele = eles[ ie ];

    let cxtMeta = self.getContextMeta( ele );

    if( cxtMeta.empty ){
      continue;
    } else {
      updatedEles.merge( ele );
    }

    let cxtStyle = self.getContextStyle( cxtMeta );
    let app = self.applyContextStyle( cxtMeta, cxtStyle, ele );

    if( !_p.newStyle ){
      self.updateTransitions( ele, app.diffProps );
    }

    self.updateStyleHints( ele );

  } // for elements

  _p.newStyle = false;

  return updatedEles;
};

styfn.getPropertiesDiff = function( oldCxtKey, newCxtKey ){
  let self = this;
  let cache = self._private.propDiffs = self._private.propDiffs || {};
  let dualCxtKey = oldCxtKey + '-' + newCxtKey;
  let cachedVal = cache[ dualCxtKey ];

  if( cachedVal ){
    return cachedVal;
  }

  let diffProps = [];
  let addedProp = {};

  for( let i = 0; i < self.length; i++ ){
    let cxt = self[ i ];
    let oldHasCxt = oldCxtKey[ i ] === 't';
    let newHasCxt = newCxtKey[ i ] === 't';
    let cxtHasDiffed = oldHasCxt !== newHasCxt;
    let cxtHasMappedProps = cxt.mappedProperties.length > 0;

    if( cxtHasDiffed || cxtHasMappedProps ){
      let props;

      if( cxtHasDiffed && cxtHasMappedProps ){
        props = cxt.properties; // suffices b/c mappedProperties is a subset of properties
      } else if( cxtHasDiffed ){
        props = cxt.properties; // need to check them all
      } else if( cxtHasMappedProps ){
        props = cxt.mappedProperties; // only need to check mapped
      }

      for( let j = 0; j < props.length; j++ ){
        let prop = props[ j ];
        let name = prop.name;

        // if a later context overrides this property, then the fact that this context has switched/diffed doesn't matter
        // (semi expensive check since it makes this function O(n^2) on context length, but worth it since overall result
        // is cached)
        let laterCxtOverrides = false;
        for( let k = i + 1; k < self.length; k++ ){
          let laterCxt = self[ k ];
          let hasLaterCxt = newCxtKey[ k ] === 't';

          if( !hasLaterCxt ){ continue; } // can't override unless the context is active

          laterCxtOverrides = laterCxt.properties[ prop.name ] != null;

          if( laterCxtOverrides ){ break; } // exit early as long as one later context overrides
        }

        if( !addedProp[ name ] && !laterCxtOverrides ){
          addedProp[ name ] = true;
          diffProps.push( name );
        }
      } // for props
    } // if

  } // for contexts

  cache[ dualCxtKey ] = diffProps;
  return diffProps;
};

styfn.getContextMeta = function( ele ){
  let self = this;
  let cxtKey = '';
  let diffProps;
  let prevKey = ele._private.styleCxtKey || '';

  if( self._private.newStyle ){
    prevKey = ''; // since we need to apply all style if a fresh stylesheet
  }

  // get the cxt key
  for( let i = 0; i < self.length; i++ ){
    let context = self[ i ];
    let contextSelectorMatches = context.selector && context.selector.matches( ele ); // NB: context.selector may be null for 'core'

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
    diffPropNames: diffProps,
    empty: diffProps.length === 0
  };
};

// gets a computed ele style object based on matched contexts
styfn.getContextStyle = function( cxtMeta ){
  let cxtKey = cxtMeta.key;
  let self = this;
  let cxtStyles = this._private.contextStyles = this._private.contextStyles || {};

  // if already computed style, returned cached copy
  if( cxtStyles[ cxtKey ] ){ return cxtStyles[ cxtKey ]; }

  let style = {
    _private: {
      key: cxtKey
    }
  };

  for( let i = 0; i < self.length; i++ ){
    let cxt = self[ i ];
    let hasCxt = cxtKey[ i ] === 't';

    if( !hasCxt ){ continue; }

    for( let j = 0; j < cxt.properties.length; j++ ){
      let prop = cxt.properties[ j ];

      style[ prop.name ] = prop;
    }
  }

  cxtStyles[ cxtKey ] = style;
  return style;
};

styfn.applyContextStyle = function( cxtMeta, cxtStyle, ele ){
  let self = this;
  let diffProps = cxtMeta.diffPropNames;
  let retDiffProps = {};

  for( let i = 0; i < diffProps.length; i++ ){
    let diffPropName = diffProps[ i ];
    let cxtProp = cxtStyle[ diffPropName ];
    let eleProp = ele.pstyle( diffPropName );

    if( !cxtProp ){ // no context prop means delete
      if( !eleProp ){
        continue; // no existing prop means nothing needs to be removed
        // nb affects initial application on mapped values like control-point-distances
      } else if( eleProp.bypass ){
        cxtProp = { name: diffPropName, deleteBypassed: true };
      } else {
        cxtProp = { name: diffPropName, delete: true };
      }
    }

    // save cycles when the context prop doesn't need to be applied
    if( eleProp === cxtProp ){ continue; }

    let retDiffProp = retDiffProps[ diffPropName ] = {
      prev: eleProp
    };

    self.applyParsedProperty( ele, cxtProp );

    retDiffProp.next = ele.pstyle( diffPropName );

    if( retDiffProp.next && retDiffProp.next.bypass ){
      retDiffProp.next = retDiffProp.next.bypassed;
    }
  }

  return {
    diffProps: retDiffProps
  };
};

styfn.updateStyleHints = function(ele){
  let _p = ele._private;
  let self = this;

  if( ele.removed() ){ return; }

  // set whether has pie or not; for greater efficiency
  let hasPie = false;
  if( _p.group === 'nodes' ){
    for( let i = 1; i <= self.pieBackgroundN; i++ ){ // 1..N
      let size = ele.pstyle( 'pie-' + i + '-background-size' ).value;

      if( size > 0 ){
        hasPie = true;
        break;
      }
    }
  }

  _p.hasPie = hasPie;

  let transform = ele.pstyle( 'text-transform' ).strValue;
  let content = ele.pstyle( 'label' ).strValue;
  let srcContent = ele.pstyle( 'source-label' ).strValue;
  let tgtContent = ele.pstyle( 'target-label' ).strValue;
  let fStyle = ele.pstyle( 'font-style' ).strValue;
  let size = ele.pstyle( 'font-size' ).pfValue + 'px';
  let family = ele.pstyle( 'font-family' ).strValue;
  // let letiant = style['font-letiant'].strValue;
  let weight = ele.pstyle( 'font-weight' ).strValue;
  let valign = ele.pstyle( 'text-valign' ).strValue;
  let halign = ele.pstyle( 'text-valign' ).strValue;
  let oWidth = ele.pstyle( 'text-outline-width' ).pfValue;
  let wrap = ele.pstyle( 'text-wrap' ).strValue;
  let wrapW = ele.pstyle( 'text-max-width' ).pfValue;
  let labelStyleKey = fStyle + '$' + size + '$' + family + '$' + weight + '$' + transform + '$' + valign + '$' + halign + '$' + oWidth + '$' + wrap + '$' + wrapW;
  _p.labelStyleKey = labelStyleKey;
  _p.sourceLabelKey = labelStyleKey + '$' + srcContent;
  _p.targetLabelKey = labelStyleKey + '$' + tgtContent;
  _p.labelKey = labelStyleKey + '$' + content;
  _p.fontKey = fStyle + '$' + weight + '$' + size + '$' + family;

  _p.styleKey = Date.now();
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
styfn.applyParsedProperty = function( ele, parsedProp ){
  let self = this;
  let prop = parsedProp;
  let style = ele._private.style;
  let fieldVal, flatProp;
  let types = self.types;
  let type = self.properties[ prop.name ].type;
  let propIsBypass = prop.bypass;
  let origProp = style[ prop.name ];
  let origPropIsBypass = origProp && origProp.bypass;
  let _p = ele._private;
  let flatPropMapping = 'mapping';

  let checkZOrder = function(){
    self.checkZOrderTrigger( ele, prop.name, origProp ? origProp.value : null, prop.value );
  };

  // edges connected to compound nodes can not be haystacks
  if(
    parsedProp.name === 'curve-style'
    && parsedProp.value === 'haystack'
    && ele.isEdge()
    && ( ele.isLoop() || ele.source().isParent() || ele.target().isParent() )
  ){
    prop = parsedProp = this.parse( parsedProp.name, 'bezier', propIsBypass );
  }

  if( prop.delete ){ // delete the property and use the default value on falsey value
    style[ prop.name ] = undefined;

    checkZOrder();

    return true;
  }

  if( prop.deleteBypassed ){ // delete the property that the
    if( !origProp ){
      checkZOrder();

      return true; // can't delete if no prop

    } else if( origProp.bypass ){ // delete bypassed
      origProp.bypassed = undefined;

      checkZOrder();

      return true;

    } else {
      return false; // we're unsuccessful deleting the bypassed
    }
  }

  // check if we need to delete the current bypass
  if( prop.deleteBypass ){ // then this property is just here to indicate we need to delete
    if( !origProp ){
      checkZOrder();

      return true; // property is already not defined

    } else if( origProp.bypass ){ // then replace the bypass property with the original
      // because the bypassed property was already applied (and therefore parsed), we can just replace it (no reapplying necessary)
      style[ prop.name ] = origProp.bypassed;

      checkZOrder();

      return true;

    } else {
      return false; // we're unsuccessful deleting the bypass
    }
  }

  let printMappingErr = function(){
    util.error( 'Do not assign mappings to elements without corresponding data (e.g. ele `' + ele.id() + '` for property `' + prop.name + '` with data field `' + prop.field + '`); try a `[' + prop.field + ']` selector to limit scope to elements with `' + prop.field + '` defined' );
  };

  // put the property in the style objects
  switch( prop.mapped ){ // flatten the property if mapped
  case types.mapData: {
    // flatten the field (e.g. data.foo.bar)
    let fields = prop.field.split( '.' );
    let fieldVal = _p.data;

    for( let i = 0; i < fields.length && fieldVal; i++ ){
      let field = fields[ i ];
      fieldVal = fieldVal[ field ];
    }

    let percent;
    if( !is.number( fieldVal ) ){ // then keep the mapping but assume 0% for now
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
      let r1 = prop.valueMin[0];
      let r2 = prop.valueMax[0];
      let g1 = prop.valueMin[1];
      let g2 = prop.valueMax[1];
      let b1 = prop.valueMin[2];
      let b2 = prop.valueMax[2];
      let a1 = prop.valueMin[3] == null ? 1 : prop.valueMin[3];
      let a2 = prop.valueMax[3] == null ? 1 : prop.valueMax[3];

      let clr = [
        Math.round( r1 + (r2 - r1) * percent ),
        Math.round( g1 + (g2 - g1) * percent ),
        Math.round( b1 + (b2 - b1) * percent ),
        Math.round( a1 + (a2 - a1) * percent )
      ];

      flatProp = { // colours are simple, so just create the flat property instead of expensive string parsing
        bypass: prop.bypass, // we're a bypass if the mapping property is a bypass
        name: prop.name,
        value: clr,
        strValue: 'rgb(' + clr[0] + ', ' + clr[1] + ', ' + clr[2] + ')'
      };

    } else if( type.number ){
      let calcValue = prop.valueMin + (prop.valueMax - prop.valueMin) * percent;
      flatProp = this.parse( prop.name, calcValue, prop.bypass, flatPropMapping );

    } else {
      return false; // can only map to colours and numbers
    }

    if( !flatProp ){ // if we can't flatten the property, then use the origProp so we still keep the mapping itself
      flatProp = this.parse( prop.name, origProp.strValue, prop.bypass, flatPropMapping );
    }

    if( !flatProp ){ printMappingErr(); }
    flatProp.mapping = prop; // keep a reference to the mapping
    prop = flatProp; // the flattened (mapped) property is the one we want

    break;
  }

  // direct mapping
  case types.data: {
    // flatten the field (e.g. data.foo.bar)
    let fields = prop.field.split( '.' );
    let fieldVal = _p.data;

    if( fieldVal ){ for( let i = 0; i < fields.length; i++ ){
      let field = fields[ i ];
      fieldVal = fieldVal[ field ];
    } }

    flatProp = this.parse( prop.name, fieldVal, prop.bypass, flatPropMapping );

    if( !flatProp ){ // if we can't flatten the property, then use the origProp so we still keep the mapping itself
      let flatPropVal = origProp ? origProp.strValue : '';

      flatProp = this.parse( prop.name, flatPropVal, prop.bypass, flatPropMapping );
    }

    if( !flatProp ){ printMappingErr(); }
    flatProp.mapping = prop; // keep a reference to the mapping
    prop = flatProp; // the flattened (mapped) property is the one we want

    break;
  }

  case types.fn: {
    let fn = prop.value;
    let fnRetVal = fn( ele );

    flatProp = this.parse( prop.name, fnRetVal, prop.bypass, flatPropMapping );
    flatProp.mapping = prop; // keep a reference to the mapping
    prop = flatProp; // the flattened (mapped) property is the one we want

    break;
  }

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

  checkZOrder();

  return true;
};

styfn.cleanElements = function( eles, keepBypasses ){
  let self = this;
  let props = self.properties;

  for( let i = 0; i < eles.length; i++ ){
    let ele = eles[i];

    if( !keepBypasses ){
      ele._private.style = {};
    } else {
      let style = ele._private.style;

      for( let j = 0; j < props.length; j++ ){
        let prop = props[j];
        let eleProp = style[ prop.name ];

        if( eleProp ){
          if( eleProp.bypass ){
            eleProp.bypassed = null;
          } else {
            style[ prop.name ] = null;
          }
        }
      }
    }
  }
};

// updates the visual style for all elements (useful for manual style modification after init)
styfn.update = function(){
  let cy = this._private.cy;
  let eles = cy.mutableElements();

  eles.updateStyle();
};

// just update the functional properties (i.e. mappings) in the elements'
// styles (less expensive than recalculation)
styfn.updateMappers = function( eles ){
  let self = this;
  let cy = this._private.cy;
  let updatedEles = cy.collection();

  for( let i = 0; i < eles.length; i++ ){ // for each ele
    let ele = eles[ i ];
    let style = ele._private.style;
    let updatedEle = false;

    for( let j = 0; j < self.properties.length; j++ ){ // for each prop
      let prop = self.properties[ j ];
      let propInStyle = style[ prop.name ];

      if( propInStyle && propInStyle.mapping ){
        let mapping = propInStyle.mapping;

        this.applyParsedProperty( ele, mapping ); // reapply the mapping property

        updatedEle = true;
      }
    }

    if( updatedEle ){
      this.updateStyleHints( ele );

      updatedEles.merge( ele );
    }
  }

  return updatedEles;
};

// diffProps : { name => { prev, next } }
styfn.updateTransitions = function( ele, diffProps, isBypass ){
  let self = this;
  let _p = ele._private;
  let props = ele.pstyle( 'transition-property' ).value;
  let duration = ele.pstyle( 'transition-duration' ).pfValue;
  let delay = ele.pstyle( 'transition-delay' ).pfValue;

  if( props.length > 0 && duration > 0 ){

    let style = {};

    // build up the style to animate towards
    let anyPrev = false;
    for( let i = 0; i < props.length; i++ ){
      let prop = props[ i ];
      let styProp = ele.pstyle( prop );
      let diffProp = diffProps[ prop ];

      if( !diffProp ){ continue; }

      let prevProp = diffProp.prev;
      let fromProp = prevProp;
      let toProp = diffProp.next != null ? diffProp.next : styProp;
      let diff = false;
      let initVal;
      let initDt = 0.000001; // delta time % value for initVal (allows animating out of init zero opacity)

      if( !fromProp ){ continue; }

      // consider px values
      if( is.number( fromProp.pfValue ) && is.number( toProp.pfValue ) ){
        diff = toProp.pfValue - fromProp.pfValue; // nonzero is truthy
        initVal = fromProp.pfValue + initDt * diff;

      // consider numerical values
      } else if( is.number( fromProp.value ) && is.number( toProp.value ) ){
        diff = toProp.value - fromProp.value; // nonzero is truthy
        initVal = fromProp.value + initDt * diff;

      // consider colour values
      } else if( is.array( fromProp.value ) && is.array( toProp.value ) ){
        diff = fromProp.value[0] !== toProp.value[0]
          || fromProp.value[1] !== toProp.value[1]
          || fromProp.value[2] !== toProp.value[2]
        ;

        initVal = fromProp.strValue;
      }

      // the previous value is good for an animation only if it's different
      if( diff ){
        style[ prop ] = toProp.strValue; // to val
        this.applyBypass( ele, prop, initVal ); // from val
        anyPrev = true;
      }

    } // end if props allow ani

    // can't transition if there's nothing previous to transition from
    if( !anyPrev ){ return; }

    _p.transitioning = true;

    ( new Promise(function( resolve ){
      if( delay > 0 ){
        ele.delayAnimation( delay ).play().promise().then( resolve );
      } else {
        resolve();
      }
    }) ).then(function(){
      return ele.animation( {
        style: style,
        duration: duration,
        easing: ele.pstyle( 'transition-timing-function' ).value,
        queue: false
      } ).play().promise();
    }).then(function(){
      // if( !isBypass ){
        self.removeBypasses( ele, props );
        ele.emitAndNotify('style');
      // }

      _p.transitioning = false;
    });

  } else if( _p.transitioning ){
    this.removeBypasses( ele, props );
    ele.emitAndNotify('style');

    _p.transitioning = false;
  }
};

styfn.checkZOrderTrigger = function( ele, name, fromValue, toValue ){
  let prop = this.properties[ name ];

  if( prop.triggersZOrder != null && ( fromValue == null || prop.triggersZOrder( fromValue, toValue ) ) ){
    this._private.cy.notify({
      type: 'zorder',
      eles: ele
    });
  }
};

module.exports = styfn;
