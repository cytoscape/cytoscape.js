'use strict';

var is = require( '../is' );
var util = require( '../util' );

var styfn = {};

// bypasses are applied to an existing style on an element, and just tacked on temporarily
// returns true iff application was successful for at least 1 specified property
styfn.applyBypass = function( eles, name, value, updateTransitions ){
  var self = this;
  var props = [];
  var isBypass = true;

  // put all the properties (can specify one or many) in an array after parsing them
  if( name === '*' || name === '**' ){ // apply to all property names

    if( value !== undefined ){
      for( var i = 0; i < self.properties.length; i++ ){
        var prop = self.properties[ i ];
        var name = prop.name;

        var parsedProp = this.parse( name, value, true );

        if( parsedProp ){
          props.push( parsedProp );
        }
      }
    }

  } else if( is.string( name ) ){ // then parse the single property
    var parsedProp = this.parse( name, value, true );

    if( parsedProp ){
      props.push( parsedProp );
    }
  } else if( is.plainObject( name ) ){ // then parse each property
    var specifiedProps = name;
    updateTransitions = value;

    for( var i = 0; i < self.properties.length; i++ ){
      var prop = self.properties[ i ];
      var name = prop.name;
      var value = specifiedProps[ name ];

      if( value === undefined ){ // try camel case name too
        value = specifiedProps[ util.dash2camel( name ) ];
      }

      if( value !== undefined ){
        var parsedProp = this.parse( name, value, true );

        if( parsedProp ){
          props.push( parsedProp );
        }
      }
    }
  } else { // can't do anything without well defined properties
    return false;
  }

  // we've failed if there are no valid properties
  if( props.length === 0 ){ return false; }

  // now, apply the bypass properties on the elements
  var ret = false; // return true if at least one succesful bypass applied
  for( var i = 0; i < eles.length; i++ ){ // for each ele
    var ele = eles[ i ];
    var diffProps = {};
    var diffProp;

    for( var j = 0; j < props.length; j++ ){ // for each prop
      var prop = props[ j ];

      if( updateTransitions ){
        var prevProp = ele.pstyle( prop.name );
        diffProp = diffProps[ prop.name ] = { prev: prevProp };
      }

      ret = this.applyParsedProperty( ele, prop ) || ret;

      if( updateTransitions ){
        diffProp.next = ele.pstyle( prop.name );
      }

    } // for props

    if( ret ){
      this.updateStyleHints( ele );
    }

    if( updateTransitions ){
      this.updateTransitions( ele, diffProps, isBypass );
    }
  } // for eles

  return ret;
};

// only useful in specific cases like animation
styfn.overrideBypass = function( eles, name, value ){
  name = util.camel2dash( name );

  for( var i = 0; i < eles.length; i++ ){
    var ele = eles[ i ];
    var prop = ele._private.style[ name ];
    var type = this.properties[ name ].type;
    var isColor = type.color;
    var isMulti = type.mutiple;

    if( !prop || !prop.bypass ){ // need a bypass if one doesn't exist
      this.applyBypass( ele, name, value );
      continue;
    }

    prop.value = value;

    if( prop.pfValue != null ){
      prop.pfValue = value;
    }

    if( isColor ){
      prop.strValue = 'rgb(' + value.join( ',' ) + ')';
    } else if( isMulti ){
      prop.strValue = value.join( ' ' );
    } else {
      prop.strValue = '' + value;
    }
  }
};

styfn.removeAllBypasses = function( eles, updateTransitions ){
  return this.removeBypasses( eles, this.propertyNames, updateTransitions );
};

styfn.removeBypasses = function( eles, props, updateTransitions ){
  var isBypass = true;

  for( var j = 0; j < eles.length; j++ ){
    var ele = eles[ j ];
    var diffProps = {};

    for( var i = 0; i < props.length; i++ ){
      var name = props[ i ];
      var prop = this.properties[ name ];
      var prevProp = ele.pstyle( prop.name );

      if( !prevProp || !prevProp.bypass ){
        // if a bypass doesn't exist for the prop, nothing needs to be removed
        continue;
      }

      var value = ''; // empty => remove bypass
      var parsedProp = this.parse( name, value, true );
      var diffProp = diffProps[ prop.name ] = { prev: prevProp };

      this.applyParsedProperty( ele, parsedProp );

      diffProp.next = ele.pstyle( prop.name );
    } // for props

    this.updateStyleHints( ele );

    if( updateTransitions ){
      this.updateTransitions( ele, diffProps, isBypass );
    }
  } // for eles
};

module.exports = styfn;
